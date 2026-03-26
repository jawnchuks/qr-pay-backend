import { z } from 'zod';

export const CreateBeneficiarySchema = z.object({
    name: z.string().min(2),
    accountNumber: z.string().length(10),
    bankName: z.string().default('SecureBank'),
    isFavorite: z.boolean().optional().default(false),
});

export const ToggleFavoriteSchema = z.object({
    isFavorite: z.boolean(),
});
