"""AI Lecture Intelligence System — backend application package."""

import sys
import os

# Patch sqlite3 on Windows for ChromaDB (Phase 5+)
if sys.platform == "win32":
    import ctypes
    sqlite_dll_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sqlite_new"))
    sqlite_dll_path = os.path.join(sqlite_dll_dir, "sqlite3.dll")
    if os.path.exists(sqlite_dll_path):
        try:
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(sqlite_dll_dir)
            ctypes.CDLL(sqlite_dll_path)
        except Exception as e:
            # Fallback/ignore if error
            pass
