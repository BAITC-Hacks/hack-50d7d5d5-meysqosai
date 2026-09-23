# Deployment

Choose hosting after the challenge requirements are known. Prefer one platform that can deploy both components, or one static frontend plus one Python web service. Do not add Kubernetes or a separate database unless required.

## Backend service

- Runtime: Python 3.12
- Install: `python -m pip install -e backend`
- Start: `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
- Health check: `/api/health`
- Environment: `APP_ENV=production`, `FRONTEND_ORIGIN=https://your-frontend.example`
- AI credentials: add through the host's encrypted secret settings, never the repository.

SQLite is suitable only when the host provides a persistent disk and one application instance. If it does not, use the host's managed PostgreSQL and change the persistence adapter deliberately.

## Frontend service

- Root: `frontend`
- Install: `npm ci`
- Build: `npm run build`
- Output directory: `dist`
- Route `/api` to the backend or configure an explicit API base URL before deployment.

## Release check

1. Run `./scripts/check.sh`.
2. Deploy with mock AI first and verify the public health endpoint.
3. Add secrets through the hosting dashboard and switch providers.
4. Test the main demo path, failure state, and cold restart.
5. Record the deployed URLs in `README.md` and rehearse `docs/demo-script.md`.
