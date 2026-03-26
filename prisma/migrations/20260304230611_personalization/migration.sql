-- AlterTable
ALTER TABLE "bank_users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "kyc_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "kyc_tier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "notification_prefs" JSONB;

-- AlterTable
ALTER TABLE "offline_transactions" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'transfer';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'transfer';
