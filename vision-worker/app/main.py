import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .classifier import MODEL_VERSION, classify_scrap
from .ocr import extract_candidates, is_ocr_initialized

logger = logging.getLogger(__name__)
app = FastAPI(title="Mahaffeys Private Vision Worker")


@app.get("/health")
def health():
    return {
        "ok": True,
        "worker_ready": True,
        "ocr_initialized": is_ocr_initialized(),
        "model_version": MODEL_VERSION,
    }


@app.post("/analyze")
async def analyze(purpose: str = Form(...), image: UploadFile = File(...)):
    if purpose not in {"vehicle", "plate", "scrap"}:
        raise HTTPException(status_code=400, detail="Unsupported scan purpose")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Unsupported image type")
    data = await image.read()
    try:
        ocr_result = extract_candidates(data, purpose)
    except Exception as error:
        logger.exception("Vision processing failed")
        raise HTTPException(
            status_code=503,
            detail="Vision processing is temporarily unavailable",
        ) from error
    classification = classify_scrap(data) if purpose == "scrap" else {"materials": [], "contamination_flags": []}
    return {**ocr_result, **classification, "model_version": MODEL_VERSION}
