"""Train/test split, filter FS, CV comparison (Linear SVM vs RF), model export."""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, mutual_info_classif
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = REPO_ROOT / "data" / "dataset.csv"
DATA_DIR = REPO_ROOT / "data"
MODELS_DIR = REPO_ROOT / "models"

TEST_SIZE = 0.2
RANDOM_STATE = 42
N_FOLDS = 5
K_BEST = 20
# If CV mean stays below this, feature engineering is likely the bottleneck
CV_STRONG_THRESHOLD = 0.70


def load_xy(path: Path = DATA_PATH) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    df = pd.read_csv(path)
    y = df["y"].astype(int)
    meta_id = df["subject_id"].astype(int)
    feature_cols = [c for c in df.columns if c not in {"subject_id", "disease", "y"}]
    X = df[feature_cols].apply(pd.to_numeric, errors="coerce")
    return X, y, meta_id


def make_classifier(name: str):
    if name == "linear_svm":
        return LinearSVC(
            dual="auto",
            max_iter=10_000,
            random_state=RANDOM_STATE,
        )
    if name == "random_forest":
        return RandomForestClassifier(
            n_estimators=200,
            max_depth=4,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    raise ValueError(f"Unknown classifier: {name}")


def make_pipeline(clf_name: str, k_best: int = K_BEST) -> Pipeline:
    """Impute -> scale -> Mutual Information filter -> classifier."""
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "feature_selection",
                SelectKBest(score_func=mutual_info_classif, k=k_best),
            ),
            ("clf", make_classifier(clf_name)),
        ]
    )


def save_splits(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    id_train: pd.Series,
    id_test: pd.Series,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    X_train.to_csv(DATA_DIR / "X_train.csv", index=False)
    X_test.to_csv(DATA_DIR / "X_test.csv", index=False)
    y_train.to_csv(DATA_DIR / "y_train.csv", index=False, header=True)
    y_test.to_csv(DATA_DIR / "y_test.csv", index=False, header=True)
    id_train.to_csv(DATA_DIR / "subject_id_train.csv", index=False, header=True)
    id_test.to_csv(DATA_DIR / "subject_id_test.csv", index=False, header=True)


def run_cv(pipeline: Pipeline, X: pd.DataFrame, y: pd.Series) -> np.ndarray:
    cv = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    return cross_val_score(pipeline, X, y, cv=cv, scoring="accuracy")


def evaluate_on_test(name: str, pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> None:
    y_pred = pipeline.predict(X_test)
    print(f"\n=== Hold-out TEST · {name} ===")
    print(f"  accuracy={accuracy_score(y_test, y_pred):.3f}")
    print(f"  f1_macro={f1_score(y_test, y_pred, average='macro'):.3f}")
    print("  confusion_matrix [rows=true H/PD, cols=pred H/PD]:")
    print(confusion_matrix(y_test, y_pred, labels=[0, 1]))
    print(classification_report(y_test, y_pred, target_names=["H", "PD"]))


def save_bundle(
    path: Path,
    pipeline: Pipeline,
    feature_names: list[str],
    selected_features: list[str],
    model_name: str,
    role: str,
) -> None:
    joblib.dump(
        {
            "pipeline": pipeline,
            "model_name": model_name,
            "role": role,
            "feature_names": feature_names,
            "selected_features": selected_features,
            "label_map": {"H": 0, "PD": 1},
            "tasks": [1, 2, 3],
        },
        path,
    )
    print(f"saved {path} ({role})")


def main() -> None:
    X, y, subject_id = load_xy()
    k = min(K_BEST, X.shape[1])

    X_train, X_test, y_train, y_test, id_train, id_test = train_test_split(
        X,
        y,
        subject_id,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )
    save_splits(X_train, X_test, y_train, y_test, id_train, id_test)
    print(
        f"split: train={len(X_train)} test={len(X_test)} "
        f"(PD train={int(y_train.sum())}, H train={int((y_train == 0).sum())})"
    )

    candidates = {
        "linear_svm": make_pipeline("linear_svm", k_best=k),
        "random_forest": make_pipeline("random_forest", k_best=k),
    }

    print(f"\n{N_FOLDS}-fold Stratified CV on TRAIN only (accuracy):")
    cv_results: dict[str, np.ndarray] = {}
    for name, pipe in candidates.items():
        scores = run_cv(pipe, X_train, y_train)
        cv_results[name] = scores
        print(f"  [{name}] folds={np.round(scores, 3).tolist()}")
        print(f"           mean={scores.mean():.3f}  std={scores.std():.3f}")

    # Best demo model: higher CV mean, then lower std
    best_name = max(
        cv_results.keys(),
        key=lambda n: (cv_results[n].mean(), -cv_results[n].std()),
    )
    best_mean = cv_results[best_name].mean()
    best_std = cv_results[best_name].std()
    print(f"\nBest on CV (demo model): {best_name}  mean={best_mean:.3f}  std={best_std:.3f}")

    if best_mean < CV_STRONG_THRESHOLD:
        print(
            f"NOTE: best CV mean < {CV_STRONG_THRESHOLD:.2f}. "
            "Likely feature bottleneck → enrich build_dataset.py "
            "(jerk, in-air time, stroke length, tremor-like) before more model tuning."
        )

    # Fit both on full train, then look at test ONCE for each
    fitted: dict[str, Pipeline] = {}
    for name, pipe in candidates.items():
        pipe.fit(X_train, y_train)
        fitted[name] = pipe
        evaluate_on_test(name, pipe, X_test, y_test)

    demo_pipe = fitted[best_name]
    svm_pipe = fitted["linear_svm"]

    selected_mask = demo_pipe.named_steps["feature_selection"].get_support()
    selected_features = X.columns[selected_mask].tolist()
    print(f"\nSelected features for demo model ({best_name}, k={k}):")
    for name in selected_features:
        print(f"  - {name}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    # Demo / production inference bundle
    save_bundle(
        MODELS_DIR / "pipeline.joblib",
        demo_pipe,
        X.columns.tolist(),
        selected_features,
        model_name=best_name,
        role="demo_best_cv",
    )
    # Weaker / linear baseline kept for continuous-training simulation
    svm_mask = svm_pipe.named_steps["feature_selection"].get_support()
    svm_selected = X.columns[svm_mask].tolist()
    save_bundle(
        MODELS_DIR / "pipeline_linear_svm.joblib",
        svm_pipe,
        X.columns.tolist(),
        svm_selected,
        model_name="linear_svm",
        role="retraining_baseline",
    )


if __name__ == "__main__":
    main()
