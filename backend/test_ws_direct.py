import asyncio
import websockets

async def test_ws():
    uri = 'ws://127.0.0.1:8000/api/v1/meetings/ws/e349a352-7638-4ae4-b918-9e6bf1c0a30c'
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            await asyncio.sleep(2)
            print("Still connected after 2 seconds!")
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(test_ws())
