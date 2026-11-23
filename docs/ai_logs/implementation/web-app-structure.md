# AI session log

- **Date:** 2026-11-23
- **Author:** Team Group 2
- **Tool:** OpenCode
- **Deliverable:** implementation (MVP web)
- **Project area:** web app | database | auth | tests
- **Goal:** Prima bozza React/Node/SQLite/Prisma e separazione delle responsabilità in moduli.

## Prompt / request (summary)

- Implementare amministratore unico, più medici, registrazione medici, dashboard e migrazione pazienti.
- Separare componenti/pagine frontend e moduli backend, senza cambiare comportamento.

## Output used

- Workspace `apps/web` e `apps/api`, migrazione SQL iniziale e seed dei soggetti demo.
- Componenti React riutilizzabili, pagine per ruolo, layout e hook di polling.
- Route, controller, servizi, middleware, validatori, client Prisma e telemetria separati.
- Test backend e browser per i flussi principali e i limiti di accesso.
- Guida `docs/web-app.md`.

## Human review

- Richiesta esplicita dell'utente: mantenere due ruoli e procedere con la separazione dei file.
- Revisione funzionale e approvazione finale del codice da parte del team: **in attesa**.
- Le verifiche automatiche non sostituiscono la revisione umana o una validazione clinica.

## Files touched

- `apps/api/`
- `apps/web/`
- `tests/e2e/`
- `package.json`, `package-lock.json`, `playwright.config.js`, `.gitignore`
- `docs/web-app.md`
