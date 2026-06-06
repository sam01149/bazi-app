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

const INTERACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  clash:           { label: 'Benturan',     color: C.red,   icon: '⚡' },
  six_combination: { label: 'Kombinasi',    color: C.teal,  icon: '◎' },
  harm:            { label: 'Hambatan',     color: C.amber, icon: '◌' },
  penalty:         { label: 'Hukuman',      color: C.red,   icon: '△' },
  self_penalty:    { label: 'Hukuman Diri', color: C.amber, icon: '△' },
};

const INTERACTION_PLAIN: Record<string, string> = {
  clash:           'Hindari konfrontasi langsung dan keputusan impulsif hari ini.',
  six_combination: 'Energi mendukung kerjasama — bagus untuk kolaborasi dan memulai hal baru.',
  harm:            'Waspadai dinamika tersembunyi di sekitarmu — jaga komunikasi tetap jelas.',
  penalty:         'Ada tekanan dari situasi di luar kendali — bersabar dan tidak terburu-buru.',
  self_penalty:    'Energi internalmu sedang tidak stabil — jaga keseimbangan dan istirahat cukup.',
};

const INTERACTION_ANTIDOTE: Record<string, string> = {
  clash:       'Gunakan hari ini untuk: Mengakhiri kebiasaan buruk, membersihkan hal yang sudah usang, atau membuat perubahan yang sudah lama ditunda. Hindari: Menikah, tanda tangan kontrak, atau memulai usaha baru.',
  harm:        'Gunakan hari ini untuk: Komunikasi satu-satu yang tenang dan langsung. Hindari: Bergosip, mengambil keputusan berdasarkan informasi pihak ketiga.',
  penalty:     'Gunakan hari ini untuk: Menyelesaikan tugas internal dan administratif. Hindari: Konfrontasi publik dan presentasi penting.',
  self_penalty:'Gunakan hari ini untuk: Istirahat, refleksi, meditasi, atau kegiatan kreatif solo. Hindari: Overpromise dan multitasking berat.',
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
  const types = interactions.map((i: any) => i.type as string);
  const hasClashOrPenalty = types.some(t => t === 'clash' || t === 'penalty' || t === 'self_penalty');
  const hasHarm           = types.some(t => t === 'harm');
  const hasCombination    = types.some(t => t === 'six_combination');

  if (hasClashOrPenalty) return {
    level: 'challenging', color: C.red, label: 'Hari Penuh Tekanan',
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

export default function CalendarScreen() {
  const { chartId, timezone, loading: ctxLoading } = useChart();
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
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
          <Text key={d} style={[styles.weekLabel, i === 0 && { color: C.red }]}>{d}</Text>
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
                isSunday   && { color: C.red },
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
                    <Text style={[styles.pillarStem, { color: stemCol }]}>{stem}</Text>
                    <Text style={styles.pillarStemEl}>{stemEl}</Text>
                    <View style={styles.pillarDivider} />
                    <Text style={styles.pillarBranch}>{branch}</Text>
                    <Text style={styles.pillarAnimal}>{animal}</Text>
                    <Text style={styles.pillarBranchEl}>{branchEl}</Text>
                  </View>
                );
              })}
            </View>

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
                    const meta = INTERACTION_META[item.type] ?? { label: item.type, color: C.gold, icon: '·' };
                    const plain = INTERACTION_PLAIN[item.type];
                    const antidote = INTERACTION_ANTIDOTE[item.type];
                    return (
                      <View key={idx} style={[styles.interactCard, { borderLeftColor: meta.color }]}>
                        <View style={styles.interactHeader}>
                          <Text style={[styles.interactBadge, { color: meta.color, borderColor: meta.color }]}>
                            {meta.icon} {meta.label.toUpperCase()}
                          </Text>
                          <Text style={styles.interactBranches}>
                            {item.user_branch} ↔ {item.calendar_branch}
                          </Text>
                        </View>
                        <Text style={styles.interactDesc}>{item.description}</Text>
                        {plain && <Text style={styles.interactPlain}>{plain}</Text>}
                        {antidote && (
                          <View style={styles.antidoteBox}>
                            <Text style={styles.antidoteLabel}>✦ Cara menggunakan energi ini:</Text>
                            <Text style={styles.antidoteText}>{antidote}</Text>
                          </View>
                        )}
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
                  Buat profil BaZi di tab Profil untuk melihat interaksi energi harianmu.
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  container: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

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
    marginTop: 8,
    backgroundColor: C.teal + '15',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.teal,
  },
  antidoteLabel: { fontSize: 10, fontWeight: '900', color: C.teal, letterSpacing: 0.5, marginBottom: 4 },
  antidoteText:  { fontSize: 12, color: C.text, lineHeight: 19 },

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
});
