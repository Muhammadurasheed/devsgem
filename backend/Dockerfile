# Multi-stage build for ServerGem Backend
FROM python:3.11-slim AS builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Ensure required directories exist and are writable by non-root user
RUN mkdir -p data previews branding_assets && \
    chown -R appuser:appuser data previews branding_assets

# Switch to non-root user
USER appuser

# Add local bin to PATH
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Start with uvicorn
CMD exec uvicorn app:app --host 0.0.0.0 --port $PORT

