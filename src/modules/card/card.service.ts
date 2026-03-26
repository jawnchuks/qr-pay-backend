import { prisma } from '../../database/prisma.service.js';
import crypto from 'crypto';

export class CardService {
    /**
     * Issue a new virtual card
     */
    static async issueCard(userId: string, cardType: string = 'VISA') {
        const bin = cardType === 'VISA' ? '411111' : '522222';
        const lastTen = crypto.randomBytes(5).toString('hex').replace(/\D/g, '').substring(0, 10);
        const cardNumber = bin + lastTen;

        // Expiry 3 years from now
        const now = new Date();
        const expiryMonth = String(now.getMonth() + 1).padStart(2, '0');
        const expiryYear = String(now.getFullYear() + 3).substring(2);
        const expiry = `${expiryMonth}/${expiryYear}`;

        const cvv = Math.floor(100 + Math.random() * 900).toString();

        return await prisma.virtualCard.create({
            data: {
                user_id: userId,
                card_number: cardNumber,
                expiry,
                cvv: crypto.createHash('sha256').update(cvv).digest('hex'), // In real app, use symmetric encryption
                card_type: cardType,
                status: 'ACTIVE',
                spending_limit: 100000.0
            }
        });
    }

    /**
     * List all cards for a user (with masking)
     */
    static async listCards(userId: string) {
        const cards = await prisma.virtualCard.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        return cards.map(card => ({
            ...card,
            card_number: `**** **** **** ${card.card_number.slice(-4)}`,
            cvv: '***'
        }));
    }

    /**
     * Get sensitive card details (requires biometric-style challenge on mobile)
     */
    static async getSecureDetails(userId: string, cardId: string) {
        const card = await prisma.virtualCard.findUnique({
            where: { id: cardId }
        });

        if (!card || card.user_id !== userId) {
            throw new Error('Card not found');
        }

        return {
            card_number: card.card_number,
            expiry: card.expiry,
            cvv: 'REDACTED' // In a real app, you'd decrypt and return or use a one-time token
        };
    }

    /**
     * Toggle Card Status (Freeze/Unfreeze)
     */
    static async toggleStatus(userId: string, cardId: string) {
        const card = await prisma.virtualCard.findUnique({
            where: { id: cardId }
        });

        if (!card || card.user_id !== userId) {
            throw new Error('Card not found');
        }

        const newStatus = card.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';

        return await prisma.virtualCard.update({
            where: { id: cardId },
            data: { status: newStatus }
        });
    }
}
