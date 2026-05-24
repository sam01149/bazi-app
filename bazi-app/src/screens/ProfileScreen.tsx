import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, Platform,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';
import { C, STEM_COLOR, STEM_ELEMENT, BRANCH_ANIMAL } from '../theme';

const TIMEZONES = [
  { label: 'WIB',  sub: 'Jakarta · Sumatera',  value: 'Asia/Jakarta'  },
  { label: 'WITA', sub: 'Bali · Makassar',      value: 'Asia/Makassar' },
  { label: 'WIT',  sub: 'Jayapura · Papua',     value: 'Asia/Jayapura' },
];

const PILLAR_LABEL: Record<string, string> = {
  year: '年\nTAHUN', month: '月\nBULAN', day: '日\nHARI', hour: '時\nJAM',
};

const NARASI_SECTIONS = [
  { key: 'daymaster',    label: 'Kepribadian', icon: '◉' },
  { key: 'career',       label: 'Karir',       icon: '◈' },
  { key: 'wealth',       label: 'Kekayaan',    icon: '◆' },
  { key: 'relationship', label: 'Hubungan',    icon: '◍' },
  { key: 'strengths',    label: 'Kekuatan',    icon: '◐' },
];

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

export default function ProfileScreen() {
  const { chartId, timezone, setChart, clearChart, loading: ctxLoading } = useChart();

  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [tz,          setTz]          = useState('Asia/Jakarta');
  const [unknownHour, setUnknownHour] = useState(false);
  const [calculating, setCalculating] = useState(false);

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
      // silent
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ctxLoading && chartId) loadProfile(chartId);
  }, [ctxLoading, chartId, loadProfile]);

  const handleCalculate = async () => {
    if (!date) {
      Alert.alert('Tanggal Diperlukan', 'Pilih tanggal lahir terlebih dahulu.');
      return;
    }
    if (!unknownHour && !time) {
      Alert.alert('Waktu Diperlukan', 'Pilih waktu lahir atau aktifkan "Jam Tidak Diketahui".');
      return;
    }
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
    const doReset = async () => {
      await clearChart();
      setChartData(null);
      setCachedSections({});
      setNarasi('');
      setActiveSection('');
    };

    if (Platform.OS === 'web') {
      // Alert.alert multi-button doesn't work on React Native Web
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
        <View style={styles.setupHero}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <img src={require('../../assets/logo.svg')} style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 16 }} alt="logo" />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={styles.logoChar}>☯</Text></View>
          )}
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

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Jam Tidak Diketahui</Text>
              <Text style={styles.fieldHint}>Pakai tengah hari sebagai default</Text>
            </View>
            <Switch
              value={unknownHour}
              onValueChange={setUnknownHour}
              trackColor={{ false: C.border, true: C.gold }}
              thumbColor={unknownHour ? C.bg : C.textMuted}
            />
          </View>

          {!unknownHour && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Waktu Lahir</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Zona Waktu</Text>
          <View style={styles.tzRow}>
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
                  <Text style={[styles.tzSub, active && { color: C.textMuted }]}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.profileContainer} showsVerticalScrollIndicator={false}>
      {profileLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Memuat profil…</Text>
        </View>
      ) : chartData ? (
        <>
          {/* Day Master Hero */}
          {(() => {
            const dayStem = chartData.pillars?.day?.stem ?? '';
            const stemCol = STEM_COLOR[dayStem] ?? C.gold;
            const stemEl  = STEM_ELEMENT[dayStem] ?? '';
            return (
              <View style={[styles.dayMasterCard, { borderColor: stemCol }]}>
                <Text style={[styles.dayMasterChar, { color: stemCol }]}>{dayStem}</Text>
                <View style={styles.dayMasterInfo}>
                  <Text style={styles.dayMasterEl}>{stemEl}</Text>
                  <Text style={styles.dayMasterLabel}>Day Master</Text>
                  <View style={[styles.strengthBadge, { borderColor: stemCol }]}>
                    <Text style={[styles.strengthText, { color: stemCol }]}>
                      {chartData.day_master_strength ?? '-'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Four Pillars */}
          <Text style={styles.sectionLabel}>EMPAT PILAR</Text>
          <View style={styles.pillarsContainer}>
            {(['year', 'month', 'day', 'hour'] as const).map(p => {
              const pillar = chartData.pillars?.[p];
              const stem   = pillar?.stem ?? '-';
              const branch = pillar?.branch ?? '-';
              const isDay  = p === 'day';
              const stemCol = STEM_COLOR[stem] ?? C.gold;
              const tenGod = isDay ? '日主' : (chartData.ten_gods?.[`${p}_stem`] ?? '-');
              const animal = BRANCH_ANIMAL[branch] ?? '';
              return (
                <View key={p} style={[styles.pillarCol, isDay && { backgroundColor: C.surfaceHigh }]}>
                  <Text style={styles.pillarColLabel}>{PILLAR_LABEL[p]}</Text>
                  <Text style={[styles.pillarColStem, { color: isDay ? C.goldSoft : stemCol }]}>{stem}</Text>
                  <View style={[styles.pillarColDivider, { borderColor: isDay ? C.gold : C.border }]} />
                  <Text style={[styles.pillarColBranch, isDay && { color: C.goldSoft }]}>{branch}</Text>
                  <Text style={styles.pillarColAnimal}>{animal}</Text>
                  <Text style={[styles.pillarColGod, { color: isDay ? C.gold : C.textMuted }]}>{tenGod}</Text>
                </View>
              );
            })}
          </View>

          {/* Narasi sections */}
          <Text style={styles.sectionLabel}>INTERPRETASI</Text>
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

          {!!narasi && !narasiLoading && (
            <View style={styles.narasiBox}>
              <Text style={styles.narasiBoxLabel}>
                {NARASI_SECTIONS.find(s => s.key === activeSection)?.label}
              </Text>
              <Text style={styles.narasiBoxText}>{narasi}</Text>
            </View>
          )}

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
            </Text>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={confirmReset} activeOpacity={0.8}>
            <Text style={styles.resetBtnText}>Reset Profil</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Gagal memuat profil. Cek koneksi backend.</Text>
        </View>
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
  setupHero:   { alignItems: 'center', marginBottom: 28 },
  logoPlaceholder: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  logoChar:      { fontSize: 36 },
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
  fieldHint:  { fontSize: 12, color: C.textMuted, marginTop: -6 },
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
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },

  tzRow:       { gap: 8 },
  tzBtn:       { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12 },
  tzBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  tzLabel:     { fontSize: 15, fontWeight: '700', color: C.textMuted },
  tzSub:       { fontSize: 12, color: C.textFaint, marginTop: 2 },

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
    alignItems: 'center',
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
  strengthBadge:  {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  strengthText: { fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textFaint,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },

  pillarsContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  pillarCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  pillarColLabel:  { fontSize: 8, color: C.textFaint, textAlign: 'center', lineHeight: 13, marginBottom: 8 },
  pillarColStem:   { fontSize: 28, fontWeight: '900' },
  pillarColDivider:{ width: 20, height: 1, borderTopWidth: 1, marginVertical: 6 },
  pillarColBranch: { fontSize: 28, fontWeight: '900', color: C.text },
  pillarColAnimal: { fontSize: 9, color: C.textFaint, marginTop: 4 },
  pillarColGod:    { fontSize: 10, fontWeight: '700', marginTop: 4 },

  narasiButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  narasiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  narasiBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  narasiBtnIcon:   { fontSize: 14, color: C.textMuted },
  narasiBtnText:   { fontSize: 13, fontWeight: '700', color: C.textMuted },
  cachedDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold, marginLeft: 2 },

  narasiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 },
  narasiLoadingText:{ color: C.textMuted, fontSize: 13 },

  narasiBox: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  narasiBoxLabel: { fontSize: 11, fontWeight: '900', color: C.gold, marginBottom: 10, letterSpacing: 0.8 },
  narasiBoxText:  { fontSize: 14, lineHeight: 24, color: C.text },

  birthCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  birthTitle: { fontSize: 11, fontWeight: '700', color: C.textFaint, letterSpacing: 0.8, marginBottom: 6 },
  birthValue: { fontSize: 14, color: C.textMuted, lineHeight: 22 },

  resetBtn: {
    borderWidth: 1.5,
    borderColor: C.red,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  resetBtnText: { color: C.red, fontWeight: '700', fontSize: 14 },
});
