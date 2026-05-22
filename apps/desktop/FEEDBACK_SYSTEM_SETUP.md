# GitHub Issue Feedback System Setup

## Architecture

```
┌──────────────────────┐     POST /api/feedback      ┌──────────────────────┐     POST /repos/.../issues    ┌──────────┐
│  Nexube Desktop App  │ ────────────────────────▸   │  Vercel / Netlify    │ ───────────────────────────▸  │  GitHub  │
│  (FeedbackReport.jsx)│ ◂────────────────────────   │  Serverless Function │ ◂───────────────────────────  │  API     │
└──────────────────────┘     201 { success: true }   └──────────────────────┘    201 { html_url: ... }      └──────────┘
                                                          │
                                                    process.env.GITHUB_TOKEN
                                                    (set in Vercel dashboard)
```

**No token is ever embedded in the desktop app.** The app POSTs to the proxy, which injects the token from its environment variables and forwards to GitHub.

---

## Step 1: Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Scopes needed: `public_repo` (or `repo` for private repos)
4. Copy the generated token — you'll only see it once

## Step 2: Deploy the Proxy to Vercel (Recommended)

1. Push the `api/feedback.js` file to your repository
2. Go to https://vercel.com/new
3. Import your repository (or create a new project pointing to the `api/` folder)
4. In **Environment Variables**, add:
   - `GITHUB_TOKEN` = your token from Step 1
5. Deploy
6. Copy your deployment URL (e.g., `https://nexube-feedback.vercel.app`)

## Step 3: Update the Proxy URL in the Desktop App

In `src/components/settings/FeedbackReport.jsx`, update the constant:

```js
const FEEDBACK_PROXY_URL = 'https://YOUR-PROXY.vercel.app/api/feedback';
```

## Step 4: Rebuild the Desktop App

```bash
cd apps/desktop
pnpm electron:build
```

---

## Alternative: Netlify Deployment

Deploy the same `api/feedback.js` file to Netlify Functions:

1. Create `netlify.toml` in the repo root:
   ```toml
   [functions]
     directory = "api"
   ```
2. Or create `netlify/functions/feedback.js` with the same code
3. Set `GITHUB_TOKEN` in Netlify environment variables
4. Deploy

---

## How It Works

1. User fills the feedback form in Settings > Feedback Report
2. App POSTs `{ issueType, title, description, platform, appVersion }` to your proxy
3. Proxy validates the input and maps issueType to a GitHub label (e.g., `bug-report`, `feature-request`)
4. Proxy calls GitHub API with your `GITHUB_TOKEN` to create the issue
5. Issue appears in your repo's Issues tab labeled `feedback` + the issue type label
6. App shows success/error message

**Issue labels created in GitHub:**
- `bug-report`, `performance-issue`, `data-sync`, `feature-request`, `improvement`, `design-ux`

## Security

- ✅ Token lives only in Vercel/Netlify environment variables
- ✅ No token in desktop app code or installers
- ✅ Input validation on the proxy prevents spam
- ✅ Users cannot see or extract the token
- ✅ The proxy has a single purpose: create issues
