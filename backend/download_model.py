
import os
import requests
import sys

# URL for the pre-trained Mini-Xception model (high accuracy, lightweight)
# Source: https://github.com/oarriaga/face_classification
MODEL_URL = "https://github.com/oarriaga/face_classification/raw/master/trained_models/emotion_models/fer2013_mini_XCEPTION.102-0.66.hdf5"
MODEL_FILENAME = "fer2013_mini_XCEPTION.102-0.66.hdf5"

def download_file(url, dest_path):
    print(f"Downloading from {url}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024 * 1024 # 1MB chunks
        
        with open(dest_path, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(block_size):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\rProgress: {percent:.1f}% ({downloaded / (1024*1024):.1f} MB)", end="")
        print("\nDownload complete!")
        return True
    except Exception as e:
        print(f"\n[ERROR] Failed to download model: {e}")
        return False

def main():
    # Determine models directory
    script_dir = os.path.dirname(os.path.abspath(__file__)) # backend/
    root_dir = os.path.dirname(script_dir) # project root
    models_dir = os.path.join(root_dir, "models")
    
    os.makedirs(models_dir, exist_ok=True)
    
    dest_path = os.path.join(models_dir, MODEL_FILENAME)
    
    if os.path.exists(dest_path):
        print(f"Model already exists at: {dest_path}")
        print("Skipping download.")
    else:
        print(f"Model file not found. Downloading to {models_dir}...")
        success = download_file(MODEL_URL, dest_path)
        if not success:
            sys.exit(1)
            
    print(f"Model ready: {dest_path}")

if __name__ == "__main__":
    main()
