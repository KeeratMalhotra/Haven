# Google Cloud Scheduler Setup for Haven Proactive Nudges

This guide explains how to configure Google Cloud Scheduler to periodically trigger the Haven nudge endpoint, ensuring users receive proactive deadline reminders even when the background scheduler needs external triggering (e.g., in serverless deployments).

## Prerequisites

- A Google Cloud project with billing enabled
- The Cloud Scheduler API enabled
- `gcloud` CLI installed and authenticated
- Haven backend deployed and accessible via a public URL
- `SCHEDULER_API_KEY` configured in your backend environment

## Step 1: Enable the Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

## Step 2: Generate a Scheduler API Key

Choose a strong, random API key for authenticating scheduler requests:

```bash
# Generate a random key
openssl rand -hex 32
```

Set this value as `SCHEDULER_API_KEY` in your backend's `.env` file or environment configuration.

## Step 3: Create the Cloud Scheduler Job

Create a job that calls the nudge trigger endpoint every 30 minutes:

```bash
gcloud scheduler jobs create http haven-nudge-trigger \
  --location=us-central1 \
  --schedule="*/30 * * * *" \
  --uri="https://YOUR_BACKEND_URL/api/nudge/trigger" \
  --http-method=POST \
  --headers="X-API-Key=YOUR_SCHEDULER_API_KEY,Content-Type=application/json" \
  --time-zone="UTC" \
  --description="Triggers Haven proactive nudge check every 30 minutes" \
  --attempt-deadline="60s"
```

Replace:
- `YOUR_BACKEND_URL` with your deployed backend URL (e.g., `haven-backend-abc123.run.app`)
- `YOUR_SCHEDULER_API_KEY` with the key you generated in Step 2
- `us-central1` with your preferred region

## Step 4: Test the Job

Manually trigger the job to verify it works:

```bash
gcloud scheduler jobs run haven-nudge-trigger --location=us-central1
```

You can also test directly with `curl`:

```bash
curl -X POST https://YOUR_BACKEND_URL/api/nudge/trigger \
  -H "X-API-Key: YOUR_SCHEDULER_API_KEY" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{
  "status": "completed",
  "nudges_generated": 0,
  "nudges_delivered": 0,
  "details": []
}
```

## Step 5: Target a Specific User (Optional)

To trigger nudges for a specific user only, add a `user_id` query parameter:

```bash
gcloud scheduler jobs create http haven-nudge-user-specific \
  --location=us-central1 \
  --schedule="*/15 * * * *" \
  --uri="https://YOUR_BACKEND_URL/api/nudge/trigger?user_id=USER_ID_HERE" \
  --http-method=POST \
  --headers="X-API-Key=YOUR_SCHEDULER_API_KEY,Content-Type=application/json" \
  --time-zone="UTC" \
  --description="Triggers nudge check for a specific user every 15 minutes"
```

## Configuration Reference

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `SCHEDULER_API_KEY` | API key for authenticating scheduler requests | (required) |
| `NUDGE_INTERVAL_MINUTES` | Background scheduler interval in minutes | 30 |

## How It Works

1. Cloud Scheduler sends a POST request to `/api/nudge/trigger` on the configured schedule.
2. The endpoint validates the `X-API-Key` header against `SCHEDULER_API_KEY`.
3. The backend queries all users (or a specific user) and checks their tasks for approaching deadlines.
4. Tasks with deadlines within 24 hours receive urgency classification:
   - **24 hours**: Gentle reminder
   - **6 hours**: Urgent reminder with action suggestion
   - **1 hour**: Critical - offer to reschedule or provide completion help
5. Nudge messages are generated using Gemini AI and pushed to connected WebSocket clients.
6. The endpoint returns a summary of nudges generated and delivered.

## Monitoring

View job execution history:

```bash
gcloud scheduler jobs describe haven-nudge-trigger --location=us-central1
```

Check recent executions in the Cloud Console:
- Navigate to Cloud Scheduler in the GCP Console
- Click on the `haven-nudge-trigger` job
- Review the "Last run" and "Status" columns

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Verify `X-API-Key` header matches `SCHEDULER_API_KEY` in your backend env |
| 503 Service Unavailable | `SCHEDULER_API_KEY` is not set in the backend environment |
| Job shows "failed" | Check backend logs for errors; ensure the backend URL is accessible |
| No nudges delivered | Verify users are connected via WebSocket and have tasks with deadlines within 24 hours |
