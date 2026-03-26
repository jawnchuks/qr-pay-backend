/*
  Warnings:

  - You are about to drop the column `notification_prefs` on the `bank_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bank_users" DROP COLUMN "notification_prefs",
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "push_token" TEXT;

-- AlterTable
ALTER TABLE "offline_transactions" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "metadata" JSONB;
