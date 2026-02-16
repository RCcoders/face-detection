FROM python:3.10-slim


# Updated pip configurations for Render
WORKDIR /app

# Copy requirements, install dependencies
# Copy requirements, install dependencies
COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render sets PORT env var, Docker needs matching EXPOSE/CMD)
EXPOSE 8000

# Start command
CMD ["uvicorn", "backend.index:app", "--host", "0.0.0.0", "--port", "8000"]
