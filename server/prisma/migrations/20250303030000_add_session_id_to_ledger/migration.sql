-- Add nullable session_id column to ledger_entries
ALTER TABLE "ledger_entries" ADD COLUMN "session_id" TEXT;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

