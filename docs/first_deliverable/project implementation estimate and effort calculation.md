## 1. Sintesi Esecutiva: Capacità e Orizzonte Temporale

L'effort complessivo stimato per completare l'intero ciclo operativo (**Task A–H**), la relazione tecnica e la demo finale ammonta a **210–240 ore-persona** (target operativo: **220 ore**), calcolato su una capacità produttiva del team di **75–80 ore/settimana** (~25–27 ore settimanali per ciascuno dei 3 componenti).


| Orizzonte                     | Capacità Team | Effort Atteso | Margine / Buffer  | Fattibilità                                                                         |
| ----------------------------- | ------------- | ------------- | ----------------- | ----------------------------------------------------------------------------------- |
| **4 Settimane (Consigliato)** | 300–320 h     | 210–240 h     | **~80 h (~25%)**  | **Alta:** assorbe la curva di apprendimento su Kubernetes e il patching CVE.        |
| **3 Settimane (Compresso)**   | 225–240 h     | 210–240 h     | **~0–15 h (<5%)** | **Critica:** richiede dataset disponibile dal giorno 1 e tagli drastici allo scope. |


---



## 2. Ripartizione dei Ruoli e Stima per Pacchetti

Per evitare colli di bottiglia nella fase di deploy, l'effort è bilanciato su tre aree di responsabilità parallele con un punto di integrazione obbligatorio a metà della seconda settimana:


| Area / Ruolo           | Quota    | Pacchetti Inclusi (Task A–H)                                                                                                                                                                                                             | Ore Stimate   |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **ML Engineer**        | **~20%** | **Task A:** pipeline offline (imputazione, scaling, feature selection, CV sui fold), serializzazione (`joblib`), contratto I/O per `/predict`.                                                                                           | **16–22 h**   |
| **App Developer**      | **~40%** | **Task B:** Web App monolitica (form feature, auth con 3 ruoli, isolamento dati per medico, 1 DB), integrazione modello e audit log minimo.                                                                                              | **40–50 h**   |
| **Platform & SecOps**  | **~40%** | Studio Docker/K8s (30–40 h) + **Task C** Container (10–14 h) + **Task D+E** Scout e patch CVE (12–16 h) + **Task F+H** Cluster locale (1 control + ≥1 worker) e NGINX TLS/rate-limit (30–40 h) + **Task G** `wrk` stress test (10–12 h). | **92–122 h**  |
| **Trasversale (Team)** | —        | Integrazione end-to-end e debug (20–28 h) + Relazione tecnica, script demo (8–10 min) e tracciamento log AI (24–30 h).                                                                                                                   | **44–58 h**   |
| **Totale Progetto**    | **100%** | —                                                                                                                                                                                                                                        | **210–240 h** |


---



## 3. Strategia di Scope: Implementazione vs. Architettura

Per rispettare il budget orario senza sacrificare la completezza progettuale richiesta dal corso, il sistema viene diviso tra componenti eseguiti realmente in locale e componenti modellati solo a livello architetturale:

- **Da implementare realmente (MVP locale A–H):**
- Applicazione web unica (frontend form + API backend) con **1 database** relazionale.
- Autenticazione **RBAC a 3 ruoli** (operatore/infermiere, medico locale, amministratore) con isolamento rigoroso dei pazienti per singolo medico.
- Pipeline ML addestrata offline, serializzata e servita tramite endpoint `/predict`.
- Containerizzazione su **Docker Desktop**, scansione e remediation vulnerabilità con **Docker Scout**, deploy su cluster **Kubernetes** locale (1 control plane + almeno 1 worker).
- Reverse proxy **NGINX** configurato per terminazione **TLS** e **rate limiting**, validato tramite benchmark **wrk**.
- **Solo a livello architetturale e di relazione (non costruire):**
- Scomposizione in 4 microservizi separati, 3 database dedicati, cifratura *mTLS East-West*, agente *Automated Scaling Listener* custom, replica database *Primary-Replica* con failover automatico e *SLA Monitor* dedicato.
- **Regola di tracciabilità:** ogni blocco del diagramma architetturale verrà classificato esplicitamente in relazione come ***implementato***, ***approssimato*** o ***progettato***.

---



## 4. Roadmap a 4 Settimane e Gestione dei Rischi

1. **Settimana 1 (Scheletro Parallelo):** definizione del contratto JSON delle feature e stub `predict()` (ML); login, ruoli, form e salvataggio su DB (App); setup Docker Desktop, primo Dockerfile e test di un Deployment base su K8s (Platform).
2. **Settimana 2 (Modello Reale e Sicurezza Base):** addestramento su dataset reale e sostituzione dello stub con il modello `.joblib` (ML); segregazione dati tra medici e audit log (App); containerizzazione completa dello stack con NGINX davanti (Platform).
3. **Settimana 3 (Hardening, Cluster e Stress Test):** scansione Docker Scout e applicazione patch (D+E); deploy su cluster K8s multi-nodo locale (F+H); esecuzione test di carico con `wrk` e raccolta metriche/screenshot (G).
4. **Settimana 4 (Consolidamento e Demo):** stesura relazione tecnica con analisi dei limiti tra test locale su laptop e SLA cloud (5.000 req/min), verifica log AI del team e prove cronometrate della demo (8–10 minuti) includendo simulazione di guasto pod e verifica *before/after* di Scout.

**Mitigazioni critiche attive fin dal giorno 1:** uso dello stub ML nella prima settimana per non bloccare lo sviluppo dell'app in attesa del dataset; avvio immediato dello studio su Kubernetes da parte del referente Platform; allocazione di 1–2 giorni di buffer per risolvere eventuali CVE non banali rilevate da Docker Scout.

