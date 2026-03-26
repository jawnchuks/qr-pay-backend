import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    const links = await prisma.bankLink.findMany();
    console.log(links);
}
test();
