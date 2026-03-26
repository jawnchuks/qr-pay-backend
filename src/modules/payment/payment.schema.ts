import { z } from 'zod';

export const BillCategory = z.enum(['Airtime', 'Data', 'CableTV', 'Electricity', 'Water', 'Education', 'Tax', 'Insurance', 'Transport']);

export const ValidateCustomerSchema = z.object({
    category: BillCategory,
    provider: z.string(),
    customerId: z.string()
});

export const ProcessBillSchema = z.object({
    category: BillCategory,
    provider: z.string(),
    customerId: z.string(),
    amount: z.number().positive(),
    pin: z.string().length(4)
});
