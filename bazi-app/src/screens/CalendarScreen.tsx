import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';
import { C, STEM_COLOR, STEM_ELEMENT, BRANCH_ANIMAL, BRANCH_ELEMENT } from '../theme';
import InfoModal from '../components/InfoModal';
import { useSimpleMode } from '../context/SimpleModeContext';
import { getInteractionDetail } from '../baziTerms';

function utcToLocalDateStr(utcStr: string, tz: string): string {
  try {
    const d = new Date(utcStr);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  } catch {
    return utcStr.split('T')[0];
  }
}

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

const INTERACTION_BASE: Record<string, { label: string; icon: string }> = {
  clash:           { label: 'Benturan',     icon: '⚡' },
  six_combination: { label: 'Kombinasi',    icon: '◎' },
  harm:            { label: 'Hambatan',     icon: '◌' },
  penalty:         { label: 'Hukuman',      icon: '△' },
  self_penalty:    { label: 'Hukuman Diri', icon: '△' },
};

const DISRUPTIVE_TYPES = new Set(['clash', 'harm', 'penalty', 'self_penalty']);
const DISRUPTIVE_CHALLENGING_COLOR: Record<string, string> = {
  clash: C.terra, penalty: C.terra, harm: C.amber, self_penalty: C.amber,
};

// Per-type 'favorable' copy — mirrors the nuance each type already has in the
// 'challenging' path (clash=perpisahan/perubahan mendadak, harm=kerugian
// tersembunyi dari orang dekat, self_penalty=kontradiksi internal) instead of
// one generic sentence for all, so Clash and Harm don't read identically.
// Penalty (刑) is handled separately below — it has 3 classically distinct
// subtypes (Ungrateful/Bullying/Uncivilized), not one generic meaning.
const DISRUPTIVE_FAVORABLE: Record<string, { plain: string; antidote: string }> = {
  clash: {
    plain: 'Benturan ini menyentuh bagian chart yang bukan elemen andalanmu — bisa dipakai untuk benar-benar memutus sesuatu yang usang tanpa mengganggu fondasi pentingmu.',
    antidote: 'Gunakan momentum ini untuk: Mengakhiri kebiasaan/komitmen yang sudah tidak relevan, membuat keputusan tegas yang selama ini ditunda. Energi benturan ini bekerja untukmu, bukan melawanmu.',
  },
  harm: {
    plain: 'Potensi dirugikan diam-diam hari ini menyasar bagian yang bukan elemen andalanmu — risiko dikecewakan orang dekat tetap ada, tapi dampaknya ke fondasi utamamu kemungkinan minim.',
    antidote: 'Gunakan momentum ini untuk: Mengevaluasi hubungan yang selama ini terasa tidak tulus, tanpa perlu takut kehilangan banyak. Energi ini membantumu melihat siapa yang benar-benar bisa dipercaya.',
  },
  self_penalty: {
    plain: 'Ada gejolak kontradiksi internal hari ini, tapi di bagian yang bukan elemen andalanmu — dampaknya ke performa utamamu kemungkinan minim.',
    antidote: 'Gunakan momentum ini untuk: Bereksperimen atau ambil risiko kecil — potensi sabotase diri hari ini tidak menyasar fondasi utamamu.',
  },
};

// 三刑 Penalty has 3 classically distinct subtypes — each means something
// different, so they can't share one generic "tekanan eksternal" text. Keyed
// by the backend's penalty_name field.
const PENALTY_SUBTYPE: Record<string, { plain: string; antidote: string; favorablePlain: string; favorableAntidote: string }> = {
  'Ungrateful Penalty': {
    plain: 'Ada risiko dikhianati atau tidak dihargai setelah membantu orang lain — bantuan yang kamu berikan mungkin tidak dibalas setara.',
    antidote: 'Gunakan hari ini untuk: Membantu dengan batasan jelas, jangan all-in tanpa ekspektasi balik. Hindari: Meminjamkan uang/jasa besar tanpa perjanjian jelas.',
    favorablePlain: 'Potensi dikhianati hari ini menyasar bagian yang bukan elemen andalanmu — kalaupun ada yang tidak menghargai bantuanmu, dampaknya ke fondasi utamamu kemungkinan kecil.',
    favorableAntidote: 'Gunakan momentum ini untuk: Berani membantu tanpa terlalu khawatir dikecewakan — risikonya rendah karena tidak menyentuh area vital chart-mu.',
  },
  'Bullying Penalty': {
    plain: 'Ada potensi konflik karena penyalahgunaan posisi/kekuasaan — entah kamu yang merasa ditekan otoritas, atau kamu sendiri yang bersikap terlalu otoriter ke orang lain.',
    antidote: 'Gunakan hari ini untuk: Mengecek ulang apakah kamu (atau pihak lain) terlalu memaksakan kehendak. Hindari: Konfrontasi dengan atasan/figur otoritas, dan jangan menekan orang yang posisinya lebih lemah.',
    favorablePlain: 'Potensi gesekan kekuasaan hari ini tidak menyasar elemen andalanmu — situasi yang terasa menekan kemungkinan tidak benar-benar mengganggu fondasi utamamu.',
    favorableAntidote: 'Gunakan momentum ini untuk: Bersikap lebih tegas/percaya diri tanpa takut konsekuensi besar — ruang amannya lebih lebar dari biasanya.',
  },
  'Uncivilized Penalty': {
    plain: 'Ada potensi gesekan karena batasan/etika yang dilanggar — bisa berupa konflik keluarga atau situasi yang terasa tidak menghormati posisimu.',
    antidote: 'Gunakan hari ini untuk: Menegaskan batasan dengan sopan, bukan diam saja. Hindari: Situasi yang menuntutmu mengabaikan prinsip demi menjaga keharmonisan semu.',
    favorablePlain: 'Potensi gesekan soal batasan hari ini menyasar bagian yang bukan elemen andalanmu — konflik kecil soal etika kemungkinan tidak berdampak besar ke fondasi utamamu.',
    favorableAntidote: 'Gunakan momentum ini untuk: Menetapkan batasan baru tanpa terlalu khawatir akan reaksi besar dari orang lain.',
  },
};
const PENALTY_FALLBACK = {
  plain: 'Ada tekanan dari konflik struktural hari ini.',
  antidote: 'Gunakan hari ini untuk: Bersikap hati-hati dalam komunikasi dan keputusan penting.',
  favorablePlain: 'Ada tekanan dari konflik struktural hari ini, tapi tidak menyasar elemen andalanmu — dampaknya kemungkinan minim.',
  favorableAntidote: 'Gunakan momentum ini untuk: Melangkah dengan lebih percaya diri — ruang amannya lebih lebar dari biasanya.',
};

// Favorability ('challenging' | 'favorable' | 'neutral' | undefined) compares the
// interaction against the user's Yong Shen (elemen andalan) — a Clash isn't
// automatically bad; it depends on whether it disturbs the element the chart needs.
function getInteractionDisplay(item: any): { label: string; icon: string; color: string; plain?: string; antidote?: string } {
  const base = INTERACTION_BASE[item.type] ?? { label: item.type, icon: '·' };
  const fav: string | undefined = item.favorability ?? undefined;
  const disruptive = DISRUPTIVE_TYPES.has(item.type);

  if (item.type === 'penalty') {
    const subtype = PENALTY_SUBTYPE[item.penalty_name] ?? PENALTY_FALLBACK;
    if (fav === 'favorable') {
      return { ...base, color: C.teal, plain: subtype.favorablePlain, antidote: subtype.favorableAntidote };
    }
    return { ...base, color: C.terra, plain: subtype.plain, antidote: subtype.antidote };
  }
  if (fav === 'favorable' && disruptive) {
    const variant = DISRUPTIVE_FAVORABLE[item.type];
    return { ...base, color: C.teal, plain: variant?.plain, antidote: variant?.antidote };
  }
  if (item.type === 'six_combination') {
    if (fav === 'favorable') {
      return { ...base, color: C.teal, plain: INTERACTION_PLAIN.six_combination };
    }
    if (fav === 'neutral') {
      return {
        ...base,
        color: C.amber,
        plain: 'Ada ikatan energi hari ini, namun tidak langsung memperkuat elemen andalan chart-mu — tetap kondusif untuk kolaborasi ringan, bukan langkah besar.',
      };
    }
    return { ...base, color: C.teal, plain: INTERACTION_PLAIN.six_combination };
  }
  if (disruptive) {
    // 'challenging', atau favorability belum bisa ditentukan (yong shen unresolved)
    return {
      ...base,
      color: DISRUPTIVE_CHALLENGING_COLOR[item.type] ?? C.terra,
      plain: INTERACTION_PLAIN[item.type],
      antidote: INTERACTION_ANTIDOTE[item.type],
    };
  }
  return { ...base, color: C.gold, plain: INTERACTION_PLAIN[item.type] };
}

const INTERACTION_PLAIN: Record<string, string> = {
  clash:           'Hindari konfrontasi langsung dan keputusan impulsif hari ini.',
  six_combination: 'Energi mendukung kerjasama — bagus untuk kolaborasi dan memulai hal baru.',
  harm:            'Ada potensi dirugikan diam-diam oleh orang yang seharusnya dekat atau membantumu — bukan konfrontasi terbuka, tapi gangguan tersembunyi.',
  penalty:         'Ada tekanan dari konflik struktural hari ini — bersabar dan tidak terburu-buru.',
  self_penalty:    'Energi internalmu cenderung kontradiktif hari ini — risiko sabotase diri lewat keraguan atau keputusan yang saling bertentangan.',
};

const INTERACTION_ANTIDOTE: Record<string, string> = {
  clash:       'Gunakan hari ini untuk: Mengakhiri kebiasaan buruk, membersihkan hal yang sudah usang, atau membuat perubahan yang sudah lama ditunda. Hindari: Menikah, tanda tangan kontrak, atau memulai usaha baru.',
  harm:        'Gunakan hari ini untuk: Memverifikasi niat orang yang menawarkan bantuan, jangan terlalu cepat percaya ke pihak ketiga. Hindari: Membagikan rencana penting ke orang yang belum benar-benar terbukti niatnya.',
  penalty:     'Gunakan hari ini untuk: Bersikap hati-hati dalam komunikasi dan keputusan penting.',
  self_penalty:'Gunakan hari ini untuk: Istirahat, refleksi, atau kegiatan kreatif solo. Hindari: Overpromise dan multitasking berat — risiko terbesar datang dari dirimu sendiri, bukan dari luar.',
};

type SolarTermInfo = { pinyin: string; season: string; desc: string };
const SOLAR_TERM_INFO: Record<string, SolarTermInfo> = {
  '小寒': { pinyin: 'Xiǎohán',    season: 'Musim Dingin', desc: 'Awal fase dingin yang dalam. Energi alam menyimpan ke dalam — saat yang baik untuk introspeksi dan perencanaan diam-diam.' },
  '大寒': { pinyin: 'Dàhán',      season: 'Musim Dingin', desc: 'Puncak musim dingin. Energi berada di titik terdalam — simpan tenaga, bersiap menyambut siklus baru yang akan segera datang.' },
  '立春': { pinyin: 'Lìchūn',     season: 'Musim Semi',   desc: 'Titik awal tahun BaZi. Energi mulai bergerak dan tumbuh — momen terbaik untuk memulai rencana dan langkah baru dalam hidup.' },
  '雨水': { pinyin: 'Yǔshuǐ',     season: 'Musim Semi',   desc: 'Hujan pertama menyuburkan bumi. Ide dan rencana yang disemai sekarang akan mendapat dukungan energi untuk tumbuh.' },
  '驚蟄': { pinyin: 'Jīngzhé',    season: 'Musim Semi',   desc: 'Alam bangkit dari tidur panjang. Energi menjadi aktif dan bergerak — saatnya keluar dari zona nyaman dan ambil inisiatif.' },
  '春分': { pinyin: 'Chūnfēn',    season: 'Musim Semi',   desc: 'Siang dan malam seimbang sempurna. Hari harmoni — cocok untuk menjembatani perbedaan, menyeimbangkan prioritas, dan mencari titik tengah.' },
  '清明': { pinyin: 'Qīngmíng',   season: 'Musim Semi',   desc: 'Langit cerah dan udara bersih. Energi jernih dan fokus — waktu yang baik untuk merenung, menghormati akar, dan membuat keputusan dengan kepala dingin.' },
  '穀雨': { pinyin: 'Gǔyǔ',       season: 'Musim Semi',   desc: 'Hujan menyuburkan ladang. Energi produktif tinggi — kerja keras sekarang akan menuai hasil yang nyata.' },
  '立夏': { pinyin: 'Lìxià',      season: 'Musim Panas',  desc: 'Awal musim panas — energi Yang mulai dominan. Aktivitas, ekspansi, dan pertumbuhan semua mendapat dorongan.' },
  '小滿': { pinyin: 'Xiǎomǎn',    season: 'Musim Panas',  desc: 'Hampir matang tapi belum sepenuhnya. Saatnya tekun dan konsisten — jangan berhenti di tengah jalan.' },
  '芒種': { pinyin: 'Mángzhòng',  season: 'Musim Panas',  desc: 'Masa panen dan tanam sekaligus. Energi paling produktif — selesaikan yang sudah dimulai, dan mulai yang baru dengan cepat.' },
  '夏至': { pinyin: 'Xiàzhì',     season: 'Musim Panas',  desc: 'Hari terpanjang — puncak energi Yang. Titik klimaks aktivitas tahunan. Manfaatkan momentum ini sebelum energi mulai menyimpan kembali.' },
  '小暑': { pinyin: 'Xiǎoshǔ',    season: 'Musim Panas',  desc: 'Panas mulai terasa. Energi tinggi tapi perlu dijaga — jangan bakar semua energi sekaligus, jaga stamina untuk jangka panjang.' },
  '大暑': { pinyin: 'Dàshǔ',      season: 'Musim Panas',  desc: 'Puncak panas sepanjang tahun. Energi maksimal — manfaatkan tapi tetap jaga keseimbangan agar tidak terbakar.' },
  '立秋': { pinyin: 'Lìqiū',      season: 'Musim Gugur',  desc: 'Awal musim gugur — alam mulai menyimpan. Waktunya evaluasi, konsolidasi, dan memangkas hal-hal yang tidak perlu.' },
  '處暑': { pinyin: 'Chǔshǔ',     season: 'Musim Gugur',  desc: 'Panas mereda, transisi terjadi. Selesaikan pekerjaan yang belum tuntas sebelum energi benar-benar berpindah musim.' },
  '白露': { pinyin: 'Báilù',      season: 'Musim Gugur',  desc: 'Embun pagi pertama — udara menjadi jernih. Energi bersih dan fokus, tepat untuk pekerjaan yang membutuhkan ketelitian dan ketenangan.' },
  '秋分': { pinyin: 'Qiūfēn',     season: 'Musim Gugur',  desc: 'Keseimbangan siang-malam untuk kedua kalinya. Momen untuk menyeimbangkan kembali semua aspek kehidupan — karier, hubungan, kesehatan.' },
  '寒露': { pinyin: 'Hánlù',      season: 'Musim Gugur',  desc: 'Udara mulai dingin, energi menyimpan ke dalam. Saatnya fokus, kurangi kegiatan luar, dan perkuat pondasi dari dalam.' },
  '霜降': { pinyin: 'Shuāngjiàng',season: 'Musim Gugur',  desc: 'Embun beku pertama. Selesaikan semua proyek penting sebelum musim dingin tiba — waktu terus berjalan.' },
  '立冬': { pinyin: 'Lìdōng',     season: 'Musim Dingin', desc: 'Awal musim dingin — energi sepenuhnya menyimpan. Cocok untuk perencanaan jangka panjang, belajar, dan memperkuat strategi.' },
  '小雪': { pinyin: 'Xiǎoxuě',    season: 'Musim Dingin', desc: 'Salju ringan pertama. Keheningan dan ketenangan mendominasi — gunakan untuk refleksi mendalam dan mempersiapkan diri.' },
  '大雪': { pinyin: 'Dàxuě',      season: 'Musim Dingin', desc: 'Salju lebat. Energi paling tersimpan dalam setahun — istirahat, isi ulang daya batin, dan siapkan diri untuk siklus baru.' },
  '冬至': { pinyin: 'Dōngzhì',    season: 'Musim Dingin', desc: 'Malam terpanjang — puncak energi Yin. Titik balik penting: setelah ini energi Yang mulai tumbuh kembali. Momentum tersembunyi yang kuat.' },
};

type EnergyStatus = { level: 'neutral' | 'good' | 'caution' | 'challenging'; label: string; color: string; summary: string };

function getEnergyStatus(interactions: any[]): EnergyStatus {
  const favs = interactions.map((i: any) => i.favorability).filter((f: any) => !!f);

  // Yong Shen resolved for this chart — judge the day by its actual impact, not interaction type alone.
  if (favs.length > 0) {
    if (favs.includes('challenging')) return {
      level: 'challenging', color: C.terra, label: 'Hari Penuh Tekanan',
      summary: 'Ada interaksi hari ini yang menyentuh elemen andalan chart-mu. Hindari keputusan besar, jaga emosi tetap stabil.',
    };
    if (favs.includes('favorable')) return {
      level: 'good', color: C.teal, label: 'Energi Mendukung',
      summary: 'Interaksi hari ini selaras dengan elemen andalan chart-mu. Manfaatkan untuk kerjasama dan langkah maju.',
    };
    return {
      level: 'neutral', color: C.textMuted, label: 'Energi Netral',
      summary: 'Ada interaksi hari ini, tapi dampaknya ke elemen andalan chart-mu tidak signifikan.',
    };
  }

  // Fallback — Yong Shen belum terselesaikan untuk chart ini, pakai heuristik berbasis tipe interaksi.
  const types = interactions.map((i: any) => i.type as string);
  const hasClashOrPenalty = types.some(t => t === 'clash' || t === 'penalty' || t === 'self_penalty');
  const hasHarm           = types.some(t => t === 'harm');
  const hasCombination    = types.some(t => t === 'six_combination');

  if (hasClashOrPenalty) return {
    level: 'challenging', color: C.terra, label: 'Hari Penuh Tekanan',
    summary: 'Ada gesekan energi hari ini. Hindari keputusan besar, jaga emosi tetap stabil.',
  };
  if (hasHarm) return {
    level: 'caution', color: C.amber, label: 'Perlu Waspada',
    summary: 'Ada hambatan tersembunyi hari ini. Waspada terhadap dinamika di sekitarmu.',
  };
  if (hasCombination) return {
    level: 'good', color: C.teal, label: 'Energi Mengalir',
    summary: 'Energi harmonis dan mendukung hari ini. Manfaatkan untuk kerjasama dan langkah maju.',
  };
  return {
    level: 'neutral', color: C.textMuted, label: 'Energi Stabil',
    summary: 'Tidak ada interaksi khusus hari ini. Energi berjalan stabil — cocok untuk rutinitas.',
  };
}

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_W - 32) / 7);
const CELL_H = 56;

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  return `${days[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const isNarasiError = (text: string): boolean => {
  if (!text || text.length < 60) return true;
  return (
    text.startsWith('Gagal') ||
    text.includes('HTTP 4') ||
    text.includes('rate limit') ||
    text.includes('API key') ||
    text.includes('Semua model') ||
    text.includes('Periksa API')
  );
};

interface AnnualData {
  year_pillar: { stem: string; branch: string };
  interactions: any[];
  narasi: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export default function CalendarScreen() {
  const { chartId, timezone, loading: ctxLoading, profiles, activeProfileIdx } = useChart();
  const { simpleMode } = useSimpleMode();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dayData,    setDayData]    = useState<any>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError,   setDayError]   = useState('');

  const [calNarasi,        setCalNarasi]        = useState('');
  const [calNarasiLoading, setCalNarasiLoading] = useState(false);
  const narasi_dateRef = useRef<string>('');

  const [solarTermsMap, setSolarTermsMap] = useState<Record<string, string>>({});
  const fetchedYearsRef = useRef<Set<number>>(new Set());

  const [solarTermModal, setSolarTermModal] = useState<(SolarTermInfo & { name: string }) | null>(null);
  const [interactionDetail, setInteractionDetail] = useState<{ title: string; body: string } | null>(null);

  // Active luck pillar for greeting card
  const [activeLp, setActiveLp] = useState<any>(null);

  // Annual section
  const [annualExpanded, setAnnualExpanded] = useState(false);
  const [annualCache, setAnnualCache] = useState<Record<number, AnnualData>>({});
  const [annualLoading, setAnnualLoading] = useState(false);

  const fetchSolarTerms = useCallback(async (year: number) => {
    if (fetchedYearsRef.current.has(year)) return;
    fetchedYearsRef.current.add(year);
    try {
      const res = await axios.get(`${API_URL}/solar-terms/year/${year}`);
      const tz = timezone || 'Asia/Jakarta';
      const map: Record<string, string> = {};
      for (const item of res.data) {
        map[utcToLocalDateStr(item.datetime_utc, tz)] = item.name;
      }
      setSolarTermsMap(prev => ({ ...prev, ...map }));
    } catch {
      // solar terms are decorative; fail silently
    }
  }, [timezone]);

  useEffect(() => {
    if (!chartId) { setActiveLp(null); return; }
    axios.get(`${API_URL}/charts/${chartId}`)
      .then(res => setActiveLp(res.data.active_luck_pillar ?? null))
      .catch(() => {});
  }, [chartId]);

  const loadCalNarasi = useCallback(async (dateStr: string) => {
    if (!chartId) return;
    narasi_dateRef.current = dateStr;
    setCalNarasiLoading(true);
    setCalNarasi('');
    try {
      const res = await axios.post(`${API_URL}/calendar/narasi`, {
        chart_id: chartId,
        date_str: dateStr,
        timezone,
      });
      if (narasi_dateRef.current === dateStr) {
        setCalNarasi(res.data.narasi);
      }
    } catch (err: any) {
      if (narasi_dateRef.current === dateStr) {
        const detail = err?.response?.data?.detail;
        setCalNarasi(detail ?? 'Tidak dapat memuat penjelasan. Periksa koneksi internet.');
      }
    } finally {
      if (narasi_dateRef.current === dateStr) {
        setCalNarasiLoading(false);
      }
    }
  }, [chartId, timezone]);

  const loadDayData = useCallback(async (dateStr: string) => {
    setDayLoading(true);
    setDayError('');
    setDayData(null);
    setCalNarasi('');
    setCalNarasiLoading(false);
    try {
      const tz  = encodeURIComponent(timezone);
      const cid = chartId ? `&chart_id=${chartId}` : '';
      const isToday = dateStr === todayStr;
      const url = isToday
        ? `${API_URL}/calendar/current?timezone=${tz}${cid}`
        : `${API_URL}/calendar/date/${dateStr}?timezone=${tz}${cid}`;
      const res = await axios.get(url);
      setDayData(res.data);
      // Auto-load narasi only for today and future dates
      if (chartId && dateStr >= todayStr) {
        loadCalNarasi(dateStr);
      }
    } catch {
      setDayError('Data tidak dapat dimuat. Periksa koneksi internet.');
    } finally {
      setDayLoading(false);
    }
  }, [chartId, timezone, todayStr, loadCalNarasi]);

  const loadAnnual = useCallback(async (year: number) => {
    if (!chartId || annualCache[year]) return;
    setAnnualLoading(true);
    try {
      const tz = encodeURIComponent(timezone || 'Asia/Jakarta');
      const res = await axios.get(`${API_URL}/calendar/annual?year=${year}&chart_id=${chartId}&timezone=${tz}`);
      setAnnualCache(prev => ({ ...prev, [year]: res.data }));
    } catch {
      // fail silently
    } finally {
      setAnnualLoading(false);
    }
  }, [chartId, timezone, annualCache]);

  useEffect(() => {
    if (!ctxLoading) loadDayData(todayStr);
  }, [ctxLoading, loadDayData]);

  useEffect(() => {
    fetchSolarTerms(viewYear);
    if (viewMonth === 0)  fetchSolarTerms(viewYear - 1);
    if (viewMonth === 11) fetchSolarTerms(viewYear + 1);
  }, [viewYear, viewMonth, fetchSolarTerms]);

  useEffect(() => {
    if (annualExpanded && chartId) loadAnnual(viewYear);
  }, [annualExpanded, viewYear, chartId]);

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    loadDayData(dateStr);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(todayStr);
    loadDayData(todayStr);
  };

  const openSolarTermModal = (name: string) => {
    const info = SOLAR_TERM_INFO[name];
    if (info) setSolarTermModal({ name, ...info });
  };

  const cells = buildCalendarDays(viewYear, viewMonth);
  const interactions: any[] = dayData?.interactions ?? [];
  const energy = chartId && dayData ? getEnergyStatus(interactions) : null;
  const isPastDate = selectedDate < todayStr;
  const annualData = annualCache[viewYear];
  const isSelectedToday = selectedDate === todayStr;
  const hourPillar = isSelectedToday ? dayData?.current_pillars?.hour : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Greeting Card ── */}
      {chartId && (
        <View style={styles.greetingCard}>
          <View style={styles.greetingTop}>
            <Text style={styles.greetingHello}>{getGreeting()},</Text>
            <Text style={styles.greetingName} numberOfLines={1}>
              {profiles[activeProfileIdx]?.nickname ?? 'Sobat BaZi'}
            </Text>
          </View>
          {activeLp && (
            <View style={styles.greetingLpRow}>
              <Text style={styles.greetingLpLabel}>Siklus Dekade Aktif</Text>
              <Text style={styles.greetingLpChars}>
                <Text style={{ color: STEM_COLOR[activeLp.stem] ?? C.gold }}>{activeLp.stem}</Text>
                <Text style={{ color: C.text }}>{activeLp.branch}</Text>
                <Text style={{ color: C.textFaint }}>  ·  mulai usia {Math.round(activeLp.age_start)} tahun</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Annual section (collapsed by default) ── */}
      {chartId && (
        <TouchableOpacity
          style={styles.annualHeader}
          onPress={() => setAnnualExpanded(prev => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.annualTitle}>◈ TEMA {viewYear}</Text>
          <Text style={styles.annualChevron}>{annualExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      )}
      {annualExpanded && (
        <View style={styles.annualBody}>
          {annualLoading ? (
            <View style={styles.annualLoadingRow}>
              <ActivityIndicator size="small" color={C.gold} />
              <Text style={styles.annualLoadingText}>Menganalisis tema {viewYear}…</Text>
            </View>
          ) : annualData ? (
            <>
              <View style={styles.annualPillarRow}>
                <Text style={styles.annualPillarLabel}>Pilar Tahun {viewYear}</Text>
                <Text style={[styles.annualPillarStem, { color: STEM_COLOR[annualData.year_pillar.stem] ?? C.gold }]}>
                  {annualData.year_pillar.stem}
                </Text>
                <Text style={styles.annualPillarBranch}>{annualData.year_pillar.branch}</Text>
              </View>
              {annualData.narasi ? (
                <Text style={styles.annualNarasi}>{annualData.narasi}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {/* ── Month navigator ── */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS_ID[viewMonth]} {viewYear}</Text>
        <View style={styles.monthNavRight}>
          {(viewYear !== today.getFullYear() || viewMonth !== today.getMonth()) && (
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.8}>
              <Text style={styles.todayBtnText}>Hari Ini</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Week-day header ── */}
      <View style={styles.weekRow}>
        {DAYS_ID.map((d, i) => (
          <Text key={d} style={[styles.weekLabel, i === 0 && { color: C.terra }]}>{d}</Text>
        ))}
      </View>

      {/* ── Calendar grid ── */}
      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={{ width: CELL_W, height: CELL_H }} />;
          const dateStr   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday   = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isSunday  = idx % 7 === 0;
          const solarTerm = solarTermsMap[dateStr];
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dayCell,
                isToday    && styles.dayCellToday,
                isSelected && !isToday && styles.dayCellSelected,
              ]}
              onPress={() => handleDayPress(day)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayNum,
                isSunday   && { color: C.terra },
                isToday    && { color: C.bg, fontWeight: '900' },
                isSelected && !isToday && { color: C.goldSoft },
              ]}>
                {day}
              </Text>
              {solarTerm ? (
                <Text style={[styles.solarTermLabel, isToday && { color: C.bg }]}>
                  {solarTerm}
                </Text>
              ) : (
                <View style={styles.solarTermPlaceholder} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Selected date detail ── */}
      <View style={styles.detailSection}>
        <View style={styles.selectedDateRow}>
          <Text style={styles.selectedDateLabel}>{formatDateLong(selectedDate)}</Text>
          {solarTermsMap[selectedDate] && (
            <TouchableOpacity
              style={styles.solarTermBadge}
              onPress={() => openSolarTermModal(solarTermsMap[selectedDate])}
              activeOpacity={0.75}
            >
              <Text style={styles.solarTermBadgeText}>{solarTermsMap[selectedDate]} ⓘ</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Energy indicator ── */}
        {energy && (
          <View style={[styles.energyCard, { borderLeftColor: energy.color }]}>
            <View style={styles.energyHeader}>
              <View style={[styles.energyDot, { backgroundColor: energy.color }]} />
              <Text style={[styles.energyLabel, { color: energy.color }]}>{energy.label}</Text>
            </View>
            <Text style={styles.energySummary}>{energy.summary}</Text>
          </View>
        )}

        {dayLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={styles.loadingText}>Memuat energi BaZi…</Text>
          </View>
        ) : dayError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{dayError}</Text>
          </View>
        ) : dayData ? (
          <>
            {/* Pillars */}
            <View style={styles.pillarsRow}>
              {(['year', 'month', 'day'] as const).map((p) => {
                const pillar   = dayData.current_pillars?.[p];
                const stem     = pillar?.stem ?? '-';
                const branch   = pillar?.branch ?? '-';
                const stemCol  = STEM_COLOR[stem]  ?? C.gold;
                const stemEl   = STEM_ELEMENT[stem]  ?? stem;
                const branchEl = BRANCH_ELEMENT[branch] ?? '';
                const animal   = BRANCH_ANIMAL[branch]  ?? '';
                const posLabel = p === 'year' ? '年 TAHUN' : p === 'month' ? '月 BULAN' : '日 HARI';
                return (
                  <View key={p} style={styles.pillarCard}>
                    <View style={[styles.pillarAccent, { backgroundColor: stemCol }]} />
                    <Text style={styles.pillarPos}>{posLabel}</Text>
                    {simpleMode ? (
                      <Text style={[styles.pillarStemSimple, { color: stemCol }]}>{stemEl}</Text>
                    ) : (
                      <>
                        <Text style={[styles.pillarStem, { color: stemCol }]}>{stem}</Text>
                        <Text style={styles.pillarStemEl}>{stemEl}</Text>
                      </>
                    )}
                    <View style={styles.pillarDivider} />
                    {simpleMode ? (
                      <Text style={styles.pillarBranchSimple}>{animal}</Text>
                    ) : (
                      <>
                        <Text style={styles.pillarBranch}>{branch}</Text>
                        <Text style={styles.pillarAnimal}>{animal}</Text>
                        <Text style={styles.pillarBranchEl}>{branchEl}</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Hour Pillar — only for today */}
            {isSelectedToday && hourPillar && (
              <View style={styles.hourPillarSection}>
                <View style={styles.hourPillarHeader}>
                  <Text style={styles.hourPillarTitle}>時 PILAR JAM SAAT INI</Text>
                  <TouchableOpacity
                    style={styles.hourRefreshBtn}
                    onPress={() => loadDayData(todayStr)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.hourRefreshBtnText}>↻ Refresh</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.hourPillarCard}>
                  <View style={[styles.pillarAccent, { backgroundColor: STEM_COLOR[hourPillar.stem] ?? C.gold }]} />
                  <Text style={styles.pillarPos}>時 JAM</Text>
                  {simpleMode ? (
                    <Text style={[styles.pillarStemSimple, { color: STEM_COLOR[hourPillar.stem] ?? C.gold }]}>
                      {STEM_ELEMENT[hourPillar.stem] ?? hourPillar.stem}
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.pillarStem, { color: STEM_COLOR[hourPillar.stem] ?? C.gold }]}>{hourPillar.stem}</Text>
                      <Text style={styles.pillarStemEl}>{STEM_ELEMENT[hourPillar.stem] ?? ''}</Text>
                    </>
                  )}
                  <View style={styles.pillarDivider} />
                  {simpleMode ? (
                    <Text style={styles.pillarBranchSimple}>{BRANCH_ANIMAL[hourPillar.branch] ?? hourPillar.branch}</Text>
                  ) : (
                    <>
                      <Text style={styles.pillarBranch}>{hourPillar.branch}</Text>
                      <Text style={styles.pillarAnimal}>{BRANCH_ANIMAL[hourPillar.branch] ?? ''}</Text>
                      <Text style={styles.pillarBranchEl}>{BRANCH_ELEMENT[hourPillar.branch] ?? ''}</Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Interactions */}
            {chartId && (
              <View style={styles.interactSection}>
                <Text style={styles.interactTitle}>Hubungan dengan Chartmu</Text>
                {interactions.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      Tidak ada interaksi signifikan.{'\n'}Energi berjalan netral.
                    </Text>
                  </View>
                ) : (
                  interactions.map((item: any, idx: number) => {
                    const disp = getInteractionDisplay(item);
                    return (
                      <View key={idx} style={[styles.interactCard, { borderLeftColor: disp.color }]}>
                        <View style={styles.interactHeader}>
                          <Text style={[styles.interactBadge, { color: disp.color, borderColor: disp.color }]}>
                            {disp.icon} {disp.label.toUpperCase()}
                          </Text>
                          <Text style={styles.interactBranches}>
                            {item.user_branch} ↔ {item.calendar_branch}
                          </Text>
                        </View>
                        <Text style={styles.interactDesc}>{item.description}</Text>
                        {disp.plain && <Text style={styles.interactPlain}>{disp.plain}</Text>}
                        {disp.antidote && (
                          <View style={styles.antidoteBox}>
                            <Text style={styles.antidoteLabel}>✦ Cara menggunakan energi ini:</Text>
                            <Text style={styles.antidoteText}>{disp.antidote}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => setInteractionDetail(getInteractionDetail(item.type, item.penalty_name))}
                          style={styles.interactDetailBtn}
                        >
                          <Text style={styles.interactDetailBtnText}>ⓘ Detail makna klasik</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                {/* AI narasi for interactions */}
                {calNarasiLoading ? (
                  <View style={styles.narasiLoadingRow}>
                    <ActivityIndicator size="small" color={C.gold} />
                    <Text style={styles.narasiLoadingText}>AI membaca interaksi chart…</Text>
                  </View>
                ) : calNarasi ? (
                  <View style={[styles.narasiBox, isNarasiError(calNarasi) && styles.narasiBoxError]}>
                    <View style={styles.narasiBoxHeader}>
                      <Text style={styles.narasiBoxLabel}>✦ Penjelasan AI</Text>
                      {isNarasiError(calNarasi) && (
                        <TouchableOpacity
                          style={styles.retryBtn}
                          onPress={() => loadCalNarasi(selectedDate)}
                        >
                          <Text style={styles.retryBtnText}>↻ Coba Lagi</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={[styles.narasiText, isNarasiError(calNarasi) && styles.narasiErrorText]}>
                      {calNarasi}
                    </Text>
                  </View>
                ) : isPastDate && !calNarasiLoading ? (
                  <TouchableOpacity
                    style={styles.retroBtn}
                    onPress={() => loadCalNarasi(selectedDate)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retroBtnText}>↻ Baca Energi Hari Itu</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {!chartId && (
              <View style={styles.noChartCard}>
                <Text style={styles.noChartText}>
                  Buat profil BaZi di tab Peta Hidup untuk melihat interaksi energi harianmu.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </View>

      {/* ── Solar term info modal ── */}
      {solarTermModal && (
        <InfoModal
          visible={!!solarTermModal}
          title={`${solarTermModal.name} — ${solarTermModal.pinyin}`}
          subtitle={solarTermModal.season}
          body={solarTermModal.desc}
          onClose={() => setSolarTermModal(null)}
        />
      )}

      {/* ── Interaction detail modal (makna klasik) ── */}
      {interactionDetail && (
        <InfoModal
          visible={!!interactionDetail}
          title={interactionDetail.title}
          body={interactionDetail.body}
          onClose={() => setInteractionDetail(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  container: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

  // Greeting card
  greetingCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.gold + '44',
  },
  greetingTop:  { marginBottom: 10 },
  greetingHello:{ fontSize: 13, color: C.textMuted, fontWeight: '600' },
  greetingName: { fontSize: 22, fontWeight: '900', color: C.gold, marginTop: 2 },
  greetingLpRow:{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  greetingLpLabel: { fontSize: 10, fontWeight: '800', color: C.textFaint, letterSpacing: 1, marginBottom: 4 },
  greetingLpChars: { fontSize: 18, fontWeight: '700' },

  // Simple mode pillar styles (text instead of Hanzi)
  pillarStemSimple:   { fontSize: 13, fontWeight: '800', lineHeight: 18, textAlign: 'center', paddingHorizontal: 2 },
  pillarBranchSimple: { fontSize: 14, fontWeight: '800', color: C.text, marginTop: 2, textAlign: 'center' },

  // Annual section
  annualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  annualTitle:   { fontSize: 12, fontWeight: '900', color: C.gold, letterSpacing: 1.2 },
  annualChevron: { fontSize: 12, color: C.gold },
  annualBody: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.gold + '44',
  },
  annualLoadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annualLoadingText: { color: C.textMuted, fontSize: 13 },
  annualPillarRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  annualPillarLabel: { fontSize: 11, color: C.textFaint, fontWeight: '700' },
  annualPillarStem:  { fontSize: 24, fontWeight: '900' },
  annualPillarBranch:{ fontSize: 24, fontWeight: '900', color: C.text },
  annualNarasi:      { fontSize: 13, color: C.text, lineHeight: 22 },

  // Month navigator
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  navBtn:   { padding: 4 },
  navArrow: { fontSize: 30, color: C.gold, lineHeight: 34 },
  monthLabel: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  monthNavRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: {
    borderWidth: 1, borderColor: C.gold, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: C.gold },

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { width: CELL_W, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.textMuted, paddingVertical: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  dayCell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 4,
  },
  dayCellToday:    { backgroundColor: C.gold },
  dayCellSelected: { backgroundColor: C.surfaceHigh },
  dayNum: { fontSize: 14, color: C.text, fontWeight: '500' },
  solarTermLabel: {
    fontSize: 10,
    color: C.gold,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 1,
  },
  solarTermPlaceholder: { height: 14 },

  detailSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 20,
  },
  selectedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  selectedDateLabel: {
    fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: 0.2,
  },
  solarTermBadge: {
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.gold,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  solarTermBadgeText: { fontSize: 12, fontWeight: '800', color: C.gold, letterSpacing: 0.3 },

  // Energy indicator
  energyCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 16,
  },
  energyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  energyDot: { width: 8, height: 8, borderRadius: 4 },
  energyLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  energySummary: { fontSize: 13, color: C.text, lineHeight: 20 },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingText: { color: C.textMuted, fontSize: 14 },
  errorCard:   { backgroundColor: C.surface, borderRadius: 12, padding: 16 },
  errorText:   { color: C.red, fontSize: 14, textAlign: 'center' },

  // Pillars
  pillarsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pillarCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', paddingBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  pillarAccent:   { width: '100%', height: 3, marginBottom: 10 },
  pillarPos:      { fontSize: 9, color: C.textFaint, marginBottom: 6, fontWeight: '700', letterSpacing: 0.5 },
  pillarStem:     { fontSize: 34, fontWeight: '900', lineHeight: 40 },
  pillarStemEl:   { fontSize: 10, color: C.textMuted, marginBottom: 4 },
  pillarDivider:  { width: 24, height: 1, backgroundColor: C.border, marginVertical: 6 },
  pillarBranch:   { fontSize: 34, fontWeight: '900', color: C.text, lineHeight: 40 },
  pillarAnimal:   { fontSize: 10, color: C.textMuted, marginTop: 4 },
  pillarBranchEl: { fontSize: 10, color: C.textFaint },

  // Interactions
  interactSection: { marginTop: 4 },
  interactTitle: {
    fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1,
    marginBottom: 10, textTransform: 'uppercase',
  },
  interactCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  interactHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  interactBadge: {
    fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, letterSpacing: 0.5,
  },
  interactBranches: { fontSize: 13, color: C.textMuted, fontWeight: '600' },
  interactDesc:     { fontSize: 13, color: C.text, lineHeight: 20 },
  interactPlain: {
    fontSize: 12, color: C.textMuted, lineHeight: 18, fontStyle: 'italic',
    marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.border,
  },
  antidoteBox: {
    marginTop: 10,
    backgroundColor: C.teal + '1A',
    borderRadius: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: C.teal + '55',
  },
  antidoteLabel: { fontSize: 11, fontWeight: '900', color: C.teal, letterSpacing: 0.6, marginBottom: 6 },
  antidoteText:  { fontSize: 13, color: C.text, lineHeight: 21 },
  interactDetailBtn: { marginTop: 8, alignSelf: 'flex-start' },
  interactDetailBtnText: { fontSize: 11, color: C.textFaint, fontWeight: '700' },

  emptyCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  emptyText: { color: C.textMuted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

  // AI narasi
  narasiLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingLeft: 2,
  },
  narasiLoadingText: { color: C.textMuted, fontSize: 13 },

  narasiBox: {
    marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3, borderLeftColor: C.gold, borderRadius: 12, padding: 14,
  },
  narasiBoxError:  { borderLeftColor: '#c0392b', borderColor: '#c0392b44' },
  narasiBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  narasiBoxLabel:  { fontSize: 11, fontWeight: '900', color: C.gold, letterSpacing: 0.8 },
  narasiText:      { fontSize: 13, lineHeight: 22, color: C.text },
  narasiErrorText: { color: '#e07070' },

  // Retro button
  retroBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.gold + '88',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: C.surfaceHigh,
  },
  retroBtnText: { fontSize: 13, fontWeight: '700', color: C.goldSoft },

  retryBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
    borderColor: '#c0392b88', backgroundColor: '#c0392b22',
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: '#e07070' },

  noChartCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: C.border,
  },
  noChartText: { color: C.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 22 },

  // Hour pillar section
  hourPillarSection: { marginBottom: 20 },
  hourPillarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  hourPillarTitle: { fontSize: 11, fontWeight: '800', color: C.textFaint, letterSpacing: 1.2 },
  hourRefreshBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: C.gold + '88', backgroundColor: C.surfaceHigh,
  },
  hourRefreshBtnText: { fontSize: 11, fontWeight: '700', color: C.goldSoft },
  hourPillarCard: {
    width: '40%',
    backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', paddingBottom: 12, borderWidth: 1.5, borderColor: C.gold + '55',
  },
});
