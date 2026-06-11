import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authService } from './auth.service.js';
import { LoginSchema } from './auth.schema.js';
import { ApiResponse } from '../../types/index.js';
import { prisma } from '../../database/prisma.service.js';
import { otpService } from '../../services/otp.service.js';
import { z } from 'zod';

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    fastify.post('/login', async (request, reply): Promise<ApiResponse> => {
        const body = LoginSchema.parse(request.body);
        request.log.info({ body }, 'DEBUG: Login attempt received');
        console.log('>>> DEBUG: Login attempt for:', body.accountNumber);
        const user = await authService.validateUser(body);

        const token = fastify.jwt.sign({
            id: user.id,
            accountNumber: user.accountNumber,
            role: 'user',
        });

        return {
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    accountNumber: user.accountNumber,
                    walletBalance: user.walletBalance,
                    registrationStep: user.registrationStep,
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
            
            const nameParts = body.fullName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const user = await prisma.bankUser.create({
                data: {
                    firstName,
                    lastName,
                    full_name: body.fullName,
                    email: body.email,
                    phone: body.phone,
                    passwordHash: hashedPassword,
                    accountNumber: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                    transaction_pin: '1234', // Default, will be updated in provisioning
                    walletBalance: '25000.0', // Signup bonus: 25k Naira
                    registrationStep: 'REGISTERED'
                }
            });

            // Send OTP to email
            const otp = await otpService.generateAndSend(user.id, user.email, 'email');

            request.log.info({ userId: user.id }, 'User registered successfully, OTP sent');

            return {
                success: true,
                message: 'User registered successfully. OTP sent to email.',
                data: {
                    user: {
                        id: user.id,
                        accountNumber: user.accountNumber,
                        registrationStep: user.registrationStep
                    },
                    otp
                }
            };
        } catch (error) {
            request.log.error(error, 'Registration error captured in controller');
            throw error;
        }
    });

    /**
     * OTP Verification
     */
    fastify.post('/verify-otp', async (request, reply): Promise<ApiResponse> => {
        const VerifyOtpSchema = z.object({
            userId: z.string(),
            code: z.string().length(6)
        });

        const body = VerifyOtpSchema.parse(request.body);
        const isValid = await otpService.verify(body.userId, body.code);

        if (!isValid) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Update registration step to ONBOARDED
        const user = await prisma.bankUser.update({
            where: { id: body.userId },
            data: { registrationStep: 'ONBOARDED' }
        });

        // Generate JWT token
        const token = fastify.jwt.sign({
            id: user.id,
            accountNumber: user.accountNumber,
            role: 'user',
        });

        return {
            success: true,
            message: 'OTP verified successfully',
            data: {
                token,
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    accountNumber: user.accountNumber,
                    walletBalance: user.walletBalance,
                    registrationStep: user.registrationStep
                }
            }
        };
    });

    /**
     * Resend OTP
     */
    fastify.post('/resend-otp', async (request, reply): Promise<ApiResponse> => {
        const ResendOtpSchema = z.object({
            userId: z.string()
        });

        const body = ResendOtpSchema.parse(request.body);
        const user = await prisma.bankUser.findUnique({ where: { id: body.userId } });

        if (!user) {
            return reply.status(404).send({
                success: false,
                message: 'User not found'
            });
        }

        const otp = await otpService.generateAndSend(user.id, user.email, 'email');

        return {
            success: true,
            message: 'OTP resent successfully',
            data: {
                otp
            }
        };
    });

    /**
     * Forgot Password
     */
    fastify.post('/forgot-password', async (request, reply): Promise<ApiResponse> => {
        const ForgotPasswordSchema = z.object({
            email: z.string().email()
        });

        const body = ForgotPasswordSchema.parse(request.body);
        const user = await prisma.bankUser.findUnique({ where: { email: body.email } });

        if (!user) {
            return reply.status(404).send({
                success: false,
                message: 'User not found'
            });
        }

        await otpService.generateAndSend(user.id, user.email, 'email');

        return {
            success: true,
            message: 'Password reset OTP sent to email',
            data: { userId: user.id }
        };
    });

    /**
     * Reset Password
     */
    fastify.post('/reset-password', async (request, reply): Promise<ApiResponse> => {
        const ResetPasswordSchema = z.object({
            userId: z.string(),
            code: z.string().length(6),
            newPassword: z.string().min(8)
        });

        const body = ResetPasswordSchema.parse(request.body);
        const isValid = await otpService.verify(body.userId, body.code);

        if (!isValid) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        const hashedPassword = await authService.hashPassword(body.newPassword);
        await prisma.bankUser.update({
            where: { id: body.userId },
            data: { passwordHash: hashedPassword }
        });

        return {
            success: true,
            message: 'Password reset successful'
        };
    });

    /**
     * Refresh Token
     */
    fastify.post('/refresh', async (request, reply): Promise<ApiResponse> => {
        try {
            await request.jwtVerify();
            const { id, accountNumber } = request.user as { id: string; accountNumber: string };
            const token = fastify.jwt.sign({ id, accountNumber, role: 'user' });
            return {
                success: true,
                data: { token }
            };
        } catch (err) {
            return reply.status(401).send({ success: false, message: 'Unauthorized' });
        }
    });

    /**
     * Logout
     */
    fastify.post('/logout', async (request, reply): Promise<ApiResponse> => {
        return {
            success: true,
            message: 'Logged out successfully'
        };
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
