import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"
# Let's use the live session ID that we know exists
SESSION_ID = "4a337bc1-6a71-435a-a690-18f2f6fa1620"

def test_flashcard_type(fc_type):
    print(f"\n=== Testing Flashcard Type: {fc_type} ===")
    try:
        res = requests.post(f"{BASE_URL}/intelligence/flashcards/generate", json={
            "session_id": SESSION_ID,
            "count": 2,
            "type": fc_type
        })
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print("API Response JSON:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Failed: {res.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    for t in ["qa", "mcq", "revision"]:
        test_flashcard_type(t)
