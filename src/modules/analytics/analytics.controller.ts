import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../database/prisma.service.js';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export default async function analyticsRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/spending', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request.user as any).id;

        // 1. Weekly Spending Trend (Last 7 Days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = subDays(new Date(), i);
            return format(date, 'yyyy-MM-dd');
        }).reverse();

        const weeklyTrend = await Promise.all(last7Days.map(async (day) => {
            const start = startOfDay(new Date(day));
            const end = endOfDay(new Date(day));

            const total = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    sender_id: userId,
                    created_at: {
                        gte: start,
                        lte: end
                    },
                    status: 'completed'
                }
            });

            return {
                date: day,
                amount: Number(total._sum.amount) || 0
            };
        }));

        // 2. Categorical Breakdown
        const categories = await prisma.transaction.groupBy({
            by: ['category'],
            _sum: { amount: true },
            where: {
                sender_id: userId,
                status: 'completed'
            }
        });

        const breakdown = categories.map(c => ({
            category: c.category,
            amount: Number(c._sum.amount) || 0
        }));

        // 3. Summary Stats
        const totalSpent = breakdown.reduce((acc, curr) => acc + curr.amount, 0);

        return {
            success: true,
            data: {
                weeklyTrend,
                breakdown,
                totalSpent,
                currency: 'NGN'
            }
        };
    });
}
