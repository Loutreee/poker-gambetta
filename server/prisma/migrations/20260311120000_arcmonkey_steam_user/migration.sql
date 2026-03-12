-- AlterTable
ALTER TABLE "ArcMonkeyPlayer" ADD COLUMN "steam_profile_url" TEXT;
ALTER TABLE "ArcMonkeyPlayer" ADD COLUMN "steam_display_name" TEXT;
ALTER TABLE "ArcMonkeyPlayer" ADD COLUMN "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ArcMonkeyPlayer_user_id_key" ON "ArcMonkeyPlayer"("user_id");

-- AddForeignKey
ALTER TABLE "ArcMonkeyPlayer" ADD CONSTRAINT "ArcMonkeyPlayer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
