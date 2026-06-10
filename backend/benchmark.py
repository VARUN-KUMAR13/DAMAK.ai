import time
import asyncio
import httpx
from pathlib import Path

BASE_URL = "http://localhost:8000"

async def run_benchmark():
    metrics = {}
    print("Starting benchmark...")
    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. Upload
        t0 = time.time()
        file_path = Path("test.wav")
        if not file_path.exists():
            print("test.wav not found. Skipping benchmark.")
            return
            
        with open(file_path, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            res = await client.post(f"{BASE_URL}/api/v1/jobs", files=files)
            
        job_id = res.json()["job_id"]
        metrics["Upload processing time"] = time.time() - t0
        
        # 2. Wait for processing (Whisper + OCR + Embeddings)
        t0 = time.time()
        while True:
            status_res = await client.get(f"{BASE_URL}/api/v1/jobs/{job_id}")
            if status_res.json()["status"] == "completed":
                break
            await asyncio.sleep(2)
        processing_time = time.time() - t0
        metrics["Pipeline Processing (Whisper+OCR+Embeddings)"] = processing_time
        
        # 3. Notes generation
        t0 = time.time()
        await client.post(f"{BASE_URL}/api/v1/intelligence/notes/generate", json={"session_id": job_id})
        metrics["Notes generation time"] = time.time() - t0
        
        # 4. AI Tutor
        t0 = time.time()
        await client.post(f"{BASE_URL}/api/v1/intelligence/chat", json={
            "session_id": job_id,
            "message": "What is the main topic?"
        })
        metrics["AI Tutor response time"] = time.time() - t0
        
    print("\n--- Benchmark Results ---")
    for k, v in metrics.items():
        print(f"{k}: {v:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
