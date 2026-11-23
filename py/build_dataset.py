"""Build subject-level feature table from PaHaW tasks 1, 2, 3."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from load_svc import list_subject_svc_files, load_svc, parse_svc_stem

# Professor-selected tasks: spiral, repeated "l", bigram "le"
SELECTED_TASKS = [1, 2, 3]

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "PaHaW" / "PaHaW" / "PaHaW_public"
CORPUS_PATH = REPO_ROOT / "PaHaW" / "PaHaW" / "PaHaW_files" / "corpus_PaHaW.xlsx"
OUTPUT_PATH = REPO_ROOT / "data" / "dataset.csv"


def _resolve_column(columns: list[str], candidates: list[str]) -> str:
    lower_map = {c.lower().strip(): c for c in columns}
    for name in candidates:
        if name.lower() in lower_map:
            return lower_map[name.lower()]
    raise KeyError(f"None of {candidates} found in columns: {columns}")


def load_corpus(path: Path = CORPUS_PATH) -> pd.DataFrame:
    """Load subject metadata and normalize id / label columns."""
    meta = pd.read_excel(path)
    id_col = _resolve_column(meta.columns.tolist(), ["ID", "Id", "id", "Subject", "subject"])
    disease_col = _resolve_column(
        meta.columns.tolist(),
        ["Disease", "disease", "Diagnosis", "Group", "Label"],
    )

    out = meta.copy()
    out["subject_id"] = out[id_col].astype(int)
    labels = out[disease_col].astype(str).str.strip().str.upper()
    # PD -> 1, H/HC/HEALTHY -> 0
    out["y"] = labels.map(lambda v: 1 if v.startswith("PD") else 0 if v.startswith("H") else np.nan)
    if out["y"].isna().any():
        bad = out.loc[out["y"].isna(), disease_col].unique().tolist()
        raise ValueError(f"Unknown Disease values: {bad}")
    out["y"] = out["y"].astype(int)
    out["disease"] = labels
    return out[["subject_id", "disease", "y"]].drop_duplicates("subject_id")


def _empty_task_features(prefix: str) -> dict[str, float]:
    keys = [
        "n_samples",
        "duration_ms",
        "path_length",
        "mean_speed",
        "std_speed",
        "on_surface_pct",
        "in_air_pct",
        "on_surface_time_ms",
        "in_air_time_ms",
        "n_strokes",
        "mean_stroke_length",
        "std_stroke_length",
        "mean_acceleration",
        "mean_jerk",
        "std_jerk",
        "tremor_like",
        "pressure_mean",
        "pressure_std",
        "pressure_max",
        "pressure_min",
        "pressure_range",
    ]
    out = {f"{prefix}n_samples": 0.0}
    for key in keys[1:]:
        out[f"{prefix}{key}"] = np.nan
    return out


def _stroke_lengths(dist: np.ndarray, on_seg: np.ndarray) -> np.ndarray:
    """Sum path length over contiguous on-surface segments (aligned to diff samples)."""
    if len(dist) == 0 or len(on_seg) == 0:
        return np.array([])
    lengths: list[float] = []
    current = 0.0
    in_stroke = False
    for d, is_on in zip(dist, on_seg):
        if is_on:
            current += float(d)
            in_stroke = True
        elif in_stroke:
            lengths.append(current)
            current = 0.0
            in_stroke = False
    if in_stroke:
        lengths.append(current)
    return np.asarray(lengths, dtype=float)


def extract_task_features(df: pd.DataFrame, task_id: int) -> dict[str, float]:
    """Extract kinematic / pressure features for one task recording."""
    prefix = f"t{task_id}_"
    if df.empty:
        return _empty_task_features(prefix)

    x = df["x"].to_numpy(dtype=float)
    y = df["y"].to_numpy(dtype=float)
    t = df["t"].to_numpy(dtype=float)
    button = df["button"].to_numpy(dtype=int)
    pressure = df["pressure"].to_numpy(dtype=float)

    duration_ms = float(t.max() - t.min()) if len(t) else np.nan

    dx = np.diff(x)
    dy = np.diff(y)
    dist = np.sqrt(dx**2 + dy**2)
    path_length = float(dist.sum()) if len(dist) else 0.0

    dt = np.diff(t).astype(float)
    dt_safe = np.where(dt <= 0, np.nan, dt)
    speed = dist / dt_safe
    mean_speed = float(np.nanmean(speed)) if len(speed) else np.nan
    std_speed = float(np.nanstd(speed)) if len(speed) else np.nan

    # Acceleration and jerk from speed samples (ignore non-finite)
    speed_finite = np.where(np.isfinite(speed), speed, np.nan)
    dspeed = np.diff(speed_finite)
    dt2 = dt_safe[1:]
    accel = dspeed / dt2
    mean_acceleration = float(np.nanmean(np.abs(accel))) if len(accel) else np.nan

    daccel = np.diff(accel)
    dt3 = dt_safe[2:]
    jerk = daccel / dt3
    mean_jerk = float(np.nanmean(np.abs(jerk))) if len(jerk) else np.nan
    std_jerk = float(np.nanstd(jerk)) if len(jerk) else np.nan
    # Simple tremor proxy: variability of speed changes
    tremor_like = float(np.nanstd(dspeed)) if len(dspeed) else np.nan

    on = button == 1
    in_air = button == 0
    on_surface_pct = float(on.mean())
    in_air_pct = float(in_air.mean())

    # Time spent on-surface / in-air using inter-sample dt (length n-1)
    if len(dt) > 0:
        on_seg = on[1:] | on[:-1]
        air_seg = in_air[1:] | in_air[:-1]
        dt_pos = np.where(np.isfinite(dt_safe), dt_safe, 0.0)
        on_surface_time_ms = float(dt_pos[on_seg].sum())
        in_air_time_ms = float(dt_pos[air_seg].sum())
    else:
        on_surface_time_ms = np.nan
        in_air_time_ms = np.nan

    n_strokes = int(np.sum(on & np.r_[True, ~on[:-1]])) if len(on) else 0
    stroke_lens = _stroke_lengths(dist, on[1:] if len(on) > 1 else np.array([], dtype=bool))
    mean_stroke_length = float(np.mean(stroke_lens)) if len(stroke_lens) else np.nan
    std_stroke_length = float(np.std(stroke_lens)) if len(stroke_lens) else np.nan

    pressure_mean = float(np.mean(pressure))
    pressure_std = float(np.std(pressure))
    pressure_max = float(np.max(pressure))
    pressure_min = float(np.min(pressure))

    return {
        f"{prefix}n_samples": float(len(df)),
        f"{prefix}duration_ms": duration_ms,
        f"{prefix}path_length": path_length,
        f"{prefix}mean_speed": mean_speed,
        f"{prefix}std_speed": std_speed,
        f"{prefix}on_surface_pct": on_surface_pct,
        f"{prefix}in_air_pct": in_air_pct,
        f"{prefix}on_surface_time_ms": on_surface_time_ms,
        f"{prefix}in_air_time_ms": in_air_time_ms,
        f"{prefix}n_strokes": float(n_strokes),
        f"{prefix}mean_stroke_length": mean_stroke_length,
        f"{prefix}std_stroke_length": std_stroke_length,
        f"{prefix}mean_acceleration": mean_acceleration,
        f"{prefix}mean_jerk": mean_jerk,
        f"{prefix}std_jerk": std_jerk,
        f"{prefix}tremor_like": tremor_like,
        f"{prefix}pressure_mean": pressure_mean,
        f"{prefix}pressure_std": pressure_std,
        f"{prefix}pressure_max": pressure_max,
        f"{prefix}pressure_min": pressure_min,
        f"{prefix}pressure_range": pressure_max - pressure_min,
    }


def features_for_subject(
    subject_id: int,
    public_root: Path = PUBLIC_ROOT,
    tasks: list[int] = SELECTED_TASKS,
) -> dict[str, float] | None:
    """Build one feature dict for a subject; None if any selected task is missing."""
    try:
        files = list_subject_svc_files(public_root, subject_id, tasks=tasks)
    except FileNotFoundError:
        return None

    found_tasks = {int(parse_svc_stem(p.stem)[1]): p for p in files}
    if any(task not in found_tasks for task in tasks):
        missing = [t for t in tasks if t not in found_tasks]
        print(f"skip subject {subject_id:05d}: missing tasks {missing}")
        return None

    row: dict[str, float] = {"subject_id": float(subject_id)}
    for task in tasks:
        df = load_svc(found_tasks[task], warn_mismatch=True)
        row.update(extract_task_features(df, task))
    return row


def build_dataset(
    public_root: Path = PUBLIC_ROOT,
    corpus_path: Path = CORPUS_PATH,
    tasks: list[int] = SELECTED_TASKS,
) -> pd.DataFrame:
    """Return subject x feature table with binary label y."""
    meta = load_corpus(corpus_path)
    rows: list[dict[str, float]] = []

    for subject_id in meta["subject_id"].tolist():
        feats = features_for_subject(int(subject_id), public_root=public_root, tasks=tasks)
        if feats is None:
            continue
        rows.append(feats)

    features = pd.DataFrame(rows)
    if features.empty:
        raise RuntimeError("No subjects produced features. Check paths and task files.")

    features["subject_id"] = features["subject_id"].astype(int)
    dataset = features.merge(meta, on="subject_id", how="inner")

    # Stable column order: ids/labels first, then features
    front = ["subject_id", "disease", "y"]
    feature_cols = [c for c in dataset.columns if c not in front]
    return dataset[front + sorted(feature_cols)]


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    dataset = build_dataset()
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"saved {OUTPUT_PATH}")
    print(f"shape={dataset.shape}")
    print(dataset["y"].value_counts().rename({0: "H", 1: "PD"}))
    print(dataset.head())


if __name__ == "__main__":
    main()
