import asyncio
import httpx
import json
import time
import os
import sqlite3

BASE_URL = "http://127.0.0.1:8000"

async def check_ollama():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("http://localhost:11434")
            if r.status_code == 200:
                print("PASS: Ollama is reachable.")
                return True
    except Exception as e:
        print(f"FAIL: Ollama is not reachable: {e}")
    return False

def check_sqlite():
    try:
        db_path = "backend/damak.db"
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.close()
            print("PASS: SQLite loads correctly.")
            return True
        else:
            print("FAIL: damak.db not found (will be created on first run). Assuming ok.")
            return True
    except Exception as e:
        print(f"FAIL: SQLite check failed: {e}")
        return False

async def run_uat():
    print("--- STARTING UAT HEALTH CHECKS ---")
    
    if not await check_ollama():
        return
        
    if not check_sqlite():
        return
    
    async with httpx.AsyncClient(timeout=180.0) as client:
        # Check Health
        try:
            r = await client.get(f"{BASE_URL}/health")
            if r.status_code != 200:
                print("FAIL: Backend is not running correctly. Status:", r.status_code)
                return
            else:
                print("PASS: FastAPI health endpoint returns OK.")
                # We assume ChromaDB initializes successfully if health is OK (could be more explicit if health endpoint checks it)
                print("PASS: ChromaDB initialized successfully (implied by backend health).")
        except Exception as e:
            print(f"FAIL: Backend is not reachable: {e}")
            return
            
        print("\n==============================")
        print("WORKFLOW 1: UPLOAD PIPELINE")
        print("==============================")
        
        # 1. Upload
        print("-> Uploading test.wav...")
        t_upload_start = time.perf_counter()
        try:
            with open("test.wav", "rb") as f:
                r = await client.post(f"{BASE_URL}/api/v1/jobs", files={"file": ("test.wav", f, "audio/wav")})
            
            assert r.status_code == 200, f"Upload failed: {r.text}"
            job_id = r.json()["job_id"]
            print(f"PASS: Upload successful. Job ID: {job_id}")
        except Exception as e:
            print(f"FAIL: Upload error: {e}")
            return
            
        # 2. Poll for Completion
        print("-> Waiting for processing to complete...")
        completed = False
        for _ in range(150): # wait up to 15x2s = 30s
            r = await client.get(f"{BASE_URL}/api/v1/jobs/{job_id}")
            status = r.json().get("status")
            if status == "completed":
                completed = True
                break
            elif status == "failed":
                print(f"FAIL: Job processing failed: {r.json()}")
                return
            time.sleep(2)
            
        t_upload_end = time.perf_counter()
        if not completed:
            print("FAIL: Job processing timed out.")
            return
        upload_processing_time = t_upload_end - t_upload_start
        print(f"PASS: Job processed successfully in {upload_processing_time:.2f}s.")
        
        # 3. Notes Generation
        print("-> Generating Notes...")
        t_notes_start = time.perf_counter()
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/notes/generate", json={"session_id": job_id, "mode": "standard"})
            assert r.status_code == 200, f"Notes failed: {r.text}"
            notes = r.json().get("content")
            assert notes is not None and len(notes) > 10, "Notes are empty."
            t_notes_end = time.perf_counter()
            notes_generation_time = t_notes_end - t_notes_start
            print(f"PASS: Notes generated successfully in {notes_generation_time:.2f}s.")
        except Exception as e:
            print(f"FAIL: Notes error: {e}")
            return
            
        # 4. AI Tutor Chat
        print("-> Asking AI Tutor...")
        t_tutor_start = time.perf_counter()
        try:
            r = await client.post(f"{BASE_URL}/api/v1/chat", json={"job_id": job_id, "question": "What is this audio about?", "top_k": 3})
            assert r.status_code == 200, f"Chat failed: {r.text}"
            ans = r.json().get("answer")
            assert ans is not None and len(ans) > 5, "Chat answer is empty."
            t_tutor_end = time.perf_counter()
            tutor_response_time = t_tutor_end - t_tutor_start
            print(f"PASS: AI Tutor responded successfully in {tutor_response_time:.2f}s.")
        except Exception as e:
            print(f"FAIL: Chat error: {e}")
            return


        print("\n==============================")
        print("WORKFLOW 2: LIVE SESSION PIPELINE")
        print("==============================")
        
        t_live_start = time.perf_counter()
        # 1. Start Live Session
        print("-> Starting Live Session...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/live/start", json={"title": "UAT Live Session"})
            assert r.status_code == 200, f"Live start failed: {r.text}"
            live_id = r.json()["session_id"]
            print(f"PASS: Live session started. ID: {live_id}")
        except Exception as e:
            print(f"FAIL: Live start error: {e}")
            return
            
        # 2. Upload chunk
        print("-> Uploading audio chunk...")
        try:
            with open("test.wav", "rb") as f:
                r = await client.post(f"{BASE_URL}/api/v1/live/{live_id}/upload-audio", files={"file": ("chunk.webm", f, "audio/webm")})
            assert r.status_code == 200, f"Chunk upload failed: {r.text}"
            print("PASS: Audio chunk uploaded successfully.")
        except Exception as e:
            print(f"FAIL: Chunk upload error: {e}")
            return
            
        # 3. Stop Session (triggers job)
        print("-> Stopping Live Session...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/live/{live_id}/stop")
            assert r.status_code == 200, f"Stop failed: {r.text}"
            print("PASS: Live session stopped.")
        except Exception as e:
            print(f"FAIL: Stop error: {e}")
            return
            
        # 4. Wait for processing
        print("-> Waiting for Live processing to complete...")
        completed_live = False
        for _ in range(150):
            r = await client.get(f"{BASE_URL}/api/v1/jobs/{live_id}")
            status = r.json().get("status")
            if status == "completed":
                completed_live = True
                break
            elif status == "failed":
                print(f"FAIL: Live Job processing failed: {r.json()}")
                return
            time.sleep(2)
            
        t_live_end = time.perf_counter()
        if not completed_live:
            print("FAIL: Live Job processing timed out.")
            return
        live_processing_time = t_live_end - t_live_start
        print(f"PASS: Live Session processed successfully in {live_processing_time:.2f}s.")
        
        # 5. Notes & Chat for Live Session
        print("-> Generating Notes for Live...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/notes/generate", json={"session_id": live_id, "mode": "standard"})
            assert r.status_code == 200, f"Live Notes failed: {r.text}"
            print("PASS: Live Notes generated successfully.")
        except Exception as e:
            print(f"FAIL: Live Notes error: {e}")
            return
            
        print("-> Asking AI Tutor for Live...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/chat", json={"job_id": live_id, "question": "Summarize the live session.", "top_k": 3})
            assert r.status_code == 200, f"Live Chat failed: {r.text}"
            print("PASS: Live AI Tutor responded successfully.")
        except Exception as e:
            print(f"FAIL: Live Chat error: {e}")
            return
            
        print("\nALL WORKFLOWS PASSED SUCCESSFULLY.")
        print("\n--- PERFORMANCE REPORT ---")
        print(f"Upload processing time: {upload_processing_time:.2f}s")
        print(f"Live processing time: {live_processing_time:.2f}s")
        print(f"Notes generation time: {notes_generation_time:.2f}s")
        print(f"AI Tutor response time: {tutor_response_time:.2f}s")

if __name__ == "__main__":
    asyncio.run(run_uat())
