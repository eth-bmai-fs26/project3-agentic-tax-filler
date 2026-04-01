"""LLM service abstraction — provider-agnostic chat completions.

Supports OLLAMA (local) and any OpenAI-compatible endpoint.
"""

import json
import logging
import re
import time
from typing import Any

logger = logging.getLogger("mcp_server.llm_service")


class LLMService:
    """Thin wrapper over OpenAI-compatible chat completions.

    Parameters
    ----------
    provider : str
        Provider name (for logging). E.g. ``"ollama"``, ``"openai"``.
    model : str
        Model identifier. E.g. ``"llama3.1:8b"``, ``"gpt-4o-mini"``.
    base_url : str
        Base URL of the OpenAI-compatible API.
    api_key : str
        API key. Use ``"unused"`` for OLLAMA.
    """

    def __init__(
        self,
        provider: str = "ollama",
        model: str = "llama3.1:8b",
        base_url: str = "http://localhost:11434/v1",
        api_key: str = "unused",
        no_think: bool = False,
    ):
        from openai import OpenAI

        self.provider = provider
        self.model = model
        self.no_think = no_think
        self._client = OpenAI(api_key=api_key, base_url=base_url)
        logger.info("LLMService ready — provider=%s, model=%s, url=%s", provider, model, base_url)

    def chat(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> str:
        """Single chat completion. Returns the assistant's text content.

        Retries up to 3 times on rate-limit (429) errors.
        """
        if self.no_think:
            system = system.rstrip() + "\n/no_think"

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        for attempt in range(3):
            try:
                response = self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                msg = response.choices[0].message
                content = msg.content or ""
                # Some models (e.g. Qwen3) put thinking in a separate
                # 'reasoning' field and leave 'content' empty.  Fall
                # back to reasoning when content is blank.
                if not content.strip():
                    reasoning = getattr(msg, "reasoning", None) or ""
                    if reasoning.strip():
                        content = reasoning
                return content
            except Exception as exc:
                if "429" in str(exc) and attempt < 2:
                    wait = 10 * (attempt + 1)
                    logger.warning("Rate limited, waiting %ds...", wait)
                    time.sleep(wait)
                else:
                    raise

    def chat_json(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> dict:
        """Chat completion that parses the response as JSON.

        Strips markdown fences, tries ``json.loads``, falls back to
        regex extraction of the first ``{...}`` object.
        """
        text = self.chat(system, user, max_tokens=max_tokens, temperature=temperature)
        return _parse_json(text)

    # -- Factory classmethods -----------------------------------------------

    @classmethod
    def ollama(
        cls,
        model: str = "llama3.1:8b",
        host: str = "http://localhost:11434",
        no_think: bool | None = None,
    ) -> "LLMService":
        """Create an LLMService backed by a local OLLAMA instance.

        Parameters
        ----------
        no_think : bool or None
            If ``True``, append ``/no_think`` to the system prompt (needed
            for thinking models like Qwen3).  If ``None`` (default),
            auto-detect from the model name.
        """
        if no_think is None:
            no_think = any(tag in model.lower() for tag in ("qwen3", "deepseek-r1"))
        return cls(
            provider="ollama",
            model=model,
            base_url=f"{host}/v1",
            api_key="unused",
            no_think=no_think,
        )

    @classmethod
    def openai_compatible(cls, model: str, base_url: str, api_key: str) -> "LLMService":
        """Create an LLMService for any OpenAI-compatible endpoint."""
        return cls(provider="openai", model=model, base_url=base_url, api_key=api_key)


# ---------------------------------------------------------------------------
# JSON parsing helpers
# ---------------------------------------------------------------------------


def _parse_json(text: str) -> dict:
    """Extract a JSON object from LLM text output.

    Handles markdown fences, leading/trailing text, and nested braces.
    """
    if text is None:
        return {}
    text = text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    # Try direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: extract first JSON object via regex
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse JSON from LLM response: %s", text[:200])
    return {}
