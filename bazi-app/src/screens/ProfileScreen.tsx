import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, Platform,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';

const C = {
  bgDeep:  '#070F2B',
  bgCard:  '#0D1F4E',
  bgInput: '#091640',
  border:  '#1E3A80',
  gold:    '#F8D21B',
  white:   '#FFFFFF',
  muted:   '#8BAAD4',
  faint:   '#3A5A9A',
  error:   '#FF6B6B',
};

const TIMEZONES = [
  { label: 'WIB',  sub: 'Jakarta · Sumatera',    value: 'Asia/Jakarta'  },
  { label: 'WITA', sub: 'Bali · Makassar',        value: 'Asia/Makassar' },
  { label: 'WIT',  sub: 'Jayapura · Papua',       value: 'Asia/Jayapura' },
];

const PILLAR_LABELS: Record<string, string> = {
  year: '年\nTAHUN', month: '月\nBULAN', day: '日\nHARI', hour: '時\nJAM',
};

const NARASI_SECTIONS = [
  { key: 'daymaster',    label: 'Kepribadian' },
  { key: 'career',       label: 'Karir' },
  { key: 'wealth',       label: 'Kekayaan' },
  { key: 'relationship', label: 'Hubungan' },
  { key: 'strengths',    label: 'Kekuatan & Kelemahan' },
];

function WebDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      max={new Date().toISOString().split('T')[0]}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px',
        backgroundColor: C.bgInput,
        color: value ? C.white : C.muted,
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
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
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px',
        backgroundColor: C.bgInput,
        color: value ? C.white : C.muted,
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer', colorScheme: 'dark',
      }}
    />
  );
}

export default function ProfileScreen() {
  const { chartId, timezone, setChart, clearChart, loading: ctxLoading } = useChart();

  // Onboarding state
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [tz,          setTz]          = useState('Asia/Jakarta');
  const [unknownHour, setUnknownHour] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Profile state
  const [chartData,      setChartData]      = useState<any>(null);
  const [cachedSections, setCachedSections] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeSection,  setActiveSection]  = useState('');
  const [narasiLoading,  setNarasiLoading]  = useState(false);
  const [narasi,         setNarasi]         = useState('');

  const loadProfile = useCallback(async (id: string) => {
    setProfileLoading(true);
    try {
      const res = await axios.get(`${API_URL}/profile/${id}`);
      setChartData(res.data.chart);
      setCachedSections(res.data.cached_sections ?? {});
    } catch {
      // silent — might just be first time
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ctxLoading && chartId) loadProfile(chartId);
  }, [ctxLoading, chartId, loadProfile]);

  const handleCalculate = async () => {
    if (!date) { Alert.alert('Tanggal Diperlukan', 'Pilih tanggal lahir terlebih dahulu.'); return; }
    if (!unknownHour && !time) { Alert.alert('Waktu Diperlukan', 'Pilih waktu lahir atau aktifkan "Jam Tidak Diketahui".'); return; }
    setCalculating(true);
    try {
      const res = await axios.post(`${API_URL}/charts/calculate`, {
        birth_date:     date,
        birth_time:     unknownHour ? null : `${time}:00`,
        birth_timezone: tz,
      });
      await setChart(res.data.id, tz);
      setChartData(res.data);
      setCachedSections({});
    } catch {
      Alert.alert('Gagal', `Tidak dapat menghitung chart. Pastikan backend berjalan di ${API_URL}`);
    } finally {
      setCalculating(false);
    }
  };

  const generateNarasi = async (section: string) => {
    if (!chartId) return;
    setActiveSection(section);

    // Use cached if available
    if (cachedSections[section]) {
      setNarasi(cachedSections[section]);
      return;
    }

    setNarasiLoading(true);
    setNarasi('');
    try {
      const res = await axios.post(`${API_URL}/narasi/generate`, { chart_id: chartId, section });
      setNarasi(res.data.narasi);
      setCachedSections(prev => ({ ...prev, [section]: res.data.narasi }));
    } catch {
      setNarasi('Gagal menghasilkan narasi. Silakan coba lagi.');
    } finally {
      setNarasiLoading(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset Profil',
      'Ini akan menghapus data profil dari perangkat ini (chart di server tetap ada). Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await clearChart();
            setChartData(null);
            setCachedSections({});
            setNarasi('');
            setActiveSection('');
          },
        },
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

  // ── No chart yet — show setup form ──────────────────────────────────────────
  if (!chartId) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.setupHeader}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <img src={require('../../assets/logo.svg')} style={{ width: 80, height: 80, marginBottom: 12, borderRadius: 16 }} alt="logo" />
          ) : (
            <Text style={styles.headerIcon}>☯</Text>
          )}
          <Text style={styles.setupTitle}>Buat Profil BaZi</Text>
          <Text style={styles.setupSubtitle}>Masukkan data kelahiran untuk membaca empat pilar nasib kamu</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Tanggal Lahir</Text>
          {Platform.OS === 'web'
            ? <WebDateInput value={date} onChange={setDate} />
            : <TextInput style={[styles.input, !!date && styles.inputFilled]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.faint} keyboardType="numbers-and-punctuation" autoCorrect={false} />
          }

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Jam Tidak Diketahui</Text>
              <Text style={styles.hint}>Pakai tengah hari sebagai default</Text>
            </View>
            <Switch value={unknownHour} onValueChange={setUnknownHour} trackColor={{ false: C.border, true: C.gold }} thumbColor={unknownHour ? C.bgDeep : C.muted} />
          </View>

          {!unknownHour && (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Waktu Lahir</Text>
              {Platform.OS === 'web'
                ? <WebTimeInput value={time} onChange={setTime} />
                : <TextInput style={[styles.input, !!time && styles.inputFilled]} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={C.faint} keyboardType="numbers-and-punctuation" autoCorrect={false} />
              }
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Zona Waktu</Text>
          <View style={styles.tzRow}>
            {TIMEZONES.map((t) => {
              const active = tz === t.value;
              return (
                <TouchableOpacity key={t.value} style={[styles.tzBtn, active && styles.tzBtnActive]} onPress={() => setTz(t.value)}>
                  <Text style={[styles.tzLabel, active && styles.tzLabelActive]}>{t.label}</Text>
                  <Text style={[styles.tzSub,   active && styles.tzSubActive]}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={[styles.calcBtn, calculating && { opacity: 0.6 }]} onPress={handleCalculate} disabled={calculating} activeOpacity={0.85}>
          {calculating
            ? <ActivityIndicator color={C.bgDeep} />
            : <Text style={styles.calcBtnText}>Hitung BaZi Chart →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Profile loaded ───────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>

      {profileLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Memuat profil…</Text>
        </View>
      ) : chartData ? (
        <>
          {/* Pillars */}
          <Text style={styles.sectionTitle}>Empat Pilar Nasib</Text>
          <View style={styles.pillarsContainer}>
            {(['year', 'month', 'day', 'hour'] as const).map((p) => {
              const pillar = chartData.pillars?.[p];
              const tenGod = p === 'day' ? '日主' : (chartData.ten_gods?.[`${p}_stem`] || '-');
              const isDay = p === 'day';
              return (
                <View key={p} style={[styles.pillar, isDay && styles.pillarDay]}>
                  <Text style={styles.pillarLabel}>{PILLAR_LABELS[p]}</Text>
                  <Text style={[styles.stem, isDay && styles.stemDay]}>{pillar?.stem || '-'}</Text>
                  <View style={styles.divider} />
                  <Text style={[styles.branch, isDay && styles.branchDay]}>{pillar?.branch || '-'}</Text>
                  <Text style={styles.tenGod}>{tenGod}</Text>
                </View>
              );
            })}
          </View>

          {/* Strength */}
          <View style={styles.strengthCard}>
            <Text style={styles.strengthLabel}>Kekuatan Day Master</Text>
            <Text style={styles.strengthValue}>{chartData.day_master_strength ?? '-'}</Text>
          </View>

          {/* Ten Gods summary */}
          {chartData.ten_gods && Object.keys(chartData.ten_gods).length > 0 && (
            <View style={styles.tenGodsCard}>
              <Text style={styles.tenGodsTitle}>Ten Gods</Text>
              <View style={styles.tenGodsRow}>
                {Object.entries(chartData.ten_gods as Record<string, string>).map(([pos, god]) => (
                  <View key={pos} style={styles.tenGodItem}>
                    <Text style={styles.tenGodPos}>{pos.replace('_stem', '').toUpperCase()}</Text>
                    <Text style={styles.tenGodVal}>{god}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerText}>
              Interpretasi menggunakan framework 子平真詮 (Zi Ping Zhen Quan). Ini adalah kecenderungan dan pola, bukan prediksi absolut.
            </Text>
          </View>

          {/* AI Narasi sections */}
          <Text style={styles.sectionTitle}>Interpretasi Lengkap</Text>
          <View style={styles.sectionButtons}>
            {NARASI_SECTIONS.map((s) => {
              const active = activeSection === s.key;
              const isCached = !!cachedSections[s.key];
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.sectionBtn, active && styles.sectionBtnActive]}
                  onPress={() => generateNarasi(s.key)}
                  disabled={narasiLoading}
                >
                  <Text style={[styles.sectionBtnText, active && styles.sectionBtnTextActive]}>
                    {isCached ? '✓ ' : ''}{s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {narasiLoading && <ActivityIndicator style={{ marginVertical: 16 }} color={C.gold} />}
          {!!narasi && (
            <View style={styles.narasiBox}>
              <Text style={styles.narasiLabel}>
                {NARASI_SECTIONS.find(s => s.key === activeSection)?.label}
              </Text>
              <Text style={styles.narasiText}>{narasi}</Text>
            </View>
          )}

          {/* Birth info */}
          <View style={styles.birthInfoCard}>
            <Text style={styles.birthInfoTitle}>Data Kelahiran</Text>
            <Text style={styles.birthInfoText}>
              {chartData.birth_datetime
                ? new Date(chartData.birth_datetime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : '-'
              }
            </Text>
            <Text style={styles.birthInfoText}>{chartData.birth_timezone}</Text>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={confirmReset}>
            <Text style={styles.resetBtnText}>Reset Profil</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Gagal memuat profil. Cek koneksi ke backend.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: C.bgDeep, padding: 20, paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  loadingText: { color: C.muted, fontSize: 14 },
  errorText:   { color: C.error, textAlign: 'center', fontSize: 15 },

  // Setup / onboarding
  setupHeader: { alignItems: 'center', paddingVertical: 28 },
  headerIcon:  { fontSize: 52, marginBottom: 10 },
  setupTitle:  { fontSize: 26, fontWeight: '800', color: C.white, letterSpacing: 1 },
  setupSubtitle: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 280 },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  label:      { fontSize: 14, fontWeight: '700', color: C.white, marginBottom: 8 },
  hint:       { fontSize: 12, color: C.muted, marginTop: -4 },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 13,
    marginBottom: 20,
    borderRadius: 10,
    fontSize: 15,
    backgroundColor: C.bgInput,
    color: C.white,
  },
  inputFilled: { borderColor: C.gold },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  tzRow:   { gap: 10 },
  tzBtn:   { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12, backgroundColor: C.bgInput },
  tzBtnActive:   { borderColor: C.gold, backgroundColor: '#151F3E' },
  tzLabel:       { fontSize: 15, fontWeight: '700', color: C.muted },
  tzLabelActive: { color: C.gold },
  tzSub:         { fontSize: 12, color: C.faint, marginTop: 2 },
  tzSubActive:   { color: C.muted },
  calcBtn: {
    backgroundColor: C.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  calcBtnText: { color: C.bgDeep, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  // Profile view
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 12 },
  pillarsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    overflow: 'hidden',
  },
  pillar: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  pillarDay:  { backgroundColor: '#0F2860' },
  pillarLabel:{ fontSize: 9, color: C.faint, marginBottom: 8, textAlign: 'center', lineHeight: 14 },
  stem:       { fontSize: 30, fontWeight: '800', color: C.white, marginBottom: 4 },
  stemDay:    { color: C.gold },
  divider:    { width: 20, height: 1, backgroundColor: C.border, marginVertical: 4 },
  branch:     { fontSize: 30, fontWeight: '800', color: C.white },
  branchDay:  { color: C.gold },
  tenGod:     { fontSize: 11, color: C.gold, marginTop: 8, fontWeight: '600' },

  strengthCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  strengthLabel: { fontSize: 14, color: C.muted, fontWeight: '600' },
  strengthValue: { fontSize: 15, fontWeight: '800', color: C.gold },

  tenGodsCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  tenGodsTitle: { fontSize: 13, fontWeight: '800', color: C.muted, marginBottom: 10, letterSpacing: 0.5 },
  tenGodsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tenGodItem:   { alignItems: 'center', minWidth: 60 },
  tenGodPos:    { fontSize: 10, color: C.faint, marginBottom: 2 },
  tenGodVal:    { fontSize: 13, fontWeight: '700', color: C.gold },

  disclaimerCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  disclaimerText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', color: C.muted, lineHeight: 18 },

  sectionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sectionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bgCard,
  },
  sectionBtnActive:     { borderColor: C.gold, backgroundColor: '#151F3E' },
  sectionBtnText:       { color: C.muted, fontSize: 13, fontWeight: '600' },
  sectionBtnTextActive: { color: C.gold },

  narasiBox: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  narasiLabel: { fontSize: 12, fontWeight: '800', color: C.gold, marginBottom: 8, letterSpacing: 0.5 },
  narasiText:  { fontSize: 14, lineHeight: 24, color: C.white },

  birthInfoCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  birthInfoTitle:{ fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 6 },
  birthInfoText: { fontSize: 14, color: C.white, lineHeight: 22 },

  resetBtn: {
    borderWidth: 1.5,
    borderColor: C.error,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  resetBtnText: { color: C.error, fontWeight: '700', fontSize: 14 },
});
