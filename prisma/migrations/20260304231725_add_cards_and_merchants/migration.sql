-- AlterTable
ALTER TABLE "bank_users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "virtual_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_number" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "cvv" TEXT NOT NULL,
    "card_type" TEXT NOT NULL DEFAULT 'VISA',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "spending_limit" DECIMAL(65,30) NOT NULL DEFAULT 100000.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "website" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "virtual_cards_card_number_key" ON "virtual_cards"("card_number");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_profiles_user_id_key" ON "merchant_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bank_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bank_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
