import { prisma } from '../../database/prisma.service.js';
import { LoginInput } from './auth.schema.js';
import { UnauthorizedException, ForbiddenException } from '../../exceptions/index.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class AuthService {
    async validateUser(input: LoginInput) {
        const user = await prisma.bankUser.findUnique({
            where: { account_number: input.accountNumber },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid account number or password');
        }

        const isMatch = await bcrypt.compare(input.password, user.login_password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid account number or password');
        }

        if (user.is_locked) {
            throw new ForbiddenException('Account is locked');
        }

        return user;
    }

    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }
}

export const authService = new AuthService();
