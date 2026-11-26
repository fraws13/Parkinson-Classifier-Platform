# AI session log

- **Date:** 2026-11-26
- **Author:** Team Group 2
- **Tool:** OpenCode
- **Deliverable:** implementation (MVP web)
- **Project area:** frontend | clinical workflow
- **Goal:** Precompilare un nuovo test del paziente manuale a partire da un file JSON.

## Prompt / request (summary)

- Il medico crea un paziente, apre la cartella, importa un JSON e vede i dati nelle rispettive sezioni dei tre task.

## Output used

- Importazione client-side con limite 64 KB e validazione rispetto a `feature_schema.json`.
- Sezioni separate per `t1_*`, `t2_*`, `t3_*` nel modulo del nuovo test.
- Errori puntuali per campi sconosciuti o valori invalidi, mantenendo le misure valide nel draft.
- Salvataggio esplicito tramite API esistente e controllo ownership già presente.

## Verification

- Build React superata.
- 12 test backend e 3 test browser regressivi superati.
- Smoke test browser del flusso completo superato con valori importati verificati nei tre tab.

## Human review

- Revisione del flusso e del formato JSON da parte del team: **in attesa**.
