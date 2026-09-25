# Fitness AI Hub v1.0

A zero-cost, mobile-first, offline PWA for personal fitness, meal, body, sleep and hydration tracking.

## Run locally

Service workers do not run from a `file://` URL. Start a local server in this folder:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy to GitHub Pages

1. Create a public GitHub repository named `fitness-ai-hub`.
2. Upload every file and folder from this project, preserving the folder structure.
3. Open repository **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main**, folder **/(root)**, then Save.
6. Open the generated `https://USERNAME.github.io/fitness-ai-hub/` URL.

All URLs are relative, so this project works under a GitHub Pages repository path.

## Install on iPhone

1. Open the deployed HTTPS URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep Open as Web App enabled when shown, then tap Add.

## Data and privacy

Version 1 stores data in browser localStorage only. Export a JSON backup from Settings before clearing browser data or moving to a new phone. There is no cloud sync yet.

## Update the app

Change the cache name in `sw.js`, for example from `v1.0.0` to `v1.0.1`, whenever changing cached files. Commit and deploy, then fully close and reopen the installed app.
