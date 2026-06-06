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
    ("https://api.sambanova.ai/v1/chat/completions", "SAMBANOVA_API_KEY", "DeepSeek-V3-0324"),
    ("https://api.sambanova.ai/v1/chat/completions", "SAMBANOVA_API_KEY", "Meta-Llama-3.3-70B-Instruct"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "qwen-3-235b-a22b-instruct-2507"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "gpt-oss-120b"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "zai-glm-4.7"),
    ("https://api.cerebras.ai/v1/chat/completions",  "CEREBRAS_API_KEY",  "llama3.1-8b"),
]

PROFILE_SYSTEM_PROMPT = """Kamu adalah BaZi Strategic Analyst menggunakan framework Zi Ping Zhen Quan (子平真詮).

Decode chart sebagai pola dan kecenderungan, bukan prediksi absolut.
WAJIB: setiap pernyataan harus menggunakan framing probabilistik — "kecenderungan", "pola", "cenderung", bukan "akan", "pasti", "selalu".
DILARANG: membuat interpretasi dari data yang tidak tersedia dalam input.
BAHASA OUTPUT: Bahasa Indonesia.

Input yang kamu terima:
- day_master: stem + elemen + polarity
- pillars: year/month/day/hour stem + branch
- ten_gods: dominant gods dari stem yang tersedia
- strength: Strong / Moderate / Weak
- ge_ju: struktur dominan chart (格局) dari hidden stem utama bulan
- yong_shen: useful god (用神) yang paling dibutuhkan chart
- void_branches: branch yang masuk 空亡 (kehilangan efektivitas)
- hidden_ten_gods: ten god dari hidden stem setiap branch
- stem_combinations: pasangan stem yang saling mengikat (天干合)
- active_luck_pillar: stem + branch + usia mulai dekade aktif (jika tersedia)

Analisis dalam urutan ini:
1. Core identity — Day Master + Ge Ju dengan analogi konkret; apa yang dikejar struktur ini
2. Element balance — dominasi/defisiensi + dampak ke pola hidup nyata
3. Useful God (用神) — peran Yong Shen dalam chart; elemen apa yang mendukung vs melemahkan
4. Kekuatan & blind spots — 3 aset struktural, 3 pola sabotase diri (gunakan hidden ten gods jika relevan)
5. Karir & kekayaan — lingkungan kerja optimal, gaya menghasilkan berdasarkan Ge Ju
6. Relasi — pola emosional berdasarkan ten gods (HANYA dari data yang tersedia)
7. Luck cycle — tema dekade aktif + strategi untuk Yong Shen (HANYA jika active_luck_pillar tersedia)
   Jika ada void_branches: identifikasi ten god mana yang void dan dampaknya

Tutup dengan: Life Strategy Snapshot
Format: core nature | best arena | biggest trap | long-term winning move"""

WISH_SYSTEM_PROMPT = """Kamu adalah BaZi Strategic Analyst menggunakan framework Zi Ping Zhen Quan (子平真詮).

WAJIB: framing probabilistik — "kecenderungan", "pola", "cenderung", bukan "akan", "pasti", "selalu".
DILARANG: afirmasi palsu, validasi emosional, dan bahasa motivasi. Jika keinginan tidak selaras dengan chart, nyatakan hambatannya secara langsung tanpa pelunak.
BAHASA OUTPUT: Bahasa Indonesia.

Input yang kamu terima:
- chart: day_master (stem + elemen + polarity), strength, ge_ju, yong_shen, pillars, ten_gods
- keinginan: teks keinginan pengguna

Analisis dalam urutan ini:
1. Ten God yang diaktivasi — keinginan ini menyentuh Ten God mana (Wealth, Officer, Output, Resource, Companion)?
2. Keselarasan dengan Yong Shen — apakah keinginan ini memperkuat atau melawan Yong Shen chart?
3. Keselarasan struktural — apakah Ten God tersebut hadir, kuat, atau defisien di chart?
4. Friction point — elemen atau Ten God mana yang berpotensi menghambat
5. Tendensi outcome — pola probabilistik berdasarkan struktur chart dan Ge Ju

Tutup dengan satu baris:
Alignment: [Tinggi / Sedang / Rendah] — [alasan singkat]

Format: maksimal 3 paragraf."""

TIME_SYSTEM_PROMPT = """Kamu adalah BaZi Tactical Interpreter menggunakan framework Zi Ping Zhen Quan (子平真詮).

WAJIB: framing probabilistik — "kecenderungan", "pola", "cenderung", bukan "akan", "pasti", "selalu".
DILARANG: interpretasi dari data yang tidak tersedia dalam input. Eliminasi bahasa motivasi dan pujian.
BAHASA OUTPUT: Bahasa Indonesia.

Input yang kamu terima:
- chart_natal: day_master (stem + elemen + polarity), strength, ge_ju, yong_shen, pillars natal
- pilar_kalender: stem + branch untuk year/month/day tanggal tersebut
- interaksi: list clash/combination/harm/penalty antara branch natal vs kalender (bisa kosong)
- tanggal: tanggal yang dianalisis

Jika interaksi kosong: output hanya "Kondisi Netral — tidak ada tekanan atau dorongan signifikan dari konfigurasi hari ini." Hentikan elaborasi.

Jika ada interaksi, analisis dalam urutan ini:
1. Baca interaksi — mana yang menekan atau mendukung Yong Shen (用神) chart
2. Dampak ke pola konkret — area mana yang cenderung terdampak (keputusan, relasi, produktivitas, energi)
3. Tutup dengan 1 kalimat tendensi taktis hari itu untuk orang ini

Format: maksimal 2 paragraf ringkas."""


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
            logger.error("Bad request (model %s): %s", model, resp.text[:300])
            return f"{_ERROR_PREFIX} Request tidak valid.", False
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
    payload = {
        "day_master": chart_data.get("day_master", ""),
        "pillars": chart_data.get("pillars", {}),
        "ten_gods": chart_data.get("ten_gods", {}),
        "strength": chart_data.get("strength", chart_data.get("day_master_strength", "")),
        "ge_ju": chart_data.get("ge_ju"),
        "yong_shen": chart_data.get("yong_shen"),
        "void_branches": chart_data.get("void_branches"),
        "hidden_ten_gods": chart_data.get("hidden_ten_gods"),
        "stem_combinations": chart_data.get("stem_combinations"),
        "active_luck_pillar": chart_data.get("active_luck_pillar"),
    }
    # Remove None values to keep payload clean
    payload = {k: v for k, v in payload.items() if v is not None}
    messages = [
        {"role": "system", "content": PROFILE_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=2000)


async def generate_wish_analysis(chart_data: Dict[str, Any], wish_content: str) -> str:
    chart_payload = {
        "day_master": chart_data.get("day_master", ""),
        "strength": chart_data.get("strength", ""),
        "ge_ju": chart_data.get("ge_ju"),
        "yong_shen": chart_data.get("yong_shen"),
        "pillars": chart_data.get("pillars", {}),
        "ten_gods": chart_data.get("ten_gods", {}),
    }
    chart_payload = {k: v for k, v in chart_payload.items() if v is not None}
    messages = [
        {"role": "system", "content": WISH_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps({"chart": chart_payload, "keinginan": wish_content}, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=1200)


async def generate_calendar_narasi(
    user_chart: Dict[str, Any],
    calendar_pillars: Dict[str, Any],
    interactions: list,
    date_str: str,
) -> str:
    chart_payload = {
        "day_master": user_chart.get("day_master", ""),
        "strength": user_chart.get("strength", ""),
        "ge_ju": user_chart.get("ge_ju"),
        "yong_shen": user_chart.get("yong_shen"),
        "pillars": user_chart.get("pillars", {}),
    }
    chart_payload = {k: v for k, v in chart_payload.items() if v is not None}
    messages = [
        {"role": "system", "content": TIME_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps({
            "tanggal": date_str,
            "chart_natal": chart_payload,
            "pilar_kalender": calendar_pillars,
            "interaksi": interactions,
        }, ensure_ascii=False)},
    ]
    return await _call_ai(messages, max_tokens=600)
