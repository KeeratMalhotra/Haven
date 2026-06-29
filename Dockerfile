FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend and MCP servers
COPY backend/ /app/backend/
COPY mcp-servers/ /app/mcp-servers/
COPY shared/ /app/shared/

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Install MCP server dependencies
RUN pip install --no-cache-dir -r /app/mcp-servers/google-calendar/requirements.txt || true
RUN pip install --no-cache-dir -r /app/mcp-servers/google-tasks/requirements.txt || true

WORKDIR /app/backend

# Cloud Run uses PORT env variable (default 8080)
ENV PORT=8080

EXPOSE 8080

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
