import os
import json
import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

_ERROR_PREFIX = "ERROR:"

_ERROR_PHRASES = [
    "Gagal menghasilkan narasi",
    "rate limited",
    "API key tidak",
    "Periksa API key",
    "Semua model sedang",
]

# (url, key_env_var, model) — SambaNova first (lebih jarang 429), Cerebras sebagai fallback
_CASCADE = [
    ("https://api.sambanova.ai/v1/chat/completions", "SAMBANOVA_API_KEY", "Meta-Llama-3.1-405B-Instruct"),
    ("https://api.sambanova.ai/v1/chat/completions", "SAMBANOVA_API_KEY", "Meta-Llama-3.3-70B-Instruct"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "qwen-3-235b-a22b-instruct-2507"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "gpt-oss-120b"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "zai-glm-4.7"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "llama3.1-8b"),
]

_SYSTEM_PROMPT = """Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Tugas kamu: tulis narasi bahasa Indonesia yang mudah dipahami berdasarkan DATA TERSTRUKTUR yang diberikan.

ATURAN KETAT:
1. Jangan membuat interpretasi di luar data yang diberikan
2. Selalu gunakan framing probabilistik: "kecenderungan", "pola", bukan "pasti" atau "akan"
3. Semua interpretasi harus dikaitkan dengan domain kehidupan konkret
4. Bahasa: Indonesia, conversational, tidak terlalu formal
5. Panjang: maksimal 3 paragraf per section
6. Selalu sertakan: "Menurut framework Zi Ping Zhen Quan"
"""

_CALENDAR_SYSTEM_PROMPT = """Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Tugas kamu: jelaskan interaksi antara chart natal pengguna dan pilar BaZi tanggal yang dipilih.

ATURAN:
- Bahasa Indonesia, conversational, mudah dipahami
- Framing probabilistik: "kecenderungan", "pola", bukan "pasti"
- Fokus: apa arti interaksi ini untuk aktivitas/energi pengguna pada tanggal tersebut
- Jika tidak ada interaksi, jelaskan makna energi netral secara singkat
- Maksimal 2 paragraf ringkas
- Selalu sertakan: "Menurut framework Zi Ping Zhen Quan"
"""


def is_error_narasi(text: str) -> bool:
    """True jika teks adalah pesan error, bukan narasi nyata."""
    if not text or len(text) < 80:
        return True
    if text.startswith(_ERROR_PREFIX):
        return True
    return any(phrase in text for phrase in _ERROR_PHRASES)


async def _try_model(url: str, api_key: str, model: str, messages: list, max_tokens: int) -> tuple[Optional[str], bool]:
    """Returns (result, is_rate_limited). result=None jika rate limited."""
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
        if resp.status_code == 429:
            logger.warning("429 pada model %s — mencoba model berikutnya", model)
            return None, True
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip(), False
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            return None, True
        logger.error("HTTP %s (model %s): %s", e.response.status_code, model, e.response.text)
        return f"{_ERROR_PREFIX} HTTP {e.response.status_code}.", False
    except Exception as e:
        logger.error("Error (model %s): %s", model, e)
        return f"{_ERROR_PREFIX} {e}", False


async def _call_ai(messages: list, max_tokens: int = 1000) -> str:
    for url, key_env, model in _CASCADE:
        api_key = os.getenv(key_env, "")
        if not api_key:
            logger.debug("Tidak ada API key untuk %s, skip model %s", key_env, model)
            continue
        result, rate_limited = await _try_model(url, api_key, model, messages, max_tokens)
        if not rate_limited:
            if result and not is_error_narasi(result):
                logger.info("Narasi berhasil dengan model %s", model)
            return result or f"{_ERROR_PREFIX} Tidak ada respons dari model."

    return f"{_ERROR_PREFIX} Semua model sedang rate limited. Coba lagi dalam beberapa menit."


async def generate_narasi(chart_data: Dict[str, Any], section: str) -> str:
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps({"chart_data": chart_data, "section": section}, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=1000)


async def generate_wish_analysis(chart_data: Dict[str, Any], wish_content: str) -> str:
    system = """Kamu adalah konsultan BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Berdasarkan chart BaZi pengguna dan keinginan yang mereka tuliskan, berikan analisis:
1. Apakah keinginan ini selaras dengan energi dominan dalam chart (elemen, Ten Gods)?
2. Hambatan apa yang mungkin muncul berdasarkan chart?
3. Strategi konkret (2-3 langkah) untuk mewujudkan keinginan tersebut sesuai pola energi chart.

ATURAN:
- Bahasa Indonesia, conversational
- Framing probabilistik: "kecenderungan", "cocok dengan pola", bukan "pasti"
- Maksimal 4 paragraf
- Selalu kaitkan dengan data chart yang diberikan
"""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps({"chart_data": chart_data, "keinginan": wish_content}, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=1200)


async def generate_calendar_narasi(
    user_chart: Dict[str, Any],
    calendar_pillars: Dict[str, Any],
    interactions: list,
    date_str: str,
) -> str:
    user_content = json.dumps({
        "tanggal": date_str,
        "chart_natal_pengguna": user_chart,
        "pilar_kalender": calendar_pillars,
        "interaksi": interactions,
    }, ensure_ascii=False)
    messages = [
        {"role": "system", "content": _CALENDAR_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    return await _call_ai(messages, max_tokens=600)
