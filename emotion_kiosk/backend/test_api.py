
import requests
import base64
import numpy as np
import cv2
import json

def test_api():
    # Create a black image with a white square (simulating a face-ish thing, primarily to check if API responds)
    # Actually, let's just send a blank black image. The face detector will return 0 faces, but the API should respond 200 OK.
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    img_str = base64.b64encode(buffer).decode('utf-8')
    
    url = "http://127.0.0.1:8000/api/detect"
    payload = {"image": img_str}
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_api()
