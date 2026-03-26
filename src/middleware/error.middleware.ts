import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppException } from '../exceptions/index.js';
import { ZodError } from 'zod';

export const errorHandler = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
) => {
    request.log.error(error);

    if (error instanceof AppException) {
        return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
            statusCode: error.statusCode,
        });
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
        return reply.status(400).send({
            success: false,
            message: error.errors[0]?.message || 'Validation Error',
            errors: error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message
            })),
            statusCode: 400
        });
    }

    // Handle validation errors from Fastify if any
    if (error.validation) {
        return reply.status(400).send({
            success: false,
            message: 'Validation Error',
            details: error.validation,
            statusCode: 400
        });
    }

    // Handle Prisma Unique Constraint Errors
    if ((error as any).code === 'P2002') {
        const target = (error as any).meta?.target as string[];
        const field = target ? target[0] : 'field';
        return reply.status(409).send({
            success: false,
            message: `A user with this ${field} already exists.`,
            statusCode: 409,
        });
    }

    // Default error
    return reply.status(500).send({
        success: false,
        message: 'Internal Server Error',
        statusCode: 500,
    });
};
