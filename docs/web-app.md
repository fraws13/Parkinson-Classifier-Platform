# Web app — struttura e avvio locale

## Tema grafico

Interfaccia ispirata alla presentazione del primo deliverable: fondo rosa chiarissimo (`#fff7f7`), titoli e azioni antracite (`#4d4b4b`), pannelli bianchi, bordi sottili e geometrie squadrate. Titoli in Bebas Neue (distribuzione web regular; il PDF usa anche la variante bold), testi in Open Sauce One. I font sono distribuiti localmente tramite pacchetti Fontsource, senza richieste a Google Fonts.

Gli stili sono separati in `styles/index.css` (token e regole base), `components.css`, `workspace.css` e `login.css`. I colori di errore e conferma mantengono una distinzione semantica; nessuna classe clinica è identificata esclusivamente tramite colore. Non sono state copiate immagini dal PDF.

## Aggiornamento: dashboard medico e Predict

### Importazione JSON dei test

Dalla cartella di un paziente manuale il medico può scegliere **Importa JSON**. Il file viene letto nel browser e i valori validi compilano il modulo del nuovo test. Le sezioni restano separate per task, quindi `t1_*` appare in Spirale, `t2_*` in Lettera “l” e `t3_*` in Bigramma “le”. Prima del salvataggio il medico può correggere i dati importati.

Formato consigliato:

```json
{
  "features": {
    "t1_duration_ms": 1111,
    "t1_in_air_pct": 0.25,
    "t2_mean_speed": 2.5,
    "t3_mean_jerk": 0.75
  }
}
```

Il file deve contenere un singolo oggetto con `features`. Sono consentiti i nomi presenti in `contracts/feature_schema.json`, numeri finiti, `null` e valori `_pct` tra 0 e 1. Campi sconosciuti o non validi vengono elencati nella pagina, mentre gli altri valori validi restano compilati. Il limite del file è 64 KB. L'importazione non salva automaticamente il test.

Le indicazioni qui sostituiscono le note precedenti sull'assenza di inferenza.

- Login con username (oppure email degli account esistenti).
- Configurazione demo esplicita: dopo seed e migrazioni, `npm run demo:configure` imposta `admin/admin` e `medic/admin`, `medic2/admin`, `medic3/admin` (eventuali medici aggiuntivi numerati). Revoca tutte le sessioni. Non eseguire su dati reali; lo script è bloccato con `NODE_ENV=production`.
- Solo i 57 soggetti di training e i pazienti manuali sono visibili nelle viste operative, conteggi e API. I 15 soggetti di test restano nel database ma non sono accessibili tramite questi percorsi. L'assegnazione al singolo medico continua a valere.
- Il medico può creare un paziente (assegnazione derivata dalla sessione), salvare nuovi test con 63 chiavi feature e ottenere la classe `H` (0) oppure `PD` (1).
- Il medico può eliminare dalla lista un paziente manuale senza storico di trasferimenti, con conferma esplicita. L'operazione elimina test e risultati collegati e registra l'audit.
- L'amministratore può eliminare un medico dalla console soltanto se non ha pazienti assegnati e non ha attività cliniche nello storico. Gli account con pazienti devono essere trasferiti prima, mentre gli eventi storici impediscono la cancellazione per mantenere la tracciabilità.
- Per le misure sconosciute si usa `null`; un test interamente vuoto viene rifiutato. Le frazioni `_pct` devono essere tra 0 e 1. L'imputazione di dati mancanti non garantisce un risultato attendibile: usare acquisizioni complete ove possibile.
- `POST /api/clinical/patients/:id/assessments/:assessmentId/predict` chiama Python internamente, valida il risultato e salva classe, versione del modello e data. Un nuovo controllo dell'ownership precede il salvataggio; un trasferimento intervenuto durante l'inferenza impedisce di restituire il risultato al vecchio medico.
- Senza servizio o modello si restituisce 503: non si usa più una classe stub.
- Predire sui soggetti di training è una dimostrazione applicativa, non una stima delle prestazioni su pazienti nuovi.

### Preparazione ML locale

```sh
python -m venv .venv
# Windows
.venv\Scripts\python.exe -m pip install -r requirements.txt
# Linux/macOS: .venv/bin/python -m pip install -r requirements.txt
npm run ml:prepare
npm run ml:dev
```

In un altro terminale eseguire `npm run dev`. Il servizio ML ascolta solo su `127.0.0.1:8000`; Node usa `ML_API_URL` (default identico). Non esporre direttamente Python.

Il modello è **ricostruito dal seed versionato**, non è l'artefatto originale del branch remoto, che manca dal repository. Lo split stratificato 80/20 con seed 42 è registrato in `contracts/dataset_split.json`; la selezione MI ha un seed esplicito. L'artefatto resta ignorato da Git e la versione include l'hash del file. Risultati della ricostruzione corrente: SVM CV ~0,597, hold-out ~0,667. Sono metriche didattiche, non validazione clinica. Le esecuzioni successive di training non devono essere usate per ottimizzare sul test hold-out.

Per i test Python: `.venv\Scripts\python.exe -m unittest discover -s py -p test_predict.py`.

## Organizzazione

Il progetto usa workspace npm: `apps/web` contiene React/Vite e `apps/api` contiene Node/Express. Il servizio ML Python in `py/` resta separato e non è ancora collegato alla web app.

```text
apps/web/src/
  main.jsx                 Avvio React e caricamento CSS
  App.jsx                  Sessione e selezione della pagina
  components/              Badge, Modal, StatCard, SearchBox, errori e caricamento
  layouts/                 WorkspaceLayout: sidebar, header e footer
  pages/
    LoginPage.jsx
    admin/                 DashboardPage, DoctorsPage, AssignmentsPage
    doctor/                PatientsPage, PatientDetailPage
  hooks/                   useLive: aggiornamento periodico dei dati
  services/                Client HTTP delle API
  utils/                   Formattazione di numeri e date
  styles/                  CSS globale e font locali

apps/api/src/
  server.js                Avvio HTTP, SQLite e distribuzione build frontend
  app.js                   Configurazione Express e composizione delle dipendenze
  routes/                  URL, metodi HTTP e middleware di accesso
  controllers/             Validazione richieste e risposte HTTP
  services/                Logica applicativa, query e transazioni
  middleware/              Sessioni, ruoli, origine delle richieste ed errori
  validators/              Schemi Zod per i payload
  db/prisma.js             Creazione client Prisma con adapter SQLite
  telemetry/               Campioni di latenza e middleware di osservazione

apps/api/prisma/
  schema.prisma            Modelli del database
  migrations/              Migrazioni SQL versionate, inclusi vincoli e trigger
  seed.js                  Account iniziali e 72 soggetti demo
```

Flusso backend: **route → middleware di accesso → controller → servizio → Prisma**.

I servizi ricevono il client database tramite dependency injection; i test possono quindi usare database temporanei isolati. L'ownership clinica viene filtrata nelle query del servizio, non soltanto nella UI.

## Primo avvio

Richiede Node.js >= 22.12 (verificato con Node 24.14.1).

1. Dalla radice eseguire `npm ci`.
2. Copiare `apps/api/.env.example` in `apps/api/.env`.
3. Impostare `ADMIN_PASSWORD` e `DOCTOR_PASSWORD`: devono essere differenti e lunghe almeno 12 caratteri. Non versionare il file `.env`.
4. Eseguire, dalla radice:

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Frontend: `http://localhost:5173`. API: `http://localhost:3001/api`.

Account iniziali:

- `admin@parkinson.local`: password `ADMIN_PASSWORD` impostata localmente.
- `rossi@parkinson.local`, `bianchi@parkinson.local`, `verdi@parkinson.local`: password `DOCTOR_PASSWORD` impostata localmente.

Il seed distribuisce i 72 soggetti fra i tre medici. Esecuzioni successive non sovrascrivono password, assegnazioni o storico già presenti. Le password condivise fra i medici del seed sono esclusivamente una facilitazione demo: prima di un impiego reale servono credenziali individuali e cambio password.

Il frontend usa lo stesso origin delle API tramite proxy Vite. Per usare un origin diverso, aggiornare `APP_ORIGIN`; le richieste di scrittura con un'origine differente vengono rifiutate.

## Versionamento database

Le modifiche strutturali si descrivono in `schema.prisma`, poi si genera una **nuova** migrazione dalla cartella `apps/api`:

```sh
npm run db:migrate -- --name descrizione_modifica
```

Versionare schema e cartella delle migrazioni, non il file `.db`. Applicare le migrazioni esistenti con `npm run db:deploy` dalla radice. Il versionamento delle migrazioni non sostituisce i backup dei dati.

La migrazione iniziale contiene anche CHECK e trigger SQLite per il singleton amministrativo e per l'assegnazione a medici attivi. Prisma non rappresenta questi controlli interamente nel modello: esaminare le future migrazioni che ricostruiscono queste tabelle e mantenere i vincoli SQL. Non usare `db push` in sostituzione delle migrazioni.

## Verifiche

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

I test backend e browser usano database temporanei, senza modificare il database locale dell'app. I test browser avviano servizi dedicati sulle porte 5175 e 3002 e non devono essere puntati a un deployment reale.

Per servire la build frontend dallo stesso processo Node:

```sh
npm run build
npm start
```

Impostare in questo caso `APP_ORIGIN=http://localhost:3001`. La configurazione production con cookie Secure richiede HTTPS davanti al servizio; il server locale ascolta soltanto su loopback.

## Perimetro attuale

- Due ruoli: un amministratore unico e più medici.
- Registrazione medici riservata all'amministratore.
- Trasferimento atomico con controllo dell'assegnazione attesa, storico e audit nella medesima transazione.
- L'amministratore vede metadati delle assegnazioni, non feature o risultati clinici.
- I medici vedono soltanto i pazienti attualmente assegnati e i relativi test.
- Dashboard aggiornata ogni 5 secondi: conteggi persistenti e metriche HTTP del processo corrente.
- I risultati importati sono etichette note PaHaW, **non inferenze**. Non vengono chiamati né simulati modelli Python.
- Latenza API, percentuale senza 5xx e tempo dall'avvio non certificano SLA cloud, disponibilità esterna o affidabilità clinica.
- Recupero/cambio password, inserimento di nuovi pazienti/test, inferenza, monitoraggio esterno, TLS/NGINX e deployment container restano da integrare.
