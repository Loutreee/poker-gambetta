-- Ajout d'un champ optionnel pour stocker l'URL de match Faceit / ESEA

ALTER TABLE "Match" ADD COLUMN "faceit_match_url" TEXT;

