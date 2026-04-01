import { prisma } from '../../database/prisma.service.js';
import { NotFoundException } from '../../exceptions/index.js';
import { UserProfile } from '../../types/index.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class UserService {
    async findByAccountNumber(accountNumber: string): Promise<UserProfile> {
        const user = await prisma.bankUser.findUnique({
            where: { account_number: accountNumber },
            include: {
                sent_transactions: { take: 15, orderBy: { created_at: 'desc' } },
                received_transactions: { take: 15, orderBy: { created_at: 'desc' } },
                offline_channels: { where: { status: 'ACTIVE' } }
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user as unknown as UserProfile;
    }

    async updatePassword(userId: string, oldPass: string, newPass: string) {
        const user = await prisma.bankUser.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const isMatch = await bcrypt.compare(oldPass, user.login_password);
        if (!isMatch) {
            throw new Error('Incorrect current password');
        }

        const hashedNewPassword = await bcrypt.hash(newPass, SALT_ROUNDS);

        return prisma.bankUser.update({
            where: { id: userId },
            data: { login_password: hashedNewPassword }
        });
    }

    async updatePin(userId: string, oldPin: string, newPin: string) {
        const user = await prisma.bankUser.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        if (user.transaction_pin !== oldPin) {
            throw new Error('Incorrect current PIN');
        }

        return prisma.bankUser.update({
            where: { id: userId },
            data: { transaction_pin: newPin }
        });
    }

    async updatePreferences(userId: string, preferences: any) {
        return prisma.bankUser.update({
            where: { id: userId },
            data: { preferences: preferences }
        });
    }

    async updatePushToken(userId: string, token: string) {
        return prisma.bankUser.update({
            where: { id: userId },
            data: { push_token: token }
        });
    }
}

export const userService = new UserService();
