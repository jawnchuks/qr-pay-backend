import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
    console.log('🌱 Seeding database...');

    const basePass = await bcrypt.hash('password123', SALT_ROUNDS);

    const users = [
        {
            full_name: 'John Doe',
            account_number: '1234567890',
            email: 'john@example.com',
            phone: '08012345678',
            balance: 250000.50,
            login_password: await bcrypt.hash('password123', SALT_ROUNDS),
            transaction_pin: '1234',
        },
        {
            full_name: 'Jane Smith',
            account_number: '0987654321',
            email: 'jane@example.com',
            phone: '08087654321',
            balance: 15000.00,
            login_password: await bcrypt.hash('password456', SALT_ROUNDS),
            transaction_pin: '5678',
        },
        {
            full_name: 'Alice Williams',
            account_number: '1112223334',
            email: 'alice@example.com',
            phone: '08011122233',
            balance: 1000000.00,
            login_password: basePass,
            transaction_pin: '1111',
        },
        {
            full_name: 'Bob Jackson',
            account_number: '4445556667',
            email: 'bob@example.com',
            phone: '08044455566',
            balance: 50000.00,
            login_password: basePass,
            transaction_pin: '2222',
        },
        {
            full_name: 'Charlie Brown',
            account_number: '7778889990',
            email: 'charlie@example.com',
            phone: '08077788899',
            balance: 75000.00,
            login_password: basePass,
            transaction_pin: '3333',
        },
        {
            full_name: 'David Wilson',
            account_number: '1231231234',
            email: 'david@example.com',
            phone: '09012312312',
            balance: 25000.00,
            login_password: basePass,
            transaction_pin: '4444',
        },
        {
            full_name: 'Eve Adams',
            account_number: '9879879870',
            email: 'eve@example.com',
            phone: '07098798798',
            balance: 150000.00,
            login_password: basePass,
            transaction_pin: '5555',
        }
    ];

    for (const u of users) {
        await prisma.bankUser.upsert({
            where: { account_number: u.account_number },
            update: { balance: u.balance }, // Refresh balance to requested amounts
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
