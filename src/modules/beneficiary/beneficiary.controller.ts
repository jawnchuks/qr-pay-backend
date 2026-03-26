import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma.service.js';
import { CreateBeneficiarySchema, ToggleFavoriteSchema } from './beneficiary.schema.js';
import { ApiResponse } from '../../types/index.js';

const beneficiaryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * List Beneficiaries
     */
    fastify.get('/', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;

        const beneficiaries = await prisma.beneficiary.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        return {
            success: true,
            data: beneficiaries
        };
    });

    /**
     * Add Beneficiary
     */
    fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const body = CreateBeneficiarySchema.parse(request.body);

        const beneficiary = await prisma.beneficiary.create({
            data: {
                user_id: userId,
                name: body.name,
                account_number: body.accountNumber,
                bank_name: body.bankName,
                is_favorite: body.isFavorite
            }
        });

        return {
            success: true,
            message: 'Beneficiary added successfully',
            data: beneficiary
        };
    });

    /**
     * Toggle Favorite
     */
    fastify.patch('/:id/favorite', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: beneficiaryId } = request.params as { id: string };
        const { id: userId } = request.user;
        const body = ToggleFavoriteSchema.parse(request.body);

        const beneficiary = await prisma.beneficiary.update({
            where: {
                id: beneficiaryId,
                user_id: userId
            },
            data: { is_favorite: body.isFavorite }
        });

        return {
            success: true,
            message: `Beneficiary ${body.isFavorite ? 'favorited' : 'unfavorited'}`,
            data: beneficiary
        };
    });

    /**
     * Delete Beneficiary
     */
    fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: beneficiaryId } = request.params as { id: string };
        const { id: userId } = request.user;

        await prisma.beneficiary.delete({
            where: {
                id: beneficiaryId,
                user_id: userId
            }
        });

        return {
            success: true,
            message: 'Beneficiary removed successfully',
            data: null
        };
    });
};

export default beneficiaryRoutes;
