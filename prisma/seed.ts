import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
    console.log('🌱 Seeding database...');

    const basePass = await bcrypt.hash('password123', SALT_ROUNDS);

    const users = [
        {
            firstName: 'John',
            lastName: 'Doe',
            full_name: 'John Doe',
            accountNumber: '1234567890',
            email: 'john@example.com',
            phone: '08012345678',
            walletBalance: 250000.50,
            passwordHash: await bcrypt.hash('password123', SALT_ROUNDS),
            transaction_pin: '1234',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'Jane',
            lastName: 'Smith',
            full_name: 'Jane Smith',
            accountNumber: '0987654321',
            email: 'jane@example.com',
            phone: '08087654321',
            walletBalance: 15000.00,
            passwordHash: await bcrypt.hash('password456', SALT_ROUNDS),
            transaction_pin: '5678',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'Alice',
            lastName: 'Williams',
            full_name: 'Alice Williams',
            accountNumber: '1112223334',
            email: 'alice@example.com',
            phone: '08011122233',
            walletBalance: 1000000.00,
            passwordHash: basePass,
            transaction_pin: '1111',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'Bob',
            lastName: 'Jackson',
            full_name: 'Bob Jackson',
            accountNumber: '4445556667',
            email: 'bob@example.com',
            phone: '08044455566',
            walletBalance: 50000.00,
            passwordHash: basePass,
            transaction_pin: '2222',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'Charlie',
            lastName: 'Brown',
            full_name: 'Charlie Brown',
            accountNumber: '7778889990',
            email: 'charlie@example.com',
            phone: '08077788899',
            walletBalance: 75000.00,
            passwordHash: basePass,
            transaction_pin: '3333',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'David',
            lastName: 'Wilson',
            full_name: 'David Wilson',
            accountNumber: '1231231234',
            email: 'david@example.com',
            phone: '09012312312',
            walletBalance: 25000.00,
            passwordHash: basePass,
            transaction_pin: '4444',
            registrationStep: 'ACTIVE'
        },
        {
            firstName: 'Eve',
            lastName: 'Adams',
            full_name: 'Eve Adams',
            accountNumber: '9879879870',
            email: 'eve@example.com',
            phone: '07098798798',
            walletBalance: 150000.00,
            passwordHash: basePass,
            transaction_pin: '5555',
            registrationStep: 'ACTIVE'
        }
    ];

    for (const u of users) {
        await prisma.bankUser.upsert({
            where: { accountNumber: u.accountNumber },
            update: { walletBalance: u.walletBalance },
            create: u
        });
    }

    console.log(`✅ Seeded ${users.length} users.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
