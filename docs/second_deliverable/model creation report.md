# ML Model Creation Report

## Track 2 — Parkinson's Classification (PaHaW)

**Project:** Cloud ML SaaS – Parkinson’s Disease Classification

**Document Purpose:** to describe clearly and in detail all operations carried out to build the tabular dataset and train/evaluate the binary classifier (healthy subject vs. Parkinson's patient), up to exporting the bundle usable by the SaaS.

---

## 1. Objective of the ML Work

The objective is not to obtain a "production" clinical model with maximum accuracy, but rather to build a **complete and methodologically sound offline pipeline**, aligned with the course and professor's guidelines:

1. use only **3 selected graphomotor tasks** (not all exercises in the corpus);
2. extract numerical features per **subject** (one row = one person);
3. apply **filter-based Feature Selection** (Mutual Information), independent of the classifier;
4. **do not** use synthetic data augmentation;
5. evaluate with **Train/Test hold-out** + **K-Fold Cross-Validation** on the training set only;
6. compare at least **Linear SVM** and **Random Forest**;
7. export an artifact (`pipeline.joblib`) ready for online inference and an SVM baseline to simulate retraining.

The result is a **general** model (a single classifier for all subjects), not a patient-personalized model.

---



## 2. Materials and Tools



### 2.1 Source Dataset: PaHaW

We used the **PaHaW** (*Parkinson’s Disease Handwriting Database*) corpus:


| Path                                        | Content                                           |
| ------------------------------------------- | ------------------------------------------------- |
| `PaHaW/PaHaW/PaHaW_public/<ID>/`            | Raw `.svc` recordings per subject                 |
| `PaHaW/PaHaW/PaHaW_files/corpus_PaHaW.xlsx` | Clinical metadata (including the `Disease` label) |
| `PaHaW/PaHaW/PaHaW_files/info.txt`          | Description of the `.svc` format and protocol     |


According to `info.txt`, the corpus contains approximately **37 PD patients** and **38 healthy controls** (total ~75 subjects). Folder IDs **are not consecutive** (they can go up to `00098`): therefore, "seeing 00098" does not mean having 98 patients, only that the demographic identifier reaches that number.

### 2.2 Format of `.svc` Files

Each `.svc` file is a handwriting trajectory acquired with a Wacom tablet (~200 Hz). Structure:

- **line 1:** declared number of samples;
- **subsequent lines:** `Y X timestamp button azimuth altitude pressure`;
- `button = 1` → pen on paper (*on-surface*);
- `button = 0` → pen in air (*in-air*).

Important: the `y` column in the `.svc` file is the **vertical coordinate of the pen**, **not** the classification label.

### 2.3 Classification Label (`y` of the model)

The clinical class is in the Excel file `corpus_PaHaW.xlsx`, `Disease` column:

- `PD` = Parkinson’s Disease → model label **1**
- `H` = Healthy (healthy control) → model label **0**

Other columns (e.g., `PD status`) describe clinical metadata (e.g., ON/OFF medication state) and are **not** used as targets.

### 2.4 The Three Chosen Tasks (as per professor's guidelines)

In the corpus, each subject typically has 8 exercises (`__1_` … `__8_`).
The three tasks cover three different types of motor load:

Spiral → continuous control, fluidity, tremor-like on a long trajectory
Repeated “l” → rhythm, bradykinesia, micrographia on a cyclic gesture (classic test in handwriting neurology)
“le” → brief motor planning + transition between graphemes, without reaching long sentences.

You have ~70 subjects. With ~20 features/task:

3 tasks ≈ 60 features
8 tasks ≈ 160+ features
With n << p the model overfits easily. Limiting the tasks is consistent with filter FS and with a stable general model, not with "more columns = better".

| File Number | Task                            | Role in the Project                      |
| ----------- | ------------------------------- | ---------------------------------------- |
| **1**       | Archimedean Spiral              | Pure geometric / motor task              |
| **2**       | Repeated cursive letter **“l”** | Repeated task (classic neurological)     |
| **3**       | Bigram **“le”**                 | Short linguistic task (no long sentence) |


Tasks 4–8 (trigram, long words, full sentence) were deliberately **excluded**.

### 2.5 Software Scripts Produced


| File                                  | Function                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| `py/load_svc.py`                      | Reads an `.svc` and transforms it into a pandas table     |
| `py/build_dataset.py`                 | Builds the subject×feature + label dataset                |
| `py/train.py`                         | Split, preprocessing, feature selection, CV, test, export |
| `py/notebooks/01_explore_pahaw.ipynb` | Initial exploration and quality checks                    |


Main dependencies: `pandas`, `numpy`, `openpyxl`, `scikit-learn`, `joblib`.

---



## 3. Phase A — Corpus Exploration

Before training any model, we verified **what** the dataset contained.

### 3.1 Filesystem Inventory

We counted:

- how many subject folders exist;
- how many `.svc` files per task;
- which subjects were incomplete.

**Relevant outcome:** almost all subjects have tasks 2–8; **three subjects** were missing task 1 (spiral) and were subsequently excluded from building the tabular dataset.

### 3.2 `.svc` Parser Check

We implemented and tested `load_svc()` on a sample file (`00001__1_1.svc`):

- ignores empty lines;
- builds a DataFrame with the 7 expected columns;
- if the number in the header does not match the actual lines, prints a **warning** but continues using the lines actually read.

Some files in the corpus have an inconsistent header (e.g., header 1396 but 1344 lines). This anomaly was documented and handled without interrupting the pipeline.

### 3.3 Label Verification

From the Excel file, we checked the `PD` / `H` distribution and the meaning of any accessory columns. The label used for machine learning remains exclusively `Disease`.

**Conclusion of the exploratory phase:** the corpus is usable; the three tasks are identified; the labels are clear; there are few incompletenesses to handle explicitly.

---



## 4. Phase B — Dataset Construction (`build_dataset.py`)

This is the phase that transforms raw signals into a **table ready for the classifier**.

### 4.1 Core Idea

The model does not classify individual `(x, y)` points of the pen.

It classifies **an entire subject**, represented by a vector of numerical features derived from their three tasks.

Therefore:

```text
Subject 00001
  ├─ task 1 (.svc) → features t1_*
  ├─ task 2 (.svc) → features t2_*
  └─ task 3 (.svc) → features t3_*
        ↓
  a single row in the table + column y (0/1)

```



### 4.2 Steps Executed by the Script

1. **Load the Excel corpus** and normalize:

- `subject_id` (integer);
- `disease` (PD/H);
- `y` (1/0).

1. **For each subject** in the Excel:

- search for the `.svc` files of tasks 1, 2, and 3;
- if even a single task among the three is missing → **skip** the subject (with a log message);
- otherwise load the three signals with `load_svc`.

1. **Extract features** from each task (see section 4.3).
2. **Merge** features + label into a single table.
3. **Save** the result in `data/dataset.csv`.



### 4.3 Features Extracted per Task

For each task `t ∈ {1,2,3}` we computed a block of features prefixed with `t1_`, `t2_`, `t3_`.

#### Basic Features (first version)


| Feature                     | Intuitive Meaning                           |
| --------------------------- | ------------------------------------------- |
| `n_samples`                 | How many points the recording has           |
| `duration_ms`               | How long the task lasts                     |
| `path_length`               | How far the pen "walks" (trajectory length) |
| `mean_speed` / `std_speed`  | Average speed and how much it fluctuates    |
| `on_surface_pct`            | Percentage of points with pen on paper      |
| `n_strokes`                 | How many continuous on-surface strokes      |
| `pressure_mean/std/max/min` | Pressure statistics                         |




#### Enriched Features (second version)

After an initial training with moderate performance, we enriched the same extractor **without changing the algorithm**, adding:


| Feature                                    | Intuitive Meaning                                              |
| ------------------------------------------ | -------------------------------------------------------------- |
| `in_air_pct`                               | Percentage of points in air                                    |
| `on_surface_time_ms` / `in_air_time_ms`    | Estimated time on paper / in air                               |
| `mean_stroke_length` / `std_stroke_length` | Average length/variability of strokes                          |
| `mean_acceleration`                        | How much the speed changes                                     |
| `mean_jerk` / `std_jerk`                   | "Jerks" of the movement (derivative of acceleration)           |
| `tremor_like`                              | Simple proxy of irregularity (variability of speed variations) |
| `pressure_range`                           | Max−min difference of pressure                                 |


**Explicit choice:** no generation of synthetic samples (no data augmentation), because random variations of trajectories would risk producing implausible neuromotor movements.

### 4.4 Numerical Outcome of the Built Dataset

After running `python build_dataset.py`:

- exported subjects: **72** (36 PD + 36 H);
- subjects excluded due to missing task 1: **3** (`00061`, `00080`, `00089`);
- output file: `data/dataset.csv`;
- dimensionality: approximately **63 features** (+ `subject_id`, `disease`, `y`).

The dataset is balanced: half healthy and half Parkinson's. This simplifies the interpretation of accuracy and F1.

---



## 5. Phase C — Training and Evaluation (`train.py`)



### 5.1 Anti-Data Leakage Principle (very important)

We followed a simple rule:

> The Test set must not influence preprocessing choices, feature selection, hyperparameters, or model selection.

Therefore:

1. Train and Test are separated immediately;
2. everything that "learns" (scaler, MI filter, classification, CV) takes place on **Train**;
3. Test is looked at **only once** at the end, solely to report the estimated quality on new subjects.



### 5.2 Step 1 — Loading

The script reads `data/dataset.csv` and separates:

- `X` = numerical feature columns;
- `y` = 0/1 label;
- `subject_id` = identifier (kept for traceability of splits).



### 5.3 Step 2 — Train/Test Split

Parameters used:

- `test_size = 20%`, increasing it would lead to a too-small train set, decreasing it would make the hold-out metric too noisy, a single error would change accuracy.
- `stratify = y` (to maintain PD/H balance in both splits)
- `random_state = 42` (reproducibility)

Typical result obtained:

- **Train:** 57 subjects (29 PD, 28 H)
- **Test:** 15 subjects (approx. 7–8 per class)

The splits are also saved to disk (`data/X_train.csv`, `X_test.csv`, `y_train.csv`, `y_test.csv`, `subject_id_*.csv`) to allow repeating analyses without redoing the random split.

### 5.4 Step 3 — Preprocessing + Model Pipeline

For each candidate (SVM and Random Forest) we use the **same** scikit-learn pipeline:

```text
SimpleImputer (median)
        ↓
StandardScaler
        ↓
SelectKBest(Mutual Information, k=20)
        ↓
Classifier (LinearSVC  or  RandomForest)

```



#### Why these steps

1. **Imputer:** handles any NaNs (e.g., tasks without strokes, divisions by zero Δt).
2. **Scaler:** brings features onto comparable scales (speed, pressure, milliseconds coexist poorly without normalization).
3. **SelectKBest + Mutual Information:** is a **filter** Feature Selection, independent of the classifier (as required: avoid Lasso/Ridge as a selection method). Keeps the 20 most informative features with respect to `y`.

We use a filter Feature Selection based on Mutual Information to reduce dimensionality on a small sample, selecting the most informative features with respect to the label independently of the classifier, so the SVM vs RF comparison remains fair.

4. **Classifier:**

- **Linear SVM:** linear model, interpretable as a baseline; also useful to simulate a "weaker" model in continuous training;
- **Random Forest:** non-linear model, with limited depth (`max_depth=4`) to reduce overfitting on few subjects.
We compared only Linear SVM and Random Forest because they represent two opposite families (linear decision boundary vs non-linear ensemble), are suited to a small tabular dataset, and are sufficient to choose a reliable demo model without broadening the scope to tuning more complex architectures, which are unnecessary for SaaS integration.



### 5.5 Step 4 — Cross-Validation on Train Only

We used **Stratified 5-Fold CV** on the training set:

- the train set is divided into 5 parts;
- in rotation, 4 parts train and 1 validates;
- one accuracy per fold is obtained, then mean and standard deviation.

This CV serves to **choose** which model is better in an honest way, without looking at Test.

### 5.6 Step 5 — Final Fit and Hold-Out Test

After CV:

1. each model is retrained on the **entire Train** set;
2. evaluated on Test (accuracy, macro F1, confusion matrix, classification report);
3. `.joblib` bundles are saved.



### 5.7 Selection Criterion for the "Demo" Model

The model exported as the primary one (`models/pipeline.joblib`) is the one with:

1. **highest CV mean**;
2. in case of a tie, **lowest CV std**.

Linear SVM is still also saved as `models/pipeline_linear_svm.joblib` with the `retraining_baseline` role, for the retraining simulations foreseen by the architecture.

---



## 6. Obtained Results



### 6.1 Before Strong Feature Enrichment (reference)

In an initial run (simpler features, k=15):

- Linear SVM: CV ≈ **0.61**, Test ≈ **0.67**
- Random Forest: CV ≈ **0.49** (unstable), higher Test (7.3) but unreliable on 15 samples



### 6.2 After Feature Enrichment (current configuration)


| Model          | CV mean ± std (Train) | Test accuracy | Test F1 macro |
| -------------- | --------------------- | ------------- | ------------- |
| **Linear SVM** | **0.615 ± 0.116**     | 0.600         | 0.583         |
| Random Forest  | 0.579 ± 0.066         | 0.533         | 0.533         |


**Demo choice:** Linear SVM (best in CV).

### 6.3 How to Read These Numbers

Imagine 72 assignments already completed by patients/controls.

1. We put **57** on the study desk (Train).
2. On the 57 we run **5 internal tests** (CV): this is the "in-class" grade.
3. At the end we quiz the models on the **15** new assignments (Test): this is the exam.

- **CV mean** ≈ how good the model seems while learning.
- **CV std** ≈ how much the grade changes from one test to another.
- **Test accuracy** ≈ how many of the 15 new ones it guesses right.
- **F1 macro** ≈ how balanced it is between class H and class PD.

With only 15 subjects in Test, accuracy can fluctuate greatly: for this reason, the model decision is based on **CV**, not on the single Test result.

### 6.4 Critical Interpretation

- Performance is **moderate** (just above/around 60% in CV).
- Feature enrichment brought "sensible" terms into selection (jerk, tremor-like, in-air, stroke length), but **did not produce a clear jump** beyond ~0.61 CV for SVM.
- Random Forest improved in stability compared to the first run, but remains lower than SVM in CV.
- The main limitation appears linked to:
- **low sample size** (72 subjects);
- **aggregated** nature of the features (one vector per subject, not fine-grained time-series modeling);
- intrinsic difficulty of the problem on this corpus with a didactic setup.

For the course, this outcome is still useful: it demonstrates a proper pipeline, transparent comparisons, and awareness of limitations.

---



## 7. Produced Artifacts (what remains in the repository)


| Artifact                                                        | Description                                |
| --------------------------------------------------------------- | ------------------------------------------ |
| `data/dataset.csv`                                              | Subject×feature + label table              |
| `data/X_train.csv`, `X_test.csv`, `y_*.csv`, `subject_id_*.csv` | Reproducible split                         |
| `models/pipeline.joblib`                                        | Demo model (best CV, currently Linear SVM) |
| `models/pipeline_linear_svm.joblib`                             | Linear baseline for retraining simulation  |


The joblib bundle typically contains:

- the already-fitted sklearn `pipeline`;
- the names of the expected input features;
- the features selected by the MI filter;
- the `{H:0, PD:1}` label map;
- the `[1,2,3]` tasks used.

---



## 8. How to Reproduce the Steps (commands)

From the `py/` folder (or adapting the paths):

```bash
python build_dataset.py
python train.py

```

Mandatory order: first build/update `dataset.csv`, then train.

---



## 9. Design Decisions and Current Status



### What we deliberately did

- restriction to tasks 1–2–3;
- exclusion of incomplete subjects;
- filter FS with Mutual Information;
- no synthetic augmentation;
- CV on train + hold-out test;
- SVM vs RF comparison;
- export of two bundles (demo + retraining baseline).



### What we deliberately did not do (for now)

- we did not pursue further tuning rounds just to raise accuracy by a few points;
- we did not use Lasso/Ridge as feature selection;
- we have not yet connected the model to the SaaS API (next step).



### Status

The offline model can be considered **sealed as a didactic baseline**: mature enough to move on to application integration (`/predict`, auth, container, Kubernetes), maintaining a clear record of limitations and metrics in the report/demo.

---



## 10. Final Summary

We walked the entire path:

**raw PaHaW signals → parsing → features on 3 tasks → balanced dataset → anti-leakage split → MI filter → CV → test → joblib export.**

The quantitative result (CV ~61% for Linear SVM) is consistent with a small dataset and a didactic setup; the value of the work lies in the **soundness of the process**, **reproducibility**, and **readiness for integration** into the Parkinson's classification SaaS.
