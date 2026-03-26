-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_receiver_id_fkey";

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "receiver_id" DROP NOT NULL,
ALTER COLUMN "receiver_account" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "bank_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
