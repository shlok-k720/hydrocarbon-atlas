# Hydrocarbon Atlas

A Next.js learning site for hydrocarbon revision. The app includes:

- high-school level topic notes for alkanes, alkenes, alkynes, and branched isomers
- 100 naming questions based on structure diagrams
- 100 drawing questions based on IUPAC names
- an adaptive quiz engine that shifts toward weaker topics
- a structure-building modal with carbon, hydrogen, and bond tools
- SQLite-backed progress tracking through Prisma

## Run locally

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Open `http://localhost:3000` in the browser.

## Data and persistence

- Static lesson content and the 200-question bank live in `src/data/`.
- Quiz progress is stored in SQLite at `prisma/dev.db`.
- Prisma client output is generated into `src/generated/prisma`.

## Useful scripts

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate -- --name <migration-name>
npm run prisma:migrate:deploy
```

## Render deployment

For Render, use the wrapper script instead of calling `prisma migrate dev` directly.

```bash
npm run prisma:generate
npm run prisma:migrate
npm run build
```

Notes:

- The `prisma:migrate` wrapper automatically uses `prisma migrate deploy` in Render and other CI environments.
- If you stay on SQLite in Render, attach a persistent disk and set `DATABASE_URL` to a file on that disk, for example `file:/var/data/hydrocarbons.db`.
- Without a persistent disk, SQLite data will be reset when the service filesystem is replaced.
