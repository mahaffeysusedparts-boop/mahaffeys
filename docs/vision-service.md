# On-premises vision service

## Architecture

The browser uploads images only to `/api/vision/scans`. Nitro authenticates the user, validates and saves images to the local `NITRO_VISION_UPLOAD_DIR` volume, then sends the image to the private `vision-worker` service. The worker is not published by Compose. It returns OCR candidates and advisory material labels only. Nitro validates VINs and sends only a valid VIN—not an image—to NHTSA vPIC.

## Required runtime configuration

- `NITRO_VISION_WORKER_URL` — private worker URL (Compose: `http://vision-worker:8000`)
- `NITRO_VISION_UPLOAD_DIR` — non-public writable directory
- `NITRO_VISION_MAX_UPLOAD_BYTES` — optional limit, default 10 MB
- `NITRO_VISION_RETENTION_DAYS` — default 90
- `NITRO_DATABASE_URL` — local PostgreSQL connection

Never expose the upload directory through `public/`, and never publish port 8000 for the worker.

## Operations

Back up PostgreSQL and the `mahaffeys-vision-images` volume together. Before deployment, define retention approval, disk quota, deletion audit, and access-review procedures. The current tables record scan metadata and immutable confirmation records; a scheduled deletion job should remove files/mark records deleted after the configured retention date.

PaddleOCR/model licensing must be reviewed for the deployed version. The included scrap adapter intentionally returns an `unknown` / manual-review result. Train and version a locally evaluated model on consented yard images before enabling material labels. It must never drive payout, legal ownership, title status, or hazardous-material decisions.

## Calibration

Collect readable, blurry, angled, dirty, and partially obscured VIN/plate samples as well as representative load photos. Track operator corrections, precision/recall by material class, and confidence distributions. Establish separate acceptance thresholds for VIN OCR, plate OCR, and material labels. Low confidence always requires review.

## Privacy

Images and OCR outputs remain local. A validated 17-character VIN is sent to NHTSA vPIC for a free official decode, with a 30-day local cache. If NHTSA is unavailable, the locally extracted VIN stays reviewable and may be retried.
