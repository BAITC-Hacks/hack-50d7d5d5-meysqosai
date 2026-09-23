from openai import AsyncOpenAI

from app.config import Settings


async def summarize(text: str, settings: Settings) -> tuple[str, str]:
    if settings.ai_provider == "mock":
        compact = " ".join(text.split())
        suffix = "…" if len(compact) > 240 else ""
        return f"Mock summary: {compact[:240]}{suffix}", "mock"

    if settings.ai_provider != "openai":
        raise ValueError(f"Unsupported AI_PROVIDER: {settings.ai_provider}")
    if not settings.ai_api_key:
        raise ValueError("AI_API_KEY is required when AI_PROVIDER=openai")

    client = AsyncOpenAI(
        api_key=settings.ai_api_key,
        base_url=settings.ai_base_url or None,
    )
    response = await client.responses.create(
        model=settings.ai_model,
        instructions=(
            "Summarize the supplied public-service text in plain language. "
            "Do not invent facts. State when important context is missing."
        ),
        input=text,
    )
    return response.output_text, "openai"
