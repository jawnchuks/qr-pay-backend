import { prisma } from '../database/prisma.service.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;

export class OtpService {
    /**
     * Generate a 6-digit numeric OTP, hash it, store it, and trigger delivery.
     */
    async generateAndSend(userId: string, target: string, targetType: 'email' | 'phone'): Promise<string> {
        // Generate 6-digit numeric OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);
        const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Update user record with OTP state
        await prisma.bankUser.update({
            where: { id: userId },
            data: {
                otpCode: hashedOtp,
                otpExpiry: expiry,
                otpTarget: targetType
            }
        });

        // Trigger Delivery based on targetType
        if (targetType === 'email') {
            console.log(`[OTP Service] DEV MODE: Sending OTP ${otp} via Email to ${target}`);
            // TODO: Integrate Nodemailer or SMTP relay
            // import nodemailer from 'nodemailer';
            // await transporter.sendMail({ ... });
        } else {
            console.log(`[OTP Service] DEV MODE: Sending OTP ${otp} via SMS to ${target}`);
            // TODO: Integrate Twilio, Termii, or Africa's Talking SDK
            // import Twilio from 'twilio';
            // const client = Twilio(sid, token);
            // await client.messages.create({ ... });
        }

        return otp;
    }

    /**
     * Verify the provided OTP code against the user's active hashed OTP code.
     */
    async verify(userId: string, code: string): Promise<boolean> {
        const user = await prisma.bankUser.findUnique({
            where: { id: userId },
            select: {
                otpCode: true,
                otpExpiry: true,
                otpTarget: true,
                email: true,
                phone: true
            }
        });

        if (!user || !user.otpCode || !user.otpExpiry) {
            return false;
        }

        // Check Expiry
        if (new Date() > user.otpExpiry) {
            return false;
        }

        // Verify Hash
        const isMatch = await bcrypt.compare(code, user.otpCode);
        if (!isMatch) {
            return false;
        }

        // Clean up OTP after successful verification to prevent reuse
        const updateData: any = {
            otpCode: null,
            otpExpiry: null,
            otpTarget: null
        };

        if (user.otpTarget === 'email') {
            updateData.isEmailVerified = true;
        } else if (user.otpTarget === 'phone') {
            updateData.isPhoneVerified = true;
        }

        await prisma.bankUser.update({
            where: { id: userId },
            data: updateData
        });

        return true;
    }
}

export const otpService = new OtpService();
