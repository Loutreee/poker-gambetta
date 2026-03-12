/**
 * One-off script: add max_stake_per_bet and max_stake_per_match to matches table.
 * Run from server/: node scripts/add-max-stake-columns.cjs
 * Uses DATABASE_URL from server/.env (same as the API).
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Add columns only if table "matches" exists; use IF NOT EXISTS for columns (PG 9.5+)
  // Table name in DB is "Match" (capital M), not "matches" (see add_betting_matches migration)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Match') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Match' AND column_name = 'max_stake_per_bet') THEN
          ALTER TABLE "Match" ADD COLUMN "max_stake_per_bet" INTEGER;
          RAISE NOTICE 'Added column max_stake_per_bet';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Match' AND column_name = 'max_stake_per_match') THEN
          ALTER TABLE "Match" ADD COLUMN "max_stake_per_match" INTEGER;
          RAISE NOTICE 'Added column max_stake_per_match';
        END IF;
      ELSE
        RAISE NOTICE 'Table Match does not exist; skipping. Run prisma migrate deploy first.';
      END IF;
    END $$;
  `);
  console.log("Done. Columns max_stake_per_bet and max_stake_per_match added to Match table if missing.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
