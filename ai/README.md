# AI workspace

See [prompts.md](prompts.md) for the runtime prompt registry and development brief,
and [evaluations.md](evaluations.md) for qualitative evaluation cases. Runtime calls
live in `backend/app/services/ai.py` and `backend/app/services/evidence.py`.

Use mock mode until credentials are available. Treat model output as untrusted: validate structured data, show uncertainty, and keep a human in control of consequential GovTech decisions.
