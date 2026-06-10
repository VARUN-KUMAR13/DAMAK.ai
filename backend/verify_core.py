import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"
SESSION_ID = "4a337bc1-6a71-435a-a690-18f2f6fa1620"

def run_tests():
    print("=== DAMAK AI Core Verification Audit ===")
    
    # 1. Test Notes Generation
    print("\n--- 1. Testing Notes Generation ---")
    try:
        res = requests.post(f"{BASE_URL}/intelligence/notes/generate", json={
            "session_id": SESSION_ID,
            "mode": "standard"
        })
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Success! Generated {len(data.get('content', ''))} bytes of notes.")
        else:
            print(f"Failed: {res.text}")
    except Exception as e:
        print(f"Exception: {e}")

    # 2. Test Flashcard Generation
    print("\n--- 2. Testing Flashcard Generation ---")
    try:
        res = requests.post(f"{BASE_URL}/intelligence/flashcards/generate", json={
            "session_id": SESSION_ID,
            "count": 3,
            "type": "qa"
        })
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Success! Generated {len(data.get('flashcards', []))} flashcards.")
        else:
            print(f"Failed: {res.text}")
    except Exception as e:
        print(f"Exception: {e}")

    # 3. Test AI Tutor Chat
    print("\n--- 3. Testing AI Tutor Chat ---")
    try:
        # Note: the endpoint is in jobs router, so it's under jobs/chat or chat/
        # Need to check router path. In jobs.py it is @router.post("/chat")
        # In router.py it is router.include_router(jobs.router, tags=["jobs"])
        # So the path is /api/v1/chat
        res = requests.post(f"{BASE_URL}/chat", json={
            "session_id": SESSION_ID,
            "question": "What did we learn in this session?"
        })
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print(f"Success! Chat response received.")
        else:
            print(f"Failed: {res.text}")
    except Exception as e:
        print(f"Exception: {e}")
        
    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    run_tests()
