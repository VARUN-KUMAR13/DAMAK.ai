import sys
try:
    from app.main import app
    print("FastAPI app loaded successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
