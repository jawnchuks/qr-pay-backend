import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authService } from './auth.service.js';
import { LoginSchema } from './auth.schema.js';
import { ApiResponse } from '../../types/index.js';
import { prisma } from '../../database/prisma.service.js';
import { z } from 'zod';

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    fastify.post('/login', async (request, reply): Promise<ApiResponse> => {
        const body = LoginSchema.parse(request.body);
        request.log.info({ body }, 'DEBUG: Login attempt received');
        console.log('>>> DEBUG: Login attempt for:', body.accountNumber);
        const user = await authService.validateUser(body);

        const token = fastify.jwt.sign({
            id: user.id,
            accountNumber: user.account_number,
            role: 'user',
        });

        return {
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    account_number: user.account_number,
                    balance: user.balance,
                },
            },
        };
    });

    /**
     * User Registration (Public)
     */
    fastify.post('/register', async (request, reply): Promise<ApiResponse> => {
        const RegistrationSchema = z.object({
            fullName: z.string(),
            email: z.string().email(),
            phone: z.string(),
            password: z.string().min(8),
        });

        try {
            const body = RegistrationSchema.parse(request.body);
            request.log.info({ email: body.email }, 'Processing user registration');

            // Proactive check for existing user
            const existingUser = await prisma.bankUser.findUnique({
                where: { email: body.email }
            });

            if (existingUser) {
                return reply.status(409).send({
                    success: false,
                    message: 'A user with this email already exists.',
                    statusCode: 409
                });
            }

            const hashedPassword = await authService.hashPassword(body.password);

            const user = await prisma.bankUser.create({
                data: {
                    full_name: body.fullName,
                    email: body.email,
                    phone: body.phone,
                    login_password: hashedPassword,
                    account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                    transaction_pin: '1234', // Default, will be updated in provisioning
                    balance: '25000000.0', // Promotional signup bonus: 25 Million Naira
                }
            });

            request.log.info({ userId: user.id }, 'User registered successfully');

            return {
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.id,
                        account_number: user.account_number,
                    }
                }
            };
        } catch (error) {
            request.log.error(error, 'Registration error captured in controller');
            throw error; // Re-throw to be caught by global handler
        }
    });

    /**
     * Device Security Provisioning (Authenticated)
     */
    fastify.post('/provision', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const ProvisionSchema = z.object({
            publicKey: z.string(),
            deviceSecret: z.string(),
            transactionPin: z.string().length(4),
        });

        const { id: userId } = request.user;
        const body = ProvisionSchema.parse(request.body);

        await prisma.bankUser.update({
            where: { id: userId },
            data: {
                public_key: body.publicKey,
                device_secret: body.deviceSecret,
                transaction_pin: body.transactionPin,
            }
        });

        return {
            success: true,
            message: 'Security hardware provisioned successfully',
            data: null
        };
    });
};

export default authRoutes;
