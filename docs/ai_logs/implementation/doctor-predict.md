# AI session log

- **Date:** 2026-11-23
- **Author:** Team Group 2
- **Tool:** OpenCode
- **Deliverable:** implementation (MVP web)
- **Project area:** ML | web app | auth | database
- **Goal:** Collegare inferenza reale e inserimento pazienti/test, limitando i dati demo ai soggetti di training.

## Prompt / request (summary)

- Richiesta di Predict con classe di appartenenza e inserimento manuale pazienti.
- Mostrare soltanto dati di training e usare credenziali demo semplificate.
- L'utente ha approvato username distinti `medic`, `medic2`, ecc. e ricostruzione del modello dal seed, essendo assenti modello e split originali.

## Output used

- Migrazione additiva per username, nome paziente, split e data di predizione; preservati trigger precedenti.
- Manifest train/test ricostruito col protocollo di split esistente; preparazione modello dal seed con MI riproducibile.
- API Python senza fallback stub e versione derivata da hash artefatto.
- Client ML interno Node, validazione di classe/versione, controllo ownership prima e dopo l'inferenza.
- Form paziente/test e visualizzazione classe predetta separata dalla label del dataset.
- Filtro TRAIN/manuali per medici e viste operative amministrative; dati TEST conservati senza cancellazioni.
- Script esplicito per credenziali demo, bloccato in produzione e con revoca sessioni.

## Verification

- 12 test Node superati, inclusa migrazione durante inferenza e isolamento del test set.
- 3 test browser superati, con client ML simulato soltanto nel test harness isolato.
- 3 test Python superati, incluso modello reale locale e assenza di fallback senza modello.
- Verifica HTTP Node → Python reale: risposta 200 con classe H e versione hashata; health Python model_loaded=true.
- Le metriche della ricostruzione sono didattiche: CV SVM ~0,597; hold-out ~0,667.

## Human review

- Approvati dall'utente ricostruzione ML e username numerati.
- Revisione finale del codice e validazione delle scelte cliniche: **in attesa**.
