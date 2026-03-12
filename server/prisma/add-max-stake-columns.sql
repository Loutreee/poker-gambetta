-- Add columns if they don't exist (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'max_stake_per_bet') THEN
    ALTER TABLE "matches" ADD COLUMN "max_stake_per_bet" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'max_stake_per_match') THEN
    ALTER TABLE "matches" ADD COLUMN "max_stake_per_match" INTEGER;
  END IF;
END $$;
