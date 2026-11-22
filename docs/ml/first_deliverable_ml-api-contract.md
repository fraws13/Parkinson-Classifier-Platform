# AI session log

- **Date:** 2026-11-22
- **Author:** Team Group 2
- **Tool:** Cursor
- **Deliverable:** first_deliverable (handoff ML → app)
- **Project area:** ML | docs | API
- **Goal:** Expose a stable JSON feature contract and a `/predict` stub so the App Developer can work in parallel without touching PaHaW raw files.

## Prompt / request (summary)

- How to pass patient data as JSON for the monolithic app.
- Freeze `feature_schema.json` (feature names + request/response contract).
- Build `patients_seed.json` from `dataset.csv` (nested `features` object).
- Implement FastAPI stub `py/api/api_predict.py`.
- Fix Windows launch (`python -m uvicorn`), schema key `feature_names` vs `features`, and clarify GET `/` / GET `/predict` vs POST.

## Output used

- Versionable contract under `contracts/` for the App Developer.
- Seed patients for forms/DB/demo.
- Working `/health` and `POST /predict` (real `pipeline.joblib` if present, else stub prediction).

## Human review

- Schema key finalized as `feature_names` (not `features`); API updated accordingly.
- Seed nested under `features` to match the predict request body.
- Response contract: `prediction`, `label`, `model_version` (probability left out of current schema).
- Team validated `/docs` + POST try-out; GET `/` and GET `/predict` 404/405 are expected.

## Files touched

- `contracts/feature_schema.json`
- `contracts/patients_seed.json`
- `py/api/api_predict.py`
- `docs/ml/first_deliverable_ml-api-contract.md`
- `docs/ai_logs/index.md`
