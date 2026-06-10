import requests
import time
try:
    print("Health Requesting...")
    t0 = time.time()
    res = requests.get("http://127.0.0.1:8000/health", timeout=20)
    print("Health Response:", res.status_code, "in", time.time() - t0, "seconds")
except Exception as e:
    print("Health Error:", e)
