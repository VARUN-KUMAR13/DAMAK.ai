# AI Lecture Intelligence System

Monorepo for lecture capture, transcription, and downstream intelligence. **Phase 3** adds OCR processing using PaddleOCR to extract text from lecture slides and code screenshots.

## Backend (FastAPI)

### Prerequisites

- **Python 3.9+** (3.10+ or newer recommended)
- **FFmpeg** installed and available on your `PATH`
- **PaddlePaddle** and **PaddleOCR** dependencies (automatically handled by `requirements.txt`)

#### FFmpeg on Windows

1. Install FFmpeg (pick one):
   - [Official builds](https://ffmpeg.org/download.html) (add the `bin` folder to your user or system **PATH**), or
   - **winget**: `winget install Gyan.FFmpeg` (verify `ffmpeg -version` in a new terminal), or
   - **Chocolatey**: `choco install ffmpeg`
2. Confirm: `ffmpeg -version` prints version info.
3. If the app still cannot find FFmpeg, set in `backend/.env`:
   - `FFMPEG_PATH=C:\Path\To\ffmpeg\bin\ffmpeg.exe`

The backend invokes FFmpeg via **subprocess** (no `ffmpeg-python` dependency).

### Setup

```powershell
cd "D:\DAMAK AI\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env if needed (WHISPER_MODEL, FFMPEG_PATH, PROJECT_ROOT, etc.)
```

**Note:** The first transcription will download the selected Whisper model (e.g. `base`) into the local cache; allow time and disk space.

### Run the API

From `backend/` with the virtual environment activated:

```powershell
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/health`
- OpenAPI docs: `http://localhost:8000/docs`

### Storage layout (project root)

- `storage/uploads/` — uploaded video files  
- `storage/audio/` — extracted WAV (16 kHz mono PCM)  
- `storage/transcripts/` — one JSON file per job (`{job_id}.json`)
- `storage/screenshots/{job_id}/` — filtered keyframes (`frame_0001.jpg`, ...) plus `metadata.json`
- `storage/ocr/{job_id}/` — OCR results (`ocr_results.json`)

Paths default to `<PROJECT_ROOT>/storage/...`, where `PROJECT_ROOT` is the repo root (parent of `backend/`), unless overridden in `.env`.

### API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/jobs` | Multipart upload (`file` field). Returns `job_id`; processing runs after the response. |
| `GET` | `/api/v1/jobs/{job_id}` | Job status, optional error message, transcript, and **OCR results** when `completed`. |
| `GET` | `/api/v1/transcripts/{job_id}` | Transcript JSON only (404 until completed). |

#### Example: upload with curl (Windows / PowerShell)

Replace `C:\path\to\lecture.mp4` with your file:

```powershell
curl.exe -X POST "http://localhost:8000/api/v1/jobs" `
  -H "accept: application/json" `
  -F "file=@C:\path\to\lecture.mp4"
```

Then poll:

```powershell
curl.exe "http://localhost:8000/api/v1/jobs/<job_id>"
```

**Postman:** `POST` → `http://localhost:8000/api/v1/jobs` → Body → **form-data** → key `file` (type *File*) → choose video → Send. Use the returned `job_id` in `GET /api/v1/jobs/{job_id}`.

### Transcript JSON shape

```json
{
  "metadata": {
    "job_id": "...",
    "source_filename": "lecture.mp4",
    "model": "base",
    "language": "en"
  },
  "segments": [
    { "start": 0.0, "end": 2.5, "text": "Hello and welcome." }
  ]
}
```

### Screenshot extraction (Phase 2)

During job processing, the backend now:

1. samples video frames at a configurable interval,
2. compares sampled frames with SSIM to detect meaningful visual changes,
3. skips near-duplicate or tiny-difference frames,
4. saves selected screenshots and metadata for future OCR/indexing.

Output layout:

```text
storage/screenshots/{job_id}/
  frame_0001.jpg
  frame_0002.jpg
  metadata.json
```

`metadata.json` example:

```json
[
  {
    "timestamp": 12.4,
    "frame_index": 372,
    "filename": "frame_0001.jpg"
  }
]
```

### OCR Processing (Phase 3)

The pipeline now includes an OCR stage using **PaddleOCR**. After screenshots are extracted, the system:

1. Processes each unique screenshot to extract readable text.
2. Deduplicates screenshots (skips OCR if an identical frame was already processed).
3. Preserves multiline formatting for better code and slide readability.
4. Saves results in `storage/ocr/{job_id}/ocr_results.json`.

`ocr_results.json` example:

```json
[
  {
    "timestamp": 12.4,
    "filename": "frame_0001.jpg",
    "frame_index": 372,
    "text": "Normalization in DBMS\n1. First Normal Form (1NF)\n2. Second Normal Form (2NF)"
  }
]
```

### New environment variables (Phase 3)

Configure in `backend/.env`:

- `STORAGE_OCR` — override OCR results root path
- `OCR_LANG` — language for OCR (default: `en`)
- `OCR_USE_GPU` — set to `True` if you have a compatible GPU and `paddlepaddle-gpu` installed
- `OCR_USE_ANGLE_CLS` — enable text angle classification for rotated text

## Out of scope (Phase 1-3)

Later phases (Electron UI, ChromaDB, PDF export, etc.) are **not** included here.
