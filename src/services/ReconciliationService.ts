import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { CryptoService } from '../common/CryptoService.js';

const prisma = new PrismaClient();

export interface OfflineTransactionInput {
    channel_id: string;
    tx_id: string;
    from_user: string;
    to_user: string;
    amount: number;
    timestamp: number;
    time_counter: number;
    otp: string;
    nonce: string;
    tx_seq: number;
    category?: string;
    prev_hash: string;
    current_hash: string;
    digital_signature: string;
}

export class ReconciliationService {
    /**
     * Process a batch of offline transactions
     * Implements the core State-Channel Settlement Engine
     */
    static async reconcileBatch(batch: OfflineTransactionInput[]) {
        if (batch.length === 0) return { status: 'EMPTY_BATCH' };

        // 1. Sort by sequence to ensure linear verification
        const sortedTxs = [...batch].sort((a, b) => a.tx_seq - b.tx_seq);
        const channelId = sortedTxs[0].channel_id;

        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 2. Fetch Channel State
            const channel = await tx.offlineChannel.findUnique({
                where: { channel_id: channelId },
                include: { user: true }
            });

            if (!channel) throw new Error('Channel not found');
            if (channel.status !== 'ACTIVE') throw new Error('Channel is not ACTIVE');
            if (new Date() > channel.expiry_date) throw new Error('Channel has expired');

            let currentHash = channel.last_hash;
            let currentSeq = channel.channel_seq;
            let totalAmount = 0;

            const verifiedTxs = [];
            const quarantinedTxs = [];

            // 3. Sequential Validation
            let isChainBroken = false;
            let chainBreakReason = '';

            for (const txData of sortedTxs) {
                if (isChainBroken) {
                    quarantinedTxs.push({
                        ...txData,
                        reason: `Preceding transaction failed: ${chainBreakReason}`
                    });
                    continue;
                }

                try {
                    // A. Nonce Uniqueness (Replay Protection)
                    const nonceUsed = await tx.usedNonce.findUnique({ where: { nonce: txData.nonce } });
                    if (nonceUsed) throw new Error(`Replay detected: Nonce ${txData.nonce} already used`);

                    // B. Sequence Check
                    if (txData.tx_seq !== currentSeq + 1) {
                        throw new Error(`Sequence break: Expected ${currentSeq + 1}, got ${txData.tx_seq}`);
                    }

                    // C. Hash Chain Integrity
                    const payloadStr = JSON.stringify({
                        channel_id: txData.channel_id,
                        tx_id: txData.tx_id,
                        from_user: txData.from_user,
                        to_user: txData.to_user,
                        amount: txData.amount,
                        timestamp: txData.timestamp,
                        time_counter: txData.time_counter,
                        otp: txData.otp,
                        nonce: txData.nonce,
                        tx_seq: txData.tx_seq,
                        category: txData.category,
                        prev_hash: txData.prev_hash
                    });

                    if (!CryptoService.verifyHashChain(currentHash, payloadStr, txData.current_hash)) {
                        throw new Error(`Hash chain broken at seq ${txData.tx_seq}`);
                    }

                    // D. Cryptographic Verification (TOTP + ECDSA)
                    if (!channel.user.device_secret || !channel.user.public_key) {
                        throw new Error('User security hardware not provisioned');
                    }

                    const isTOTPValid = CryptoService.verifyTOTP(txData.otp, channel.user.device_secret);
                    if (!isTOTPValid) throw new Error(`Invalid or expired TOTP at seq ${txData.tx_seq}`);

                    const isSigValid = CryptoService.verifySignature(payloadStr, txData.digital_signature, channel.user.public_key);
                    if (!isSigValid) throw new Error(`Invalid digital signature at seq ${txData.tx_seq}`);

                    // E. Balance Check against Allocation
                    if (totalAmount + txData.amount > channel.allocated_amount.toNumber()) {
                        throw new Error('Exceeds channel allocation');
                    }

                    // F. Mark Nonce as Used
                    await tx.usedNonce.create({ data: { nonce: txData.nonce } });

                    // Update local loop state
                    currentHash = txData.current_hash;
                    currentSeq = txData.tx_seq;
                    totalAmount += txData.amount;

                    verifiedTxs.push(txData);
                } catch (err: any) {
                    isChainBroken = true;
                    chainBreakReason = err.message;
                    quarantinedTxs.push({
                        ...txData,
                        reason: err.message
                    });
                }
            }

            // 4. Final Settlement: Update Channel State
            if (verifiedTxs.length > 0) {
                await tx.offlineChannel.update({
                    where: { channel_id: channelId },
                    data: {
                        remaining_balance: channel.allocated_amount.toNumber() - totalAmount,
                        channel_seq: currentSeq,
                        last_hash: currentHash
                    }
                });

                // 5. Credit the receivers & Record Transactions for verified ones
                for (const txData of verifiedTxs) {
                    const receiver = await tx.bankUser.findUnique({
                        where: { accountNumber: txData.to_user }
                    });

                    if (receiver) {
                        await tx.bankUser.update({
                            where: { id: receiver.id },
                            data: { walletBalance: { increment: txData.amount } }
                        });

                        // Create a transaction record for history
                        await tx.transaction.create({
                            data: {
                                id: txData.tx_id,
                                sender_id: channel.user_id,
                                sender_account: channel.user.accountNumber,
                                receiver_id: receiver.id,
                                receiver_account: receiver.accountNumber,
                                amount: txData.amount,
                                description: `Offline Payment from ${channel.user.full_name} to ${receiver.full_name}`,
                                category: txData.category || 'transfer',
                                status: 'COMPLETED',
                                transaction_type: 'transfer',
                                reference: txData.tx_id,
                                is_offline: true
                            }
                        });

                        // Create OfflineTransaction record
                        await tx.offlineTransaction.create({
                            data: {
                                tx_id: txData.tx_id,
                                channel_id: txData.channel_id,
                                from_user: txData.from_user,
                                to_user: txData.to_user,
                                amount: txData.amount,
                                timestamp: new Date(txData.timestamp),
                                time_counter: txData.time_counter,
                                otp: txData.otp,
                                nonce: txData.nonce,
                                tx_seq: txData.tx_seq,
                                prev_hash: txData.prev_hash,
                                current_hash: txData.current_hash,
                                digital_signature: txData.digital_signature,
                                status: 'SUCCESS'
                            }
                        });
                    }
                }
            }

            // 6. Record Quarantined Transactions
            for (const txData of quarantinedTxs) {
                await tx.offlineTransaction.create({
                    data: {
                        tx_id: txData.tx_id,
                        channel_id: txData.channel_id,
                        from_user: txData.from_user,
                        to_user: txData.to_user,
                        amount: txData.amount,
                        timestamp: new Date(txData.timestamp),
                        time_counter: txData.time_counter,
                        otp: txData.otp,
                        nonce: txData.nonce,
                        tx_seq: txData.tx_seq,
                        prev_hash: txData.prev_hash,
                        current_hash: txData.current_hash,
                        digital_signature: txData.digital_signature,
                        status: 'QUARANTINED',
                        rejection_reason: txData.reason
                    }
                });
            }

            // 7. Log the result
            const logStatus = quarantinedTxs.length > 0
                ? (verifiedTxs.length > 0 ? 'PARTIAL_SUCCESS' : 'FAILED')
                : 'SUCCESS';

            await tx.reconciliationLog.create({
                data: {
                    channel_id: channelId,
                    batch_size: sortedTxs.length,
                    status: logStatus,
                    audit_hash: CryptoService.generateBatchHash(sortedTxs),
                    rejection_reason: logStatus !== 'SUCCESS' ? chainBreakReason : null
                }
            });

            // 8. Fetch Final State for Synchronization
            const finalUser = await tx.bankUser.findUnique({ where: { id: channel.user_id } });

            return {
                status: logStatus,
                processed: verifiedTxs.length,
                quarantined: quarantinedTxs.length,
                totalAmount,
                balance: finalUser?.walletBalance.toNumber() || 0,
            };
        });
    }

    /**
     * Close an offline state channel or partially release funds
     */
    static async closeChannel(channelId: string, batch?: OfflineTransactionInput[], reclaimAmount?: number, pin?: string) {
        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. If a final batch is provided, reconcile it first
            if (batch && batch.length > 0) {
                await ReconciliationService.reconcileBatch(batch);
            }

            // 2. Fetch Channel State
            const channel = await tx.offlineChannel.findUnique({
                where: { channel_id: channelId },
                include: { user: true }
            });

            if (!channel) throw new Error('Channel not found');
            if (pin && channel.user.transaction_pin !== pin) throw new Error('Invalid transaction PIN');
            if (channel.status !== 'ACTIVE') throw new Error('Channel is already CLOSED or EXPIRED');

            const remainingFunds = channel.remaining_balance.toNumber();
            const amountToReclaim = reclaimAmount !== undefined ? reclaimAmount : remainingFunds;

            if (amountToReclaim > remainingFunds) {
                throw new Error(`Insufficient funds: Requested ₦${amountToReclaim}, Available ₦${remainingFunds}`);
            }

            // 3. Determine if this is a partial release or a full closure
            const isFullClosure = reclaimAmount === undefined || amountToReclaim >= remainingFunds;

            if (isFullClosure) {
                await tx.offlineChannel.update({
                    where: { channel_id: channelId },
                    data: { 
                        status: 'CLOSED',
                        remaining_balance: 0
                    }
                });
            } else {
                await tx.offlineChannel.update({
                    where: { channel_id: channelId },
                    data: {
                        remaining_balance: { decrement: amountToReclaim },
                        allocated_amount: { decrement: amountToReclaim }
                    }
                });
            }

            // 4. Release funds back to Main Balance
            await tx.bankUser.update({
                where: { id: channel.user_id },
                data: { walletBalance: { increment: amountToReclaim } }
            });

            // 5. CREATE TRANSACTION RECORD
            await tx.transaction.create({
                data: {
                    sender_id: channel.user_id,
                    sender_account: channel.user.accountNumber,
                    amount: amountToReclaim,
                    transaction_type: 'offline_reclaim',
                    category: 'offline',
                    status: 'completed',
                    description: isFullClosure ? 'Restore Full Offline Balance' : 'Partial Balance Restoration',
                    reference: `RECL-${Date.now().toString(36).toUpperCase()}`,
                }
            });

            const finalUser = await tx.bankUser.findUnique({ where: { id: channel.user_id } });

            return {
                status: isFullClosure ? 'CLOSED' : 'ACTIVE',
                releasedAmount: amountToReclaim,
                remainingBalance: isFullClosure ? 0 : remainingFunds - amountToReclaim,
                finalBalance: finalUser?.walletBalance.toNumber() || 0
            };
        });
    }
}
