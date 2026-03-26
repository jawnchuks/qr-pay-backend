import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { userService } from './user.service.js';
import { ApiResponse } from '../../types/index.js';
import { prisma } from '../../database/prisma.service.js';

import { z } from 'zod';

const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    fastify.get('/profile', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { accountNumber } = request.user;
        const user = await userService.findByAccountNumber(accountNumber);
        return {
            success: true,
            data: user,
        };
    });

    fastify.post('/change-password', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const ChangePasswordSchema = z.object({
            oldPassword: z.string(),
            newPassword: z.string().min(8),
        });
        const { id: userId } = request.user;
        const body = ChangePasswordSchema.parse(request.body);

        try {
            await userService.updatePassword(userId, body.oldPassword, body.newPassword);
            return { success: true, message: 'Password updated successfully' };
        } catch (err: any) {
            reply.status(400);
            return { success: false, message: err.message };
        }
    });

    fastify.post('/change-pin', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const ChangePinSchema = z.object({
            oldPin: z.string().length(4),
            newPin: z.string().length(4),
        });
        const { id: userId } = request.user;
        const body = ChangePinSchema.parse(request.body);

        try {
            await userService.updatePin(userId, body.oldPin, body.newPin);
            return { success: true, message: 'Transaction PIN updated successfully' };
        } catch (err: any) {
            reply.status(400);
            return { success: false, message: err.message };
        }
    });

    fastify.patch('/preferences', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const body = z.any().parse(request.body);

        try {
            await userService.updatePreferences(userId, body);
            return { success: true, message: 'Preferences updated successfully' };
        } catch (err: any) {
            reply.status(400);
            return { success: false, message: err.message };
        }
    });

    fastify.patch('/push-token', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const PushTokenSchema = z.object({ token: z.string() });
        const { id: userId } = request.user;
        const { token } = PushTokenSchema.parse(request.body);

        try {
            await userService.updatePushToken(userId, token);
            return { success: true, message: 'Push token registered successfully' };
        } catch (err: any) {
            reply.status(400);
            return { success: false, message: err.message };
        }
    });

    /**
     * Get Linked Bank Accounts
     */
    fastify.get('/linked-accounts', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const links = await prisma.bankLink.findMany({ where: { user_id: userId } });
        return { success: true, data: links };
    });

    /**
     * Link a New Bank Account
     */
    fastify.post('/linked-accounts', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const LinkAccountSchema = z.object({
            bankName: z.string(),
            accountName: z.string(),
            accountNumber: z.string().length(10),
            bankCode: z.string(),
        });
        const { id: userId } = request.user;
        const body = LinkAccountSchema.parse(request.body);

        const link = await prisma.bankLink.create({
            data: {
                user_id: userId,
                bank_name: body.bankName,
                account_name: body.accountName,
                account_number: body.accountNumber,
                bank_code: body.bankCode,
            }
        });

        return { success: true, message: 'Account linked successfully', data: link };
    });

    /**
     * Delete a Linked Bank Account
     */
    fastify.delete('/linked-accounts/:id', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id } = request.params as { id: string };
        const { id: userId } = request.user;

        await prisma.bankLink.deleteMany({
            where: { id, user_id: userId }
        });

        return { success: true, message: 'Account link removed successfully' };
    });

    fastify.get('/lookup/:accountNumber', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { accountNumber } = request.params as { accountNumber: string };
        const user = await userService.findByAccountNumber(accountNumber);

        if (!user) {
            return {
                success: false,
                message: 'Account not found',
                data: null
            };
        }

        return {
            success: true,
            data: {
                full_name: user.full_name,
                account_number: user.account_number
            },
        };
    });
};

export default userRoutes;
