from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.parse import urlparse

from app.core import config

logger = logging.getLogger("ai_usage")
_ONE_MILLION = Decimal("1000000")


@dataclass(frozen=True)
class UsagePricing:
    prompt_per_million: Decimal
    completion_per_million: Decimal


@dataclass(frozen=True)
class PricingEntry:
    model: str
    provider: str
    prompt_per_million: Decimal
    completion_per_million: Decimal


@dataclass(frozen=True)
class UsageRecord:
    user_id: int | None
    recorded_at: datetime
    provider: str
    source: str
    purpose: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: Decimal


_DEFAULT_PRICING_TABLE: list[tuple[tuple[str, ...], PricingEntry]] = [
    (("gpt-4.1-mini",), PricingEntry("gpt-4.1-mini", "openai", Decimal("0.40"), Decimal("1.60"))),
    (("gpt-4.1-nano",), PricingEntry("gpt-4.1-nano", "openai", Decimal("0.10"), Decimal("0.40"))),
    (("gpt-4.1",), PricingEntry("gpt-4.1", "openai", Decimal("2.00"), Decimal("8.00"))),
    (("gpt-4o-mini",), PricingEntry("gpt-4o-mini", "openai", Decimal("0.15"), Decimal("0.60"))),
    (("gpt-4o",), PricingEntry("gpt-4o", "openai", Decimal("2.50"), Decimal("10.00"))),
    (("local-model", "llama", "qwen", "deepseek"), PricingEntry("local-model", "local", Decimal("0.00"), Decimal("0.00"))),
]
_DEFAULT_FALLBACK = PricingEntry("fallback", "default", Decimal("0.50"), Decimal("1.50"))


def utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


def normalize_usage_tokens(
    *,
    prompt_tokens: Any,
    completion_tokens: Any,
    total_tokens: Any,
) -> tuple[int, int, int]:
    prompt = max(0, int(prompt_tokens or 0))
    completion = max(0, int(completion_tokens or 0))
    total = max(0, int(total_tokens or 0))

    if total <= 0 and (prompt > 0 or completion > 0):
        total = prompt + completion
    if total > 0 and prompt == 0 and completion == 0:
        completion = total

    return prompt, completion, total


def detect_provider(*, url: str, explicit_backend: str = "") -> str:
    raw_url = str(url or "").strip().lower()
    host = (urlparse(raw_url).hostname or "").strip().lower()
    backend = str(explicit_backend or "").strip().lower()

    if "openai.com" in host:
        return "openai"
    if "openrouter.ai" in host:
        return "openrouter"
    if host in {"127.0.0.1", "localhost"}:
        return "local"
    if backend:
        return backend
    if host:
        return host
    return "unknown"


def _default_pricing_payload() -> dict[str, Any]:
    return {
        "fallback": {
            "prompt_per_million": str(_DEFAULT_FALLBACK.prompt_per_million),
            "completion_per_million": str(_DEFAULT_FALLBACK.completion_per_million),
        },
        "models": [
            {
                "model": entry.model,
                "provider": entry.provider,
                "prompt_per_million": str(entry.prompt_per_million),
                "completion_per_million": str(entry.completion_per_million),
            }
            for _, entry in _DEFAULT_PRICING_TABLE
        ],
    }


def default_pricing_json() -> str:
    return json.dumps(_default_pricing_payload(), ensure_ascii=False, indent=2)


def _to_decimal(value: Any) -> Decimal:
    return Decimal(str(value).strip())


def _normalize_pricing_entry(item: dict[str, Any]) -> PricingEntry:
    model = str(item.get("model") or "").strip()
    if not model:
        raise ValueError("Pricing entry model is required")
    provider = str(item.get("provider") or "").strip()
    prompt = _to_decimal(item.get("prompt_per_million", "0"))
    completion = _to_decimal(item.get("completion_per_million", "0"))
    if prompt < 0 or completion < 0:
        raise ValueError("Pricing rates must be non-negative")
    return PricingEntry(
        model=model,
        provider=provider,
        prompt_per_million=prompt,
        completion_per_million=completion,
    )


def parse_pricing_config(raw: str | None = None) -> dict[str, Any]:
    text = str(raw if raw is not None else config.AI_PRICING_JSON or "").strip()
    if not text:
        return _default_pricing_payload()

    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("Pricing config must be a JSON object")

    fallback_raw = parsed.get("fallback") or {}
    models_raw = parsed.get("models")
    if not isinstance(fallback_raw, dict):
        raise ValueError("Pricing fallback must be an object")
    if not isinstance(models_raw, list):
        raise ValueError("Pricing models must be an array")

    fallback_prompt = _to_decimal(fallback_raw.get("prompt_per_million", _DEFAULT_FALLBACK.prompt_per_million))
    fallback_completion = _to_decimal(fallback_raw.get("completion_per_million", _DEFAULT_FALLBACK.completion_per_million))
    if fallback_prompt < 0 or fallback_completion < 0:
        raise ValueError("Fallback pricing rates must be non-negative")
    fallback = {
        "prompt_per_million": str(fallback_prompt),
        "completion_per_million": str(fallback_completion),
    }
    models = [
        {
            "model": entry.model,
            "provider": entry.provider,
            "prompt_per_million": str(entry.prompt_per_million),
            "completion_per_million": str(entry.completion_per_million),
        }
        for entry in (_normalize_pricing_entry(item) for item in models_raw)
    ]

    return {"fallback": fallback, "models": models}


def normalize_pricing_json(raw: str | None = None) -> str:
    return json.dumps(parse_pricing_config(raw), ensure_ascii=False, indent=2)


def pricing_entries_from_config(raw: str | None = None) -> tuple[list[tuple[tuple[str, ...], PricingEntry]], PricingEntry]:
    try:
        parsed = parse_pricing_config(raw)
    except Exception as exc:
        logger.warning("invalid pricing config, using defaults: %s", exc)
        return _DEFAULT_PRICING_TABLE, _DEFAULT_FALLBACK

    fallback = parsed["fallback"]
    fallback_entry = PricingEntry(
        model="fallback",
        provider="default",
        prompt_per_million=_to_decimal(fallback["prompt_per_million"]),
        completion_per_million=_to_decimal(fallback["completion_per_million"]),
    )
    table: list[tuple[tuple[str, ...], PricingEntry]] = []
    for item in parsed["models"]:
        entry = _normalize_pricing_entry(item)
        table.append(((entry.model.lower(),), entry))
    return table, fallback_entry


def pricing_for_model(model_name: str) -> PricingEntry:
    name = str(model_name or "").strip().lower()
    table, fallback = pricing_entries_from_config()
    for aliases, entry in table:
        if any(alias in name for alias in aliases):
            return entry
    return fallback


def pricing_table_for_api() -> dict[str, Any]:
    raw = config.AI_PRICING_JSON
    uses_defaults = False
    try:
        parsed = parse_pricing_config(raw)
        if not str(raw or "").strip():
            uses_defaults = True
    except Exception:
        parsed = parse_pricing_config("")
        uses_defaults = True
    return {
        "fallback": parsed["fallback"],
        "models": parsed["models"],
        "source": "config",
        "uses_fallback_defaults": uses_defaults,
    }


def estimate_usage_cost_usd(
    *,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> Decimal:
    pricing = pricing_for_model(model_name)
    prompt_cost = (Decimal(prompt_tokens) / _ONE_MILLION) * pricing.prompt_per_million
    completion_cost = (Decimal(completion_tokens) / _ONE_MILLION) * pricing.completion_per_million
    return (prompt_cost + completion_cost).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
