## 1. Inquadramento Architetturale e Modelli di Riferimento

L'architettura progettata realizza una piattaforma **Software-as-a-Service (SaaS)** cloud-native per il supporto decisionale clinico nella classificazione del morbo di Parkinson a partire da feature grafomotorie. Secondo la tassonomia **NIST**, il sistema espone all'utente finale un'applicazione web completa (SaaS) costruita su risorse computazionali e di rete virtualizzate (IaaS/PaaS) all'interno di una **Virtual Private Cloud (VPC)** dedicata.

Dal punto di vista strutturale, il sistema adotta uno stile a **Microservizi Disaccoppiati** combinato con il pattern **Database-per-Service** e una rigida **segregazione di rete** tra Subnet Pubblica e Subnet Privata. Questa impostazione consente di scalare selettivamente i componenti ad alto carico computazionale, isolare i guasti e soddisfare i vincoli contrattuali di servizio (**SLA**): bacino di 50.000 utenti, picchi di 5.000 richieste/minuto, finestra operativa dal lunedì al venerdì (08:00–18:00), latenza end-to-end ≤ 1 secondo e disponibilità (*availability* e *reliability*) ≥ 99,5%.

---



## 2. Analisi Dettagliata dei Componenti



### 2.1 Attori Autenticati (Controllo degli Accessi RBAC)

L'interazione con la piattaforma è governata da politiche di **Role-Based Access Control (RBAC)** che differenziano i privilegi operativi in base al profilo professionale:

- **1. Medico Locale:** È l'attore clinico principale. Utilizza la piattaforma per sottomettere i vettori di feature grafomotorie acquisiti durante i test, avviare l'inferenza diagnostica, consultare i referti esclusivamente dei propri pazienti e richiedere eventuali consulti specialistici.
- **2. Amministratore di Sistema:** È il responsabile tecnico della piattaforma e del ciclo di vita dei modelli. Gestisce la configurazione operativa del servizio e coordina le procedure controllate di aggiornamento e *retraining* del classificatore, senza avere accesso in chiaro ai dati anagrafici dei singoli pazienti.



### 2.2 Perimetro Pubblico (Subnet Pubblica)

La **Subnet Pubblica** costituisce l'unico punto di contatto esposto verso Internet ed è progettata per assorbire, filtrare e cifrare il traffico esterno prima che raggiunga i servizi interni:

- **Load Balancer Cluster (Active-Active):** Coppia ridondata di bilanciatori di carico attivi simultaneamente per eliminare ogni *Single Point of Failure (SPOF)* perimetrale. Gestisce la **terminazione HTTPS/TLS** (*Data-in-Transit*) e distribuisce equamente le richieste in ingresso. Integra un **Web Application Firewall (WAF)** per bloccare payload malevoli (es. SQL injection, XSS) e meccanismi di **Rate Limiting** tarati sulla soglia massima di **5.000 richieste/minuto** per mitigare attacchi DoS applicativi.



### 2.3 Livello di Ingresso ed Elasticità (Subnet Privata)

Tutto il traffico che supera il perimetro pubblico entra nella **Subnet Privata**, una rete completamente isolata dall'esterno in cui ogni comunicazione interna (*East-West traffic*) è cifrata tramite **Mutual TLS (mTLS)**:

- **Automated Scaling Listener (ASL):** Implementa il meccanismo formale di *Service Agent*. Posizionato direttamente lungo il percorso di comunicazione tra il Load Balancer e l'API Gateway, intercetta e misura in tempo reale il volume del traffico durante la fascia operativa (**Lun–Ven, 08:00–18:00**). Al superamento delle soglie di carico attiva lo *Scaling Out* (creazione di nuove istanze) e, al rientro del picco, lo *Scaling In* (rilascio delle risorse in eccesso).
- **API Gateway:** Funge da punto di ingresso unico (*Single Entry Point*) per l'ecosistema dei microservizi. Svolge funzioni di routing delle richieste verso i servizi di backend, aggregazione delle risposte, enforcement delle politiche di sicurezza mTLS e validazione preliminare dei token di sessione.



### 2.4 Microservizi Indipendenti (Bounded Contexts)

La logica applicativa è scomposta in quattro microservizi stateless/disaccoppiati, ciascuno dotato di bilanciamento interno (*Internal Load Balancing*):

- **Frontend UI Service:** Eroga l'interfaccia web dell'applicazione, consentendo al medico di inserire o caricare i parametri cinematici/grafomotori del paziente e di visualizzare in modo chiaro l'esito della classificazione.
- **Auth & RBAC Service:** Gestisce l'autenticazione degli utenti, l'emissione e la verifica crittografica dei token di sessione e l'applicazione delle regole di isolamento multi-tenant, garantendo che ogni medico possa interrogare esclusivamente i dati clinici di propria competenza.
- **Clinical & Patient Service:** Incapsula la logica di dominio sanitario. Gestisce l'acquisizione strutturata dei task grafomotori, l'associazione con i profili clinici dei pazienti, lo storico dei referti e la gestione dei consulti.
- **ML Inference Service (Stateless):** Microservizio dedicato esclusivamente al calcolo predittivo. Opera in modalità completamente *stateless* (priva di stato in memoria persistente): per ogni richiesta applica in sequenza la pipeline di trasformazione (`Imputation` dei valori mancanti, `Scaling` delle feature e `Feature Selection`) e calcola la predizione binaria (soggetto sano vs paziente Parkinson) con la relativa probabilità.



### 2.5 Livello di Persistenza (Pattern Database-per-Service)

Per evitare accoppiamenti strutturali e propagazione dei guasti, ogni dominio applicativo accede esclusivamente al proprio datastore dedicato, tutti protetti tramite cifratura **Data-at-Rest**:

- **Identity & Audit DB:** Archivia le credenziali degli utenti autorizzati, i ruoli RBAC e i log immutabili di audit sugli accessi e sulle operazioni eseguite sulla piattaforma.
- **Clinical DB (Primary + Replica):** Conserva in forma cifrata i dati dei pazienti, i parametri dei task grafomotori e gli esiti diagnostici. Implementa il pattern *Redundant Storage* tramite una configurazione **Primary (Master)** dedicata alle operazioni di scrittura e **Replica (Slave)** dedicata alle letture e al ripristino rapido.
- **Model Registry (Sola Lettura):** Archivio dedicato agli artefatti serializzati del modello di Machine Learning (parametri dell'imputer, dello scaler, maschera delle feature selezionate e pesi del classificatore addestrato offline). È esposto in modalità di sola lettura verso il servizio di inferenza ed è fisicamente separato dai dati anagrafici dei pazienti.



### 2.6 Meccanismi di Continuità e Governance

A supporto dell'intera Subnet Privata operano due meccanismi trasversali di controllo e resilienza:

- **Failover System:** Monitora continuamente lo stato di salute (*health check*) dei nodi critici. In caso di guasto di un'istanza del `ML Inference Service` o del nodo `Clinical DB Primary`, esegue lo **switchover automatico in un tempo ≤ 3 minuti**, reindirizzando il traffico su istanze di riserva e promuovendo il nodo `Replica` a `Primary` per assicurare un uptime ≥ 99,5%.
- **SLA Monitor:** Componente di telemetria e auditing che misura costantemente i tempi di risposta dell'`API Gateway` e dei servizi sottostanti, verificando il rispetto della latenza massima (≤ 1 secondo) e certificando la disponibilità continua esposta dal `Load Balancer`.

---



## 3. Flussi Operativi e Ciclo di Vita delle Richieste



### 3.1 Flusso Principale di Inferenza Clinica (Sincrono)

Il percorso completo di una richiesta diagnostica avviata dal **Medico Locale** si articola nei seguenti passaggi sequenziali:

1. **Ingresso e Sicurezza Perimetrale:** Il Medico Locale invia dal browser una richiesta cifrata tramite **HTTPS/TLS** corredata dal proprio **Token di sessione**. Il **Load Balancer Cluster** verifica il certificato, filtra il traffico tramite **WAF** e **Rate Limiting** (max 5.000 req/min), termina la connessione TLS esterna e avvia una sessione interna cifrata in **mTLS**.
2. **Intercettazione e Routing:** Il traffico attraversa l'**Automated Scaling Listener (ASL)**, che contabilizza la richiesta per il monitoraggio del carico, e raggiunge l'**API Gateway**.
3. **Autenticazione e Verifica RBAC:** Prima di instradare la chiamata, l'**API Gateway** interroga in mTLS l'**Auth & RBAC Service**, il quale valida il token interrogando l'**Identity & Audit DB**, verifica il ruolo (`Medico Locale`) e registra l'evento di accesso nei log di audit.
4. **Acquisizione e Salvataggio Dati Clinici:** Attraverso il **Frontend UI Service**, il medico sottomette il vettore delle feature grafomotorie. L'API Gateway inoltra il payload al **Clinical & Patient Service**, che valida la coerenza dei dati e li salva in forma cifrata sul nodo **Clinical DB Primary** (replicato in background sul **Clinical DB Replica**).
5. **Esecuzione dell'Inferenza Stateless:** L'API Gateway invia il vettore numerico al **ML Inference Service**. Quest'ultimo carica in memoria i parametri congelati dal **Model Registry** (in sola lettura), esegue imputazione, standardizzazione, selezione delle feature e classificazione, restituendo la predizione in pochi millisecondi.
6. **Restituzione del Referto:** L'esito viene associato al record clinico nel `Clinical DB` e inviato a ritroso attraverso `API Gateway` e `Load Balancer` fino all'interfaccia web del medico, completando l'intero ciclo entro la soglia contrattuale di **1 secondo**.



### 3.2 Flusso di Gestione e Retraining Controllato

Quando l'**Amministratore di Sistema** interviene per aggiornare il modello (ad esempio in seguito alla segnalazione di un calo prestazionale su nuovi casi clinici):

1. L'Amministratore si autentica tramite il medesimo perimetro protetto (`Load Balancer` → `API Gateway` → `Auth & RBAC Service`), ottenendo i privilegi amministrativi circoscritti alla gestione della piattaforma.
2. Il nuovo artefatto addestrato e validato offline viene caricato nel **Model Registry** come nuova versione in sola lettura, senza alterare né esporre i record anagrafici contenuti nel **Clinical DB**.
3. Le istanze del **ML Inference Service** leggono i nuovi parametri congelati dal registro, rendendo operativo il modello aggiornato senza interruzioni di servizio (*zero-downtime*).



### 3.3 Flussi Trasversali di Scaling, Failover e Auditing

Parallelamente al traffico applicativo, i meccanismi di Thomas Erl operano in modo continuo:

- **Elasticità Selettiva:** Quando l'**ASL** rileva un incremento delle richieste durante la fascia 08:00–18:00, invia comandi di **Scaling Out** selettivo all'**API Gateway** e al **ML Inference Service**, aumentando il numero di repliche computazionali per assorbire i picchi fino a 5.000 req/min senza degradare i tempi di risposta.
- **Continuità Operativa:** Il **Failover System** esegue controlli periodici sul `ML Inference Service` e sul `Clinical DB`; in caso di anomalia, commuta istantaneamente il traffico sulle risorse ridondate mantenendo l'eventuale disservizio ampiamente al di sotto della soglia media di 3 minuti.
- **Verifica SLA:** Lo **SLA Monitor** raccoglie continuamente le metriche di raggiungibilità dal `Load Balancer` e i tempi di elaborazione dall'`API Gateway`, garantendo la tracciabilità formale del rispetto degli accordi di servizio.

---



## 4. Garanzie di Sicurezza e Compliance GDPR

L'architettura soddisfa i requisiti normativi per il trattamento di dati sanitari (GDPR) attraverso una difesa in profondità (*Defense-in-Depth*): i dati sono cifrati sia in transito (**HTTPS/TLS** sul perimetro esterno e **mTLS** su ogni canale interno della Subnet Privata) sia a riposo (**Data-at-Rest** su tutti i datastore). Infine, il disaccoppiamento fisico tra il **Clinical DB** e il **Model Registry** garantisce che il modello di Machine Learning rimanga un artefatto matematico statico e privo di riferimenti personali: qualora un paziente eserciti il **Diritto all'Oblio** (Art. 17 GDPR), è sufficiente rimuovere i suoi record dal database clinico senza dover ricorrere a complesse procedure di *Machine Unlearning* o ri-addestramento.