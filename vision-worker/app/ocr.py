import logging
import re
from threading import Lock
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)
_ocr: Any | None = None
_ocr_lock = Lock()
VIN_PATTERN = re.compile(r"[A-Z0-9]{17}")
PLATE_PATTERN = re.compile(r"[A-Z0-9]{5,8}")


def is_ocr_initialized() -> bool:
    return _ocr is not None


def get_ocr() -> Any:
    global _ocr

    if _ocr is None:
        with _ocr_lock:
            if _ocr is None:
                logger.info("Initializing PaddleOCR engine")
                from paddleocr import PaddleOCR

                _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
                logger.info("PaddleOCR engine initialized")
    return _ocr


def _prepare(image: np.ndarray, purpose: str) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if purpose in {"vehicle", "plate"}:
        gray = cv2.bilateralFilter(gray, 7, 60, 60)
        gray = cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def extract_candidates(image_bytes: bytes, purpose: str) -> dict[str, Any]:
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return {"raw_text": "", "candidates": []}
    result = get_ocr().ocr(_prepare(image, purpose), cls=True)
    rows = result[0] if result else []

    raw_text = "\n".join(row[1][0] for row in rows)
    candidates = []
    for row in rows:
        text, confidence = row[1]
        compact = re.sub(r"[^A-Z0-9]", "", text.upper())
        if purpose == "vehicle" and VIN_PATTERN.fullmatch(compact):
            candidates.append({"text": compact, "confidence": round(float(confidence), 3), "kind": "vin"})
        elif purpose == "plate" and PLATE_PATTERN.fullmatch(compact):
            candidates.append({"text": compact, "confidence": round(float(confidence), 3), "kind": "plate"})
    return {"raw_text": raw_text, "candidates": candidates}
