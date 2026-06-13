import asyncio
import httpx
import json
import time
import os
import wave
import struct

BASE_URL = "http://127.0.0.1:8000"

def create_dummy_wav(filename):
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(16000)
        # write 1 second of silence
        f.writeframes(struct.pack('h', 0) * 16000)

async def run_uat():
    print("--- STARTING UAT ---")
    if not os.path.exists("test.wav"):
        create_dummy_wav("test.wav")
        print("Created dummy test.wav")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Check Health
        try:
            r = await client.get(f"{BASE_URL}/health")
            if r.status_code != 200:
                print("Backend is not running. Please start the server.")
                return
            print("PASS: Backend is running.")
        except Exception as e:
            print(f"Backend is not reachable: {e}")
            return
            
        print("\n==============================")
        print("WORKFLOW 1: UPLOAD PIPELINE")
        print("==============================")
        
        # 1. Upload
        print("-> Uploading test.wav...")
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
        for _ in range(15): # wait up to 15x2s = 30s
            r = await client.get(f"{BASE_URL}/api/v1/jobs/{job_id}")
            status = r.json().get("status")
            if status == "completed":
                completed = True
                break
            elif status == "failed":
                print(f"FAIL: Job processing failed: {r.json()}")
                return
            time.sleep(2)
            
        if not completed:
            print("FAIL: Job processing timed out.")
            return
        print("PASS: Job processed successfully.")
        
        # 3. Notes Generation
        print("-> Generating Notes...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/notes/generate", json={"session_id": job_id, "mode": "standard"})
            assert r.status_code == 200, f"Notes failed: {r.text}"
            notes = r.json().get("content")
            assert notes is not None and len(notes) > 10, "Notes are empty."
            print("PASS: Notes generated successfully.")
        except Exception as e:
            print(f"FAIL: Notes error: {e}")
            return
            
        # 4. Flashcards Generation
        print("-> Generating Flashcards...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/flashcards/generate", json={"session_id": job_id, "count": 2, "type": "qa"})
            assert r.status_code == 200, f"Flashcards failed: {r.text}"
            fcs = r.json().get("flashcards")
            assert len(fcs) == 2, f"Expected 2 flashcards, got {len(fcs) if fcs else 0}"
            print("PASS: Flashcards generated successfully.")
        except Exception as e:
            print(f"FAIL: Flashcards error: {e}")
            return
            
        # 5. AI Tutor Chat
        print("-> Asking AI Tutor...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/chat", json={"job_id": job_id, "question": "What is this audio about?"})
            assert r.status_code == 200, f"Chat failed: {r.text}"
            ans = r.json().get("answer")
            assert ans is not None and len(ans) > 5, "Chat answer is empty."
            print("PASS: AI Tutor responded successfully.")
        except Exception as e:
            print(f"FAIL: Chat error: {e}")
            return


        print("\n==============================")
        print("WORKFLOW 2: LIVE SESSION PIPELINE")
        print("==============================")
        
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
        for _ in range(15):
            r = await client.get(f"{BASE_URL}/api/v1/jobs/{live_id}")
            status = r.json().get("status")
            if status == "completed":
                completed_live = True
                break
            elif status == "failed":
                print(f"FAIL: Live Job processing failed: {r.json()}")
                return
            time.sleep(2)
            
        if not completed_live:
            print("FAIL: Live Job processing timed out.")
            return
        print("PASS: Live Session processed successfully.")
        
        # 5. Notes & Flashcards & Chat for Live Session
        print("-> Generating Notes for Live...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/notes/generate", json={"session_id": live_id, "mode": "standard"})
            assert r.status_code == 200, f"Live Notes failed: {r.text}"
            print("PASS: Live Notes generated successfully.")
        except Exception as e:
            print(f"FAIL: Live Notes error: {e}")
            return
            
        print("-> Generating Flashcards for Live...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/intelligence/flashcards/generate", json={"session_id": live_id, "count": 1, "type": "qa"})
            assert r.status_code == 200, f"Live Flashcards failed: {r.text}"
            print("PASS: Live Flashcards generated successfully.")
        except Exception as e:
            print(f"FAIL: Live Flashcards error: {e}")
            return
            
        print("-> Asking AI Tutor for Live...")
        try:
            r = await client.post(f"{BASE_URL}/api/v1/chat", json={"job_id": live_id, "question": "Summarize the live session."})
            assert r.status_code == 200, f"Live Chat failed: {r.text}"
            print("PASS: Live AI Tutor responded successfully.")
        except Exception as e:
            print(f"FAIL: Live Chat error: {e}")
            return
            
        print("\nALL WORKFLOWS PASSED SUCCESSFULLY.")

if __name__ == "__main__":
    asyncio.run(run_uat())
