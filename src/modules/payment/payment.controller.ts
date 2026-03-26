import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma.service.js';
import { ValidateCustomerSchema, ProcessBillSchema } from './payment.schema.js';
import { ApiResponse } from '../../types/index.js';
import crypto from 'crypto';
import { transactionService } from '../transaction/transaction.service.js';
import { z } from 'zod';

const paymentRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * Get Providers by Category
     */
    fastify.get('/providers/:category', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { category } = request.params as { category: string };

        const providers: Record<string, any[]> = {
            'Airtime': [
                { id: 'MTN-NG', name: 'MTN', color: '#fbbf24' },
                { id: 'AIRTEL-NG', name: 'Airtel', color: '#ef4444' },
                { id: 'GLO-NG', name: 'Glo', color: '#16a34a' },
                { id: '9MOB-NG', name: '9mobile', color: '#4ade80' }
            ],
            'Data': [
                { id: 'MTN-NG', name: 'MTN', color: '#fbbf24' },
                { id: 'AIRTEL-NG', name: 'Airtel', color: '#ef4444' },
                { id: 'GLO-NG', name: 'Glo', color: '#16a34a' },
                { id: '9MOB-NG', name: '9mobile', color: '#4ade80' }
            ],
            'CableTV': [
                { id: 'DSTV', name: 'DSTV' },
                { id: 'GOTV', name: 'GOTV' },
                { id: 'STARTIMES', name: 'StarTimes' }
            ],
            'Electricity': [
                { id: 'IKEDC', name: 'Ikeja Electric' },
                { id: 'EKEDC', name: 'Eko Electric' },
                { id: 'AEDC', name: 'Abuja Electric' },
                { id: 'PHED', name: 'Port Harcourt Electric' }
            ],
            'Water': [
                { id: 'LWC', name: 'Lagos Water Corp' },
                { id: 'FCT-WATER', name: 'FCT Water Board' }
            ],
            'Education': [
                { id: 'JAMB', name: 'JAMB' },
                { id: 'WAEC', name: 'WAEC' },
                { id: 'UNITAB', name: 'University Tution' }
            ],
            'Transport': [
                { id: 'LCC', name: 'Lekki Toll (LCC)' },
                { id: 'COWRY', name: 'Cowry Card' },
                { id: 'UBER-NG', name: 'Uber Voucher' }
            ],
            'Tax & Gov': [
                { id: 'FIRS', name: 'FIRS Tax' },
                { id: 'LIRS', name: 'LIRS Tax' },
                { id: 'LASG-LEVIES', name: 'LASG Levies' }
            ]
        };

        return {
            success: true,
            data: providers[category] || []
        };
    });

    /**
     * Get Plans for a Provider
     */
    fastify.get('/plans/:category/:provider', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { category, provider } = request.params as { category: string, provider: string };

        const plans: Record<string, any[]> = {
            'MTN-NG': [
                { id: 'MTN-1GB-1D', name: '1GB / 24hrs', price: 350 },
                { id: 'MTN-2GB-2D', name: '2.5GB / 2 Days', price: 600 },
                { id: 'MTN-5GB-7D', name: '5GB / 7 Days', price: 1600 }
            ],
            'AIRTEL-NG': [
                { id: 'AIRTEL-1GB-1D', name: '1GB / 24hrs', price: 300 },
                { id: 'AIRTEL-2GB-2D', name: '2GB / 2 Days', price: 550 }
            ]
        };

        // Fallback for demo
        const result = plans[provider] || [
            { id: `${provider}-BASIC`, name: 'Standard Bundle', price: 500 },
            { id: `${provider}-PREMIUM`, name: 'Premium Bundle', price: 2000 }
        ];

        return {
            success: true,
            data: category === 'Airtime' ? [] : result
        };
    });

    /**
     * Validate Customer ID
     */
    fastify.post('/validate', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const body = ValidateCustomerSchema.parse(request.body);

        // Mock validation for demo
        return {
            success: true,
            data: {
                name: `Validated Customer (${body.provider})`,
                customerId: body.customerId
            }
        };
    });

    /**
     * Process Bill Payment
     */
    fastify.post('/process', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user;
        const body = ProcessBillSchema.parse(request.body);

        try {
            const result = await transactionService.payBill(
                userId,
                body.amount,
                body.category,
                body.provider,
                body.pin
            );

            return {
                success: true,
                message: result.message,
                data: {
                    reference: result.reference,
                    status: 'COMPLETED',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (err: any) {
            reply.status(err.statusCode || 400);
            return {
                success: false,
                message: err.message || 'Payment failed'
            };
        }
    });
};

export default paymentRoutes;
