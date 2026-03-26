import { FastifyInstance } from 'fastify';
import { Server, Socket } from 'socket.io';

export class SocketService {
    private static io: Server;
    private static userSockets = new Map<string, string[]>(); // userId -> socketIds[]

    static init(fastify: FastifyInstance) {
        this.io = (fastify as any).io;

        this.io.on('connection', (socket: Socket) => {
            fastify.log.info(`Socket connected: ${socket.id}`);

            socket.on('authenticate', (userId: string) => {
                fastify.log.info(`Socket ${socket.id} authenticated for user ${userId}`);
                const existing = this.userSockets.get(userId) || [];
                this.userSockets.set(userId, [...existing, socket.id]);

                // Keep track of userId on the socket for cleanup
                (socket as any).userId = userId;
            });

            socket.on('disconnect', () => {
                const userId = (socket as any).userId;
                if (userId) {
                    const existing = this.userSockets.get(userId) || [];
                    this.userSockets.set(userId, existing.filter(id => id !== socket.id));
                    if (this.userSockets.get(userId)?.length === 0) {
                        this.userSockets.delete(userId);
                    }
                }
                fastify.log.info(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    static emitToUser(userId: string, event: string, data: any) {
        const socketIds = this.userSockets.get(userId);
        if (socketIds && this.io) {
            socketIds.forEach(id => {
                this.io.to(id).emit(event, data);
            });
            return true;
        }
        return false;
    }

    static broadcast(event: string, data: any) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
}
