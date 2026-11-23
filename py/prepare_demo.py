"""Rebuild a local demo model from versioned features, not raw recordings.

Split matches train.py. This is a reconstruction, not the original model artifact.
The test set is reserved; model selection uses training cross-validation only.
"""
import json
import sys
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from train import RANDOM_STATE, TEST_SIZE, main as train

ROOT = Path(__file__).resolve().parents[1]


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    rows = json.loads((ROOT / 'contracts/patients_seed.json').read_text(encoding='utf-8'))
    schema = json.loads((ROOT / 'contracts/feature_schema.json').read_text(encoding='utf-8'))
    frame = pd.DataFrame([
        {'subject_id': r['subject_id'], 'disease': r['disease'], 'y': r['y'], **r['features']}
        for r in rows
    ])
    frame = frame[['subject_id', 'disease', 'y', *schema['feature_names']]]
    train_ids, test_ids = train_test_split(
        frame['subject_id'], test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=frame['y']
    )
    (ROOT / 'data').mkdir(exist_ok=True)
    manifest = {
        'source': 'reconstructed_from_versioned_seed',
        'random_state': RANDOM_STATE, 'test_size': TEST_SIZE,
        'train_subject_ids': sorted(int(v) for v in train_ids),
        'test_subject_ids': sorted(int(v) for v in test_ids),
    }
    (ROOT / 'contracts/dataset_split.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    frame.to_csv(ROOT / 'data/dataset.csv', index=False)
    train()


if __name__ == '__main__':
    main()
