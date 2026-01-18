# DevGem Backend

AI-powered deployment assistant backend using Google Gemini and Cloud Run.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file in `backend/` directory:

```bash
GEMINI_API_KEY=your-gemini-api-key
GITHUB_TOKEN=your-github-token
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1
```

### 3. Run Locally

**From the backend directory:**
```bash
cd backend
python app.py
```

**Or from project root:**
```bash
python -m backend.app
```

Server runs at `http://localhost:8000`

Test health check:
```bash
curl http://localhost:8000/health
```

### 4. Test Agents

```bash
# Test orchestrator
python agents/orchestrator.py

# Test code analyzer
python agents/code_analyzer.py

# Test docker expert
python agents/docker_expert.py
```

## Deploy to Cloud Run

### Option 1: Using gcloud CLI

```bash
# Build and deploy
gcloud run deploy DevGem-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key-here
```

### Option 2: Using Dockerfile

```bash
# Build image
docker build -t DevGem-backend .

# Test locally
docker run -p 8000:8000 -e GEMINI_API_KEY=your-key DevGem-backend

# Push to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT/DevGem-backend

# Deploy to Cloud Run
gcloud run deploy DevGem-backend \
  --image gcr.io/YOUR_PROJECT/DevGem-backend \
  --region us-central1
```

## API Endpoints

### HTTP Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check for Cloud Run
- `POST /chat` - Send message (non-streaming)
- `GET /stats` - Service statistics

### WebSocket

- `WS /ws/chat` - Real-time chat connection

## Agent System

### Orchestrator Agent
- Routes user requests using Gemini function calling
- Maintains conversation context
- Manages specialist agents

### Code Analyzer Agent
- Detects frameworks and languages
- Analyzes dependencies
- Identifies configuration requirements

### Docker Expert Agent
- Generates optimized Dockerfiles
- Multi-stage builds for smaller images
- Security hardening

## Cloud Run Optimizations

✅ **Multi-stage Docker builds** - 50-70% smaller images
✅ **Non-root user** - Security best practices
✅ **Health checks** - Automatic monitoring
✅ **PORT environment variable** - Cloud Run compatibility
✅ **Minimal dependencies** - Faster cold starts
✅ **Layer caching** - Faster builds

## Testing

```bash
# Run agent tests
python -m pytest tests/

# Test WebSocket connection
# Use tools like wscat or postman
```

## Performance

- **Cold start**: ~2-3 seconds
- **Average response**: 500-800ms
- **Image size**: ~150MB (compressed)
- **Memory usage**: ~256-512MB

## Troubleshooting

**Import errors:**
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

**Gemini API errors:**
- Check API key is valid
- Ensure billing is enabled in Google Cloud
- Verify API quota limits

**WebSocket connection fails:**
- Check CORS configuration
- Ensure Cloud Run allows WebSocket (it does by default)
- Verify frontend WebSocket URL matches backend

## Next Steps

- [ ] Add GitHub integration for repo cloning
- [ ] Implement actual Cloud Run deployment
- [ ] Add Cloud SQL setup
- [ ] Implement CI/CD pipeline generation
- [ ] Add cost estimation
- [ ] Implement rollback functionality
