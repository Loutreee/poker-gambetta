-- AlterTable Match: add title and format
ALTER TABLE "Match" ADD COLUMN "title" TEXT;
ALTER TABLE "Match" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'BO3';

-- CreateTable Bet
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bet_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bet_match_id_idx" ON "Bet"("match_id");
CREATE INDEX "Bet_user_id_idx" ON "Bet"("user_id");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
