# BaZi AI Prompts

Dokumen ini merangkum prompt AI yang dipakai runtime dan sudah dibagi secara modular.

> **Catatan:** dokumen ini sebelumnya tertinggal dari kode — masih mendeskripsikan `PROFILE_SYSTEM_PROMPT` v1 padahal runtime sudah pindah ke `PROFILE_SYSTEM_PROMPT_V2` (format `SECTION:` untuk story cards). Update di bawah ini sudah disinkronkan ulang dengan [backend/app/services/cerebras.py](backend/app/services/cerebras.py).

## 1. Base Cascade & Error Handling

Lokasi: [backend/app/services/cerebras.py](backend/app/services/cerebras.py)

Semua endpoint AI memanggil `_call_ai()`, yang mencoba model secara berurutan (SambaNova dulu karena lebih jarang 429, lalu Cerebras sebagai fallback):

```text
1. SambaNova — DeepSeek-V3-0324
2. SambaNova — Meta-Llama-3.3-70B-Instruct
3. Cerebras  — qwen-3-235b-a22b-instruct-2507
4. Cerebras  — gpt-oss-120b
5. Cerebras  — zai-glm-4.7
6. Cerebras  — llama3.1-8b
```

Jika semua gagal/rate limited, return `"ERROR: Semua model sedang rate limited. Coba lagi dalam beberapa menit."` — dicek via `is_error_narasi()` sebelum di-cache ke DB (respons error tidak pernah disimpan sebagai cache permanen).

## 2. Task Prompt Profil (Story Cards)

Lokasi: [backend/app/services/cerebras.py](backend/app/services/cerebras.py) — `PROFILE_SYSTEM_PROMPT_V2`

Fungsi: `generate_narasi(chart_data, section)`, dipakai saat `section == 'full_analysis_v2'`. Untuk section lain (`full_analysis`), masih memakai `PROFILE_SYSTEM_PROMPT` (v1, paragraf bebas + baris `Snapshot:` di akhir) — dipertahankan untuk kompatibilitas data lama.

```text
Kamu adalah BaZi Strategic Analyst menggunakan framework Zi Ping Zhen Quan (子平真詮).

WAJIB: setiap pernyataan harus menggunakan framing probabilistik — "kecenderungan", "pola", "cenderung", bukan "akan", "pasti", "selalu".
DILARANG: membuat interpretasi dari data yang tidak tersedia dalam input.
BAHASA OUTPUT: Bahasa Indonesia.

ATURAN KHUSUS hour_unknown: jika input menyertakan hour_unknown=true, jam lahir tidak diketahui — Pilar Jam, day_master_strength, dan yong_shen dihitung dengan estimasi dasar saja. Sisipkan satu catatan singkat di SECTION:keseimbangan_elemen bahwa estimasi ini bersifat dasar karena jam lahir tidak spesifik, dan jangan terdengar terlalu percaya diri di bagian itu.

Output WAJIB dalam format ini — 5 bagian dengan penanda SECTION: (tidak boleh ada teks apapun sebelum SECTION pertama):

SECTION:karakter_inti
[Day Master + Ge Ju dengan analogi konkret]

SECTION:keseimbangan_elemen
[dominasi/defisiensi elemen + peran Yong Shen]

SECTION:kekuatan_dan_jebakan
[2-3 aset struktural + 2-3 pola sabotase diri]

SECTION:arena_karir
[lingkungan kerja optimal + gaya menghasilkan berdasarkan Ge Ju]

SECTION:siklus_aktif
[tema dekade aktif (active_luck_pillar) + strategi siklus ini, atau pesan fallback jika tidak tersedia]

Setelah SECTION terakhir, wajib sertakan (persis satu baris):
Snapshot: [core nature] | [best arena] | [biggest trap] | [long-term move]
```

User payload (`generate_narasi`'s internal `payload` dict, hanya key yang non-null dikirim):

```json
{
  "day_master": "...",
  "pillars": { "...": "..." },
  "ten_gods": { "...": "..." },
  "strength": "Strong | Moderate-Strong | Moderate | Moderate-Weak | Weak",
  "ge_ju": "...",
  "yong_shen": "...",
  "void_branches": ["..."],
  "hidden_ten_gods": { "...": "..." },
  "stem_combinations": [{ "stems": ["...", "..."], "positions": ["...", "..."], "result_element": "..." }],
  "active_luck_pillar": { "...": "..." },
  "hour_unknown": true
}
```

Parser di frontend: `parseStorySections()` di [bazi-app/src/screens/ProfileScreen.tsx](bazi-app/src/screens/ProfileScreen.tsx) — regex `/SECTION:(\w+)\n([\s\S]*?)(?=SECTION:|Snapshot:|$)/g`. **Risiko:** ini delimiter string custom, bukan JSON — rapuh terhadap deviasi format kecil dari model (spasi ekstra, urutan section tertukar). Belum direfactor ke JSON mode karena parser saat ini stabil di production; pertimbangkan refactor jika model di cascade berganti dan mulai sering gagal parse.

## 3. Task Prompt Strategi

Lokasi: [backend/app/services/cerebras.py](backend/app/services/cerebras.py) — `WISH_SYSTEM_PROMPT`

Fungsi: `generate_wish_analysis(chart_data, wish_content)`

```text
Tugas: Evaluasi kelayakan (feasibility) target pengguna terhadap konfigurasi Ten Gods dan elemen chart.

ATURAN SPESIFIK:
1. Dilarang afirmasi palsu. Jika target tidak cocok dengan chart, jelaskan dengan bahasa sederhana apa hambatannya dan seberapa besar risikonya.
2. Analisis: Ten God yang diaktivasi → keselarasan dengan Yong Shen → keselarasan struktural → friction point → tendensi outcome.
3. Tutup dengan baris: "Alignment: [Tinggi / Sedang / Rendah] — [alasan singkat]"
4. Format keluaran: Maksimal 3 paragraf.
```

User payload template:

```json
{ "chart": chart_payload, "keinginan": wish_content }
```

## 4. Task Prompt Waktu (Kalender)

Lokasi: [backend/app/services/cerebras.py](backend/app/services/cerebras.py) — `TIME_SYSTEM_PROMPT`

Fungsi: `generate_calendar_narasi(user_chart, calendar_pillars, interactions, date_str)`

```text
Tugas: Kalkulasi interaksi taktis antara natal chart dan pilar waktu spesifik.

ATURAN SPESIFIK:
1. Fokus pada Yong Shen — interaksi mana yang menekan/mendukung Yong Shen chart.
2. Jika ada Clash/Harm/Punishment/Self-Penalty, jelaskan sebagai benturan, gangguan, atau tekanan yang jelas.
3. Jika tidak ada interaksi (kosong), output: "Kondisi Netral — tidak ada tekanan atau dorongan signifikan dari konfigurasi hari ini." Hentikan elaborasi.
4. Jika tanggal sudah lewat: frame sebagai retrospektif, bukan forward-looking.
5. Format keluaran: Maksimal 2 paragraf ringkas.
```

User payload template:

```json
{
  "tanggal": date_str,
  "chart_natal": chart_payload,
  "pilar_kalender": calendar_pillars,
  "interaksi": interactions
}
```

`interaksi` sekarang membawa field `favorability` per item (`'challenging' | 'favorable' | 'neutral' | null`) — hasil `annotate_favorability()` di [backend/app/engine/interactions.py](backend/app/engine/interactions.py), yang membandingkan elemen branch yang terdampak terhadap Yong Shen chart, bukan menilai baik/buruk murni dari tipe interaksi.

## 5. Task Prompt Lain (ringkas)

- **Annual** (`ANNUAL_SYSTEM_PROMPT` → `generate_annual_narasi`): tema makro tahun + area prioritas/risiko, 3 paragraf.
- **Wish Timing** (`WISH_TIMING_PROMPT` → `generate_wish_timing`): 2-3 bulan terbaik dari 6 bulan ke depan untuk eksekusi keinginan.
- **Relationship** (`RELATIONSHIP_SYSTEM_PROMPT` → `generate_relationship_narasi`): dinamika dua chart, TANPA skor kecocokan/jodoh.

## 6. Endpoint yang Memakai Prompt AI

| Endpoint | Fungsi prompt |
|----------|----------------|
| `POST /api/narasi/generate` | Task Prompt Profil (v1 atau v2 sesuai `section`) |
| `POST /api/wishes/{wish_id}/analyze` | Task Prompt Strategi |
| `GET /api/wishes/{wish_id}/timing` | Wish Timing |
| `POST /api/calendar/narasi` | Task Prompt Waktu |
| `GET /api/calendar/annual` | Annual |
| `POST /api/charts/compare` | Relationship |
| `GET /api/calendar/energy-summary` | Tidak memakai AI — rule-based murni (favorability + tipe interaksi), dipakai untuk teks notifikasi push |
| `GET /api/health` | Tidak memakai AI — liveness probe untuk wake-up HF Spaces dari frontend saat startup |

Frontend tidak mengirim prompt model tambahan; yang ada hanya teks UI, label, dan pesan error.

## 7. Catatan

- File yang sama juga ada di mirror backend Hugging Face pada [hf-deploy/backend/app/services/cerebras.py](hf-deploy/backend/app/services/cerebras.py) — selalu sync manual setelah ubah prompt.
- Tidak ada prompt AI lain yang ditemukan di workspace selain yang terdaftar di atas.
