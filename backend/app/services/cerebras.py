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

BASE_PROMPT = """Sistem: Analis Data BaZi.
Framework: Zi Ping Zhen Quan (子平真詮).

ATURAN GLOBAL KETAT:
- Eliminasi bahasa motivasi, pujian, dan validasi emosional.
- Dilarang memberikan prediksi absolut ("pasti", "akan"). Gunakan terminologi probabilitas objektif ("korelasi tinggi", "pola dominan", "deviasi perilaku").
- Nada keluaran: Bahasa Indonesia, klinis, taktis, lugas, tanpa basa-basi percakapan.
- Deskripsikan kondisi negatif secara telanjang tanpa kata pelunak.
- Ekstraksi kesimpulan murni berdasarkan kalkulasi struktural interaksi elemen dan Ten Gods.
"""

PROFILE_TASK_PROMPT = """Tugas: Ekstraksi metrik psikologis dan strategis dari data BaZi terstruktur (Profil Natal).

ATURAN SPESIFIK:
1. Identifikasi kekuatan sebagai "Keuntungan Sistemik" dan kelemahan sebagai "Kerentanan Sistemik". Paparkan secara proporsional.
2. Prefix kalimat pertama: "Berdasarkan analisis struktural Zi Ping Zhen Quan:"
3. Format keluaran: Maksimal 3 paragraf per section, padat informasi.
"""

STRATEGY_TASK_PROMPT = """Tugas: Evaluasi kelayakan (feasibility) target pengguna terhadap konfigurasi Ten Gods dan elemen chart.

ATURAN SPESIFIK:
1. Dilarang afirmasi palsu. Jika target bertentangan dengan struktur chart, nyatakan secara eksplisit tingkat inkompatibilitas dan risikonya tanpa diperhalus.
2. Output wajib memuat 3 parameter metrik:
   - Keselarasan Sistem: Analisis teknis (korelasi Ten Gods/Elemen target vs chart dominan).
   - Friksi Bawaan: Hambatan struktural spesifik dari chart yang akan menjegal target tersebut.
   - Protokol Mitigasi: 2-3 taktik operasional untuk mem-bypass friksi bawaan.
3. Nada keluaran: Bahasa Indonesia, taktis, teknis, tanpa basa-basi.
4. Format keluaran: Maksimal 4 paragraf.
"""

TIME_TASK_PROMPT = """Tugas: Kalkulasi interaksi taktis antara natal chart dan pilar waktu spesifik.

ATURAN SPESIFIK:
1. Fokus pada pemetaan kondisi lingkungan (volatilitas, friksi, momentum).
2. Jika ada Clash/Harm/Punishment/Destruction, paparkan potensi disrupsi operasional.
3. Jika tidak ada interaksi (kosong), output: "Kondisi Netral/Status Quo." Hentikan elaborasi.
4. Format keluaran: Maksimal 2 paragraf ringkas.
"""


def _compose_system_prompt(task_prompt: str) -> str:
    return f"{BASE_PROMPT}\n\n{task_prompt}"


def is_error_narasi(text: str) -> bool:
    """True jika teks adalah pesan error, bukan narasi nyata."""
    if not text or len(text) < 80:
        return True
    if text.startswith(_ERROR_PREFIX):
        return True
    return any(phrase in text for phrase in _ERROR_PHRASES)


async def _try_model(url: str, api_key: str, model: str, messages: list, max_tokens: int) -> tuple[Optional[str], bool]:
    """Returns (result, try_next). result=None + try_next=True → lanjut ke model berikutnya."""
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
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip(), False
        if resp.status_code in (400, 422):
            # Payload kita yang salah — bukan masalah provider, stop cascade
            logger.error("Bad request (model %s): %s", model, resp.text[:300])
            return f"{_ERROR_PREFIX} Request tidak valid.", False
        # Semua error lain (401, 403, 404, 429, 5xx) → coba model berikutnya
        logger.warning("HTTP %s pada model %s — mencoba model berikutnya", resp.status_code, model)
        return None, True
    except Exception as e:
        logger.warning("Exception pada model %s (%s) — mencoba model berikutnya", model, e)
        return None, True


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
        {"role": "system", "content": _compose_system_prompt(PROFILE_TASK_PROMPT)},
        {"role": "user", "content": json.dumps({"chart_data": chart_data, "section": section}, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=1000)


async def generate_wish_analysis(chart_data: Dict[str, Any], wish_content: str) -> str:
    messages = [
        {"role": "system", "content": _compose_system_prompt(STRATEGY_TASK_PROMPT)},
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
        {"role": "system", "content": _compose_system_prompt(TIME_TASK_PROMPT)},
        {"role": "user", "content": user_content},
    ]
    return await _call_ai(messages, max_tokens=600)
