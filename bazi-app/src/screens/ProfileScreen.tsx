import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, Image, Modal, Share, FlatList, Dimensions,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';
import { useSimpleMode } from '../context/SimpleModeContext';
import { C, STEM_COLOR, STEM_ELEMENT, BRANCH_ANIMAL } from '../theme';
import InfoModal from '../components/InfoModal';

const ONBOARDING_KEY  = '@bazi_onboarding_seen';
const NOTIF_KEY       = '@bazi_notifications_enabled';
const NOTIF_CHANNEL   = 'bazi-daily';
const NOTIF_HOUR      = 8;
const SCREEN_W = Dimensions.get('window').width;

const ONBOARDING_SLIDES = [
  {
    icon: '⊞',
    title: 'BaZi — Peta Energi Kelahiranmu',
    body: 'BaZi ("Delapan Karakter") adalah sistem metafisika Tionghoa yang membaca pola energi dari tanggal dan jam kelahiranmu.\n\nEmpat Pilar — Tahun, Bulan, Hari, Jam — masing-masing membawa informasi tentang kepribadian, karier, hubungan, dan siklus hidup.',
  },
  {
    icon: '◉',
    title: 'Apa yang Akan Kamu Dapat',
    body: 'Profil BaZi — Day Master, Ge Ju, Yong Shen, Luck Pillars, Special Stars, dan Life Stages untuk memahami siapa kamu secara struktural.\n\nKalender Energi — setiap hari dilihat lewat lensa chart natal-mu.\n\nKeinginan — analisis AI untuk melihat seberapa selaras keinginanmu dengan struktur chart.',
  },
  {
    icon: '◌',
    title: 'Interpretasi adalah Kecenderungan, Bukan Ramalan',
    body: 'BaZi membaca pola dan kecenderungan — bukan memprediksikan masa depan secara deterministik.\n\nSetiap interpretasi menggunakan framing probabilistik: "cenderung", "pola", bukan "akan" atau "pasti".\n\nKamu tetap pegang kendali atas keputusan dan tindakanmu.',
  },
];

type TermKey = 'day_master' | 'empat_pilar' | 'ge_ju' | 'yong_shen' | 'stem_combo' | 'luck_pillars' | 'kong_wang' | 'special_stars' | 'life_stages';

const TERM_EXPLANATIONS: Record<TermKey, { title: string; subtitle: string; body: string }> = {
  day_master: {
    title: 'Day Master (日主)',
    subtitle: 'Inti dari chart BaZi-mu',
    body: 'Day Master adalah elemen hari kelahiranmu — inti kepribadian, energi dasar, dan cara kamu berinteraksi dengan dunia. Semua elemen lain dalam chart dibaca relatif terhadap Day Master ini.\n\nContoh: Day Master 甲 (Kayu Yang) cenderung visioner, ambisius, dan suka tumbuh — seperti pohon besar yang terus berkembang.',
  },
  empat_pilar: {
    title: 'Empat Pilar (四柱)',
    subtitle: 'Peta energi kelahiranmu',
    body: 'BaZi berarti "Delapan Karakter" — empat pilar (tahun, bulan, hari, jam) masing-masing terdiri dari dua karakter: Heavenly Stem (天干) di atas dan Earthly Branch (地支) di bawah.\n\nPilar Tahun: energi keluarga dan leluhur.\nPilar Bulan: energi karier dan lingkungan tumbuh.\nPilar Hari: inti diri (Day Master) dan hubungan intim.\nPilar Jam: ambisi, anak, dan warisan.',
  },
  ge_ju: {
    title: 'Ge Ju (格局)',
    subtitle: 'Struktur dominan chartmu',
    body: 'Ge Ju adalah "pola" atau struktur utama chart BaZi-mu, ditentukan dari hidden stem terkuat di Pilar Bulan. Ini seperti "DNA strategis" — menggambarkan jenis energi apa yang paling dominan menggerakkan hidupmu.\n\nContoh: 正官格 (Official Structure) → orang yang bergerak lewat jalur formal, otoritas, dan reputasi.',
  },
  yong_shen: {
    title: 'Yong Shen (用神)',
    subtitle: 'Elemen yang paling kamu butuhkan',
    body: 'Yong Shen adalah "Useful God" — elemen atau Ten God yang paling dibutuhkan chartmu untuk seimbang. Jika Day Master terlalu kuat, ia butuh elemen yang "mengeluarkan" atau "mengontrol" energinya. Jika terlalu lemah, ia butuh dukungan.\n\nSederhananya: Yong Shen adalah arah di mana energimu paling efektif mengalir.',
  },
  stem_combo: {
    title: 'Stem Combinations (天干合)',
    subtitle: '5 pasangan kombinasi Heavenly Stem',
    body: 'Dalam BaZi, ada 5 pasangan Heavenly Stem yang ketika bertemu, "bergabung" dan menghasilkan elemen baru:\n\n甲+己 → Tanah  |  乙+庚 → Logam\n丙+辛 → Air    |  丁+壬 → Kayu\n戊+癸 → Api\n\nKombinasi ini bisa memperkuat atau mengubah dinamika chart — terutama jika melibatkan Day Master.',
  },
  luck_pillars: {
    title: 'Luck Pillars (大運)',
    subtitle: 'Siklus energi 10-tahunan',
    body: 'Luck Pillars adalah siklus energi yang berubah setiap 10 tahun sepanjang hidupmu. Masing-masing pillar membawa tema, peluang, dan tantangan yang berbeda.\n\nPillar yang aktif sekarang adalah "cuaca" dekade ini — menentukan elemen apa yang mendukung atau menekanmu saat ini. Bacalah chart natal dalam konteks pillar aktif untuk pemahaman yang lebih akurat.',
  },
  kong_wang: {
    title: 'Kong Wang / Void Branches (空亡)',
    subtitle: 'Branch yang kehilangan efektivitas',
    body: 'Dalam setiap siklus 旬 (10 hari), ada 2 Earthly Branch yang "kosong" atau tidak aktif — disebut Kong Wang (空亡) atau Void.\n\nBranch yang masuk dalam void cenderung kehilangan efektivitasnya: Ten God yang ada di branch itu menjadi kurang kuat bekerja. Bukan berarti buruk — hanya menunjukkan area di mana energi tersebut tidak bekerja maksimal.',
  },
  special_stars: {
    title: 'Special Stars (神煞)',
    subtitle: 'Bintang-bintang karakter tambahan',
    body: '神煞 adalah "bintang" karakter yang muncul berdasarkan kombinasi stem dan branch di chart natal:\n\n贵人 Gui Ren — Noble People: orang-orang berpengaruh yang cenderung membantu di saat kritis.\n桃花 Tao Hua — Peach Blossom: daya tarik sosial dan pesona emosional yang kuat.\n驿马 Yi Ma — Sky Horse: mobilitas tinggi, perjalanan, perubahan lingkungan.\n文昌 Wen Chang — Intelligence: kemampuan akademis, menulis, dan belajar.\n孤辰/寡宿 Gu Chen/Gua Su — Solitary Stars: kecenderungan periode isolasi atau kemandirian.',
  },
  life_stages: {
    title: '12 Life Stages (十二运星)',
    subtitle: 'Siklus energi setiap branch untuk Day Master',
    body: 'Setiap Earthly Branch memiliki "kualitas energi" yang berbeda terhadap Day Master:\n\n长生 Cháng Shēng — Tumbuh (energi baru, penuh potensi)\n沐浴 Mùyù — Mandi (phase sensitif, perlu arahan)\n冠带 Guàn Dài — Berpakaian (mulai matang)\n临官 Lín Guān — Puncak Karier (sangat produktif)\n帝旺 Dì Wàng — Kejayaan (puncak energi)\n衰 Shuāi — Menurun (efisiensi berkurang)\n病 Bìng — Sakit (energi terkuras)\n死 Sǐ — Mati (energi berhenti)\n墓 Mù — Makam (tersimpan, kurang aktif)\n绝 Jué — Punah (paling lemah)\n胎 Tāi — Konsepsi (benih baru)\n养 Yǎng — Perawatan (dipersiapkan)\n\nSetiap Luck Pillar membawa kualitas ini yang mempengaruhi dekade itu.',
  },
};

const TIMEZONES = [
  { label: 'WIB',  sub: 'Jakarta · Sumatera',     value: 'Asia/Jakarta'    },
  { label: 'WITA', sub: 'Bali · Makassar',         value: 'Asia/Makassar'   },
  { label: 'WIT',  sub: 'Jayapura · Papua',        value: 'Asia/Jayapura'   },
  { label: 'SGT',  sub: 'Singapura · Malaysia',    value: 'Asia/Singapore'  },
  { label: 'CST',  sub: 'Tiongkok · Taiwan · HK',  value: 'Asia/Shanghai'   },
  { label: 'JST',  sub: 'Jepang · Korea',          value: 'Asia/Tokyo'      },
  { label: 'UTC',  sub: 'Universal (GMT+0)',        value: 'UTC'             },
  { label: 'CET',  sub: 'Eropa Tengah (GMT+1/+2)', value: 'Europe/Paris'    },
  { label: 'EST',  sub: 'Amerika Timur (GMT-5)',   value: 'America/New_York' },
];

const GENDERS = [
  { label: 'Pria',   value: 'male'   },
  { label: 'Wanita', value: 'female' },
];

const PILLAR_LABEL: Record<string, string> = {
  year: '年\nTAHUN', month: '月\nBULAN', day: '日\nHARI', hour: '時\nJAM',
};

const NARASI_SECTIONS = [
  { key: 'full_analysis_v2', label: 'Kenali Dirimu', icon: '◉' },
];

const STORY_SECTION_META: Record<string, { title: string; subtitle: string }> = {
  karakter_inti:        { title: 'Karakter Inti',       subtitle: 'Siapa kamu secara energetik' },
  keseimbangan_elemen:  { title: 'Keseimbangan Elemen', subtitle: 'Yang mendukung & melemahkanmu' },
  kekuatan_dan_jebakan: { title: 'Kekuatan & Jebakan',  subtitle: 'Aset dan pola sabotase diri' },
  arena_karir:          { title: 'Arena & Karir',        subtitle: 'Lingkungan dan gaya produktifmu' },
  siklus_aktif:         { title: 'Siklus Aktif',         subtitle: 'Tema dekade saat ini' },
};

function parseStorySections(text: string): { key: string; title: string; subtitle: string; content: string }[] {
  const results: { key: string; title: string; subtitle: string; content: string }[] = [];
  const regex = /SECTION:(\w+)\n([\s\S]*?)(?=SECTION:|Snapshot:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1];
    const content = match[2].trim();
    const meta = STORY_SECTION_META[key];
    if (meta && content) results.push({ key, ...meta, content });
  }
  return results;
}

const APPROX_TIMES = [
  { label: 'Dini Hari / Tahajud', sub: '00:00–03:59', value: '02:00', pillar: '丑' },
  { label: 'Subuh / Fajar',       sub: '04:00–05:59', value: '05:00', pillar: '卯' },
  { label: 'Pagi / Duha',         sub: '06:00–10:59', value: '08:00', pillar: '辰' },
  { label: 'Tengah Hari / Dzuhur',sub: '11:00–13:59', value: '12:00', pillar: '午' },
  { label: 'Sore / Ashar',        sub: '14:00–17:59', value: '16:00', pillar: '申' },
  { label: 'Maghrib / Senja',     sub: '18:00–19:59', value: '19:00', pillar: '戌' },
  { label: 'Malam / Isya',        sub: '20:00–23:59', value: '21:00', pillar: '亥' },
];

type TimeMode = 'exact' | 'approximate' | 'unknown';

const SNAPSHOT_LABELS = ['Sifat Inti', 'Arena Terbaik', 'Jebakan Utama', 'Langkah Jangka Panjang'];

function parseSnapshot(narasi: string): string[] | null {
  const match = narasi.match(/Snapshot:\s*(.+)/);
  if (!match) return null;
  const parts = match[1].split('|').map(s => s.trim());
  return parts.length >= 4 ? parts : null;
}

const isNarasiError = (text: string): boolean => {
  if (!text || text.length < 80) return true;
  return (
    text.startsWith('Gagal') ||
    text.includes('HTTP 4') ||
    text.includes('rate limit') ||
    text.includes('API key') ||
    text.includes('Semua model') ||
    text.includes('Periksa API')
  );
};

function WebDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      max={new Date().toISOString().split('T')[0]}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px', backgroundColor: C.bg,
        color: value ? C.text : C.textFaint,
        boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer', colorScheme: 'dark',
      }}
    />
  );
}

function WebTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px', backgroundColor: C.bg,
        color: value ? C.text : C.textFaint,
        boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer', colorScheme: 'dark',
      }}
    />
  );
}

const SPECIAL_STAR_META: Record<string, { label: string; desc: string; color: string }> = {
  gui_ren:   { label: '贵人 Gui Ren',   color: C.gold,  desc: 'Noble People — orang-orang berpengaruh yang muncul membantu di saat kritis' },
  tao_hua:   { label: '桃花 Tao Hua',   color: '#E08080', desc: 'Peach Blossom — daya tarik sosial dan pesona emosional yang tinggi' },
  yi_ma:     { label: '驿马 Yi Ma',     color: C.teal,  desc: 'Sky Horse — mobilitas, perjalanan, perubahan lingkungan yang aktif' },
  wen_chang: { label: '文昌 Wen Chang', color: C.amber, desc: 'Intelligence Star — bakat akademis, menulis, dan kemampuan belajar' },
  gu_chen:   { label: '孤辰 Gu Chen',   color: C.textFaint, desc: 'Solitary Star — kecenderungan periode isolasi atau kemandirian (Pria)' },
  gua_su:    { label: '寡宿 Gua Su',    color: C.textFaint, desc: 'Solitary Star — kecenderungan periode isolasi atau kemandirian (Wanita)' },
};

export default function ProfileScreen() {
  const {
    chartId, timezone, setChart, clearChart, loading: ctxLoading,
    profiles, activeProfileIdx, switchProfile, addNewProfile, removeActiveProfile, renameProfile,
  } = useChart();

  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [tz,          setTz]          = useState('Asia/Jakarta');
  const [gender,      setGender]      = useState<string | null>(null);
  const [timeMode,    setTimeMode]    = useState<TimeMode>('exact');
  const [approxTime,  setApproxTime]  = useState<string>('');
  const [calculating, setCalculating] = useState(false);

  const [chartData,      setChartData]      = useState<any>(null);
  const [cachedSections, setCachedSections] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeSection,  setActiveSection]  = useState('');
  const [narasiLoading,  setNarasiLoading]  = useState(false);
  const [narasi,         setNarasi]         = useState('');
  const [infoTopic,      setInfoTopic]      = useState<TermKey | ''>('');

  const { simpleMode, toggleSimpleMode } = useSimpleMode();
  const [storyCardIdx, setStoryCardIdx] = useState(0);
  const storyFlatRef = useRef<FlatList>(null);

  const scrollRef   = useRef<ScrollView>(null);
  const narasiBoxY  = useRef<number>(0);

  // Profile switcher
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editingNickname,     setEditingNickname]     = useState('');
  const [renamingIdx,         setRenamingIdx]         = useState<number | null>(null);

  // Compare
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareTargetIdx,    setCompareTargetIdx]    = useState<number | null>(null);
  const [compareNarasi,       setCompareNarasi]       = useState('');
  const [compareLoading,      setCompareLoading]      = useState(false);

  // Onboarding
  const [onboardingVisible,   setOnboardingVisible]   = useState(false);
  const [onboardSlide,        setOnboardSlide]        = useState(0);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (!val) setOnboardingVisible(true);
    });
  }, []);

  const dismissOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingVisible(false);
  };

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(NOTIF_KEY).then(val => setNotifEnabled(val === 'true'));
  }, []);

  const toggleNotification = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Notifikasi', 'Notifikasi harian hanya tersedia di aplikasi mobile (Android/iOS).');
      return;
    }
    setNotifLoading(true);
    try {
      if (notifEnabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.setItem(NOTIF_KEY, 'false');
        setNotifEnabled(false);
      } else {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Izin Ditolak', 'Aktifkan izin notifikasi di pengaturan perangkat untuk menggunakan fitur ini.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL, {
            name: 'BaZi Harian',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'BaZi Harian',
            body: 'Cek energi dan interaksi hari ini →',
            data: { screen: 'Kalender' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: NOTIF_HOUR,
            minute: 0,
          },
        });
        await AsyncStorage.setItem(NOTIF_KEY, 'true');
        setNotifEnabled(true);
        Alert.alert('Aktif!', `Notifikasi harian dijadwalkan setiap pukul 0${NOTIF_HOUR}.00.`);
      }
    } catch {
      Alert.alert('Gagal', 'Tidak dapat mengatur notifikasi. Coba lagi.');
    } finally {
      setNotifLoading(false);
    }
  };

  const info = (key: TermKey) => (
    <TouchableOpacity onPress={() => setInfoTopic(key)} style={styles.infoBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.infoBtnText}>ⓘ</Text>
    </TouchableOpacity>
  );

  const loadProfile = useCallback(async (id: string) => {
    setProfileLoading(true);
    try {
      const res = await axios.get(`${API_URL}/profile/${id}`);
      setChartData(res.data.chart);
      const raw: Record<string, string> = res.data.cached_sections ?? {};
      const filtered = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => !isNarasiError(v))
      );
      setCachedSections(filtered);
    } catch {
      // silent
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ctxLoading && chartId) loadProfile(chartId);
  }, [ctxLoading, chartId, loadProfile]);

  const generateNarasi = async (section: string, forceRefresh = false) => {
    if (!chartId) return;
    setActiveSection(section);
    if (!forceRefresh && cachedSections[section]) {
      setNarasi(cachedSections[section]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: narasiBoxY.current - 20, animated: true });
      }, 150);
      return;
    }
    setNarasiLoading(true);
    setNarasi('');
    try {
      const res = await axios.post(`${API_URL}/narasi/generate`, { chart_id: chartId, section });
      const text: string = res.data.narasi;
      setNarasi(text);
      if (!isNarasiError(text)) {
        setCachedSections(prev => ({ ...prev, [section]: text }));
      }
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: narasiBoxY.current - 20, animated: true });
      }, 150);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setNarasi(detail ?? 'Gagal menghasilkan narasi. Silakan coba lagi.');
    } finally {
      setNarasiLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!date) {
      Alert.alert('Tanggal Diperlukan', 'Pilih tanggal lahir terlebih dahulu.');
      return;
    }
    if (timeMode === 'exact' && !time) {
      Alert.alert('Waktu Diperlukan', 'Pilih waktu lahir atau gunakan opsi perkiraan waktu.');
      return;
    }
    if (timeMode === 'approximate' && !approxTime) {
      Alert.alert('Perkiraan Waktu Diperlukan', 'Pilih satu perkiraan waktu kelahiran.');
      return;
    }

    const doCalculate = async () => {
      setCalculating(true);
      try {
        const finalTime = timeMode === 'exact' ? `${time}:00`
                        : timeMode === 'approximate' ? `${approxTime}:00`
                        : null;
        const isHourUnknown = timeMode === 'unknown' || timeMode === 'approximate';

        const res = await axios.post(`${API_URL}/charts/calculate`, {
          birth_date:     date,
          birth_time:     finalTime,
          birth_timezone: tz,
          gender:         gender ?? undefined,
          hour_unknown:   isHourUnknown,
        });
        await setChart(res.data.id, tz);
        setChartData(res.data);
        setCachedSections({});
        setTimeout(() => generateNarasi('full_analysis'), 500);
      } catch {
        Alert.alert('Gagal', 'Tidak dapat membuat chart. Periksa koneksi internet dan coba lagi.');
      } finally {
        setCalculating(false);
      }
    };

    if (!gender) {
      if (Platform.OS === 'web') {
        const ok = window.confirm(
          'Jenis kelamin belum dipilih.\n\nTanpa ini, Luck Pillars (大運) tidak akan dihitung. Lanjutkan tanpa Luck Pillars?'
        );
        if (ok) doCalculate();
        return;
      }
      Alert.alert(
        'Jenis Kelamin Belum Dipilih',
        'Tanpa ini, Luck Pillars (大運) tidak akan dihitung. Lanjutkan tanpa Luck Pillars?',
        [
          { text: 'Batalkan', style: 'cancel' },
          { text: 'Lanjutkan', onPress: doCalculate },
        ]
      );
      return;
    }

    doCalculate();
  };

  const handleShare = async () => {
    if (!chartData) return;
    const pillars = chartData.pillars;
    const text = [
      `◉ BaZi Chart`,
      `Day Master: ${pillars?.day?.stem ?? '-'} (${chartData.day_master_strength ?? ''})`,
      `Ge Ju: ${chartData.ge_ju ?? '-'} | Yong Shen: ${chartData.yong_shen ?? '-'}`,
      ``,
      `Pilar Tahun: ${pillars?.year?.stem ?? '-'}${pillars?.year?.branch ?? '-'}`,
      `Pilar Bulan: ${pillars?.month?.stem ?? '-'}${pillars?.month?.branch ?? '-'}`,
      `Pilar Hari:  ${pillars?.day?.stem ?? '-'}${pillars?.day?.branch ?? '-'}`,
      `Pilar Jam:   ${pillars?.hour?.stem ?? '-'}${pillars?.hour?.branch ?? '-'}${chartData.hour_unknown ? ' (~)' : ''}`,
      ``,
      `bazi-app-two.vercel.app`,
    ].join('\n');

    if (Platform.OS === 'web') {
      if (navigator.share) {
        navigator.share({ title: 'BaZi Chart Saya', text }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(text);
        Alert.alert('Disalin!', 'Data chart disalin ke clipboard.');
      }
      return;
    }
    await Share.share({ message: text, title: 'BaZi Chart Saya' });
  };

  const handleCompare = async () => {
    if (compareTargetIdx === null || !chartId) return;
    const targetProfile = profiles[compareTargetIdx];
    if (!targetProfile?.chartId) return;
    setCompareLoading(true);
    setCompareNarasi('');
    try {
      const res = await axios.post(`${API_URL}/charts/compare`, {
        chart_id_a: chartId,
        chart_id_b: targetProfile.chartId,
      });
      setCompareNarasi(res.data.narasi ?? '');
    } catch {
      setCompareNarasi('Tidak dapat membandingkan chart. Periksa koneksi internet.');
    } finally {
      setCompareLoading(false);
    }
  };

  const confirmReset = () => {
    const doReset = async () => {
      await removeActiveProfile();
      setChartData(null);
      setCachedSections({});
      setNarasi('');
      setActiveSection('');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset Profil?\n\nChart di server tetap ada. Perangkat ini akan lupa profil ini.')) {
        doReset();
      }
      return;
    }

    Alert.alert(
      'Reset Profil',
      'Chart di server tetap ada. Perangkat ini akan lupa profil ini. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: doReset },
      ]
    );
  };

  if (ctxLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (!chartId) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.setupContainer} showsVerticalScrollIndicator={false}>

        {/* ── ONBOARDING MODAL ─────────────────────────────────── */}
        <Modal
          visible={onboardingVisible}
          animationType="fade"
          transparent={false}
          statusBarTranslucent
          onRequestClose={dismissOnboarding}
        >
          <View style={styles.onboardRoot}>
            <FlatList
              ref={flatRef}
              data={ONBOARDING_SLIDES}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setOnboardSlide(idx);
              }}
              renderItem={({ item }) => (
                <View style={[styles.onboardSlide, { width: SCREEN_W }]}>
                  <Text style={styles.onboardIcon}>{item.icon}</Text>
                  <Text style={styles.onboardTitle}>{item.title}</Text>
                  <Text style={styles.onboardBody}>{item.body}</Text>
                </View>
              )}
            />
            {/* Dot indicators */}
            <View style={styles.onboardDots}>
              {ONBOARDING_SLIDES.map((_, i) => (
                <View key={i} style={[styles.onboardDot, i === onboardSlide && styles.onboardDotActive]} />
              ))}
            </View>
            {/* Action row */}
            <View style={styles.onboardActions}>
              {onboardSlide < ONBOARDING_SLIDES.length - 1 ? (
                <>
                  <TouchableOpacity style={styles.onboardSkip} onPress={dismissOnboarding}>
                    <Text style={styles.onboardSkipText}>Lewati</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.onboardNext}
                    onPress={() => {
                      const next = onboardSlide + 1;
                      flatRef.current?.scrollToIndex({ index: next, animated: true });
                      setOnboardSlide(next);
                    }}
                  >
                    <Text style={styles.onboardNextText}>Lanjut →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.onboardStart} onPress={dismissOnboarding}>
                  <Text style={styles.onboardStartText}>Mulai →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        {/* Back button — only shown when previous profiles exist */}
        {profiles.some(p => p.chartId) && (
          <TouchableOpacity
            style={styles.setupBackBtn}
            onPress={async () => {
              await removeActiveProfile();
              setChartData(null);
              setCachedSections({});
              setNarasi('');
              setActiveSection('');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.setupBackBtnText}>← Kembali ke profil sebelumnya</Text>
          </TouchableOpacity>
        )}

        <View style={styles.setupHero}>
          <Image source={require('../../assets/logo.png')} style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 16 }} />
          <Text style={styles.setupTitle}>BaZi Chart</Text>
          <Text style={styles.setupSubtitle}>Masukkan data kelahiran untuk membaca empat pilar nasibmu</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Tanggal Lahir</Text>
          {Platform.OS === 'web'
            ? <WebDateInput value={date} onChange={setDate} />
            : <TextInput
                style={[styles.input, !!date && styles.inputActive]}
                value={date} onChangeText={setDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={C.textFaint}
                keyboardType="numbers-and-punctuation" autoCorrect={false}
              />
          }

          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Jam Lahir</Text>

          {/* Time mode selector */}
          <View style={styles.timeModeRow}>
            {([
              { key: 'exact',       label: 'Jam Pasti' },
              { key: 'approximate', label: 'Perkiraan' },
              { key: 'unknown',     label: 'Tidak Tahu' },
            ] as { key: TimeMode; label: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.timeModeBtn, timeMode === opt.key && styles.timeModeBtnActive]}
                onPress={() => setTimeMode(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.timeModeBtnText, timeMode === opt.key && { color: C.gold }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {timeMode === 'exact' && (
            <>
              {Platform.OS === 'web'
                ? <WebTimeInput value={time} onChange={setTime} />
                : <TextInput
                    style={[styles.input, !!time && styles.inputActive]}
                    value={time} onChangeText={setTime}
                    placeholder="HH:MM" placeholderTextColor={C.textFaint}
                    keyboardType="numbers-and-punctuation" autoCorrect={false}
                  />
              }
            </>
          )}

          {timeMode === 'approximate' && (
            <View style={styles.approxList}>
              {APPROX_TIMES.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.approxBtn, approxTime === opt.value && styles.approxBtnActive]}
                  onPress={() => setApproxTime(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.approxBtnLeft}>
                    <Text style={[styles.approxPillar, approxTime === opt.value && { color: C.gold }]}>{opt.pillar}</Text>
                    <View>
                      <Text style={[styles.approxLabel, approxTime === opt.value && { color: C.text }]}>{opt.label}</Text>
                      <Text style={styles.approxSub}>{opt.sub}</Text>
                    </View>
                  </View>
                  {approxTime === opt.value && <Text style={styles.approxCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
              <Text style={styles.fieldHint}>Pilar jam dihitung dari tengah rentang — akan ditandai sebagai estimasi</Text>
            </View>
          )}

          {timeMode === 'unknown' && (
            <View style={styles.unknownBox}>
              <Text style={styles.unknownText}>Jam kelahiran akan diestimasi dari tengah hari (12:00). Pilar Jam ditandai sebagai estimasi.</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Zona Waktu</Text>
          <View style={styles.tzGrid}>
            {TIMEZONES.map(t => {
              const active = tz === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.tzBtn, active && styles.tzBtnActive]}
                  onPress={() => setTz(t.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tzLabel, active && { color: C.gold }]}>{t.label}</Text>
                  <Text style={[styles.tzSub, active && { color: C.textMuted }]} numberOfLines={1}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>
            Jenis Kelamin{' '}
            <Text style={styles.optionalTag}>(untuk Luck Pillars)</Text>
          </Text>
          <View style={styles.genderRow}>
            {GENDERS.map(g => {
              const active = gender === g.value;
              return (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.genderBtn, active && styles.genderBtnActive]}
                  onPress={() => setGender(active ? null : g.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderLabel, active && { color: C.gold }]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>Diperlukan untuk menghitung siklus 大運 (Luck Pillars)</Text>
        </View>

        <TouchableOpacity
          style={[styles.calcBtn, calculating && { opacity: 0.65 }]}
          onPress={handleCalculate}
          disabled={calculating}
          activeOpacity={0.85}
        >
          {calculating
            ? <ActivityIndicator color={C.bg} />
            : <Text style={styles.calcBtnText}>Hitung Chart Saya →</Text>
          }
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Menggunakan framework 子平真詮 (Zi Ping Zhen Quan).{'\n'}Interpretasi adalah kecenderungan, bukan prediksi absolut.
        </Text>
      </ScrollView>
    );
  }

  // ── PROFILE ────────────────────────────────────────────────────────────────
  const voidBranches:     string[]             = chartData?.void_branches ?? [];
  const stemCombos:       any[]                = chartData?.stem_combinations ?? [];
  const luckPillars:      any[]                = chartData?.luck_pillars ?? [];
  const activeLp:         any                  = chartData?.active_luck_pillar ?? null;
  const hiddenTg:         Record<string, any[]>= chartData?.hidden_ten_gods ?? {};
  const hourUnknown:      boolean              = chartData?.hour_unknown ?? false;
  const specialStars:     Record<string, any>  = chartData?.special_stars ?? {};
  const pillarLifeStages: Record<string, string> = chartData?.pillar_life_stages ?? {};

  const snapshotParts = (() => {
    const text = cachedSections['full_analysis_v2'] ?? cachedSections['full_analysis'] ?? narasi;
    return text ? parseSnapshot(text) : null;
  })();

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.profileContainer}
      showsVerticalScrollIndicator={false}
    >
      {profileLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Memuat profil…</Text>
        </View>
      ) : chartData ? (
        <>
          {/* ── Profile Switcher ── */}
          {profiles.length > 0 && (
            <View style={styles.profileSwitcherRow}>
              <TouchableOpacity
                style={styles.profileSwitcherBtn}
                onPress={() => setProfileModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.profileSwitcherName} numberOfLines={1}>
                  {profiles[activeProfileIdx]?.nickname ?? 'Profil'}
                </Text>
                <Text style={styles.profileSwitcherChevron}>▾</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addProfileBtn}
                onPress={() => {
                  const doAdd = async () => {
                    await addNewProfile();
                    setChartData(null);
                    setCachedSections({});
                    setNarasi('');
                    setActiveSection('');
                  };
                  if (Platform.OS === 'web') {
                    if (window.confirm('Buat profil baru?\n\nKamu bisa kembali ke profil sebelumnya kapan saja.')) doAdd();
                  } else {
                    Alert.alert(
                      'Profil Baru',
                      'Buat profil baru? Kamu bisa kembali ke profil sebelumnya kapan saja.',
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Buat Profil Baru', onPress: doAdd },
                      ]
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addProfileBtnText}>+ Profil Baru</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Profile Switcher Modal ── */}
          <Modal
            visible={profileModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setProfileModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => { setProfileModalVisible(false); setRenamingIdx(null); }}
            >
              <View style={styles.profileModal} onStartShouldSetResponder={() => true}>
                <Text style={styles.profileModalTitle}>Pilih Profil</Text>
                {profiles.map((p, idx) => (
                  <View key={idx} style={styles.profileModalItem}>
                    {renamingIdx === idx ? (
                      <TextInput
                        style={styles.profileNicknameInput}
                        value={editingNickname}
                        onChangeText={setEditingNickname}
                        autoFocus
                        onSubmitEditing={async () => {
                          if (editingNickname.trim()) await renameProfile(idx, editingNickname.trim());
                          setRenamingIdx(null);
                        }}
                        onBlur={async () => {
                          if (editingNickname.trim()) await renameProfile(idx, editingNickname.trim());
                          setRenamingIdx(null);
                        }}
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.profileModalItemInner}
                        onPress={async () => {
                          await switchProfile(idx);
                          if (idx !== activeProfileIdx) {
                            setChartData(null);
                            setCachedSections({});
                            setNarasi('');
                            setActiveSection('');
                          }
                          setProfileModalVisible(false);
                        }}
                        onLongPress={() => {
                          setRenamingIdx(idx);
                          setEditingNickname(p.nickname);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.profileModalName, idx === activeProfileIdx && { color: C.gold }]}>
                          {idx === activeProfileIdx ? '✓ ' : '  '}{p.nickname}
                        </Text>
                        <Text style={styles.profileModalEdit}>tekan lama untuk ganti nama</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.profileModalClose}
                  onPress={() => { setProfileModalVisible(false); setRenamingIdx(null); }}
                >
                  <Text style={styles.profileModalCloseText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* ── Compare Modal ── */}
          <Modal
            visible={compareModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCompareModalVisible(false)}
          >
            <View style={styles.compareModalOverlay}>
              <View style={styles.compareModal}>
                <Text style={styles.compareModalTitle}>◎ Dinamika Bersama</Text>
                {!compareNarasi && !compareLoading && (
                  <>
                    <Text style={styles.compareSelectLabel}>Bandingkan dengan:</Text>
                    {profiles.filter((_, i) => i !== activeProfileIdx && profiles[i]?.chartId).map((p, i) => {
                      const realIdx = profiles.indexOf(p);
                      return (
                        <TouchableOpacity
                          key={realIdx}
                          style={[styles.compareProfileBtn, compareTargetIdx === realIdx && styles.compareProfileBtnActive]}
                          onPress={() => setCompareTargetIdx(realIdx)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.compareProfileBtnText, compareTargetIdx === realIdx && { color: C.gold }]}>
                            {p.nickname}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.compareRunBtn, (!compareTargetIdx && compareTargetIdx !== 0) && { opacity: 0.4 }]}
                      onPress={handleCompare}
                      disabled={compareTargetIdx === null}
                    >
                      <Text style={styles.compareRunBtnText}>Analisis Dinamika →</Text>
                    </TouchableOpacity>
                  </>
                )}
                {compareLoading && (
                  <View style={{ alignItems: 'center', padding: 20, gap: 10 }}>
                    <ActivityIndicator color={C.gold} />
                    <Text style={{ color: C.textMuted, fontSize: 13 }}>AI membandingkan kedua chart…</Text>
                  </View>
                )}
                {!!compareNarasi && (
                  <ScrollView style={{ maxHeight: 360 }}>
                    <Text style={styles.compareNarasiText}>{compareNarasi}</Text>
                  </ScrollView>
                )}
                <TouchableOpacity
                  style={styles.compareCloseBtn}
                  onPress={() => { setCompareModalVisible(false); setCompareNarasi(''); setCompareTargetIdx(null); }}
                >
                  <Text style={styles.compareCloseBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Day Master Hero */}
          {(() => {
            const dayStem = chartData.pillars?.day?.stem ?? '';
            const stemCol = STEM_COLOR[dayStem] ?? C.gold;
            const stemEl  = STEM_ELEMENT[dayStem] ?? '';
            const geJu    = chartData.ge_ju;
            const yongShen = chartData.yong_shen;
            return (
              <View style={[styles.dayMasterCard, { borderColor: stemCol, backgroundColor: stemCol + '12' }]}>
                <Text style={[styles.dayMasterChar, { color: stemCol }]}>
                  {simpleMode ? (stemEl || dayStem) : dayStem}
                </Text>
                <View style={styles.dayMasterInfo}>
                  <Text style={styles.dayMasterEl}>{stemEl}</Text>
                  <View style={styles.dayMasterLabelRow}>
                    <Text style={styles.dayMasterLabel}>Day Master</Text>
                    {info('day_master')}
                  </View>
                  <View style={styles.dayMasterBadges}>
                    <View style={[styles.strengthBadge, { borderColor: stemCol }]}>
                      <Text style={[styles.strengthText, { color: stemCol }]}>
                        {chartData.day_master_strength ?? '-'}
                      </Text>
                    </View>
                    {geJu && (
                      <TouchableOpacity onPress={() => setInfoTopic('ge_ju')} activeOpacity={0.75}>
                        <View style={styles.geJuBadge}>
                          <Text style={styles.geJuText}>
                            {simpleMode ? `Pola Dominan ⓘ` : `${geJu} ⓘ`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                  {yongShen && (
                    <TouchableOpacity onPress={() => setInfoTopic('yong_shen')} activeOpacity={0.75}>
                      <Text style={styles.yongShenRow}>
                        <Text style={styles.yongShenLabel}>{simpleMode ? 'Elemen Andalan ' : '用神 '}</Text>
                        <Text style={styles.yongShenValue}>{yongShen} ⓘ</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Life Strategy Snapshot Card */}
          {snapshotParts && (
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotTitle}>◉ STRATEGI HIDUPMU</Text>
              {snapshotParts.slice(0, 4).map((s, i) => (
                <View key={i} style={styles.snapshotRow}>
                  <Text style={styles.snapshotLabel}>{SNAPSHOT_LABELS[i]}</Text>
                  <Text style={styles.snapshotValue}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Four Pillars */}
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>EMPAT PILAR</Text>
            {info('empat_pilar')}
          </View>
          <View style={styles.pillarsContainer}>
            {(['year', 'month', 'day', 'hour'] as const).map(p => {
              const pillar  = chartData.pillars?.[p];
              const stem    = pillar?.stem ?? '-';
              const branch  = pillar?.branch ?? '-';
              const isDay   = p === 'day';
              const stemCol = STEM_COLOR[stem] ?? C.gold;
              const tenGod  = isDay ? '日主' : (chartData.ten_gods?.[`${p}_stem`] ?? '-');
              const animal  = BRANCH_ANIMAL[branch] ?? '';
              const isVoid  = voidBranches.includes(branch) && branch !== '-';
              const dominantHidden = hiddenTg[p]?.[0];
              const isHourEst = p === 'hour' && hourUnknown;
              const lifeStage = pillarLifeStages[p];
              return (
                <View key={p} style={[styles.pillarCol, isDay && { backgroundColor: C.surfaceHigh }]}>
                  <Text style={styles.pillarColLabel}>{PILLAR_LABEL[p]}</Text>
                  {simpleMode ? (
                    <Text style={[styles.pillarStemSimple, { color: isDay ? C.goldSoft : stemCol }]}>
                      {STEM_ELEMENT[stem] ?? stem}
                    </Text>
                  ) : (
                    <Text style={[styles.pillarColStem, { color: isDay ? C.goldSoft : stemCol }]}>{stem}</Text>
                  )}
                  <View style={[styles.pillarColDivider, { borderColor: isDay ? C.gold : C.border }]} />
                  <View style={{ position: 'relative', alignItems: 'center' }}>
                    {simpleMode ? (
                      <Text style={[styles.pillarBranchSimple, isDay && { color: C.goldSoft }, isVoid && styles.voidBranchText]}>
                        {BRANCH_ANIMAL[branch] ?? branch}
                      </Text>
                    ) : (
                      <Text style={[styles.pillarColBranch, isDay && { color: C.goldSoft }, isVoid && styles.voidBranchText]}>
                        {branch}
                      </Text>
                    )}
                    {isVoid && (
                      <View style={styles.voidBadge}>
                        <Text style={styles.voidBadgeText}>空</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pillarColAnimal}>{simpleMode ? '' : animal}</Text>
                  <Text style={[styles.pillarColGod, { color: isDay ? C.gold : C.textMuted }]}>{tenGod}</Text>
                  {dominantHidden && (
                    <Text style={styles.pillarColHiddenGod} numberOfLines={1}>
                      {simpleMode ? `~${dominantHidden.ten_god}` : `藏${dominantHidden.ten_god}`}
                    </Text>
                  )}
                  {lifeStage && (
                    <Text style={styles.pillarColLifeStage} numberOfLines={1}>{lifeStage}</Text>
                  )}
                  {isHourEst && (
                    <View style={styles.estimatedBadge}>
                      <Text style={styles.estimatedBadgeText}>~</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {hourUnknown && (
            <Text style={styles.hourEstimatedNote}>
              ⚠ Pilar Jam dihitung dari estimasi — akurasi terbatas untuk analisis masa tua &amp; warisan
            </Text>
          )}

          {/* Stem Combinations */}
          {stemCombos.length > 0 && (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{simpleMode ? 'KOMBINASI ENERGI' : '天干合 STEM COMBINATIONS'}</Text>
                {info('stem_combo')}
              </View>
              <View style={styles.comboCard}>
                {stemCombos.map((c, idx) => (
                  <View key={idx} style={styles.comboRow}>
                    <Text style={styles.comboStems}>
                      {c.stems.map((s: string) => (
                        <Text key={s} style={{ color: STEM_COLOR[s] ?? C.goldSoft }}>{s}</Text>
                      ))}
                      <Text style={{ color: C.textMuted }}> 合 → </Text>
                      <Text style={{ color: C.gold }}>{c.result_element}</Text>
                    </Text>
                    <Text style={styles.comboPositions}>{c.positions.join(' + ')}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Luck Pillars */}
          {luckPillars.length > 0 ? (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{simpleMode ? 'SIKLUS 10 TAHUNAN' : '大運 LUCK PILLARS'}</Text>
                {info('luck_pillars')}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lpScroll} contentContainerStyle={styles.lpScrollContent}>
                {luckPillars.map((lp: any, idx: number) => {
                  const isActive = activeLp?.order_index === lp.order_index;
                  const stemCol  = STEM_COLOR[lp.stem] ?? C.textMuted;
                  return (
                    <View key={idx} style={[styles.lpCard, isActive && styles.lpCardActive]}>
                      {isActive && <Text style={styles.lpActiveTag}>AKTIF</Text>}
                      {simpleMode ? (
                        <Text style={[styles.pillarStemSimple, { color: isActive ? stemCol : C.textMuted }]}>
                          {STEM_ELEMENT[lp.stem] ?? lp.stem}
                        </Text>
                      ) : (
                        <Text style={[styles.lpStem, { color: isActive ? stemCol : C.textMuted }]}>{lp.stem}</Text>
                      )}
                      <View style={[styles.lpDivider, { borderColor: isActive ? C.gold : C.border }]} />
                      {simpleMode ? (
                        <Text style={[styles.pillarBranchSimple, isActive && { color: C.goldSoft }]}>
                          {BRANCH_ANIMAL[lp.branch] ?? lp.branch}
                        </Text>
                      ) : (
                        <Text style={[styles.lpBranch, isActive && { color: C.goldSoft }]}>{lp.branch}</Text>
                      )}
                      <Text style={[styles.lpAge, isActive && { color: C.gold }]}>{lp.age_start}岁</Text>
                      {lp.life_stage && (
                        <Text style={[styles.lpLifeStage, isActive && { color: C.amber }]} numberOfLines={1}>
                          {lp.life_stage}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <View style={styles.lpMissingCard}>
              <Text style={styles.lpMissingTitle}>{simpleMode ? 'Siklus 10 Tahunan tidak tersedia' : '大運 Luck Pillars tidak tersedia'}</Text>
              <Text style={styles.lpMissingDesc}>
                Jenis kelamin diperlukan untuk menghitung siklus 10 tahunan.
                Reset profil dan isi ulang dengan data lengkap untuk mengaktifkan fitur ini.
              </Text>
            </View>
          )}

          {/* Void Branches info */}
          {voidBranches.length > 0 && (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{simpleMode ? 'CABANG KOSONG' : '空亡 VOID BRANCHES'}</Text>
                {info('kong_wang')}
              </View>
              <View style={styles.voidCard}>
                <View style={styles.voidBranchRow}>
                  {voidBranches.map(b => (
                    <View key={b} style={styles.voidBranchChip}>
                      <Text style={styles.voidBranchChipText}>
                        {simpleMode ? (BRANCH_ANIMAL[b] ?? b) : b}
                      </Text>
                      {!simpleMode && <Text style={styles.voidBranchChipSub}>{BRANCH_ANIMAL[b] ?? ''}</Text>}
                    </View>
                  ))}
                </View>
                <Text style={styles.voidNote}>Ten God di branch ini cenderung kehilangan efektivitas</Text>
              </View>
            </>
          )}

          {/* Special Stars (神煞) */}
          {Object.keys(specialStars).length > 0 && (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{simpleMode ? 'BINTANG SPESIAL' : '神煞 SPECIAL STARS'}</Text>
                {info('special_stars')}
              </View>
              <View style={styles.starsCard}>
                {Object.entries(specialStars).map(([key, val]: [string, any]) => {
                  const meta = SPECIAL_STAR_META[key];
                  if (!meta) return null;
                  const branches = val.branches ?? (val.branch ? [val.branch] : []);
                  return (
                    <View key={key} style={[styles.starRow, val.in_chart && styles.starRowActive]}>
                      <View style={styles.starLeft}>
                        <Text style={[styles.starLabel, { color: val.in_chart ? meta.color : C.textFaint }]}>
                          {simpleMode ? meta.label.replace(/^[一-鿿]+ /, '') : meta.label}
                        </Text>
                        <Text style={styles.starBranches}>
                          {simpleMode
                            ? branches.map((b: string) => BRANCH_ANIMAL[b] ?? b).join(' · ')
                            : branches.join(' · ')}
                        </Text>
                      </View>
                      <View style={styles.starRight}>
                        <Text style={[styles.starStatus, { color: val.in_chart ? meta.color : C.textFaint }]}>
                          {val.in_chart
                            ? (simpleMode ? '● Aktif' : '● 在命')
                            : (simpleMode ? '○ Tidak Aktif' : '○ 不在')}
                        </Text>
                        <Text style={styles.starDesc} numberOfLines={2}>{meta.desc}</Text>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity onPress={() => setInfoTopic('special_stars')} style={styles.starsInfoBtn}>
                  <Text style={styles.starsInfoBtnText}>{simpleMode ? 'ⓘ Tentang Bintang Spesial' : 'ⓘ Tentang 神煞'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Narasi sections */}
          <Text style={styles.sectionLabel}>INTERPRETASI</Text>
          {Object.keys(cachedSections).length === 0 && (
            <Text style={styles.narasiHint}>Tap untuk membaca interpretasi BaZi chart-mu</Text>
          )}
          <View style={styles.narasiButtons}>
            {NARASI_SECTIONS.map(s => {
              const active   = activeSection === s.key;
              const isCached = !!cachedSections[s.key];
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.narasiBtn, active && styles.narasiBtnActive]}
                  onPress={() => generateNarasi(s.key)}
                  disabled={narasiLoading}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.narasiBtnIcon, active && { color: C.gold }]}>{s.icon}</Text>
                  <Text style={[styles.narasiBtnText, active && { color: C.goldSoft }]}>
                    {s.label}
                  </Text>
                  {isCached && <View style={styles.cachedDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {narasiLoading && (
            <View style={styles.narasiLoadingRow}>
              <ActivityIndicator size="small" color={C.gold} />
              <Text style={styles.narasiLoadingText}>Membaca chart…</Text>
            </View>
          )}

          {!!narasi && !narasiLoading && (() => {
            const sections = parseStorySections(narasi);
            if (sections.length > 0) {
              return (
                <View style={styles.storyContainer}>
                  <FlatList
                    ref={storyFlatRef}
                    data={sections}
                    keyExtractor={item => item.key}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.storyFlatList}
                    onScroll={e => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                      setStoryCardIdx(idx);
                    }}
                    scrollEventThrottle={16}
                    renderItem={({ item, index }) => (
                      <View style={styles.storyCard}>
                        <Text style={styles.storyCardNum}>{index + 1} / {sections.length}</Text>
                        <Text style={styles.storyCardTitle}>{item.title}</Text>
                        <Text style={styles.storyCardSubtitle}>{item.subtitle}</Text>
                        <Text style={styles.storyCardText}>{item.content}</Text>
                      </View>
                    )}
                  />
                  <View style={styles.storyDots}>
                    {sections.map((_, i) => (
                      <View key={i} style={[styles.storyDot, i === storyCardIdx && styles.storyDotActive]} />
                    ))}
                  </View>
                </View>
              );
            }
            // Fallback: error or old format text block
            return (
              <View
                onLayout={(e) => { narasiBoxY.current = e.nativeEvent.layout.y; }}
                style={[styles.narasiBox, isNarasiError(narasi) && styles.narasiBoxError]}
              >
                <View style={styles.narasiBoxHeader}>
                  <Text style={styles.narasiBoxLabel}>
                    {NARASI_SECTIONS.find(s => s.key === activeSection)?.label}
                  </Text>
                  {isNarasiError(narasi) && (
                    <TouchableOpacity
                      style={styles.retryBtn}
                      onPress={() => generateNarasi(activeSection, true)}
                    >
                      <Text style={styles.retryBtnText}>↻ Coba Lagi</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.narasiBoxText, isNarasiError(narasi) && styles.narasiErrorText]}>
                  {narasi}
                </Text>
              </View>
            );
          })()}

          {/* Birth info */}
          <View style={styles.birthCard}>
            <Text style={styles.birthTitle}>Data Kelahiran</Text>
            <Text style={styles.birthValue}>
              {chartData.birth_datetime
                ? new Date(chartData.birth_datetime).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : '-'}
              {' · '}{chartData.birth_timezone}
              {chartData.gender ? ` · ${chartData.gender === 'male' ? 'Pria' : 'Wanita'}` : ''}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Text style={styles.shareBtnText}>↑ Bagikan Chart</Text>
            </TouchableOpacity>
            {profiles.filter((_, i) => i !== activeProfileIdx && profiles[i]?.chartId).length > 0 && (
              <TouchableOpacity
                style={styles.compareBtn}
                onPress={() => { setCompareModalVisible(true); setCompareNarasi(''); setCompareTargetIdx(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.compareBtnText}>◎ Bandingkan</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Mode Awam toggle */}
          <TouchableOpacity
            style={styles.simpleModeRow}
            onPress={toggleSimpleMode}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.notifLabel}>Mode Awam</Text>
              <Text style={styles.notifSub}>{simpleMode ? 'Aktif — karakter Hanzi disembunyikan' : 'Nonaktif — tampil karakter Hanzi lengkap'}</Text>
            </View>
            <View style={[styles.notifPill, simpleMode && styles.notifPillOn]}>
              <View style={[styles.notifThumb, simpleMode && styles.notifThumbOn]} />
            </View>
          </TouchableOpacity>

          {/* Notification toggle */}
          {Platform.OS === 'web' ? (
            <View style={[styles.notifRow, { opacity: 0.45 }]}>
              <View>
                <Text style={styles.notifLabel}>Notifikasi Harian</Text>
                <Text style={styles.notifSub}>Hanya tersedia di aplikasi mobile</Text>
              </View>
              <View style={styles.notifPill}>
                <View style={styles.notifThumb} />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.notifRow}
              onPress={toggleNotification}
              activeOpacity={0.8}
              disabled={notifLoading}
            >
              <View>
                <Text style={styles.notifLabel}>Notifikasi Harian</Text>
                <Text style={styles.notifSub}>Pengingat pukul 0{NOTIF_HOUR}.00 setiap hari</Text>
              </View>
              <View style={[styles.notifPill, notifEnabled && styles.notifPillOn]}>
                <View style={[styles.notifThumb, notifEnabled && styles.notifThumbOn]} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={confirmReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>Reset Profil</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Profil tidak dapat dimuat. Periksa koneksi internet.</Text>
        </View>
      )}

      {/* ── Term explanation modal ── */}
      {infoTopic !== '' && TERM_EXPLANATIONS[infoTopic] && (
        <InfoModal
          visible
          title={TERM_EXPLANATIONS[infoTopic].title}
          subtitle={TERM_EXPLANATIONS[infoTopic].subtitle}
          body={TERM_EXPLANATIONS[infoTopic].body}
          onClose={() => setInfoTopic('')}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { color: C.textMuted, fontSize: 14 },
  errorText:   { color: C.red, textAlign: 'center', fontSize: 15 },

  // ── Setup ──
  setupContainer: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 24 },
  setupBackBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginBottom: 8,
  },
  setupBackBtnText: { fontSize: 14, color: C.gold, fontWeight: '700' },
  setupHero:   { alignItems: 'center', marginBottom: 28 },
  setupTitle:    { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: 0.5 },
  setupSubtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 280 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10, letterSpacing: 0.3 },
  fieldHint:  { fontSize: 12, color: C.textMuted, marginTop: 6 },
  optionalTag:{ fontSize: 11, fontWeight: '400', color: C.textFaint },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: C.text,
    marginBottom: 4,
  },
  inputActive: { borderColor: C.gold },

  // Time mode selector
  timeModeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  timeModeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: 'center',
  },
  timeModeBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  timeModeBtnText:   { fontSize: 12, fontWeight: '700', color: C.textMuted },

  // Approximate time list
  approxList: { gap: 6 },
  approxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  approxBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  approxBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  approxPillar:    { fontSize: 22, fontWeight: '900', color: C.textMuted, width: 28 },
  approxLabel:     { fontSize: 13, fontWeight: '700', color: C.textMuted },
  approxSub:       { fontSize: 11, color: C.textFaint, marginTop: 1 },
  approxCheck:     { fontSize: 16, color: C.gold, fontWeight: '900' },

  // Unknown time box
  unknownBox: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.amber + '55',
    borderRadius: 10,
    padding: 12,
  },
  unknownText: { fontSize: 13, color: C.amber, lineHeight: 20 },

  // Timezone grid (3-col)
  tzGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tzBtn: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
  },
  tzBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  tzLabel:     { fontSize: 14, fontWeight: '700', color: C.textMuted },
  tzSub:       { fontSize: 10, color: C.textFaint, marginTop: 2 },

  genderRow:       { flexDirection: 'row', gap: 10 },
  genderBtn:       { flex: 1, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  genderBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  genderLabel:     { fontSize: 15, fontWeight: '700', color: C.textMuted },

  calcBtn: {
    backgroundColor: C.gold,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  calcBtnText: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  disclaimer:  { fontSize: 12, color: C.textFaint, textAlign: 'center', lineHeight: 18 },

  // ── Profile ──
  profileContainer: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 16 },

  dayMasterCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 16,
  },
  dayMasterChar:  { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  dayMasterInfo:  { flex: 1, gap: 4 },
  dayMasterEl:    { fontSize: 15, fontWeight: '700', color: C.text },
  dayMasterLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  dayMasterBadges:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  strengthBadge:  { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  strengthText:   { fontSize: 13, fontWeight: '700' },
  geJuBadge: {
    borderWidth: 1, borderColor: C.textFaint, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  geJuText: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  yongShenRow:  { marginTop: 4 },
  yongShenLabel:{ fontSize: 11, color: C.textFaint, fontWeight: '600' },
  yongShenValue:{ fontSize: 13, color: C.goldSoft, fontWeight: '700' },

  // Snapshot card
  snapshotCard: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.gold + '55',
  },
  snapshotTitle: { fontSize: 10, fontWeight: '900', color: C.gold, letterSpacing: 1.5, marginBottom: 12 },
  snapshotRow:   { marginBottom: 8 },
  snapshotLabel: { fontSize: 10, color: C.textFaint, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  snapshotValue: { fontSize: 14, color: C.text, lineHeight: 21, fontWeight: '500' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: C.textFaint, letterSpacing: 1.5, marginTop: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  infoBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  infoBtnText: { fontSize: 14, color: C.textFaint, lineHeight: 18 },
  dayMasterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  pillarsContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  pillarCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  pillarColLabel:     { fontSize: 8, color: C.textFaint, textAlign: 'center', lineHeight: 13, marginBottom: 8 },
  pillarColStem:      { fontSize: 28, fontWeight: '900' },
  pillarColDivider:   { width: 20, height: 1, borderTopWidth: 1, marginVertical: 6 },
  pillarColBranch:    { fontSize: 28, fontWeight: '900', color: C.text },
  voidBranchText:     { opacity: 0.45 },
  voidBadge:          { position: 'absolute', top: -4, right: -4, backgroundColor: C.textFaint, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  voidBadgeText:      { fontSize: 8, color: C.bg, fontWeight: '900' },
  pillarColAnimal:    { fontSize: 9, color: C.textFaint, marginTop: 4 },
  pillarColGod:       { fontSize: 10, fontWeight: '700', marginTop: 4 },
  pillarColHiddenGod: { fontSize: 9, color: C.textFaint, marginTop: 2, fontStyle: 'italic' },
  estimatedBadge: {
    backgroundColor: C.amber + '33',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 4,
  },
  estimatedBadgeText: { fontSize: 8, color: C.amber, fontWeight: '900' },
  hourEstimatedNote:  {
    fontSize: 12, color: C.amber, lineHeight: 18, marginBottom: 16,
    paddingHorizontal: 4, opacity: 0.85,
  },

  // Stem Combinations
  comboCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.border, gap: 8,
  },
  comboRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comboStems:     { fontSize: 15, fontWeight: '700' },
  comboPositions: { fontSize: 11, color: C.textFaint },

  // Luck Pillars
  lpScroll:        { marginBottom: 20 },
  lpScrollContent: { paddingHorizontal: 2, gap: 10 },
  lpCard: {
    width: 64, alignItems: 'center', backgroundColor: C.surface, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 4, borderWidth: 1, borderColor: C.border, gap: 2,
  },
  lpCardActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  lpActiveTag:  { fontSize: 7, fontWeight: '900', color: C.gold, letterSpacing: 0.5, marginBottom: 2 },
  lpStem:       { fontSize: 22, fontWeight: '900', color: C.textMuted },
  lpDivider:    { width: 16, height: 1, borderTopWidth: 1, marginVertical: 4 },
  lpBranch:     { fontSize: 22, fontWeight: '900', color: C.text },
  lpAge:        { fontSize: 10, color: C.textFaint, marginTop: 4, fontWeight: '700' },

  // LP Missing card
  lpMissingCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  lpMissingTitle: { fontSize: 13, fontWeight: '800', color: C.textMuted, marginBottom: 6 },
  lpMissingDesc:  { fontSize: 13, color: C.textFaint, lineHeight: 20 },

  // Void Branches
  voidCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  voidBranchRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  voidBranchChip:    { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.textFaint },
  voidBranchChipText:{ fontSize: 22, fontWeight: '900', color: C.textFaint },
  voidBranchChipSub: { fontSize: 9, color: C.textFaint, marginTop: 2 },
  voidNote:          { fontSize: 12, color: C.textFaint, lineHeight: 18 },

  narasiHint: { fontSize: 13, color: C.textFaint, marginBottom: 10, fontStyle: 'italic' },
  narasiButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: 8 },
  narasiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface,
  },
  narasiBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  narasiBtnIcon:   { fontSize: 14, color: C.textMuted },
  narasiBtnText:   { fontSize: 13, fontWeight: '700', color: C.textMuted },
  cachedDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold, marginLeft: 2 },

  narasiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 },
  narasiLoadingText:{ color: C.textMuted, fontSize: 13 },

  narasiBox: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3, borderLeftColor: C.gold, borderRadius: 14,
    padding: 16, marginBottom: 20,
  },
  narasiBoxError:  { borderLeftColor: '#c0392b', borderColor: '#c0392b44' },
  narasiBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  narasiBoxLabel:  { fontSize: 11, fontWeight: '900', color: C.gold, letterSpacing: 0.8 },
  narasiBoxText:   { fontSize: 14, lineHeight: 24, color: C.text },
  narasiErrorText: { color: '#e07070', fontSize: 13 },
  retryBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: '#c0392b88', backgroundColor: '#c0392b22',
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: '#e07070' },

  birthCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  birthTitle: { fontSize: 11, fontWeight: '700', color: C.textFaint, letterSpacing: 0.8, marginBottom: 6 },
  birthValue: { fontSize: 14, color: C.textMuted, lineHeight: 22 },

  resetBtn: {
    borderWidth: 1.5, borderColor: C.red, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  resetBtnText: { color: C.red, fontWeight: '700', fontSize: 14 },

  // Profile switcher
  profileSwitcherRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  profileSwitcherBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flex: 1, marginRight: 8,
  },
  profileSwitcherName: { fontSize: 14, fontWeight: '700', color: C.gold, flex: 1 },
  profileSwitcherChevron: { fontSize: 12, color: C.gold },
  addProfileBtn: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.gold + '88',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  addProfileBtnText: { fontSize: 13, fontWeight: '700', color: C.goldSoft },

  // Profile switcher modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  profileModal: {
    backgroundColor: C.surface, borderRadius: 16, padding: 20,
    width: '85%', borderWidth: 1, borderColor: C.border,
  },
  profileModalTitle: { fontSize: 14, fontWeight: '900', color: C.gold, marginBottom: 14, letterSpacing: 1 },
  profileModalItem: { marginBottom: 8 },
  profileModalItemInner: { paddingVertical: 8, paddingHorizontal: 4 },
  profileModalName: { fontSize: 15, fontWeight: '700', color: C.text },
  profileModalEdit: { fontSize: 10, color: C.textFaint, marginTop: 2 },
  profileNicknameInput: {
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.gold,
    borderRadius: 8, padding: 8, color: C.text, fontSize: 14,
  },
  profileModalClose: {
    marginTop: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  profileModalCloseText: { color: C.textMuted, fontWeight: '700', fontSize: 14 },

  // Special Stars
  starsCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.border, gap: 10,
  },
  starRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8,
  },
  starRowActive: { backgroundColor: C.surfaceHigh },
  starLeft:      { flex: 1, marginRight: 8 },
  starLabel:     { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  starBranches:  { fontSize: 11, color: C.textFaint, fontWeight: '600' },
  starRight:     { flex: 1.5, alignItems: 'flex-end' },
  starStatus:    { fontSize: 11, fontWeight: '900', letterSpacing: 0.3, marginBottom: 3 },
  starDesc:      { fontSize: 10, color: C.textFaint, textAlign: 'right', lineHeight: 14 },
  starsInfoBtn:  { paddingTop: 6, paddingBottom: 2, alignItems: 'center' },
  starsInfoBtnText: { fontSize: 11, color: C.textFaint, fontStyle: 'italic' },

  // Life stage in pillar/LP
  pillarColLifeStage: { fontSize: 9, color: C.teal, marginTop: 3, fontWeight: '700' },
  lpLifeStage: { fontSize: 9, color: C.textFaint, marginTop: 2, fontWeight: '700' },

  // Share + Compare buttons
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  shareBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.gold + '88', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', backgroundColor: C.surfaceHigh,
  },
  shareBtnText: { color: C.goldSoft, fontWeight: '700', fontSize: 14 },
  compareBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.teal + '88', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', backgroundColor: C.surfaceHigh,
  },
  compareBtnText: { color: C.teal, fontWeight: '700', fontSize: 14 },

  // Compare modal
  compareModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  compareModal: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.border, maxHeight: '85%',
  },
  compareModalTitle: { fontSize: 15, fontWeight: '900', color: C.gold, letterSpacing: 1, marginBottom: 14 },
  compareSelectLabel: { fontSize: 12, color: C.textMuted, fontWeight: '700', marginBottom: 8 },
  compareProfileBtn: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, marginBottom: 8,
  },
  compareProfileBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  compareProfileBtnText: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  compareRunBtn: {
    backgroundColor: C.gold, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  compareRunBtnText: { color: C.bg, fontWeight: '900', fontSize: 14 },
  compareNarasiText: { fontSize: 14, color: C.text, lineHeight: 23 },
  compareCloseBtn: {
    marginTop: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  compareCloseBtnText: { color: C.textMuted, fontWeight: '700', fontSize: 14 },

  // Notification toggle
  notifRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  notifLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  notifSub:   { fontSize: 11, color: C.textFaint },
  notifPill: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: C.border, justifyContent: 'center', padding: 2,
  },
  notifPillOn: { backgroundColor: C.teal },
  notifThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.textFaint,
    alignSelf: 'flex-start',
  },
  notifThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // Onboarding
  onboardRoot: {
    flex: 1, backgroundColor: C.bg, justifyContent: 'space-between',
  },
  onboardSlide: {
    flex: 1, paddingHorizontal: 32, paddingTop: 100, paddingBottom: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  onboardIcon: {
    fontSize: 72, color: C.gold, marginBottom: 32, textAlign: 'center',
  },
  onboardTitle: {
    fontSize: 22, fontWeight: '900', color: C.text,
    textAlign: 'center', letterSpacing: 0.5, marginBottom: 20,
    lineHeight: 30,
  },
  onboardBody: {
    fontSize: 15, color: C.textMuted, textAlign: 'center',
    lineHeight: 24, maxWidth: 340,
  },
  onboardDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 20, gap: 8,
  },
  onboardDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.border,
  },
  onboardDotActive: {
    width: 24, backgroundColor: C.gold,
  },
  onboardActions: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32, paddingBottom: 48, paddingTop: 8,
  },
  onboardSkip: { paddingVertical: 14, paddingHorizontal: 8 },
  onboardSkipText: { color: C.textFaint, fontSize: 15, fontWeight: '700' },
  onboardNext: {
    backgroundColor: C.gold, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 14,
  },
  onboardNextText: { color: C.bg, fontWeight: '900', fontSize: 15 },
  onboardStart: {
    flex: 1, backgroundColor: C.gold, paddingVertical: 16,
    borderRadius: 14, alignItems: 'center',
  },
  onboardStartText: { color: C.bg, fontWeight: '900', fontSize: 16 },

  // Story swipe cards
  storyContainer: { marginBottom: 20 },
  storyFlatList:  { },
  storyCard: {
    width: SCREEN_W - 32,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.gold + '55',
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    minHeight: 200,
  },
  storyCardNum:      { fontSize: 10, color: C.textFaint, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  storyCardTitle:    { fontSize: 16, fontWeight: '900', color: C.gold, marginBottom: 4 },
  storyCardSubtitle: { fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 14 },
  storyCardText:     { fontSize: 14, color: C.text, lineHeight: 23 },
  storyDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingTop: 12,
  },
  storyDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  storyDotActive: { width: 18, backgroundColor: C.gold },

  // Simple mode pillar display
  pillarStemSimple:   { fontSize: 11, fontWeight: '700', color: C.gold, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  pillarBranchSimple: { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center', marginTop: 4, lineHeight: 16 },

  // Mode Awam toggle
  simpleModeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
});
