-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
