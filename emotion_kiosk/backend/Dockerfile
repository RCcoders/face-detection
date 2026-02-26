# Pin Python 3.10 — required for mediapipe + tensorflow compatibility
FROM python:3.10.13-slim

WORKDIR /app

# Install system dependencies for OpenCV and mediapipe
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start the server
CMD ["python", "index.py"]
