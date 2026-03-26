import { prisma } from '../../database/prisma.service.js';

export interface MerchantRegistrationInput {
    businessName: string;
    category: string;
    website?: string;
}

export class MerchantService {
    /**
     * Register a user as a merchant
     */
    static async registerMerchant(userId: string, data: MerchantRegistrationInput) {
        return await prisma.$transaction(async (tx) => {
            // Update user role
            await tx.bankUser.update({
                where: { id: userId },
                data: { role: 'MERCHANT' }
            });

            // Create merchant profile
            return await tx.merchantProfile.create({
                data: {
                    user_id: userId,
                    business_name: data.businessName,
                    category: data.category,
                    website: data.website
                }
            });
        });
    }

    /**
     * Get merchant profile
     */
    static async getProfile(userId: string) {
        return await prisma.merchantProfile.findUnique({
            where: { user_id: userId }
        });
    }

    /**
     * Get Merchant Dashboard Data (Basic)
     */
    static async getDashboard(userId: string) {
        const user = await prisma.bankUser.findUnique({
            where: { id: userId },
            include: {
                received_transactions: {
                    take: 20,
                    orderBy: { created_at: 'desc' }
                }
            }
        });

        if (!user) throw new Error('User not found');

        const totalRevenue = user.received_transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const transactionCount = user.received_transactions.length;

        return {
            totalRevenue,
            transactionCount,
            recentSales: user.received_transactions
        };
    }
}
