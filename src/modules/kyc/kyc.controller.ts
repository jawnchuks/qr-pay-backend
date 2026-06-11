import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../database/prisma.service.js';
import { z } from 'zod';
import { ApiResponse } from '../../types/index.js';
import { BadRequestException } from '../../exceptions/index.js';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'd6F3EFEaDFEfbcde1234567890123456'; // Must be 32 bytes
const IV_LENGTH = 16;

function encryptBvn(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const SubmitKycSchema = z.object({
    legalFirstName: z.string(),
    legalLastName: z.string(),
    legalMiddleName: z.string().optional(),
    dateOfBirth: z.string(), // ISO String or YYYY-MM-DD
    bvn: z.string().length(11),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string().default('NG'),
});

const VerifyBvnSchema = z.object({
    bvn: z.string().length(11),
});

const LivenessSchema = z.object({
    selfieBase64: z.string(),
});

const kycRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * Submit KYC personal details
     */
    fastify.post('/submit', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user as { id: string };
        const body = SubmitKycSchema.parse(request.body);

        const encryptedBvn = encryptBvn(body.bvn);

        const updatedUser = await prisma.bankUser.update({
            where: { id: userId },
            data: {
                legalFirstName: body.legalFirstName,
                legalLastName: body.legalLastName,
                legalMiddleName: body.legalMiddleName || null,
                dateOfBirth: new Date(body.dateOfBirth),
                bvn: encryptedBvn,
                address: body.address,
                city: body.city,
                state: body.state,
                country: body.country,
                kycSubmittedAt: new Date(),
                registrationStep: 'KYC_SUBMITTED',
                kyc_status: 'PENDING'
            }
        });

        return {
            success: true,
            message: 'KYC personal info submitted successfully',
            data: {
                registrationStep: updatedUser.registrationStep,
                kycStatus: updatedUser.kyc_status
            }
        };
    });

    /**
     * Verify BVN (Third-party integration stub)
     */
    fastify.post('/verify-bvn', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user as { id: string };
        const { bvn } = VerifyBvnSchema.parse(request.body);

        // Smile ID / NIBSS API Call Stub
        console.log(`[BVN VERIFICATION STUB] Verifying BVN ${bvn} for user ${userId}`);

        const updatedUser = await prisma.bankUser.update({
            where: { id: userId },
            data: {
                bvnVerified: true
            }
        });

        // Determine if they can advance step
        let nextStep = updatedUser.registrationStep;
        if (updatedUser.bvnVerified && updatedUser.livenessCheckPassed) {
            nextStep = 'ACTIVE';
            await prisma.bankUser.update({
                where: { id: userId },
                data: { registrationStep: 'ACTIVE', kyc_status: 'VERIFIED', kycVerifiedAt: new Date() }
            });
        }

        return {
            success: true,
            message: 'BVN verified successfully',
            data: {
                bvnVerified: true,
                registrationStep: nextStep === 'ACTIVE' ? 'ACTIVE' : updatedUser.registrationStep
            }
        };
    });

    /**
     * Perform selfie liveness check (Third-party integration stub)
     */
    fastify.post('/liveness', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user as { id: string };
        const { selfieBase64 } = LivenessSchema.parse(request.body);

        console.log(`[LIVENESS VERIFICATION STUB] Processing selfie liveness for user ${userId} (Selfie length: ${selfieBase64.length} chars)`);

        const updatedUser = await prisma.bankUser.update({
            where: { id: userId },
            data: {
                livenessCheckPassed: true,
                livenessImageUrl: 'https://cdn.qr-pay.com/selfies/mock-selfie.jpg'
            }
        });

        // Determine if they can advance step
        let nextStep = updatedUser.registrationStep;
        if (updatedUser.bvnVerified && updatedUser.livenessCheckPassed) {
            nextStep = 'ACTIVE';
            await prisma.bankUser.update({
                where: { id: userId },
                data: { registrationStep: 'ACTIVE', kyc_status: 'VERIFIED', kycVerifiedAt: new Date() }
            });
        }

        return {
            success: true,
            message: 'Selfie liveness check completed successfully',
            data: {
                livenessCheckPassed: true,
                registrationStep: nextStep === 'ACTIVE' ? 'ACTIVE' : updatedUser.registrationStep
            }
        };
    });

    /**
     * Get KYC Status
     */
    fastify.get('/status', { onRequest: [fastify.authenticate] }, async (request, reply): Promise<ApiResponse> => {
        const { id: userId } = request.user as { id: string };

        const user = await prisma.bankUser.findUnique({
            where: { id: userId },
            select: {
                registrationStep: true,
                bvnVerified: true,
                livenessCheckPassed: true,
                kyc_status: true,
                kycRejectionReason: true,
            }
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        return {
            success: true,
            data: {
                registrationStep: user.registrationStep,
                bvnVerified: user.bvnVerified,
                livenessCheckPassed: user.livenessCheckPassed,
                kycStatus: user.kyc_status,
                rejectionReason: user.kycRejectionReason
            }
        };
    });
};

export default kycRoutes;
