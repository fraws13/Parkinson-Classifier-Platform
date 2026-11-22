# Report di creazione del modello ML

## Track 2 — Classificazione Parkinson (PaHaW)

**Progetto:** Cloud ML SaaS – Parkinson’s Disease Classification  
**Scopo del documento:** descrivere in modo chiaro e dettagliato tutte le operazioni svolte per costruire il dataset tabellare e addestrare/valutare il classificatore binario (soggetto sano vs paziente Parkinson), fino all’esportazione del bundle usabile dal SaaS.

---

## 1. Obiettivo del lavoro ML

L’obiettivo non è ottenere un modello clinico “di produzione” con accuratezza massima, bensì realizzare una **pipeline offline completa e metodologicamente corretta**, allineata alle indicazioni del corso e del professore:

1. usare solo **3 task grafomotori** selezionati (non tutti gli esercizi del corpus);
2. estrarre feature numeriche per **soggetto** (una riga = una persona);
3. applicare **Feature Selection di tipo filter** (Mutual Information), indipendente dal classificatore;
4. **non** usare data augmentation sintetica;
5. valutare con **Train/Test hold-out** + **K-Fold Cross-Validation** sul solo training set;
6. confrontare almeno **Linear SVM** e **Random Forest**;
7. esportare un artefatto (`pipeline.joblib`) pronto per l’inferenza online e un baseline SVM per simulare il retraining.

Il risultato è un modello **generale** (un unico classificatore per tutti i soggetti), non un modello personalizzato per paziente.

---



## 2. Materiali e strumenti



### 2.1 Dataset di partenza: PaHaW

Abbiamo utilizzato il corpus **PaHaW** (*Parkinson’s Disease Handwriting Database*):


| Percorso                                    | Contenuto                                       |
| ------------------------------------------- | ----------------------------------------------- |
| `PaHaW/PaHaW/PaHaW_public/<ID>/`            | Registrazioni grezze `.svc` per soggetto        |
| `PaHaW/PaHaW/PaHaW_files/corpus_PaHaW.xlsx` | Metadati clinici (tra cui la label `Disease`)   |
| `PaHaW/PaHaW/PaHaW_files/info.txt`          | Descrizione del formato `.svc` e del protocollo |


Secondo `info.txt`, il corpus contiene circa **37 pazienti PD** e **38 controlli sani** (totale ~75 soggetti). Gli ID delle cartelle **non sono consecutivi** (possono arrivare fino a `00098`): quindi “vedere 00098” non significa avere 98 pazienti, ma solo che l’identificativo anagrafico arriva a quel numero.

### 2.2 Formato dei file `.svc`

Ogni file `.svc` è una traiettoria di scrittura acquisita con tavoletta Wacom (~200 Hz). Struttura:

- **riga 1:** numero dichiarato di campioni;
- **righe successive:** `Y X timestamp button azimuth altitude pressure`;
- `button = 1` → penna sul foglio (*on-surface*);
- `button = 0` → penna in aria (*in-air*).

Importante: la colonna `y` nel `.svc` è la **coordinata verticale della penna**, **non** la label di classificazione.

### 2.3 Label di classificazione (`y` del modello)

La classe clinica sta nel file Excel `corpus_PaHaW.xlsx`, colonna `Disease`:

- `PD` = Parkinson’s Disease → etichetta modello **1**
- `H` = Healthy (controllo sano) → etichetta modello **0**

Altre colonne (es. `PD status`) descrivono metadati clinici (es. stato ON/OFF della terapia) e **non** sono usate come target.

### 2.4 I tre task scelti (come da indicazioni del professore)

Nel corpus ogni soggetto ha tipicamente 8 esercizi (`__1_` … `__8_`). 
I tre task coprono tre tipi di carico motorio diversi:

Spirale → controllo continuo, fluidità, tremor-like su traiettoria lunga
“l” ripetuta → ritmo, bradicinesia, micrografia su gesto ciclico (test classico in neurologia della scrittura)
“le” → breve pianificazione motoria + passaggio tra grafemi, senza arrivare a frasi lunghe.

Avete ~70 soggetti. Con ~20 feature/task:

3 task ≈ 60 feature
8 task ≈ 160+ feature
Con n << p il modello overfitta facilmente. Limitare i task è coerente con filter FS e con un modello generale stabile, non con “più colonne = meglio”.


| Numero file | Task                             | Ruolo nel progetto                      |
| ----------- | -------------------------------- | --------------------------------------- |
| **1**       | Spirale di Archimede             | Task geometrico / motorio puro          |
| **2**       | Lettera **“l”** corsiva ripetuta | Task ripetuto (classico neurologico)    |
| **3**       | Bigramma **“le”**                | Task linguistico breve (no frase lunga) |


I task 4–8 (trigramma, parole lunghe, frase completa) sono stati **esclusi** deliberatamente.

### 2.5 Script software prodotti


| File                                  | Funzione                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| `py/load_svc.py`                      | Legge un `.svc` e lo trasforma in tabella pandas          |
| `py/build_dataset.py`                 | Costruisce il dataset soggetto×feature + label            |
| `py/train.py`                         | Split, preprocessing, feature selection, CV, test, export |
| `py/notebooks/01_explore_pahaw.ipynb` | Esplorazione iniziale e controlli di qualità              |


Dipendenze principali: `pandas`, `numpy`, `openpyxl`, `scikit-learn`, `joblib`.

---



## 3. Fase A — Esplorazione del corpus

Prima di addestrare qualsiasi modello abbiamo verificato **cosa conteneva** il dataset.

### 3.1 Inventario filesystem

Abbiamo contato:

- quante cartelle soggetto esistono;
- quanti file `.svc` per task;
- quali soggetti erano incompleti.

**Esito rilevante:** quasi tutti i soggetti hanno i task 2–8; **tre soggetti** risultavano senza task 1 (spirale) e sono stati esclusi in seguito dalla costruzione del dataset tabellare.

### 3.2 Controllo del parser `.svc`

Abbiamo implementato e testato `load_svc()` su un file di esempio (`00001__1_1.svc`):

- ignora righe vuote;
- costruisce un DataFrame con le 7 colonne attese;
- se il numero in header non coincide con le righe reali, stampa un **warning** ma continua usando le righe effettivamente lette.

Alcuni file del corpus hanno header inconsistente (es. header 1396 ma 1344 righe). Questa anomalia è stata documentata e gestita senza interrompere la pipeline.

### 3.3 Verifica delle label

Dal Excel abbiamo controllato la distribuzione `PD` / `H` e il significato di eventuali colonne accessorie. La label usata per il machine learning resta esclusivamente `Disease`.

**Conclusione della fase esplorativa:** il corpus è utilizzabile; i tre task sono identificati; le label sono chiare; esistono poche incompletezze da gestire in modo esplicito.

---



## 4. Fase B — Costruzione del dataset (`build_dataset.py`)

Questa è la fase che trasforma i segnali grezzi in una **tabella pronta per il classificatore**.

### 4.1 Idea centrale

Il modello non classifica i singoli punti `(x, y)` della penna.  
Classifica **un soggetto intero**, rappresentato da un vettore di feature numeriche derivate dai suoi tre task.

Quindi:

```text
Soggetto 00001
  ├─ task 1 (.svc) → feature t1_*
  ├─ task 2 (.svc) → feature t2_*
  └─ task 3 (.svc) → feature t3_*
        ↓
  una sola riga nella tabella + colonna y (0/1)
```



### 4.2 Passi eseguiti dallo script

1. **Caricare il corpus Excel** e normalizzare:
  - `subject_id` (intero);
  - `disease` (PD/H);
  - `y` (1/0).
2. **Per ogni soggetto** nel Excel:
  - cercare i file `.svc` dei task 1, 2 e 3;
  - se manca anche un solo task tra i tre → **skip** del soggetto (con messaggio a log);
  - altrimenti caricare i tre segnali con `load_svc`.
3. **Estrarre le feature** da ciascun task (vedi sezione 4.3).
4. **Unire** feature + label in una sola tabella.
5. **Salvare** il risultato in `data/dataset.csv`.



### 4.3 Feature estratte per ogni task

Per ciascun task `t ∈ {1,2,3}` abbiamo calcolato un blocco di feature con prefisso `t1_`, `t2_`, `t3_`.

#### Feature di base (prima versione)


| Feature                     | Significato intuitivo                             |
| --------------------------- | ------------------------------------------------- |
| `n_samples`                 | Quanti punti ha la registrazione                  |
| `duration_ms`               | Quanto dura il task                               |
| `path_length`               | Quanto “cammina” la penna (lunghezza traiettoria) |
| `mean_speed` / `std_speed`  | Velocità media e quanto oscilla                   |
| `on_surface_pct`            | Percentuale di punti con penna sul foglio         |
| `n_strokes`                 | Quanti tratti continui on-surface                 |
| `pressure_mean/std/max/min` | Statistiche della pressione                       |




#### Feature arricchite (seconda versione)

Dopo un primo training con performance moderate, abbiamo arricchito lo stesso estrattore **senza cambiare algoritmo**, aggiungendo:


| Feature                                    | Significato intuitivo                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `in_air_pct`                               | Percentuale di punti in aria                                              |
| `on_surface_time_ms` / `in_air_time_ms`    | Tempo stimato sul foglio / in aria                                        |
| `mean_stroke_length` / `std_stroke_length` | Lunghezza media/variabilità dei tratti                                    |
| `mean_acceleration`                        | Quanto cambia la velocità                                                 |
| `mean_jerk` / `std_jerk`                   | “Scatti” del movimento (derivata dell’accelerazione)                      |
| `tremor_like`                              | Proxy semplice di irregolarità (variabilità delle variazioni di velocità) |
| `pressure_range`                           | Differenza max−min della pressione                                        |


**Scelta esplicita:** nessuna generazione di campioni sintetici (no data augmentation), perché variazioni casuali delle traiettorie rischierebbero di produrre movimenti neuromotori non plausibili.

### 4.4 Esito numerico del dataset costruito

Dopo l’esecuzione di `python build_dataset.py`:

- soggetti esportati: **72** (36 PD + 36 H);
- soggetti esclusi per task 1 mancante: **3** (`00061`, `00080`, `00089`);
- file di output: `data/dataset.csv`;
- dimensionalità: circa **63 feature** (+ `subject_id`, `disease`, `y`).

Il dataset è bilanciato: metà sani e metà Parkinson. Questo semplifica l’interpretazione di accuracy e F1.

---



## 5. Fase C — Addestramento e valutazione (`train.py`)



### 5.1 Principio anti data leakage (molto importante)

Abbiamo seguito una regola semplice:

> Il Test set non deve influenzare scelte di preprocessing, feature selection, iperparametri o selezione del modello.

Quindi:

1. si separa subito Train e Test;
2. tutto ciò che “impara” (scaler, filtro MI, classificazione, CV) avviene sul **Train**;
3. il Test si guarda **una sola volta** alla fine, solo per riportare la qualità stimata su soggetti nuovi.



### 5.2 Passo 1 — Caricamento

Lo script legge `data/dataset.csv` e separa:

- `X` = colonne numeriche di feature;
- `y` = label 0/1;
- `subject_id` = identificativo (tenuto per tracciabilità degli split).



### 5.3 Passo 2 — Split Train/Test

Parametri usati:

- `test_size = 20%`, aumentarlo porterebbe a un train troppo piccolo, diminuirlo   porterebbe la metrica hold-out ad essere troppo rumorosa, un solo errore cambierebbe l'accuracy. 
- `stratify = y` (per mantenere bilanciamento PD/H in entrambi gli split)
- `random_state = 42` (riproducibilità)

Risultato tipico ottenuto:

- **Train:** 57 soggetti (29 PD, 28 H)
- **Test:** 15 soggetti (circa 7–8 per classe)

Gli split sono anche salvati su disco (`data/X_train.csv`, `X_test.csv`, `y_train.csv`, `y_test.csv`, `subject_id_*.csv`) per poter ripetere analisi senza rifare lo split a caso.

### 5.4 Passo 3 — Pipeline di preprocessing + modello

Per ogni candidato (SVM e Random Forest) usiamo la **stessa** pipeline scikit-learn:

```text
SimpleImputer (mediana)
        ↓
StandardScaler
        ↓
SelectKBest(Mutual Information, k=20)
        ↓
Classificatore (LinearSVC  oppure  RandomForest)
```



#### Perché questi passi

1. **Imputer:** gestisce eventuali NaN (es. task senza tratti, divisioni per Δt nulli).
2. **Scaler:** porta le feature su scale confrontabili (velocità, pressione, millisecondi convivono male senza normalizzazione).
3. **SelectKBest + Mutual Information:** è una Feature Selection **filter**, indipendente dal classificatore (come richiesto: evitare Lasso/Ridge come metodo di selezione). Tiene le 20 feature più informative rispetto a `y`.
4. **Classificatore:**
  - **Linear SVM:** modello lineare, interpretabile come baseline; utile anche per simulare un modello “più debole” nel continuous training;
  - **Random Forest:** modello non lineare, con profondità limitata (`max_depth=4`) per ridurre overfitting su pochi soggetti.
Abbiamo confrontato solo Linear SVM e Random Forest perché rappresentano due famiglie opposte (decision boundary lineare vs ensemble non lineare), sono adatte a un dataset tabellare piccolo, e bastano a scegliere un modello demo affidabile senza allargare lo scope a tuning di architetture più complesse, non necessarie per l’integrazione SaaS.



### 5.5 Passo 4 — Cross-Validation sul solo Train

Abbiamo usato **Stratified 5-Fold CV** sul training set:

- il train viene diviso in 5 parti;
- a rotazione, 4 parti addestrano e 1 valida;
- si ottiene un’accuracy per fold, poi media e deviazione standard.

Questa CV serve a **scegliere** quale modello è migliore in modo onesto, senza guardare il Test.

### 5.6 Passo 5 — Fit finale e Test hold-out

Dopo la CV:

1. si riaddestra ciascun modello sull’**intero Train**;
2. si valuta sul Test (accuracy, F1 macro, confusion matrix, classification report);
3. si salvano i bundle `.joblib`.



### 5.7 Criterio di selezione del modello “demo”

Il modello esportato come principale (`models/pipeline.joblib`) è quello con:

1. **CV mean più alta**;
2. in caso di parità, **CV std più bassa**.

La Linear SVM viene comunque salvata anche come `models/pipeline_linear_svm.joblib` con ruolo `retraining_baseline`, per le simulazioni di riaddestramento previste dall’architettura.

---



## 6. Risultati ottenuti



### 6.1 Prima del forte arricchimento feature (riferimento)

In una prima esecuzione (feature più semplici, k=15):

- Linear SVM: CV ≈ **0.61**, Test ≈ **0.67**
- Random Forest: CV ≈ **0.49** (instabile), Test più alto (7.3) ma poco affidabile su 15 sample



### 6.2 Dopo arricchimento feature (configurazione corrente)


| Modello        | CV mean ± std (Train) | Test accuracy | Test F1 macro |
| -------------- | --------------------- | ------------- | ------------- |
| **Linear SVM** | **0.615 ± 0.116**     | 0.600         | 0.583         |
| Random Forest  | 0.579 ± 0.066         | 0.533         | 0.533         |


**Scelta demo:** Linear SVM (migliore in CV).

### 6.3 Come leggere questi numeri

Immaginate 72 compiti già svolti da pazienti/controlli.

1. Ne mettiamo **57** sul banco di studio (Train).
2. Sui 57 facciamo **5 prove interne** (CV): è il voto “in classe”.
3. Alla fine interroghiamo i modelli sui **15** compiti nuovi (Test): è l’esame.

- **CV mean** ≈ quanto il modello sembra bravo mentre impara.
- **CV std** ≈ quanto il voto cambia da una prova all’altra.
- **Test accuracy** ≈ quanti dei 15 nuovi indovina.
- **F1 macro** ≈ quanto è equilibrato tra classe H e classe PD.

Con soli 15 soggetti nel Test, un’accuracy può oscillare molto: per questo la decisione del modello si basa sulla **CV**, non sul singolo risultato di Test.

### 6.4 Interpretazione critica

- La performance è **moderata** (poco sopra/intorno al 60% in CV).
- L’arricchimento delle feature ha fatto entrare in selezione termini “sensati” (jerk, tremor-like, in-air, stroke length), ma **non ha prodotto un salto chiaro** oltre ~0.61 di CV per la SVM.
- Random Forest è migliorato in stabilità rispetto al primo run, ma resta inferiore alla SVM in CV.
- Il limite principale appare legato a:
  - **numerosità bassa** (72 soggetti);
  - natura **aggregata** delle feature (un vettore per soggetto, non modellazione fine della serie temporale);
  - difficoltà intrinseca del problema su questo corpus con setup didattico.

Per il corso, questo esito è comunque utile: dimostra una pipeline corretta, confronti trasparenti e consapevolezza dei limiti.

---



## 7. Artefatti prodotti (cosa resta nel repository)


| Artefatto                                                       | Descrizione                                    |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `data/dataset.csv`                                              | Tabella soggetto×feature + label               |
| `data/X_train.csv`, `X_test.csv`, `y_*.csv`, `subject_id_*.csv` | Split riproducibile                            |
| `models/pipeline.joblib`                                        | Modello demo (best CV, attualmente Linear SVM) |
| `models/pipeline_linear_svm.joblib`                             | Baseline lineare per simulazione retraining    |


Il bundle joblib contiene tipicamente:

- la `pipeline` sklearn già fittata;
- i nomi delle feature attese in input;
- le feature selezionate dal filtro MI;
- la mappa label `{H:0, PD:1}`;
- i task usati `[1,2,3]`.

---



## 8. Come riprodurre i passi (comandi)

Dalla cartella `py/` (o adattando i path):

```bash
python build_dataset.py
python train.py
```

Ordine obbligatorio: prima si costruisce/aggiorna `dataset.csv`, poi si addestra.

---



## 9. Decisioni di progetto e stato attuale



### Cosa abbiamo deliberatamente fatto

- limitazione ai task 1–2–3;
- esclusione soggetti incompleti;
- filter FS con Mutual Information;
- niente augmentation sintetica;
- CV sul train + test hold-out;
- confronto SVM vs RF;
- export di due bundle (demo + baseline retraining).



### Cosa abbiamo deliberatamente non fatto (per ora)

- non abbiamo inseguito ulteriori round di tuning solo per alzare l’accuracy di pochi punti;
- non abbiamo usato Lasso/Ridge come feature selection;
- non abbiamo ancora collegato il modello all’API SaaS (passo successivo).



### Stato

Il modello offline può considerarsi **sigillato come baseline didattica**: abbastanza maturo per passare all’integrazione applicativa (`/predict`, auth, container, Kubernetes), mantenendo traccia chiara di limiti e metriche in relazione/demo.

---



## 10. Sintesi finale

Abbiamo percorso l’intero cammino:

**segnali grezzi PaHaW → parsing → feature su 3 task → dataset bilanciato → split anti-leakage → filter MI → CV → test → export joblib.**

Il risultato quantitativo (CV ~61% per Linear SVM) è coerente con un dataset piccolo e un setup didattico; il valore del lavoro sta nella **correttezza del processo**, nella **riproducibilità** e nella **prontezza all’integrazione** nel SaaS di classificazione del Parkinson.