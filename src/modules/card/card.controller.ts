import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CardService } from './card.service.js';
import { ApiResponse } from '../../types/index.js';

const cardRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * Issue Virtual Card
     */
    fastify.post('/issue', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const { cardType } = request.body as { cardType?: string };

        const result = await CardService.issueCard(userId, cardType);

        return {
            success: true,
            message: 'Virtual card issued successfully',
            data: result
        };
    });

    /**
     * List Virtual Cards
     */
    fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;

        const result = await CardService.listCards(userId);

        return {
            success: true,
            data: result
        };
    });

    /**
     * Get Secure Details (Requires biometric challenge on mobile)
     */
    fastify.get('/:id/details', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const { id: cardId } = request.params as { id: string };

        const result = await CardService.getSecureDetails(userId, cardId);

        return {
            success: true,
            data: result
        };
    });

    /**
     * Toggle Freeze Status
     */
    fastify.patch('/:id/toggle-status', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const { id: cardId } = request.params as { id: string };

        const result = await CardService.toggleStatus(userId, cardId);

        return {
            success: true,
            message: `Card ${result.status === 'ACTIVE' ? 'activated' : 'frozen'} successfully`,
            data: result
        };
    });
};

export default cardRoutes;
