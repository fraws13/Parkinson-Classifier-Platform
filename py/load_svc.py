"""Parser for PaHaW .svc handwriting recordings."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

SVC_COLUMNS = [
    "y",
    "x",
    "t",
    "button",
    "azimuth",
    "altitude",
    "pressure",
]


def load_svc(path: str | Path, *, warn_mismatch: bool = True) -> pd.DataFrame:
    """Load one PaHaW .svc file into a DataFrame.

    File format (info.txt):
      - line 1: number of samples
      - next lines: Y X timestamp button azimuth altitude pressure
      - button: 1 = on-surface, 0 = in-air
    """
    path = Path(path)
    with path.open(encoding="utf-8", errors="replace") as f:
        header = f.readline().strip()
        if not header:
            raise ValueError(f"Empty SVC file: {path}")
        declared_n = int(header)

        rows: list[list[int]] = []
        for line in f:
            line = line.strip()
            if not line:
                continue
            values = line.split()
            if len(values) != len(SVC_COLUMNS):
                raise ValueError(
                    f"Expected {len(SVC_COLUMNS)} columns in {path}, "
                    f"got {len(values)}: {line!r}"
                )
            rows.append([int(v) for v in values])

    df = pd.DataFrame(rows, columns=SVC_COLUMNS)
    if warn_mismatch and len(df) != declared_n:
        print(f"warn {path.name}: header={declared_n}, rows={len(df)}")
    return df


def parse_svc_stem(stem: str) -> tuple[str, str, str]:
    """Parse '00001__3_1' -> (subject_id, task_id, repetition)."""
    subject, rest = stem.split("__", maxsplit=1)
    task, repetition = rest.split("_", maxsplit=1)
    return subject, task, repetition


def list_subject_svc_files(
    public_root: str | Path,
    subject_id: str | int,
    tasks: list[int] | None = None,
) -> list[Path]:
    """List .svc files for one subject, optionally filtered by task numbers."""
    subject = f"{int(subject_id):05d}"
    subject_dir = Path(public_root) / subject
    if not subject_dir.is_dir():
        raise FileNotFoundError(f"Subject folder not found: {subject_dir}")

    files = sorted(subject_dir.glob(f"{subject}__*_*.svc"))
    if tasks is not None:
        wanted = {str(t) for t in tasks}
        files = [p for p in files if parse_svc_stem(p.stem)[1] in wanted]
    return files


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[1]
    sample = (
        repo_root
        / "PaHaW"
        / "PaHaW"
        / "PaHaW_public"
        / "00001"
        / "00001__1_1.svc"
    )
    df = load_svc(sample)
    print(sample.name, df.shape)
    print(df.head())
    print(df["button"].value_counts())
