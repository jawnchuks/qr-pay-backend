import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.service.js';
import { BadRequestException, NotFoundException, ForbiddenException } from '../../exceptions/index.js';

export interface TransferInput {
    senderAccountNumber: string;
    receiverAccountNumber: string;
    amount: number;
    pin: string;
    category?: string;
    description?: string;
}

export class TransactionService {
    /**
     * Internal Transfer (Main Balance to Main Balance)
     */
    async transfer(input: TransferInput) {
        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Verify Sender & PIN
            const sender = await tx.bankUser.findUnique({ where: { account_number: input.senderAccountNumber } });
            if (!sender) throw new BadRequestException('Sender not found');
            if (sender.transaction_pin !== input.pin) throw new ForbiddenException('Invalid transaction PIN');
            if (sender.balance.toNumber() < input.amount) throw new BadRequestException('Insufficient balance');

            // 2. Verify Receiver
            const receiver = await tx.bankUser.findUnique({ where: { account_number: input.receiverAccountNumber } });
            if (!receiver) throw new BadRequestException('Receiver not found');

            // 3. Update Balances
            await tx.bankUser.update({
                where: { id: sender.id },
                data: { balance: { decrement: input.amount } },
            });

            await tx.bankUser.update({
                where: { id: receiver.id },
                data: { balance: { increment: input.amount } },
            });

            // 4. Create Transaction Record
            const reference = `TXN-${Date.now().toString(36).toUpperCase()}`;
            const transaction = await tx.transaction.create({
                data: {
                    sender_id: sender.id,
                    receiver_id: receiver.id,
                    sender_account: input.senderAccountNumber,
                    receiver_account: input.receiverAccountNumber,
                    amount: input.amount,
                    transaction_type: 'transfer',
                    category: input.category || 'transfer',
                    status: 'completed',
                    description: input.description || 'Bank Transfer',
                    reference,
                },
            });

            // 5. Notify Receiver via WebSocket
            this.notifyUser(receiver.id, 'payment_received', {
                amount: input.amount,
                sender: sender.full_name,
                reference,
                timestamp: transaction.created_at
            });

            return { success: true, reference, message: 'Transfer successful' };
        });
    }

    /**
     * Allocate Funds to Offline Channel (State Channel Opening)
     * Hardened with PIN verification and 100k NGN total limit.
     */
    async allocateFunds(userId: string, amount: number, pin: string) {
        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.bankUser.findUnique({ 
                where: { id: userId },
                include: { offline_channels: { where: { status: 'ACTIVE' } } }
            });
            
            if (!user) throw new BadRequestException('User not found');
            if (user.transaction_pin !== pin) throw new ForbiddenException('Invalid transaction PIN');
            if (user.balance.toNumber() < amount) throw new BadRequestException('Insufficient funds for allocation');

            // 1. Enforce 100k NGN Limit across all active offline funds
            const currentOfflineTotal = user.offline_channels.reduce((sum, ch) => sum + ch.remaining_balance.toNumber(), 0);
            if (currentOfflineTotal + amount > 100000) {
                throw new BadRequestException(`Offline limit exceeded. Maximum allowed: ₦100,000. Current offline: ₦${currentOfflineTotal.toLocaleString()}`);
            }

            // 2. Debit User Balance
            await tx.bankUser.update({
                where: { id: userId },
                data: { balance: { decrement: amount } }
            });

            // 3. Create Transaction for History
            const reference = `ALLOC-${Date.now().toString(36).toUpperCase()}`;
            await tx.transaction.create({
                data: {
                    sender_id: userId,
                    sender_account: user.account_number,
                    amount,
                    transaction_type: 'offline_allocation',
                    category: 'offline',
                    status: 'completed',
                    description: 'Offline Wallet Allocation',
                    reference,
                }
            });

            // 4. Update or Create Offline Channel
            // We'll top up the first active channel if it exists, otherwise create a new one.
            const existingChannel = user.offline_channels[0];
            
            if (existingChannel) {
                const updatedChannel = await tx.offlineChannel.update({
                    where: { id: existingChannel.id },
                    data: {
                        allocated_amount: { increment: amount },
                        remaining_balance: { increment: amount },
                        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Reset expiry
                    }
                });
                return { ...updatedChannel, reference, is_topup: true };
            } else {
                const channelId = `CH-${Math.random().toString(36).substr(2, 9)}`;
                const channel = await tx.offlineChannel.create({
                    data: {
                        channel_id: channelId,
                        user_id: userId,
                        allocated_amount: amount,
                        remaining_balance: amount,
                        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    }
                });
                return { ...channel, reference, is_topup: false };
            }
        });
    }

    /**
     * Pay Bill (Deduct Balance & Record)
     */
    async payBill(userId: string, amount: number, category: string, provider: string, pin: string) {
        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.bankUser.findUnique({ where: { id: userId } });
            if (!user) throw new BadRequestException('User not found');
            if (user.transaction_pin !== pin) throw new ForbiddenException('Invalid transaction PIN');
            if (user.balance.toNumber() < amount) throw new BadRequestException('Insufficient balance');

            // 1. Debit User Balance
            await tx.bankUser.update({
                where: { id: userId },
                data: { balance: { decrement: amount } }
            });

            // 2. Create Transaction Record
            const reference = `BILL-${Date.now().toString(36).toUpperCase()}`;
            await tx.transaction.create({
                data: {
                    sender_id: userId,
                    sender_account: user.account_number,
                    amount,
                    transaction_type: 'bill_payment',
                    category,
                    status: 'completed',
                    description: `${category} payment to ${provider}`,
                    reference,
                }
            });

            return { success: true, reference, message: 'Payment successful' };
        });
    }

    private notifyUser(userId: string, event: string, data: any) {
        import('../../services/SocketService.js').then(({ SocketService }) => {
            SocketService.emitToUser(userId, event, data);
        }).catch(err => console.error('Socket notification failed:', err));
    }
}

export const transactionService = new TransactionService();
