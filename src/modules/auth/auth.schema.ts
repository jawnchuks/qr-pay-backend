import { z } from 'zod';

export const LoginSchema = z.object({
    accountNumber: z.string(),
    password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
