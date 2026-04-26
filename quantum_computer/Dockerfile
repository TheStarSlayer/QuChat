# Use official Python image
FROM python:slim

# Set working directory
WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd -m appuser
USER appuser

# Copy app code
COPY . .

# Expose port
EXPOSE 8598

# Run FastAPI with uvicorn
CMD ["python", "main.py"]