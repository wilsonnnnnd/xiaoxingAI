from decimal import Decimal
import sys
import types

if "dotenv" not in sys.modules:
    sys.modules["dotenv"] = types.SimpleNamespace(load_dotenv=lambda *args, **kwargs: None)

from app.core.ai_usage import (
    normalize_pricing_json,
    pricing_for_model,
    detect_provider,
    estimate_usage_cost_usd,
    normalize_usage_tokens,
)


def test_normalize_usage_tokens_uses_prompt_and_completion_when_total_missing():
    prompt, completion, total = normalize_usage_tokens(
        prompt_tokens=120,
        completion_tokens=80,
        total_tokens=0,
    )
    assert (prompt, completion, total) == (120, 80, 200)


def test_estimate_usage_cost_uses_model_specific_rates():
    cost = estimate_usage_cost_usd(
        model_name="gpt-4o-mini",
        prompt_tokens=1_000_000,
        completion_tokens=500_000,
    )
    assert cost == Decimal("0.45000000")


def test_detect_provider_prefers_url_host():
    assert detect_provider(url="https://api.openai.com/v1/chat/completions") == "openai"
    assert detect_provider(url="http://127.0.0.1:8001/v1/chat/completions") == "local"


def test_normalize_pricing_json_roundtrips_structured_config():
    raw = '{"fallback":{"prompt_per_million":"1.0","completion_per_million":"2.0"},"models":[{"model":"gpt-4o-mini","provider":"openai","prompt_per_million":"0.2","completion_per_million":"0.8"}]}'
    normalized = normalize_pricing_json(raw)
    assert '"gpt-4o-mini"' in normalized


def test_pricing_for_model_uses_config_when_present(monkeypatch):
    monkeypatch.setattr(
        "app.core.config.AI_PRICING_JSON",
        '{"fallback":{"prompt_per_million":"9","completion_per_million":"9"},"models":[{"model":"gpt-4o-mini","provider":"openai","prompt_per_million":"0.2","completion_per_million":"0.8"}]}',
    )
    pricing = pricing_for_model("gpt-4o-mini")
    assert pricing.prompt_per_million == Decimal("0.2")
    assert pricing.completion_per_million == Decimal("0.8")
