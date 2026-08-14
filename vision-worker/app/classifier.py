from typing import Any

MODEL_VERSION = "baseline-human-review-v1"

def classify_scrap(_: bytes) -> dict[str, list[dict[str, Any]]]:
    # This intentionally conservative adapter is a data-collection baseline.
    # It never returns a payout or compliance decision until a locally trained model is installed.
    return {
        "materials": [{"label": "unknown material — operator label required", "confidence": 0.0}],
        "contamination_flags": [{"label": "manual contamination review required", "confidence": 0.0}],
    }
