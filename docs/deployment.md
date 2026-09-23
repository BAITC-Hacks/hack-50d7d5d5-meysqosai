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
- Route `/api` on the frontend origin to the backend using the hosting reverse proxy.
  The frontend uses relative API paths; no runtime API-base-URL setting is implemented.
  `VITE_API_PROXY` is development-only. `npm run preview` alone is not a full deployment.

## Current deployment limitations

No public deployment is verified. Run from the repository root so the fixture and
environment paths resolve. Use persistent writable storage for `DATA_PATH`, keep
the versioned fixture available, and run one backend instance. `APP_ENV=production`
does not enable authentication or rate limiting. Add access controls, TLS, request
limits and provider-spend controls before exposing research or report endpoints.
Do not put backend keys in frontend build variables. Restart after settings change.

## Release check

1. Run `./scripts/check.sh`.
2. Deploy with mock AI first and verify the public health endpoint.
3. Add secrets through the hosting dashboard and switch providers.
4. Test the main demo path, failure state, and cold restart.
5. Record the deployed URLs in `README.md` and rehearse `docs/demo-script.md`.
