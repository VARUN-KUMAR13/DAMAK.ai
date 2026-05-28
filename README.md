# AI Lecture Intelligence System

Monorepo for lecture capture, transcription, and downstream intelligence. **Phase 8** introduces the **DAMAK AI Knowledge Workspace**, a comprehensive academic second brain for studying lectures.

## 🌟 DAMAK AI Knowledge Workspace

The Knowledge Workspace is a modern web-based dashboard that transforms raw lecture data into actionable intelligence:

1.  **AI Notes System**: 
    *   Generates structured markdown notes from multimodal context (OCR + Speech).
    *   Multiple modes: `Easy`, `Standard`, `Deep Dive`, and `Exam Focus`.
    *   Grounded citations linked to timestamps and screenshots.
2.  **Multimodal Learning Interface**:
    *   **Transcript Panel**: Synchronized text with timestamp jumping.
    *   **Screenshot Timeline**: Visual navigation through lecture slides.
    *   **AI Tutor**: RAG-powered chat for immediate clarification.
3.  **Study Tools**:
    *   **Flashcard Generator**: Automatic creation of Q&A and MCQs from key concepts.
    *   **Smart Search**: Semantic retrieval across all indexed lectures.

## 📦 Project Structure

```text
DAMAK-AI/
├── backend/            # FastAPI Multimodal Engine
├── frontend/
│   ├── extension/      # Chrome Extension (Capture System)
│   └── workspace/      # Next.js Knowledge Workspace (Dashboard)
├── storage/            # Local Intelligence Storage
...
```

## 🚀 Getting Started

### 1. Start the Backend
```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Launch the Workspace
```powershell
cd frontend/workspace
npm install
npm run dev
```

### 3. Capture a Lecture
Use the Chrome Extension to capture your session. Once processed, it will appear in your Knowledge Workspace.

## 📖 New Intelligence APIs (Phase 8)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/intelligence/notes/generate` | Generate AI notes (Easy/Standard/Deep/Exam). |
| `POST` | `/api/v1/intelligence/flashcards/generate` | Generate study flashcards (QA/MCQ). |

## 🛠️ Setup & Installation

### Backend

1.  **Prerequisites**: Python 3.9+, FFmpeg, Ollama (with `phi3`).
2.  **Install Dependencies**:
    ```powershell
    cd backend
    pip install -r requirements.txt
    ```
3.  **Run API**:
    ```powershell
    uvicorn app.main:app --reload
    ```

### Chrome Extension

1.  Open Chrome and go to `chrome://extensions/`.
2.  Enable **Developer mode** (top right).
3.  Click **Load unpacked**.
4.  Select the `frontend/extension/` folder from this repository.
5.  Pin the "DAMAK AI Capture" extension.

## 📖 Usage Workflow

1.  **Start Capture**: Open any lecture tab, click the extension icon, enter a title, and click **Start Capture**.
2.  **Learn**: Attend your session. The extension captures screenshots every 5s and audio every 3s.
3.  **Stop & Process**: Click **Stop & Process**. The backend will merge the stream and build your semantic knowledge base.
4.  **Chat & Retrieval**: Use the `/api/v1/chat` endpoint (or a future dashboard) to ask questions like:
    *   *"What were the three types of normalization mentioned?"*
    *   *"Show me the slide where the 2-minute rule was explained."*

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
- `storage/chunks/{job_id}/` — semantic multimodal chunks (`chunks.json`)
- `storage/embeddings/chroma_db/` — persistent vector database for semantic search
- `storage/live/{session_id}/` — raw live capture data (audio chunks, screenshots)

Paths default to `<PROJECT_ROOT>/storage/...`, where `PROJECT_ROOT` is the repo root (parent of `backend/`), unless overridden in `.env`.

### API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/jobs` | Multipart upload (`file` field). Returns `job_id`; processing runs after the response. |
| `GET` | `/api/v1/jobs/{job_id}` | Job status, optional error message, transcript, OCR results, and multimodal chunks when `completed`. |
| `GET` | `/api/v1/transcripts/{job_id}` | Transcript JSON only (404 until completed). |
| `POST` | `/api/v1/search` | Global semantic search across all processed lectures. |
| `GET` | `/api/v1/search/{job_id}` | Semantic search within a specific lecture (requires `query` param). |
| `POST` | `/api/v1/chat` | Multimodal RAG Chat: Ask questions and get answers with sources. |
| `POST` | `/api/v1/live/start` | Start a new live capture session. |
| `POST` | `/api/v1/live/{id}/upload-screenshot` | Upload a screenshot with timestamp (form-data). |
| `POST` | `/api/v1/live/{id}/upload-audio` | Upload an audio chunk (file). |
| `POST` | `/api/v1/live/{id}/stop` | Finalize session and trigger processing. |
| `GET` | `/api/v1/live/{id}` | Get live session status. |

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

### Multimodal Chunking (Phase 4)

The system now aligns OCR results with spoken segments to create semantically rich chunks for RAG:

1. **Alignment**: Spoken text is grouped into segments (default ~150-250 words).
2. **Context Enrichment**: Overlapping OCR slide text is merged into the chunk metadata.
3. **Multimodal Mapping**: Each chunk is associated with specific screenshot filenames and timestamps.
4. **Storage**: Chunks are saved in `storage/chunks/{job_id}/chunks.json`.

`chunks.json` example:

```json
{
  "chunk_id": "chunk_001",
  "start_time": 10.0,
  "end_time": 25.0,
  "slide_text": "Normalization in DBMS",
  "spoken_text": "Today we will discuss first normal form...",
  "combined_text": "Slide Content:\nNormalization in DBMS\n\nSpoken Content:\nToday we will discuss first normal form...",
  "screenshots": ["frame_0001.jpg"]
}
```

### Semantic Search & Embeddings (Phase 5)

The system now features high-performance semantic retrieval using **Sentence-Transformers** and **ChromaDB**:

1. **Embedding Generation**: Multimodal chunks are converted into 384-dimensional vectors using the `all-MiniLM-L6-v2` model.
2. **Vector Storage**: Embeddings and rich metadata (timestamps, screenshots, text) are stored in a persistent ChromaDB instance.
3. **Semantic Retrieval**: Users can search across all lectures or within a specific one using natural language queries.
4. **RAG-Ready**: The architecture is fully prepared for Retrieval-Augmented Generation (RAG) with LLMs.

#### Search Example (curl)

```powershell
curl.exe -X POST "http://localhost:8000/api/v1/search" `
  -H "Content-Type: application/json" `
  -d '{"query": "How to stop procrastination?", "limit": 3}'
```

### Local RAG Chat (Phase 6)

The system now integrates **Ollama** to provide a fully local, privacy-focused AI tutor experience:

1. **Context Retrieval**: The system performs a semantic search to find the most relevant chunks for a user's question.
2. **Prompt Engineering**: A specialized RAG prompt is built, including spoken text, slide text, and timestamps.
3. **Local Inference**: The `phi3` model (running via Ollama) generates an answer based **only** on the lecture context.
4. **Citations**: Every response includes the source chunks, allowing the user to jump to specific timestamps or view screenshots.

#### Chat Example (curl)

```powershell
curl.exe -X POST "http://localhost:8000/api/v1/chat" `
  -H "Content-Type: application/json" `
  -d '{"question": "What is the 2 minute rule?", "top_k": 3}'
```

### New environment variables (Phase 6)

Configure in `backend/.env`:

- `OLLAMA_BASE_URL` — local Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` — model name to use (default: `phi3`)
