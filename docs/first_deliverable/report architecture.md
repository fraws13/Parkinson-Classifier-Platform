## 1. Inquadramento Architetturale e Modelli di Riferimento

L'architettura progettata realizza una piattaforma **Software-as-a-Service (SaaS)** cloud-native per il supporto decisionale clinico nella classificazione del morbo di Parkinson a partire da feature grafomotorie. Secondo la tassonomia **NIST**, il sistema espone all'utente finale un'applicazione web completa (SaaS) costruita su risorse computazionali e di rete virtualizzate (IaaS/PaaS) all'interno di una **Virtual Private Cloud (VPC)** dedicata.

Dal punto di vista strutturale, il sistema adotta uno stile a **Microservizi Disaccoppiati** combinato con il pattern **Database-per-Service** e una rigida **segregazione di rete** tra Subnet Pubblica e Subnet Privata. Autenticazione, RBAC e dominio clinico sono **accorpati** in un unico backend transazionale (**Clinical Core & Auth Service**), mentre inferenza e retraining restano servizi dedicati: così si evitano round-trip interni e inconsistenza di ownership a ogni query, senza rinunciare allo scaling selettivo dei componenti a carico computazionale elevato. Il sistema soddisfa i vincoli contrattuali di servizio (**SLA**): bacino di 50.000 utenti, picchi di 5.000 richieste/minuto, finestra operativa dal lunedì al venerdì (08:00–18:00), latenza end-to-end ≤ 1 secondo e disponibilità (*availability* e *reliability*) ≥ 99,5%.

Il ciclo di vita del modello non è statico: oltre all'inferenza sincrona, l'architettura prevede un flusso asincrono di **Continuous Training** che aggiorna a caldo il bundle nel **Model Registry** quando il tasso di errore clinicamente validato supera una soglia predefinita (es. > 5%), senza interrompere il servizio online.

---



## 2. Analisi Dettagliata dei Componenti



### 2.1 Attori Autenticati (Controllo degli Accessi RBAC)

L'interazione con la piattaforma è governata da politiche di **Role-Based Access Control (RBAC)** che differenziano i privilegi operativi in base al profilo professionale:

- **1. Medico Locale:** È l'attore clinico principale. Utilizza la piattaforma per sottomettere i vettori di feature grafomotorie acquisiti durante i test, avviare l'inferenza diagnostica, consultare i referti esclusivamente dei propri pazienti, richiedere eventuali consulti specialistici e **segnalare/validare errori di predizione** (feedback clinico usato per il calcolo del tasso di errore che può attivare il retraining).
- **2. Amministratore di Sistema:** È il responsabile tecnico della piattaforma e della governance del ciclo di vita dei modelli. Supervisa configurazione operativa, soglie di attivazione del retraining e procedure di *Patient Migration*; non ha accesso in chiaro ai dati anagrafici dei singoli pazienti e non esegue manualmente l'addestramento, che avviene in background tramite il **Retraining Worker**.



### 2.2 Perimetro Pubblico (Subnet Pubblica)

La **Subnet Pubblica** costituisce l'unico punto di contatto esposto verso Internet ed è progettata per assorbire, filtrare e cifrare il traffico esterno prima che raggiunga i servizi interni:

- **Load Balancer Cluster (Active-Active):** Coppia ridondata di bilanciatori di carico attivi simultaneamente per eliminare ogni *Single Point of Failure (SPOF)* perimetrale. Gestisce la **terminazione HTTPS/TLS** (*Data-in-Transit*) e distribuisce equamente le richieste in ingresso. Integra un **Web Application Firewall (WAF)** per bloccare payload malevoli (es. SQL injection, XSS) e meccanismi di **Rate Limiting** tarati sulla soglia massima di **5.000 richieste/minuto** per mitigare attacchi DoS applicativi.



### 2.3 Livello di Ingresso ed Elasticità (Subnet Privata)

Tutto il traffico che supera il perimetro pubblico entra nella **Subnet Privata**, una rete completamente isolata dall'esterno in cui ogni comunicazione interna è cifrata tramite **Mutual TLS (mTLS)**:

- **Automated Scaling Listener (ASL):** Implementa il meccanismo formale di *Service Agent*. Posizionato direttamente lungo il percorso di comunicazione tra il Load Balancer e l'API Gateway, intercetta e misura in tempo reale il volume del traffico durante la fascia operativa (**Lun–Ven, 08:00–18:00**). Al superamento delle soglie di carico attiva lo *Scaling Out* (creazione di nuove istanze) e, al rientro del picco, lo *Scaling In* (rilascio delle risorse in eccesso).
- **API Gateway:** Funge da punto di ingresso unico (*Single Entry Point*) per l'ecosistema dei microservizi. Svolge funzioni di routing delle richieste verso i servizi di backend, aggregazione delle risposte, rafforzamento delle politiche di sicurezza mTLS e validazione preliminare dei token di sessione.



### 2.4 Microservizi Indipendenti (Bounded Contexts)

La logica applicativa è scomposta in microservizi disaccoppiati, ciascuno dotato di bilanciamento interno (*Internal Load Balancing*):

- **Frontend UI Service:** Eroga l'interfaccia web dell'applicazione, consentendo al medico di inserire i parametri cinematici/grafomotori dei **task selezionati**, visualizzare l'esito della classificazione e registrare il feedback clinico (conferma o correzione della predizione).
- **Clinical Core & Auth Service:** Backend transazionale unico che unisce autenticazione, RBAC e dominio clinico. Gestisce emissione/verifica dei token di sessione, ruoli, **Doctor-Patient Ownership**, acquisizione dei soli task ammessi, profili pazienti, referti, consulti, feedback di errore/validazione e **Patient Migration**. Ogni query clinica risolve autenticazione, ruolo e titolarità nello stesso processo e sulla stessa transazione del **Clinical & Identity DB**. In caso di riassegnazione o pensionamento, una singola oparazione di aggiornamento atomica trasferisce la ownership: il medico uscente perde **istantaneamente** ogni privilegio di lettura. Espone inoltre i casi clinicamente confermati necessari al Retraining Worker.
- **ML Inference Service (Stateless):** Microservizio dedicato esclusivamente al calcolo predittivo online. Opera in modalità *stateless*: per ogni richiesta carica il modello attivo dal **Model Registry**, applica la pipeline sui i dati inseriti dal medico e produce la predizione binaria (soggetto sano vs paziente Parkinson) con la relativa probabilità. Non esegue addestramento; resta disponibile durante gli aggiornamenti del modello.
- **Retraining Worker (Asincrono):** Componente di background, disaccoppiato dal percorso sincrono di inferenza. Si attiva quando il tasso di errore clinicamente segnalato/validato supera la soglia configurata (es. **> 5%**). Unisce lo storico di training ai nuovi casi confermati, riesegue la pipeline sui **tre task** con **Filter Feature Selection**, serializza un nuovo bundle e lo pubblica nel **Model Registry** con sostituzione a caldo (*hot-swap*), senza interrompere le istanze di inferenza online.



### 2.5 Livello di Persistenza (Pattern Database-per-Service)

Per evitare accoppiamenti strutturali inutili e propagazione dei guasti, i datastore seguono i confini dei servizi, con un'eccezione intenzionale sul core clinico-identitario, tutti protetti tramite cifratura **Data-at-Rest**:

- **Clinical & Identity DB** (Primary + Replica): Database relazionale unico del Clinical Core & Auth Service. Contiene in forma cifrata credenziali, ruoli, titolarità medico-paziente, dati clinici, feedback di validazione e log di audit. Ownership e dati clinici nello stesso DB permettono revoche atomiche con una sola transazione SQL. Scrive sul Primary e usa la Replica per letture e ripristino.
- **Model Registry:** Archivio versionato degli artefatti serializzati del modello (parametri dell'imputer, dello scaler, maschera delle feature selezionate tramite filtro e pesi del classificatore). Esposto in **sola lettura** verso il `ML Inference Service` e in **scrittura controllata** verso il `Retraining Worker`, che pubblica una nuova versione attiva sostituendo a caldo il bundle precedente. Resta fisicamente separato dai dati anagrafici dei pazienti.



### 2.6 Meccanismi di Continuità e Governance

A supporto dell'intera Subnet Privata operano due meccanismi trasversali di controllo e resilienza:

- **Failover System:** Monitora continuamente lo stato di salute (*health check*) dei nodi critici. In caso di guasto di un'istanza del `ML Inference Service` o del nodo `Clinical & Identity DB Primary`, esegue lo **switchover automatico in un tempo ≤ 3 minuti**, reindirizzando il traffico su istanze di riserva e promuovendo il nodo `Replica` a `Primary` per assicurare un uptime ≥ 99,5%. Il `Retraining Worker` è ripartibile: un job interrotto può essere ripreso senza degradare l'inferenza online.
- **SLA Monitor:** Componente di telemetria e auditing che misura costantemente i tempi di risposta dell'`API Gateway` e dei servizi sottostanti, verificando il rispetto della latenza massima (≤ 1 secondo) e certificando la disponibilità continua esposta dal `Load Balancer`. Può inoltre osservare metriche di governance del modello (tasso di errore validato, stato dei job di retraining, versione attiva nel registry).



### 2.7 Specifiche Algoritmiche del Dominio ML

L'inferenza online e il retraining condividono lo stesso contratto di dominio, vincolato a tre scelte progettuali:

1. **Tre task grafomotori selezionati:** spirale; sequenza di lettere **"L"** ripetute; bigrammi / due parole di ortografia. Feature provenienti da altri esercizi non rientrano nel perimetro di training né di predizione.
2. **Feature Selection di tipo Filter:** selezione basata su criteri indipendenti dal classificatore (es. **entropia** e/o **Mutual Information**), applicata sia in fase di retraining sia, tramite maschera congelata nel bundle, in fase di inferenza.
3. **Nessuna data augmentation sintetica:** il dataset di training è composto esclusivamente da casi reali storici e da nuovi casi clinicamente confermati; non si generano campioni sintetici per bilanciare o ampliare il training set.

---



## 3. Flussi Operativi e Ciclo di Vita delle Richieste



### 3.1 Flusso Principale di Inferenza Clinica (Sincrono)

Il percorso completo di una richiesta diagnostica avviata dal **Medico Locale** si articola nei seguenti passaggi sequenziali:

1. **Ingresso e Sicurezza Perimetrale:** Il Medico Locale invia dal browser una richiesta cifrata tramite **HTTPS/TLS** corredata dal proprio **Token di sessione**. Il **Load Balancer Cluster** verifica il certificato, filtra il traffico tramite **WAF** e **Rate Limiting** (max 5.000 req/min), termina la connessione TLS esterna e avvia una sessione interna cifrata in **mTLS**.
2. **Intercettazione e Routing:** Il traffico attraversa l'**Automated Scaling Listener (ASL)**, che contabilizza la richiesta per il monitoraggio del carico, e raggiunge l'**API Gateway**.
3. **Auth, Ownership e Persistenza Clinica (unico hop):** L'**API Gateway** instrada la chiamata al **Clinical Core & Auth Service**, che in una sola interazione con il **Clinical & Identity DB** valida il token, verifica il ruolo (`Medico Locale`), controlla la **titolarità corrente** sul paziente, registra l'accesso in audit e, se autorizzato, valida e salva il vettore dei **task ammessi** sul nodo **Primary** (replicato in background sulla **Replica**). Se il medico non è titolare, la richiesta è rifiutata senza ulteriori hop interni.
4. **Esecuzione dell'Inferenza Stateless:** L'API Gateway invia il vettore numerico al **ML Inference Service**. Quest'ultimo carica in memoria il bundle **attivo** dal **Model Registry** (sola lettura), esegue imputazione, standardizzazione, applicazione della maschera di **Filter Feature Selection** e classificazione, restituendo la predizione in pochi millisecondi.
5. **Restituzione del Referto e Feedback:** L'esito viene associato al record clinico nel `Clinical & Identity DB` tramite il **Clinical Core & Auth Service** e restituito all'interfaccia del medico entro la soglia contrattuale di **1 secondo**. Il medico può successivamente **confermare o segnalare** l'errore di predizione; tali eventi alimentano il tasso di errore usato per attivare il retraining asincrono.



### 3.2 Flusso di Continuous Training in Background (Asincrono)

Il modello non resta congelato a tempo indeterminato. Il ciclo di aggiornamento è governato dal **Retraining Worker**:

1. **Rilevazione della soglia:** Il sistema aggrega le segnalazioni/validazioni di errore dei medici memorizzate dal **Clinical Core & Auth Service**. Quando il tasso di errore clinicamente validato supera la soglia configurata (es. **> 5%**), viene generato un evento di attivazione verso il **Retraining Worker** (l'Amministratore può supervisionare soglia e stato del job, senza eseguire l'addestramento a mano).
2. **Costruzione del training set:** Il Worker recupera dallo storico e dai nuovi casi **confermati** i soli campioni dei **tre task** selezionati. Non applica *data augmentation* sintetica.
3. **Addestramento offline rispetto al path online:** Riesegue imputazione, scaling e **Filter Feature Selection** (entropia / Mutual Information), addestra il classificatore e serializza un nuovo bundle versionato.
4. **Hot-swap nel Model Registry:** Il nuovo bundle viene pubblicato come versione attiva nel **Model Registry**. Le istanze del **ML Inference Service** rilevano o ricaricano la versione corrente e servono le richieste successive con il modello aggiornato, **senza interrompere** l'inferenza online (*zero-downtime*).
5. **Audit e tracciabilità:** L'evento di retraining (trigger, dimensione del set, versione pubblicata, esito del job) è registrato nei log di audit sul **Clinical & Identity DB**.



### 3.3 Flusso di Patient Migration e Revoca della Titolarità

La titolarità medico-paziente è dinamica e viene enforceata a ogni richiesta all'interno dello stesso servizio:

1. L'**Amministratore di Sistema** (o un processo di riassegnazione autorizzato) avvia la **Patient Migration** sul **Clinical Core & Auth Service**, indicando il paziente e il nuovo medico titolare (es. cambio medico o pensionamento).
2. Il servizio esegue una **singola transazione SQL** sul **Clinical & Identity DB** (es. `UPDATE` atomico della ownership).
3. Da quel momento, ogni tentativo di lettura o scrittura da parte del **medico uscente** fallisce il controllo di ownership nello stesso backend: la revoca è **istantanea** e non lascia privilegi residui su dati, referti o feedback del paziente.
4. L'operazione è tracciata nei log di audit per finalità di accountability e compliance.



### 3.4 Flussi Trasversali di Scaling, Failover e Auditing

Parallelamente al traffico applicativo, i meccanismi di secure cloud computing operano in modo continuo:

- **Elasticità Selettiva:** Quando l'**ASL** rileva un incremento delle richieste durante la fascia 08:00–18:00, invia comandi di **Scaling Out** selettivo all'**API Gateway**, al **Clinical Core & Auth Service** e al **ML Inference Service**, aumentando il numero di repliche computazionali per assorbire i picchi fino a 5.000 req/min senza degradare i tempi di risposta. Il **Retraining Worker** scala in modo indipendente, così il carico di addestramento non contende le risorse del percorso sincrono.
- **Continuità Operativa:** Il **Failover System** esegue controlli periodici sul `ML Inference Service` e sul `Clinical & Identity DB`; in caso di anomalia, commuta istantaneamente il traffico sulle risorse ridondate mantenendo l'eventuale disservizio ampiamente al di sotto della soglia media di 3 minuti.
- **Verifica SLA:** Lo **SLA Monitor** raccoglie continuamente le metriche di raggiungibilità dal `Load Balancer` e i tempi di elaborazione dall'`API Gateway`, garantendo la tracciabilità formale del rispetto degli accordi di servizio.

---



## 4. Garanzie di Sicurezza e Compliance GDPR

L'architettura soddisfa i requisiti normativi per il trattamento di dati sanitari (GDPR) attraverso una difesa in profondità (*Defense-in-Depth*): i dati sono cifrati sia in transito (**HTTPS/TLS** sul perimetro esterno e **mTLS** su ogni canale interno della Subnet Privata) sia a riposo (**Data-at-Rest** su tutti i datastore).

Il controllo di accesso non si limita al ruolo: la **Doctor-Patient Ownership** e la **Patient Migration**, gestite atomicamente dal **Clinical Core & Auth Service** sul **Clinical & Identity DB**, assicurano che al cambio o alla cessazione del medico titolare ogni privilegio di lettura sui dati del paziente sia revocato immediatamente, senza finestre di inconsistenza tra servizi distinti.

Il disaccoppiamento fisico tra il **Clinical & Identity DB** e il **Model Registry** mantiene il modello come artefatto matematico privo di riferimenti anagrafici: il retraining utilizza feature e label cliniche aggregate/confermate senza esporre identità al percorso di inferenza. Qualora un paziente eserciti il **Diritto all'Oblio** (Art. 17 GDPR), i suoi record sono rimossi dal database clinico-identitario e esclusi dai successivi cicli di training; non è necessario *Machine Unlearning* sul bundle già pubblicato, in quanto quest'ultimo non conserva identificativi personali.

## 5. Scelte sulle Architetture: Adozione e Scarti

Rispetto alle architetture di elasticità del Cap. 11, il progetto adotta solo i moduli che proteggono SLA, GDPR e il disaccoppiamento tra inferenza sincrona e retraining asincrono. Gli altri sono esclusi o restano fuori perimetro.

**Resource Pooling (adottato)**
Le risorse di compute della Subnet Privata sono organizzate in pool distinti: un pool dedicato al percorso sincrono (API Gateway, Clinical Core & Auth, ML Inference) e un pool dedicato al Retraining Worker. La segregazione garantisce che i job di continuous training non sottraggano CPU/RAM al path online, preservando la latenza ≤ 1 secondo e lo SLA in fascia Lun–Ven 08:00–18:00.

**Elastic Resource Capacity (adottato in modo selettivo)**
Sul path online si conferma lo scaling out/in orizzontale guidato dall’ASL. Sul Retraining Worker, invece, si adotta capacità elastica verticale: per la durata del job (cross-validation e filter feature selection) si allocano CPU/RAM aggiuntive dal sub-pool batch, rilasciandole a fine addestramento. La scelta deriva dalla natura single-job/batch del retraining, non dalla volontà di moltiplicare repliche stateless.

**Elastic Disk Provisioning (non adottato)**
Il volume di dati applicativi (vettori dei tre task, bundle del Model Registry, audit e backup) non costituisce un vincolo critico rispetto a latenza, availability o picco di 5.000 req/min. Un provisioning disco elastico di tipo thin/pay-per-use ottimizzerebbe soprattutto il costo dello storage, non le prestazioni del percorso clinico; pertanto il pattern è stato valutato e scartato dal disegno target.

**Cloud Bursting (escluso)**
Non si adotta un’architettura ibrida con overflow verso un cloud pubblico esterno. I dati trattati sono sanitari e soggetti a GDPR: il bursting fuori dalla VPC dedicata amplierebbe la superficie di trasferimento e ridurrebbe il controllo sul perimetro. Inoltre, l’instradamento del carico clinico verso un ambiente esterno introdurrebbe latenza di rete aggiuntiva incompatibile con il vincolo end-to-end ≤ 1 secondo. L’elasticità richiesta è quindi realizzata all’interno della VPC mediante Resource Pooling e scaling orizzontale/verticale selettivo.