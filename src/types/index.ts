import { BankUser, Transaction } from '@prisma/client';

export type UserProfile = BankUser & {
    sent_transactions: Transaction[];
    received_transactions: Transaction[];
};

export interface TokenPayload {
    id: string;
    accountNumber: string;
    role: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
