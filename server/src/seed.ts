import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Génère un mot de passe par défaut à partir du nom (ex: "Arthur C." → "arthurc", "Léane" → "leane") */
function defaultPassword(name: string): string {
  const accented: Record<string, string> = { é: "e", è: "e", ê: "e", ë: "e", à: "a", â: "a", ä: "a", ù: "u", û: "u", ü: "u", î: "i", ï: "i", ô: "o", ö: "o", ç: "c" };
  const base = name
    .toLowerCase()
    .split("")
    .map((c) => accented[c] ?? c)
    .join("")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  return base || "password";
}

/**
 * Liste des joueurs : nom, rôle (dealer = Hugo uniquement), solde initial en $.
 * Solde à 0 = pas d'entrée ledger (nouveau ou pas encore de bankroll).
 */
const BANKROLL_DATA: { name: string; role: "player" | "dealer"; balance: number }[] = [
  { name: "Eliott", role: "player", balance: 31_600 },
  { name: "Killian", role: "player", balance: 34_125 },
  { name: "Camille", role: "player", balance: 20_975 },
  { name: "Arthur C.", role: "player", balance: 21_375 },
  { name: "Mimo", role: "player", balance: 24_000 },
  { name: "Loic", role: "player", balance: 0 },
  { name: "Celia", role: "player", balance: 0 },
  { name: "Océane", role: "player", balance: 0 },
  { name: "Thomas", role: "player", balance: 0 },
  { name: "Adriane", role: "player", balance: 20_250 },
  { name: "Margaut", role: "player", balance: 0 },
  { name: "Anouk", role: "player", balance: 0 },
  { name: "Jules", role: "player", balance: 24_925 },
  { name: "Emilie", role: "player", balance: 0 },
  { name: "Léane", role: "player", balance: 20_900 },
  { name: "Flavien", role: "player", balance: 0 },
  { name: "Iléana", role: "player", balance: 0 },
  { name: "Lou", role: "player", balance: 31_350 },
  { name: "Arthur (Anastasi)", role: "player", balance: 0 },
  { name: "Orlane", role: "player", balance: 0 },
  { name: "Hugo", role: "dealer", balance: 43_325 },
  { name: "Clémentine", role: "player", balance: 14_050 },
  { name: "Paul P.", role: "player", balance: 23_500 },
  { name: "Antoine P.", role: "player", balance: 20_000 },
  { name: "Marvin", role: "player", balance: 20_000 },
  { name: "Quentin (pote adri)", role: "player", balance: 14_900 },
];

const SEED_NAMES = new Set(BANKROLL_DATA.map((u) => u.name));

async function main() {
  // 1. Supprimer les users qui ne sont plus dans la liste
  const existingUsers = await prisma.user.findMany({ select: { id: true, name: true } });
  for (const u of existingUsers) {
    if (!SEED_NAMES.has(u.name)) {
      await prisma.user.delete({ where: { id: u.id } });
      console.log("Supprimé (plus dans la liste):", u.name);
    }
  }

  // 2. Créer ou mettre à jour chaque user
  let dealerId: string | null = null;
  for (const row of BANKROLL_DATA) {
    const password = defaultPassword(row.name);
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findFirst({ where: { name: row.name } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: row.role, passwordHash },
      });
      if (row.role === "dealer") dealerId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { name: row.name, role: row.role, passwordHash },
      });
      if (row.role === "dealer") dealerId = created.id;
      console.log("Ajouté:", row.name);
    }
  }

  if (!dealerId) {
    throw new Error("Aucun croupier (Hugo) dans la liste : impossible de créer les entrées ledger.");
  }

  // 3. Vider le ledger et recréer les soldes
  await prisma.ledgerEntry.deleteMany({});
  for (const row of BANKROLL_DATA) {
    if (row.balance === 0) continue;
    const user = await prisma.user.findFirst({ where: { name: row.name } });
    if (!user) continue;
    await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: row.balance,
        note: "Bankroll initiale (seed)",
        createdBy: dealerId,
      },
    });
  }

  console.log("Seed OK : joueurs et bankrolls à jour.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
