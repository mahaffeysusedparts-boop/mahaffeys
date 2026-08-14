from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from .classifier import MODEL_VERSION, classify_scrap
from .ocr import extract_candidates

app = FastAPI(title="Mahaffeys Private Vision Worker")

@app.get("/health")
def health():
    return {"ok": True, "model_version": MODEL_VERSION}

@app.post("/analyze")
async def analyze(purpose: str = Form(...), image: UploadFile = File(...)):
    if purpose not in {"vehicle", "plate", "scrap"}:
        raise HTTPException(status_code=400, detail="Unsupported scan purpose")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Unsupported image type")
    data = await image.read()
    ocr_result = extract_candidates(data, purpose)
    classification = classify_scrap(data) if purpose == "scrap" else {"materials": [], "contamination_flags": []}
    return {**ocr_result, **classification, "model_version": MODEL_VERSION}
