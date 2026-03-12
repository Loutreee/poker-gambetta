Monorepo `poker-gambetta` / `betting-gambetta`

- `apps/poker-gambetta` : front poker existant (port dev 5173)
- `apps/betting-gambetta` : nouveau front paris (port dev 5174)
- `server` : backend Node/Express/Prisma partagé entre les deux fronts

Les commandes et Docker seront progressivement adaptés pour pointer vers ces deux apps.
