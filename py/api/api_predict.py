"""Stub /predict allineato a contracts/feature_schema.json."""

from __future__ import annotations

import json
import hashlib
import math
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "contracts" / "feature_schema.json"
MODEL_PATH = REPO_ROOT / "models" / "pipeline.joblib"

with SCHEMA_PATH.open(encoding="utf-8") as f:
    SCHEMA = json.load(f)

FEATURE_NAMES: list[str] = SCHEMA["feature_names"]
LABEL_MAP: dict[str, int] = SCHEMA["label_map"]  # {"H": 0, "PD": 1}
ID_TO_LABEL = {v: k for k, v in LABEL_MAP.items()}

BUNDLE: dict[str, Any] | None = None
if MODEL_PATH.exists():
    BUNDLE = joblib.load(MODEL_PATH)
MODEL_VERSION = (
    f"{BUNDLE.get('model_name', 'model')}_{hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()[:16]}"
    if BUNDLE is not None else None
)
if BUNDLE is not None and BUNDLE.get('feature_names') != FEATURE_NAMES:
    raise RuntimeError('Model features differ from the versioned feature contract')

app = FastAPI(title="Parkinson Predict API", version="1.0")


class PredictRequest(BaseModel):
    subject_id: int | None = None
    features: dict[str, float | None] = Field(default_factory=dict)


class PredictResponse(BaseModel):
    subject_id: int | None = None
    prediction: int
    label: str
    model_version: str


def _vectorize(features: dict[str, float | None]) -> pd.DataFrame:
    unknown = set(features) - set(FEATURE_NAMES)
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Feature sconosciute: {sorted(unknown)}",
        )
    if set(features) != set(FEATURE_NAMES):
        raise HTTPException(status_code=400, detail='Tutte le 63 chiavi feature sono richieste (numero o null).')
    if not any(value is not None for value in features.values()):
        raise HTTPException(status_code=400, detail='Almeno una feature numerica è richiesta.')
    if any(value is not None and not math.isfinite(value) for value in features.values()):
        raise HTTPException(status_code=400, detail='Le feature devono essere finite.')
    if any(name.endswith('_pct') and value is not None and not 0 <= value <= 1 for name, value in features.items()):
        raise HTTPException(status_code=400, detail='Le frazioni _pct devono essere comprese tra 0 e 1.')
    row = {name: np.nan if features[name] is None else features[name] for name in FEATURE_NAMES}
    return pd.DataFrame([row], columns=FEATURE_NAMES)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": BUNDLE is not None,
        "n_features": len(FEATURE_NAMES),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    X = _vectorize(body.features)

    if BUNDLE is not None:
        pipeline = BUNDLE["pipeline"]
        pred = int(pipeline.predict(X)[0])
        model_version = MODEL_VERSION
    else:
        raise HTTPException(status_code=503, detail='Modello non disponibile: nessuna predizione simulata.')

    return PredictResponse(
        subject_id=body.subject_id,
        prediction=pred,
        label=ID_TO_LABEL[pred],
        model_version=model_version,
    )
