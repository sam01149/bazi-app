import os
import json
import logging
import asyncio
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"

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


_ERROR_PREFIX = "ERROR:"

def is_error_narasi(text: str) -> bool:
    return text.startswith(_ERROR_PREFIX)


async def _call_cerebras(messages: list, max_tokens: int = 1000) -> str:
    if not CEREBRAS_API_KEY:
        logger.error("CEREBRAS_API_KEY tidak dikonfigurasi")
        return f"{_ERROR_PREFIX} API key AI tidak dikonfigurasi."

    payload = {
        "model": "qwen-3-235b-a22b-instruct-2507",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }

    # Retry up to 3 times with backoff for rate-limit (429) responses
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    CEREBRAS_API_URL,
                    headers={"Authorization": f"Bearer {CEREBRAS_API_KEY}", "Content-Type": "application/json"},
                    json=payload,
                )

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2 ** (attempt + 1) * 3))
                logger.warning("Cerebras 429 rate limit — menunggu %ss (attempt %d/3)", retry_after, attempt + 1)
                if attempt < 2:
                    await asyncio.sleep(retry_after)
                    continue
                return f"{_ERROR_PREFIX} Rate limit tercapai. Tunggu beberapa detik lalu coba lagi."

            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt < 2:
                await asyncio.sleep(2 ** (attempt + 1) * 3)
                continue
            logger.error("Cerebras HTTP %s: %s", e.response.status_code, e.response.text)
            return f"{_ERROR_PREFIX} HTTP {e.response.status_code}."
        except Exception as e:
            logger.error("Cerebras error: %s", e)
            return f"{_ERROR_PREFIX} {e}"

    return f"{_ERROR_PREFIX} Gagal setelah 3 percobaan."


async def generate_narasi(chart_data: Dict[str, Any], section: str) -> str:
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps({"chart_data": chart_data, "section": section}, ensure_ascii=False)},
    ]
    return await _call_cerebras(messages, max_tokens=1000)


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
    user_content = json.dumps({
        "chart_data": chart_data,
        "keinginan": wish_content,
    }, ensure_ascii=False)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
    return await _call_cerebras(messages, max_tokens=1200)


