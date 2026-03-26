-- CreateTable
CREATE TABLE "bank_users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "daily_transfer_limit" DECIMAL(65,30) NOT NULL DEFAULT 500000.0,
    "login_password" TEXT NOT NULL,
    "transaction_pin" TEXT NOT NULL,
    "device_secret" TEXT,
    "public_key" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "sender_account" TEXT NOT NULL,
    "receiver_account" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "reference" TEXT NOT NULL,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_channels" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(65,30) NOT NULL,
    "remaining_balance" DECIMAL(65,30) NOT NULL,
    "channel_seq" INTEGER NOT NULL DEFAULT 0,
    "last_hash" TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_transactions" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "tx_id" TEXT NOT NULL,
    "from_user" TEXT NOT NULL,
    "to_user" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "time_counter" BIGINT NOT NULL,
    "otp" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "tx_seq" INTEGER NOT NULL,
    "prev_hash" TEXT NOT NULL,
    "current_hash" TEXT NOT NULL,
    "digital_signature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_nonces" (
    "nonce" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "used_nonces_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "reconciliation_logs" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "batch_size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "rejection_reason" TEXT,
    "audit_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_users_account_number_key" ON "bank_users"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "bank_users_email_key" ON "bank_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "offline_channels_channel_id_key" ON "offline_channels"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "offline_transactions_tx_id_key" ON "offline_transactions"("tx_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "bank_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "bank_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_channels" ADD CONSTRAINT "offline_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bank_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_transactions" ADD CONSTRAINT "offline_transactions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "offline_channels"("channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;
