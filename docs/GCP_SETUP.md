# Google Cloud Platform Setup Guide

This guide walks you through setting up a GCP project and configuring all the necessary APIs and credentials for Haven.

## Table of Contents

1. [Create a GCP Project](#1-create-a-gcp-project)
2. [Enable Required APIs](#2-enable-required-apis)
3. [Create OAuth 2.0 Credentials](#3-create-oauth-20-credentials)
4. [Configure OAuth Consent Screen](#4-configure-oauth-consent-screen)
5. [Get a Gemini API Key](#5-get-a-gemini-api-key)
6. [Set Up Environment Variables](#6-set-up-environment-variables)

---

## 1. Create a GCP Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top of the page.
3. Click **New Project**.
4. Enter a project name (e.g., `haven-dev`).
5. Select your organization (if applicable) and click **Create**.
6. Wait for the project to be created, then select it from the project dropdown.
7. Note down the **Project ID** (visible on the project dashboard) - you will need this for `GCP_PROJECT_ID`.

---

## 2. Enable Required APIs

Navigate to **APIs & Services > Library** in the Cloud Console, then search for and enable each of the following APIs:

| API | Purpose |
|-----|---------|
| **Google Calendar API** | Read/write access to user calendars |
| **Google Tasks API** | Read/write access to user task lists |
| **Cloud Text-to-Speech API** | Voice synthesis for notifications |
| **Generative Language API** | Gemini model access (also available via AI Studio) |

To enable each API:

1. Click on the API name in the library.
2. Click **Enable**.
3. Wait for the API to activate (this may take a few seconds).

---

## 3. Create OAuth 2.0 Credentials

### 3.1 Configure the OAuth Consent Screen

Before creating credentials, you must configure the consent screen:

1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select **External** as the user type (unless you have a Google Workspace org and want internal-only access).
3. Click **Create**.
4. Fill in the required fields:
   - **App name**: Haven
   - **User support email**: your email
   - **Developer contact information**: your email
5. Click **Save and Continue**.

### 3.2 Add OAuth Scopes

On the Scopes page, click **Add or Remove Scopes** and add the following:

| Scope | Description |
|-------|-------------|
| `https://www.googleapis.com/auth/calendar` | Full access to Google Calendar |
| `https://www.googleapis.com/auth/tasks` | Full access to Google Tasks |
| `https://www.googleapis.com/auth/userinfo.email` | View user email address |
| `https://www.googleapis.com/auth/userinfo.profile` | View user profile info |

Click **Update**, then **Save and Continue**.

### 3.3 Add Test Users (External apps only)

While in testing mode, you must explicitly add users who can log in:

1. Click **Add Users**.
2. Enter the email addresses of your test accounts.
3. Click **Save and Continue**.

### 3.4 Create OAuth Client Credentials

1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Web application** as the application type.
4. Set the name (e.g., `Haven Web Client`).
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google`
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret** from the dialog.

These values map to:
- `GOOGLE_CLIENT_ID` (backend and frontend)
- `GOOGLE_CLIENT_SECRET` (backend and frontend)

---

## 4. Configure OAuth Consent Screen

> **Note**: If you already configured the consent screen in step 3.1, this section is for reference on publishing.

For production use, you will need to submit your app for verification:

1. Navigate to **APIs & Services > OAuth consent screen**.
2. Click **Publish App** when ready to move out of testing mode.
3. Google will review your app (this can take several days for sensitive scopes).

For local development, the app can remain in "Testing" status.

---

## 5. Set Up Vertex AI Authentication

Haven uses Vertex AI SDK which authenticates via Application Default Credentials (ADC).
No API key is needed for Gemini - just authenticate with your Google Cloud account:

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) if not already installed.
2. Run the following command to set up ADC:
   ```bash
   gcloud auth application-default login
   ```
3. Follow the browser prompts to authenticate with your Google account.
4. The credentials will be stored locally and used automatically by the Vertex AI SDK.

### GCP API Key for Cloud Text-to-Speech (Optional)

If you want to use Cloud TTS (for the voice agent), you need a separate API key:

1. Go to **APIs & Services > Credentials** in the Cloud Console.
2. Click **Create Credentials > API key**.
3. Restrict the key to **Cloud Text-to-Speech API** only (recommended).
4. Copy the key.

This value maps to `GCP_API_KEY`.

---

## 6. Set Up Environment Variables

### Backend (`backend/.env`)

Copy the example file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required variables:

```env
# Google OAuth 2.0 credentials (from step 3.4)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# GCP API key for Cloud Text-to-Speech (optional)
GCP_API_KEY=your-gcp-api-key

# GCP Project ID (from step 1)
GCP_PROJECT_ID=your-project-id

# Vertex AI region
GCP_REGION=us-central1

# Firestore configuration (defaults to GCP_PROJECT_ID and '(default)' database)
FIRESTORE_PROJECT_ID=your-project-id
FIRESTORE_DATABASE=(default)
```

### Frontend (`frontend/.env.local`)

Copy the example file and fill in your values:

```bash
cp frontend/.env.example frontend/.env.local
```

Required variables:

```env
# Same Google Client ID as backend (from step 3.4)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Google Client Secret (needed by NextAuth for token refresh)
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth configuration
NEXTAUTH_SECRET=generate-a-random-secret
NEXTAUTH_URL=http://localhost:3000

# WebSocket connection to backend
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

To generate a `NEXTAUTH_SECRET`, run:

```bash
openssl rand -base64 32
```

---

## Troubleshooting

### "Access blocked: app has not been verified"

Your OAuth consent screen is in testing mode and the user is not added as a test user. Add their email in the OAuth consent screen settings.

### "redirect_uri_mismatch" error

Ensure the redirect URI in your OAuth client matches exactly: `http://localhost:3000/api/auth/callback/google`. Check for trailing slashes or protocol mismatches.

### "API not enabled" errors

Go to **APIs & Services > Dashboard** and verify all four required APIs are enabled for your project.

### Gemini API key not working

Ensure the API key was created for the same GCP project that has the Generative Language API enabled. You can verify this in AI Studio under **Get API Key**.
