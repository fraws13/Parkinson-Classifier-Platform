# AI session log

- **Date:** 2026-11-26
- **Author:** Team Group 2
- **Tool:** OpenCode
- **Deliverable:** implementation (MVP web)
- **Project area:** web app | authorization | database
- **Goal:** Aggiungere la cancellazione esplicita e controllata di pazienti manuali e medici.

## Prompt / request (summary)

- Pulsante dedicato per eliminare un paziente dalla lista del medico.
- Stesso comportamento nella console amministrativa per eliminare i medici creati.

## Output used

- DELETE del paziente riservato al medico proprietario e ai pazienti manuali senza trasferimenti.
- DELETE del medico riservato all'amministratore, con blocco se esistono pazienti assegnati o eventi clinici registrati dal medico.
- Conferme esplicite nel frontend, gestione errori e audit nella transazione.
- Testi informativi che spiegano la cancellazione permanente e i vincoli di tracciabilità.

## Human review

- La scelta di impedire la cancellazione in presenza di ownership o storico è stata adottata per preservare revoca e audit.
- Revisione finale del comportamento da parte del team: **in attesa**.
