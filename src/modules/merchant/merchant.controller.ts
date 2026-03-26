import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { MerchantService, MerchantRegistrationInput } from './merchant.service.js';
import { ApiResponse } from '../../types/index.js';

const merchantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * Register Merchant
     */
    fastify.post('/register', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const body = request.body as MerchantRegistrationInput;

        const result = await MerchantService.registerMerchant(userId, body);

        return {
            success: true,
            message: 'Merchant registration successful',
            data: result
        };
    });

    /**
     * Get Merchant Profile
     */
    fastify.get('/profile', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;

        const result = await MerchantService.getProfile(userId);

        return {
            success: true,
            data: result
        };
    });

    /**
     * Get Merchant Dashboard
     */
    fastify.get('/dashboard', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;

        const result = await MerchantService.getDashboard(userId);

        return {
            success: true,
            data: result
        };
    });
};

export default merchantRoutes;
