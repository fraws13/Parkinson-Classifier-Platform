"""Stub /predict allineato a contracts/feature_schema.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
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
    row = {name: features.get(name) for name in FEATURE_NAMES}
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
        model_version = f"{BUNDLE.get('model_name', 'model')}_v1"
    else:
        # Stub finché non c'è models/pipeline.joblib
        pred = 0
        model_version = "stub_v0"

    return PredictResponse(
        subject_id=body.subject_id,
        prediction=pred,
        label=ID_TO_LABEL[pred],
        model_version=model_version,
    )