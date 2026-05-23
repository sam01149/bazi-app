# BaZi App — Technical Brief
**Untuk AI teknikal / developer. Baca seluruh dokumen sebelum menulis satu baris kode.**

---

## 1. OVERVIEW PROYEK

Aplikasi mobile BaZi (八字) untuk **non-practitioner** — pengguna yang tertarik BaZi tapi tidak bisa membacanya sendiri. Aplikasi menghasilkan chart BaZi dari tanggal/waktu lahir dan menerjemahkan hasilnya ke bahasa yang mudah dipahami.

**Target platform:** Android & iOS (via React Native + Expo)
**Bahasa UI:** Indonesia
**Deployment:** APK/IPA yang bisa diinstall di handphone

---

## 2. TECH STACK

### Mobile (Frontend)
- **React Native** + **Expo** (managed workflow)
- Expo EAS Build untuk generate APK/IPA

### Backend
- **Python** + **FastAPI**
- **pyswisseph** — Swiss Ephemeris Python binding untuk Solar Terms
- **PostgreSQL** — data user, chart tersimpan
- **Redis** — caching hasil kalkulasi

### AI Narasi
- **Cerebras API** — model `llama-4-scout-17b` atau `llama3.1-70b`
- Hanya untuk generate narasi bahasa natural
- **Bukan** untuk decision-making atau kalkulasi

### Hosting
- Railway atau Render (backend)
- Supabase (PostgreSQL managed)

---

## 3. ARSITEKTUR 3-LAYER

```
Layer 1: Calculation Engine (Python, deterministic)
    ↓ output: Heavenly Stems, Earthly Branches, Ten Gods, interactions
Layer 2: Rule Engine (Python, auditable)
    ↓ output: structured interpretation data
Layer 3: AI Narasi (Cerebras)
    ↓ output: teks bahasa Indonesia untuk user
```

**Prinsip penting:**
- Layer 1 & 2 harus 100% deterministic dan auditable
- Layer 3 hanya membungkus output Layer 2 menjadi narasi
- AI tidak pernah membuat keputusan interpretasi sendiri
- Semua output dilabel: *"Menurut framework Zi Ping Zhen Quan (子平真詮)"*
- Framing selalu probabilistik: "kecenderungan", "pola", bukan prediksi absolut

---

## 4. CALCULATION ENGINE — DETAIL TEKNIS

### 4.1 Referensi Framework
**Primary:** 子平真詮 (Zi Ping Zhen Quan / ZPZQ) — semua interpretasi menggunakan framework ini  
**Calculation source:** 三命通會 (San Ming Tong Hui) untuk tabel Hidden Stems

### 4.2 Solar Terms (節氣)
Gunakan **Swiss Ephemeris** via pyswisseph — bukan algoritma estimasi.

```python
import swisseph as swe

def get_solar_term_date(year: int, term_index: int) -> datetime:
    """
    term_index 0-23, mulai dari 小寒
    Returns tanggal/waktu exact Solar Term
    """
    # swe.sol_eclipse_when_glob atau swe.houses
    # Gunakan swe.julday dan swe.revjul untuk konversi
    pass
```

**Kenapa Swiss Ephemeris:** Solar Terms adalah posisi matahari astronomis (setiap 15°). Algoritma estimasi bisa meleset 1 hari, Swiss Ephemeris akurat hingga detik.

### 4.3 Tahun BaZi
- Ganti di **Li Chun (立春)**, **bukan** Tahun Baru Imlek
- Li Chun = Solar Term ke-3 setiap tahun (sekitar 4 Feb)

### 4.4 Bulan BaZi
- Ganti di 12 Solar Terms ganjil (每月節氣):
  - 立春, 驚蟄, 清明, 立夏, 芒種, 小暑, 立秋, 白露, 寒露, 立冬, 大雪, 小寒

### 4.5 Hari BaZi
60 Jiazi cycle dari anchor date yang diketahui. Anchor yang valid:
- 1 Januari 2000 = 甲子日 (Jiazi Day #1)

```python
ANCHOR_DATE = date(2000, 1, 1)
ANCHOR_JIAZI_INDEX = 0  # 甲子

def get_day_pillar(target_date: date) -> tuple[str, str]:
    delta = (target_date - ANCHOR_DATE).days
    jiazi_index = delta % 60
    stem = HEAVENLY_STEMS[jiazi_index % 10]
    branch = EARTHLY_BRANCHES[jiazi_index % 12]
    return stem, branch
```

### 4.6 Jam BaZi
12 blok 2-jam. **Wajib** timezone dan DST correction.

```python
HOUR_BRANCHES = {
    (23, 1): "子",   # 23:00–01:00
    (1, 3): "丑",
    (3, 5): "寅",
    (5, 7): "卯",
    (7, 9): "辰",
    (9, 11): "巳",
    (11, 13): "午",
    (13, 15): "未",
    (15, 17): "申",
    (17, 19): "酉",
    (19, 21): "戌",
    (21, 23): "亥",
}
```

Hour Stem ditentukan dari Day Stem menggunakan tabel 五虎遁年起月法 yang dimodifikasi untuk jam.

---

## 5. HARDCODED TABLES

**Sumber: 三命通會 (San Ming Tong Hui)**

### 5.1 Heavenly Stems (天干)
```python
HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
HEAVENLY_STEMS_ELEMENT = {
    "甲": "Wood", "乙": "Wood",
    "丙": "Fire", "丁": "Fire",
    "戊": "Earth", "己": "Earth",
    "庚": "Metal", "辛": "Metal",
    "壬": "Water", "癸": "Water",
}
HEAVENLY_STEMS_POLARITY = {
    "甲": "Yang", "乙": "Yin",
    "丙": "Yang", "丁": "Yin",
    "戊": "Yang", "己": "Yin",
    "庚": "Yang", "辛": "Yin",
    "壬": "Yang", "癸": "Yin",
}
```

### 5.2 Earthly Branches (地支)
```python
EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
EARTHLY_BRANCHES_ELEMENT = {
    "子": "Water", "丑": "Earth", "寅": "Wood", "卯": "Wood",
    "辰": "Earth", "巳": "Fire", "午": "Fire", "未": "Earth",
    "申": "Metal", "酉": "Metal", "戌": "Earth", "亥": "Water",
}
```

### 5.3 Hidden Stems (藏干) — dari 三命通會
```python
HIDDEN_STEMS = {
    "子": ["癸"],
    "丑": ["己", "癸", "辛"],
    "寅": ["甲", "丙", "戊"],
    "卯": ["乙"],
    "辰": ["戊", "乙", "癸"],
    "巳": ["丙", "庚", "戊"],
    "午": ["丁", "己"],
    "未": ["己", "丁", "乙"],
    "申": ["庚", "壬", "戊"],
    "酉": ["辛"],
    "戌": ["戊", "辛", "丁"],
    "亥": ["壬", "甲"],
}
```

### 5.4 Six Clashes (六沖)
```python
SIX_CLASHES = [
    {"子", "午"}, {"丑", "未"}, {"寅", "申"},
    {"卯", "酉"}, {"辰", "戌"}, {"巳", "亥"},
]
```

### 5.5 Six Combinations (六合)
```python
SIX_COMBINATIONS = [
    ({"子", "丑"}, "Earth"),
    ({"寅", "亥"}, "Wood"),
    ({"卯", "戌"}, "Fire"),
    ({"辰", "酉"}, "Metal"),
    ({"巳", "申"}, "Water"),
    ({"午", "未"}, "Fire"),
]
```

### 5.6 Three Combinations (三合)
```python
THREE_COMBINATIONS = [
    ({"申", "子", "辰"}, "Water"),
    ({"亥", "卯", "未"}, "Wood"),
    ({"寅", "午", "戌"}, "Fire"),
    ({"巳", "酉", "丑"}, "Metal"),
]
```

### 5.7 Six Harms (六害)
```python
SIX_HARMS = [
    {"子", "未"}, {"丑", "午"}, {"寅", "巳"},
    {"卯", "辰"}, {"申", "亥"}, {"酉", "戌"},
]
```

### 5.8 Three Penalties (三刑)
```python
THREE_PENALTIES = [
    {"寅", "巳", "申"},  # Ungrateful Penalty
    {"丑", "戌", "未"},  # Bullying Penalty
    {"子", "卯"},         # Uncivilized Penalty
    {"辰"},               # Self Penalty
    {"午"},               # Self Penalty
    {"酉"},               # Self Penalty
    {"亥"},               # Self Penalty
]
```

---

## 6. TEN GODS (十神) MAPPING

**Sumber:** 子平真詮 (ZPZQ) sebagai primary, 淵海子平 untuk 比肩/劫財/偏印

### 6.1 Logic Kalkulasi
Ten God ditentukan dari hubungan antara **Day Master** (日主, Heavenly Stem hari) dengan setiap Stem lain di chart.

```python
def calculate_ten_god(day_master: str, target_stem: str) -> str:
    dm_element = HEAVENLY_STEMS_ELEMENT[day_master]
    dm_polarity = HEAVENLY_STEMS_POLARITY[day_master]
    t_element = HEAVENLY_STEMS_ELEMENT[target_stem]
    t_polarity = HEAVENLY_STEMS_POLARITY[target_stem]
    
    same_polarity = (dm_polarity == t_polarity)
    
    # Same element
    if dm_element == t_element:
        return "比肩" if same_polarity else "劫財"
    
    # I produce (我生)
    if PRODUCES[dm_element] == t_element:
        return "食神" if same_polarity else "傷官"
    
    # I control (我克)
    if CONTROLS[dm_element] == t_element:
        return "偏財" if same_polarity else "正財"
    
    # Controls me (克我)
    if CONTROLS[t_element] == dm_element:
        return "偏官" if same_polarity else "正官"
    
    # Produces me (生我)
    if PRODUCES[t_element] == dm_element:
        return "偏印" if same_polarity else "正印"

PRODUCES = {
    "Wood": "Fire", "Fire": "Earth", "Earth": "Metal",
    "Metal": "Water", "Water": "Wood",
}
CONTROLS = {
    "Wood": "Earth", "Earth": "Water", "Water": "Fire",
    "Fire": "Metal", "Metal": "Wood",
}
```

### 6.2 Ten Gods — Domain & Interpretasi untuk User

Ini adalah konten layer yang ditampilkan ke user non-practitioner. **Semua interpretasi dilabel "Menurut ZPZQ".**

---

**正官 (Zheng Guan — Direct Officer)**
- Sumber ZPZQ: Ch.31
- Domain: Karir formal, reputasi, struktur, otoritas
- Strong: Disiplin, etis, dihormati, cocok kerja di institusi
- Weak/Excess: Kaku berlebihan, takut otoritas, overthinking aturan
- Kalender: Baik untuk interview, presentasi formal, negosiasi kontrak

**偏官 / 七殺 (Pian Guan — Indirect Officer / Seven Killings)**
- Sumber ZPZQ: Ch.39
- Domain: Tekanan eksternal, kompetisi, krisis, transformasi melalui konflik
- Strong + controlled: Berani, decisive, cocok leadership di lingkungan kompetitif
- Uncontrolled: Agresif, impulsif, menarik konflik
- Kalender: Waspadai konflik; jika strong & controlled, waktu untuk decisive action

**正財 (Zheng Cai — Direct Wealth)**
- Sumber ZPZQ: Ch.33
- Domain: Pendapatan stabil, aset, hubungan pasangan (pria), manajemen resources
- Strong: Rajin, hemat, reliable, financial manager yang baik
- Weak: Kesulitan material, kurang kepercayaan diri soal uang
- Kalender: Baik untuk investasi jangka panjang, negosiasi gaji

**偏財 (Pian Cai — Indirect Wealth)**
- Sumber ZPZQ: Ch.33
- Domain: Pendapatan tidak terduga, bisnis, networking, ayah (dalam konteks 6 relatives)
- Strong: Dermawan, sociable, luck dalam windfall
- Excess: Boros, tersebar fokus
- Kalender: Peluang bisnis mendadak, networking events

**正印 (Zheng Yin — Direct Resource)**
- Sumber ZPZQ: Ch.35
- Domain: Dukungan, pendidikan, ibu, intuisi, regenerasi
- Strong: Bijaksana, belajar cepat, dapat dukungan kuat
- Excess: Bergantung, kurang inisiatif
- Kalender: Baik untuk belajar, mendapat mentor, istirahat

**偏印 / 梟神 (Pian Yin — Indirect Resource)**
- Sumber: 淵海子平 (相心賦, 六親總篇)
- Domain: Keahlian non-konvensional, intuisi alternatif, belajar mandiri
- Strong: Kreatif, unik, skill esoterik
- Excess (梟神): Mulai banyak, selesai sedikit; mengorbankan output demi process
- Kalender: Baik untuk solo research, bukan untuk deliverable dengan deadline ketat

**食神 (Shi Shen — Eating God)**
- Sumber ZPZQ: Ch.37
- Domain: Ekspresi diri, kreativitas, kenikmatan, output
- Strong: Ekspresif, berbakat, menikmati hidup, produktif secara kreatif
- Weak: Sulit mengekspresikan diri
- Kalender: Baik untuk creative projects, public speaking, kolaborasi

**傷官 (Shang Guan — Hurting Officer)**
- Sumber ZPZQ: Ch.43
- Domain: Inovasi, pemberontakan terhadap struktur, bakat luar biasa, ego tinggi
- Strong + channeled: Genius-level output, pembuat tren
- Unmanaged: Konflik dengan otoritas, merusak reputasi sendiri
- Kalender: Hindari konfrontasi dengan atasan; gunakan energi untuk creative output

**陽刃 (Yang Ren — Yang Blade)**
- Sumber ZPZQ: Ch.45
- Domain: Intensitas, determinasi, kompetisi, potensi ekstrem (sangat baik atau sangat buruk)
- Strong + controlled: Warrior energy, pemimpin militer/eksekutif
- Uncontrolled: Destruktif, self-sabotage
- Kalender: Hari/bulan 陽刃 — hindari konfrontasi langsung, gunakan untuk kerja intensif solo

**建祿 (Jian Lu — Established Prosperity)**
- Sumber ZPZQ: Ch.47
- Domain: Kemandirian, self-sufficiency, tidak bergantung orang lain
- Strong: Independent, capable, self-made
- Excess: Sulit menerima bantuan, isolated
- Kalender: Baik untuk self-directed projects

**比肩 (Bi Jian — Parallel Shoulder)**
- Sumber: 淵海子平 (論兄弟姊妹)
- Domain: Peers, kompetisi dari sesama level, networking horizontal
- Strong: Kolaboratif dengan peers, kompetitif secara sehat
- Excess: Kompetisi berebut resources, konflik dengan siblings/partners
- Kalender: Waspadai persaingan; waktu yang baik untuk peer collaboration

**劫財 (Jie Cai — Rob Wealth)**
- Sumber: 淵海子平 (論劫財, dedicated section)
- Domain: Pengeluaran tidak terduga, kehilangan resources melalui orang lain, risk-taking
- Strong: Risk-taker, sociable, dapat windfall tapi juga mudah kehilangan
- Excess: Kebocoran finansial, kepercayaan salah orang
- Catatan ZPZQ: 男命見劫財多克妻 — konteks histori, dalam app framing sebagai: "kecenderungan konflik dalam partnership"
- Kalender: Waspadai pengeluaran besar; audit keuangan

---

## 7. DAY MASTER STRENGTH

**Default: ZPZQ weighting**

Komponen yang dinilai:
1. Month Branch (月支) — paling berpengaruh
2. Season alignment
3. Hidden Stems yang mendukung Day Master
4. Heavenly Stems lain yang mendukung

```python
def calculate_day_master_strength(chart: BaZiChart) -> str:
    """Returns: 'Strong', 'Moderate', 'Weak'"""
    # ZPZQ weighting logic
    pass
```

---

## 8. KALENDER BAZI

### 8.1 Definisi
Kalender BaZi adalah 四柱 (Year/Month/Day/Hour pillars) dari **waktu sekarang**, bukan dari kelahiran user.

### 8.2 Interaction Detection
Sistem harus mendeteksi otomatis interaksi antara pillar kalender dengan chart user:

```python
def detect_calendar_interactions(
    user_chart: BaZiChart,
    calendar_pillars: BaZiChart
) -> list[Interaction]:
    interactions = []
    
    # Check clashes
    all_branches = user_chart.all_branches + calendar_pillars.all_branches
    for clash_pair in SIX_CLASHES:
        if clash_pair.issubset(set(all_branches)):
            interactions.append(Interaction(type="clash", ...))
    
    # Check combinations
    # Check harms
    # Check penalties
    
    return interactions
```

### 8.3 Output ke User
Bukan raw interaction, tapi narasi:
- "Bulan ini ada 子午 clash antara chart kamu dan energi bulan — kecenderungan: tekanan di area [domain yang relevan]"

---

## 9. DATABASE SCHEMA

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    timezone VARCHAR(50) NOT NULL
);

-- BaZi Charts
CREATE TABLE bazi_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    birth_datetime TIMESTAMPTZ NOT NULL,
    birth_timezone VARCHAR(50) NOT NULL,
    -- Pillars
    year_stem VARCHAR(5) NOT NULL,
    year_branch VARCHAR(5) NOT NULL,
    month_stem VARCHAR(5) NOT NULL,
    month_branch VARCHAR(5) NOT NULL,
    day_stem VARCHAR(5) NOT NULL,
    day_branch VARCHAR(5) NOT NULL,
    hour_stem VARCHAR(5),
    hour_branch VARCHAR(5),
    -- Metadata
    day_master_strength VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ten Gods per chart
CREATE TABLE ten_gods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID REFERENCES bazi_charts(id),
    position VARCHAR(20),  -- year_stem, month_branch, etc.
    stem_or_branch VARCHAR(5),
    ten_god VARCHAR(10),
    element VARCHAR(10),
    polarity VARCHAR(5)
);
```

---

## 10. API ENDPOINTS

```
POST /api/charts/calculate
    Body: { birth_date, birth_time, birth_timezone }
    Returns: full BaZi chart dengan Ten Gods

GET /api/charts/{chart_id}
    Returns: saved chart

GET /api/calendar/current
    Query: ?timezone=Asia/Jakarta
    Returns: current BaZi pillars + interactions dengan chart user

POST /api/narasi/generate
    Body: { chart_id, section }  # section: overall, career, wealth, etc.
    Returns: AI-generated narasi bahasa Indonesia

GET /api/solar-terms/year/{year}
    Returns: semua Solar Terms dalam tahun tersebut
```

---

## 11. AI NARASI — CEREBRAS INTEGRATION

### 11.1 System Prompt Template
```
Kamu adalah interpreter BaZi menggunakan framework Zi Ping Zhen Quan (子平真詮).
Tugas kamu: tulis narasi bahasa Indonesia yang mudah dipahami berdasarkan DATA TERSTRUKTUR yang diberikan.

ATURAN KETAT:
1. Jangan membuat interpretasi di luar data yang diberikan
2. Selalu gunakan framing probabilistik: "kecenderungan", "pola", bukan "pasti" atau "akan"
3. Semua interpretasi harus dikaitkan dengan domain kehidupan konkret
4. Bahasa: Indonesia, conversational, tidak terlalu formal
5. Panjang: maksimal 3 paragraf per section
6. Selalu sertakan: "Menurut framework Zi Ping Zhen Quan"
```

### 11.2 Input ke AI (selalu structured)
```json
{
  "day_master": "甲 (Yang Wood)",
  "strength": "Strong",
  "dominant_gods": ["正官", "傷官"],
  "calendar_interactions": [
    {
      "type": "clash",
      "user_branch": "子",
      "calendar_branch": "午",
      "domain": "career"
    }
  ],
  "section": "career"
}
```

---

## 12. MOBILE APP — SCREEN FLOW

```
Splash Screen
    ↓
Onboarding (input tanggal lahir, waktu, timezone)
    ↓
Chart Screen (visual 四柱 display)
    ↓
Interpretation Screen (per Ten God, dengan narasi)
    ↓
Calendar Screen (BaZi hari ini + interaksi dengan chart user)
    ↓
[Roadmap v2] Goals Screen (fitur "keinginan dan cara mencapainya")
```

### 12.1 Onboarding — Input yang Diperlukan
- Tanggal lahir (date picker)
- Waktu lahir — WAJIB, dengan note: "Waktu lahir mempengaruhi Hour Pillar. Jika tidak tahu, aktifkan 'Unknown Hour'"
- Timezone — auto-detect tapi bisa diubah manual
- DST: handling otomatis via pytz/timezone database

### 12.2 Chart Display
Visual 4-kolom menampilkan:
```
Year  | Month | Day  | Hour
甲    | 丙    | 壬   | 庚
子    | 寅    | 午   | 申
```
Setiap pillar: karakter Hanzi + element + Ten God label

---

## 13. FRAMING & LABEL YANG WAJIB ADA

Setiap halaman interpretasi harus menampilkan:

> *"Interpretasi ini menggunakan framework 子平真詮 (Zi Ping Zhen Quan), salah satu teks klasik BaZi dari Dinasti Qing. Ini adalah kecenderungan dan pola, bukan prediksi absolut."*

---

## 14. SCOPE V1 vs V2

### V1 (Build sekarang)
- [ ] Kalkulasi chart lengkap (4 pillars + Ten Gods)
- [ ] Display chart visual
- [ ] Interpretasi per Ten God (narasi AI)
- [ ] Kalender BaZi (hari/bulan/tahun saat ini)
- [ ] Interaksi kalender vs chart user
- [ ] Onboarding input birth data

### V2 (Roadmap)
- [ ] Fitur "keinginan dan cara mencapainya" — mapping goals ke periode kalender BaZi yang favorable
- [ ] Multi-framework setting (tambahan 滴天髓 perspective)
- [ ] Day Master strength method selector (exposed setting)
- [ ] Special Structures (格局) dengan confidence threshold
- [ ] Push notification kalender harian

---

## 15. SOURCE AUTHORITY — UNTUK AUDIT

Jika ada pertanyaan tentang interpretasi, ini hierarki sumber:

| Ten God | Primary Source | Chapter/Section |
|---------|---------------|-----------------|
| 正官 | 子平真詮 | Ch.31 |
| 偏官/七殺 | 子平真詮 | Ch.39 |
| 正財/偏財 | 子平真詮 | Ch.33 |
| 正印 | 子平真詮 | Ch.35 |
| 食神 | 子平真詮 | Ch.37 |
| 傷官 | 子平真詮 | Ch.43 |
| 陽刃 | 子平真詮 | Ch.45 |
| 建祿 | 子平真詮 | Ch.47 |
| 比肩 | 淵海子平 | 論兄弟姊妹 |
| 劫財 | 淵海子平 | 論劫財 |
| 偏印 | 淵海子平 | 相心賦, 六親總篇 |
| Hidden Stems | 三命通會 | 藏干表 |
| Solar Terms | Swiss Ephemeris | — |

**Catatan:** 比肩, 劫財, 偏印 tidak memiliki dedicated chapter di teks klasik manapun (sudah diverifikasi di 子平真詮, 三命通會, 滴天髓闡微, 淵海子平). Ini bukan gap — memang struktur literatur BaZi klasik tidak memperlakukan ketiga gods ini sebagai primary subject. Interpretasi di section 6.2 adalah cross-inference yang telah divalidasi dari konteks dalam teks.

---

## 16. ENVIRONMENT SETUP

```bash
# Backend
pip install fastapi uvicorn pyswisseph psycopg2-binary redis pydantic

# Swiss Ephemeris data files — WAJIB download
# https://www.astro.com/swisseph/ephe/
# Download: seas_18.se1, sepl_18.se1, semo_18.se1 (minimal)
# Set path: swe.set_ephe_path('/path/to/ephe')

# Mobile
npm install -g @expo/cli
npx create-expo-app bazi-app
cd bazi-app
npx expo install expo-localization @react-native-async-storage/async-storage
```

---

## 17. CATATAN PENTING

1. **Waktu lahir timezone** — simpan selalu dalam UTC di database, konversi hanya untuk display. Jam lahir yang salah timezone = Hour Pillar yang salah.

2. **Li Chun boundary** — user yang lahir antara 1–6 Februari harus dicek apakah sebelum atau sesudah Li Chun. Ini sering salah di implementasi lain.

3. **Hidden Stems dan Ten Gods** — Ten Gods juga dihitung untuk Hidden Stems di setiap Branch, bukan hanya Heavenly Stems. Display ini opsional di V1 tapi kalkulasinya harus ada.

4. **Cerebras API** — tidak ada streaming di versi awal, gunakan standard completion. Set timeout yang cukup (30s) karena narasi bisa 3 paragraf.

5. **Expo EAS Build** — untuk generate APK yang bisa diinstall langsung (tidak melalui Play Store), gunakan `eas build --platform android --profile preview` dengan `buildType: apk` di eas.json.

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## 12. V2 — ARSITEKTUR 3-TAB (2026-05-23)

### 12.1 Perubahan Utama

V2 menghapus flow linear (Onboarding → Chart → Calendar) dan menggantinya dengan **3 tab bottom navigation**, ditujukan untuk single-user personal use.

**Tab 1 — Kalender BaZi**
- Grid kalender bulanan (7-kolom, navigasi bulan prev/next)
- Tap tanggal → fetch BaZi pilar untuk tanggal tersebut via `GET /api/calendar/date/{YYYY-MM-DD}`
- Untuk hari ini: auto-fetch via `GET /api/calendar/current` + generate AI narasi energi harian
- Tampilkan interaksi (clash, combination, harm, penalty) antara pilar tanggal dan chart natal user
- Bila belum ada profil, tampilkan banner ajakan ke tab Profil

**Tab 2 — Keinginan**
- User tulis keinginan/goal → simpan via `POST /api/wishes`
- Daftar keinginan tersimpan, bisa expand/collapse
- Tombol "Analisis dengan BaZi Chart" → `POST /api/wishes/{id}/analyze` → AI generate strategi berdasarkan chart natal
- Analisis di-cache di database (tidak re-generate kecuali diminta ulang)
- Delete wish via `DELETE /api/wishes/{id}`

**Tab 3 — Profil**
- Bila belum ada chart: tampilkan form setup (tanggal, waktu, timezone)
- Setelah setup: tampilkan 4 pilar, strength, Ten Gods, dan 5 seksi AI narasi
- Seksi narasi: Kepribadian, Karir, Kekayaan, Hubungan, Kekuatan & Kelemahan
- Narasi di-cache di `cached_narasi` table — `✓` di tombol jika sudah ter-generate
- Reset profil (hapus dari AsyncStorage, tidak hapus data server)

### 12.2 Persistensi chart_id

Chart ID dan timezone disimpan di **AsyncStorage** device (`@bazi_chart_id`, `@bazi_timezone`) via `ChartContext`. Tidak ada user authentication — satu device = satu profil. Context di-wrap di root `App.tsx`.

### 12.3 Endpoint Baru

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/calendar/date/{date}?timezone&chart_id` | BaZi pilar untuk tanggal tertentu |
| GET | `/api/profile/{chart_id}` | Chart + semua cached narasi |
| POST | `/api/wishes` | Simpan keinginan baru |
| GET | `/api/wishes?chart_id` | List keinginan |
| DELETE | `/api/wishes/{id}` | Hapus keinginan |
| POST | `/api/wishes/{id}/analyze` | AI analisis keinginan vs chart |
| POST | `/api/narasi/generate` | Generate + cache seksi profil (updated) |

### 12.4 Model Database Baru

```python
class Wish(Base):
    id, chart_id (FK), content, analysis (cached), created_at

class CachedNarasi(Base):
    id, chart_id (FK), section (key string), narasi_text, generated_at
```

Tabel dibuat otomatis via `Base.metadata.create_all` di startup.

### 12.5 File Frontend Baru / Berubah

```
bazi-app/
  App.tsx                    — bottom tab navigator (3 tab)
  src/context/
    ChartContext.tsx          — AsyncStorage chart_id persistence
  src/screens/
    CalendarScreen.tsx        — full redesign: monthly grid calendar
    WishScreen.tsx            — NEW: wish CRUD + AI analysis
    ProfileScreen.tsx         — NEW: setup form + full profile view
    OnboardingScreen.tsx      — DEPRECATED (tidak di-import)
    ChartScreen.tsx           — DEPRECATED (tidak di-import)
```

### 12.6 Packages Ditambahkan

```json
"@react-navigation/bottom-tabs": "^7.16.1",
"@react-native-async-storage/async-storage": "2.2.0"
```
