import asyncio
import urllib.request
import urllib.error

def test_http():
    try:
        req = urllib.request.Request('http://127.0.0.1:8000/api/v1/meetings')
        with urllib.request.urlopen(req) as response:
            print("HTTP Status:", response.status)
            print("HTTP Response:", response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code, e.reason)
    except Exception as e:
        print("Error:", e)

test_http()
