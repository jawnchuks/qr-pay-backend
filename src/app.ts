import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import fastifySocketIO from 'fastify-socket.io';
import { env } from './config/env.config.js';
import { errorHandler } from './middleware/error.middleware.js';
import { FastifyRequest, FastifyReply } from 'fastify';
import { SocketService } from './services/SocketService.js';

// Modules
import authRoutes from './modules/auth/auth.controller.js';
import userRoutes from './modules/user/user.controller.js';
import transactionRoutes from './modules/transaction/transaction.controller.js';
import beneficiaryRoutes from './modules/beneficiary/beneficiary.controller.js';
import paymentRoutes from './modules/payment/payment.controller.js';
import cardRoutes from './modules/card/card.controller.js';
import merchantRoutes from './modules/merchant/merchant.controller.js';
import cmsRoutes from './modules/cms/cms.controller.js';
import analyticsRoutes from './modules/analytics/analytics.controller.js';

const createApp = async (): Promise<FastifyInstance> => {
    const fastify = Fastify({ logger: true });

    // Error Handler
    fastify.setErrorHandler(errorHandler);

    // Plugins
    await fastify.register(cors, { origin: '*' });
    await fastify.register(jwt, {
        secret: env.JWT_SECRET,
    });
    await fastify.register(sensible);

    // Socket.io
    await fastify.register(fastifySocketIO as any, {
        cors: {
            origin: '*',
        }
    });

    // Initialize Socket Service
    SocketService.init(fastify);

    // Authentication Decorator
    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Health Check
    fastify.get('/', async () => ({ status: 'ok', message: 'QR Pay Backend API', timestamp: new Date().toISOString() }));
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // Routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
    await fastify.register(beneficiaryRoutes, { prefix: '/api/beneficiaries' });
    await fastify.register(paymentRoutes, { prefix: '/api/payments' });
    await fastify.register(cardRoutes, { prefix: '/api/cards' });
    await fastify.register(merchantRoutes, { prefix: '/api/merchant' });
    await fastify.register(cmsRoutes, { prefix: '/api/cms' });
    await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });

    return fastify;
};

export default createApp;
