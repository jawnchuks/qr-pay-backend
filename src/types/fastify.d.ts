import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        user: {
            id: string;
            accountNumber: string;
            role: string;
        };
    }
}
