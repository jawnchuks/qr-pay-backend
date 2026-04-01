import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { transactionService } from './transaction.service.js';
import { ReconciliationService } from '../../services/ReconciliationService.js';
import { z } from 'zod';
import { ApiResponse } from '../../types/index.js';
import { prisma } from '../../database/prisma.service.js';
import { BadRequestException } from '../../exceptions/index.js';
import type { Prisma } from '@prisma/client';

const transactionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    const TransferSchema = z.object({
        receiverAccountNumber: z.string(),
        amount: z.number().positive(),
        pin: z.string().length(4),
        category: z.string().optional(),
        description: z.string().optional(),
    });

    fastify.post('/transfer', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { accountNumber: senderAccountNumber } = request.user as { accountNumber: string };
        const body = TransferSchema.parse(request.body);

        const result = await transactionService.transfer({
            ...body,
            senderAccountNumber,
        });

        return {
            success: true,
            message: 'Transfer successful',
            data: result,
        };
    });

    /**
     * Allocate Offline Funds (Open State Channel)
     */
    /**
     * Allocate Offline Funds (Open State Channel)
     */
    fastify.post('/allocate', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user as { id: string };
        const { amount } = request.body as { amount: number };

        if (!amount || amount <= 0) throw new BadRequestException('Invalid amount');

        try {
            const result = await transactionService.allocateFunds(userId, amount);
            return {
                success: true,
                message: 'Funds allocated successfully',
                data: result
            };
        } catch (err: any) {
            return {
                success: false,
                message: err.message,
                data: null
            };
        }
    });

    /**
     * Sync Offline Transactions (Batch Reconciliation)
     */
    fastify.post('/sync-offline', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { transactions } = request.body as { transactions: any[] };

        try {
            const result = await ReconciliationService.reconcileBatch(transactions);
            return {
                success: true,
                message: 'Offline transactions reconciled',
                data: result
            };
        } catch (err: any) {
            return {
                success: false,
                message: err.message,
                data: null
            };
        }
    });

    /**
     * Generate PDF Receipt
     */
    fastify.get('/:id/pdf', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { id: userId } = request.user;
        const { jsPDF } = await import('jspdf');

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { sender: true, receiver: true }
        });

        if (!transaction) throw (fastify as any).httpErrors.notFound('Transaction not found');
        if (transaction.sender_id !== userId && transaction.receiver_id !== userId) {
            throw (fastify as any).httpErrors.unauthorized('Access denied');
        }

        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(67, 56, 202); // Indigo 700
        doc.text('QR PAY RECEIPT', 105, 30, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(156, 163, 175);
        doc.text('Authorized Electronic Banking Transaction', 105, 38, { align: 'center' });

        // Divider
        doc.setDrawColor(229, 231, 235);
        doc.line(20, 45, 190, 45);

        // Details
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);

        let y = 60;
        const addRow = (label: string, value: string) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, 20, y);
            doc.setFont('helvetica', 'normal');
            doc.text(value, 80, y);
            y += 12;
        };

        const formatCurrency = (amt: number) => `NGN ${new Intl.NumberFormat('en-NG').format(amt)}`;

        addRow('Transaction ID', transaction.id);
        addRow('Reference', transaction.reference);
        addRow('Date', transaction.created_at.toLocaleString());
        addRow('Type', transaction.transaction_type.toUpperCase());
        addRow('Amount', formatCurrency(transaction.amount.toNumber()));
        addRow('Status', transaction.status);
        addRow('Description', transaction.description || 'N/A');

        y += 5;
        doc.line(20, y, 190, y);
        y += 15;

        addRow('Sender', transaction.sender?.full_name || 'N/A');
        addRow('Sender Account', transaction.sender?.account_number || 'N/A');
        addRow('Recipient', transaction.receiver?.full_name || 'System / Bill Payment');

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(156, 163, 175);
        doc.text('This matches our internal records and serves as official proof of payment.', 105, 270, { align: 'center' });
        doc.text('QR Pay - Secure, Instant, Enterprise Grade.', 105, 275, { align: 'center' });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="receipt-${transaction.reference}.pdf"`)
            .send(pdfBuffer);
    });

    /**
     * Get Paginated Transactions
     */
    fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const {
            page = '1',
            limit = '20',
            type,
            status,
            startDate,
            endDate
        } = request.query as any;

        const p = parseInt(page);
        const l = parseInt(limit);

        const where: Prisma.TransactionWhereInput = {
            OR: [
                { sender_id: userId },
                { receiver_id: userId }
            ]
        };

        if (type) where.transaction_type = type;
        if (status) where.status = status;
        if (startDate || endDate) {
            where.created_at = {
                gte: startDate ? new Date(startDate) : undefined,
                lte: endDate ? new Date(endDate) : undefined
            };
        }

        const [total, transactions] = await Promise.all([
            prisma.transaction.count({ where }),
            prisma.transaction.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (p - 1) * l,
                take: l,
                include: {
                    sender: { select: { full_name: true, account_number: true } },
                    receiver: { select: { full_name: true, account_number: true } }
                }
            })
        ]);

        return {
            success: true,
            data: {
                transactions,
                pagination: {
                    total,
                    page: p,
                    limit: l,
                    totalPages: Math.ceil(total / l)
                }
            }
        };
    });

    /**
     * Close Offline Channel
     */
    fastify.post('/close-channel', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { channelId, transactions, amount } = request.body as { channelId: string; transactions?: any[]; amount?: number };

        if (!channelId) throw new Error('Channel ID is required');

        try {
            const result = await ReconciliationService.closeChannel(channelId, transactions, amount);
            return {
                success: true,
                message: 'Channel closed and funds released',
                data: result
            };
        } catch (err: any) {
            return {
                success: false,
                message: err.message,
                data: null
            };
        }
    });
};

export default transactionRoutes;
