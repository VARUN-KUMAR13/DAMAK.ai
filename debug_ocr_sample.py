import sys
import os
import json
from pathlib import Path
from paddleocr import PaddleOCR
import cv2
import numpy as np

def debug_ocr(image_path: str):
    print(f"--- Debugging OCR for: {image_path} ---")
    
    if not os.path.exists(image_path):
        # Create a dummy image with text if not exists for testing purposes
        print("Image not found. Creating a dummy image with text...")
        img = np.zeros((500, 1000, 3), dtype=np.uint8) + 255
        cv2.putText(img, "Normalization in DBMS", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 2)
        cv2.putText(img, "1. First Normal Form (1NF)", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
        cv2.putText(img, "2. Second Normal Form (2NF)", (50, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
        cv2.imwrite(image_path, img)
        print(f"Dummy image created at {image_path}")

    # Initialize PaddleOCR
    print("Initializing PaddleOCR...")
    try:
        # Try with common arguments
        ocr = PaddleOCR(lang='en', show_log=False)
    except Exception as e:
        print(f"Failed to initialize with defaults: {e}")
        # Fallback to very basic init
        ocr = PaddleOCR()
    
    # Run OCR
    print("Running OCR...")
    result = ocr.ocr(image_path, cls=True)
    
    print("\n--- Raw PaddleOCR Output ---")
    print(json.dumps(result, indent=2, ensure_ascii=False) if result else "None")
    
    # Parsing logic
    print("\n--- Parsed OCR Text Output ---")
    lines = []
    if result:
        # PaddleOCR v2.6+ returns a list of results (one per page/image)
        # For a single image, it's result[0]
        for idx in range(len(result)):
            res = result[idx]
            if res is None:
                print(f"Result at index {idx} is None")
                continue
            
            for line in res:
                # line structure: [ [ [x,y], [x,y], [x,y], [x,y] ], (text, confidence) ]
                text = line[1][0]
                conf = line[1][1]
                print(f"Detected: '{text}' (conf: {conf:.4f})")
                lines.append(text)
    
    full_text = "\n".join(lines)
    print("\n--- Final Full Text ---")
    print(full_text if full_text else "[EMPTY]")
    
    # Save to debug JSON
    debug_data = {
        "image": image_path,
        "raw_output": result,
        "parsed_text": full_text,
        "line_count": len(lines)
    }
    
    debug_json_path = "debug_ocr_result.json"
    with open(debug_json_path, "w", encoding="utf-8") as f:
        json.dump(debug_data, f, indent=2, ensure_ascii=False)
    print(f"\nDebug info saved to {debug_json_path}")

if __name__ == "__main__":
    # Use a sample screenshot if available, otherwise it creates a dummy
    sample_img = "sample_screenshot.jpg"
    debug_ocr(sample_img)
