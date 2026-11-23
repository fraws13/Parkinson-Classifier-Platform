# AI session log

- **Date:** 2026-11-19 (and immediate follow-ups)
- **Author:** Team Group 2
- **Tool:** Cursor
- **Project area:** ML | docs
- **Goal:** Build the offline ML pipeline on PaHaW (tasks 1–2–3), train/evaluate Linear SVM vs Random Forest, and document the process.

## Prompt / request (summary)

- Explain PaHaW layout, labels (`PD`/`H`), and task mapping.
- Implement `load_svc.py`, `build_dataset.py`, `train.py`.
- Compare models with train-only CV; hold-out test once; enrich features after weak CV.
- Freeze model when CV stayed ~0.61; write a verbose model-creation report.
- Advise `.gitignore` for `PaHaW/` and generated artifacts.

## Output used

- Working ML scripts and exported bundles.
- Model creation report under `docs/ml/`.
- Decision to seal Linear SVM as demo model and keep SVM baseline for retraining simulation.

## Human review

- Team ran `build_dataset.py` / `train.py` locally and validated metrics.
- Confirmed: choose model on **CV**, not on noisy 15-sample test (RF once looked better on test while worse on CV).
- Feature enrichment added jerk / in-air / stroke / tremor-like features; no clear jump above ~0.61 CV → stop tuning, move to SaaS.
- Kept only tasks 1–2–3; no synthetic augmentation; Mutual Information filter FS.

## Files touched

- `py/load_svc.py`
- `py/build_dataset.py`
- `py/train.py`
- `py/notebooks/01_explore_pahaw.ipynb`
- `data/` (generated CSVs; may be gitignored)
- `models/pipeline.joblib`
- `models/pipeline_linear_svm.joblib`
- `docs/ml/report_creazione_modello.md`
- `.gitignore`
