import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, Platform, Image,
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

const GENDERS = [
  { label: 'Pria',   value: 'male'   },
  { label: 'Wanita', value: 'female' },
];

const PILLAR_LABEL: Record<string, string> = {
  year: '年\nTAHUN', month: '月\nBULAN', day: '日\nHARI', hour: '時\nJAM',
};

const NARASI_SECTIONS = [
  { key: 'full_analysis', label: 'Analisis Lengkap', icon: '◉' },
];

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

export default function ProfileScreen() {
  const { chartId, timezone, setChart, clearChart, loading: ctxLoading } = useChart();

  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [tz,          setTz]          = useState('Asia/Jakarta');
  const [gender,      setGender]      = useState<string | null>(null);
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
        gender:         gender ?? undefined,
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

  const generateNarasi = async (section: string, forceRefresh = false) => {
    if (!chartId) return;
    setActiveSection(section);
    if (!forceRefresh && cachedSections[section]) {
      setNarasi(cachedSections[section]);
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
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setNarasi(detail ?? 'Gagal menghasilkan narasi. Silakan coba lagi.');
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

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Jenis Kelamin <Text style={styles.optionalTag}>(untuk Luck Pillars)</Text></Text>
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
  const voidBranches: string[] = chartData?.void_branches ?? [];
  const stemCombos: any[] = chartData?.stem_combinations ?? [];
  const luckPillars: any[] = chartData?.luck_pillars ?? [];
  const activeLp: any = chartData?.active_luck_pillar ?? null;
  const hiddenTg: Record<string, any[]> = chartData?.hidden_ten_gods ?? {};

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
            const geJu    = chartData.ge_ju;
            const yongShen = chartData.yong_shen;
            return (
              <View style={[styles.dayMasterCard, { borderColor: stemCol }]}>
                <Text style={[styles.dayMasterChar, { color: stemCol }]}>{dayStem}</Text>
                <View style={styles.dayMasterInfo}>
                  <Text style={styles.dayMasterEl}>{stemEl}</Text>
                  <Text style={styles.dayMasterLabel}>Day Master</Text>
                  <View style={styles.dayMasterBadges}>
                    <View style={[styles.strengthBadge, { borderColor: stemCol }]}>
                      <Text style={[styles.strengthText, { color: stemCol }]}>
                        {chartData.day_master_strength ?? '-'}
                      </Text>
                    </View>
                    {geJu && (
                      <View style={styles.geJuBadge}>
                        <Text style={styles.geJuText}>{geJu}</Text>
                      </View>
                    )}
                  </View>
                  {yongShen && (
                    <Text style={styles.yongShenRow}>
                      <Text style={styles.yongShenLabel}>用神 </Text>
                      <Text style={styles.yongShenValue}>{yongShen}</Text>
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Four Pillars */}
          <Text style={styles.sectionLabel}>EMPAT PILAR</Text>
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
              return (
                <View key={p} style={[styles.pillarCol, isDay && { backgroundColor: C.surfaceHigh }]}>
                  <Text style={styles.pillarColLabel}>{PILLAR_LABEL[p]}</Text>
                  <Text style={[styles.pillarColStem, { color: isDay ? C.goldSoft : stemCol }]}>{stem}</Text>
                  <View style={[styles.pillarColDivider, { borderColor: isDay ? C.gold : C.border }]} />
                  <View style={{ position: 'relative', alignItems: 'center' }}>
                    <Text style={[styles.pillarColBranch, isDay && { color: C.goldSoft }, isVoid && styles.voidBranchText]}>
                      {branch}
                    </Text>
                    {isVoid && (
                      <View style={styles.voidBadge}>
                        <Text style={styles.voidBadgeText}>空</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pillarColAnimal}>{animal}</Text>
                  <Text style={[styles.pillarColGod, { color: isDay ? C.gold : C.textMuted }]}>{tenGod}</Text>
                  {dominantHidden && (
                    <Text style={styles.pillarColHiddenGod} numberOfLines={1}>
                      藏{dominantHidden.ten_god}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Stem Combinations */}
          {stemCombos.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>天干合 STEM COMBINATIONS</Text>
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
          {luckPillars.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>大運 LUCK PILLARS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lpScroll} contentContainerStyle={styles.lpScrollContent}>
                {luckPillars.map((lp: any, idx: number) => {
                  const isActive = activeLp?.order_index === lp.order_index;
                  const stemCol  = STEM_COLOR[lp.stem] ?? C.textMuted;
                  return (
                    <View key={idx} style={[styles.lpCard, isActive && styles.lpCardActive]}>
                      {isActive && <Text style={styles.lpActiveTag}>AKTIF</Text>}
                      <Text style={[styles.lpStem, { color: isActive ? stemCol : C.textMuted }]}>{lp.stem}</Text>
                      <View style={[styles.lpDivider, { borderColor: isActive ? C.gold : C.border }]} />
                      <Text style={[styles.lpBranch, isActive && { color: C.goldSoft }]}>{lp.branch}</Text>
                      <Text style={[styles.lpAge, isActive && { color: C.gold }]}>{lp.age_start}岁</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Void Branches info */}
          {voidBranches.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>空亡 VOID BRANCHES</Text>
              <View style={styles.voidCard}>
                <View style={styles.voidBranchRow}>
                  {voidBranches.map(b => (
                    <View key={b} style={styles.voidBranchChip}>
                      <Text style={styles.voidBranchChipText}>{b}</Text>
                      <Text style={styles.voidBranchChipSub}>{BRANCH_ANIMAL[b] ?? ''}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.voidNote}>Ten God di branch ini cenderung kehilangan efektivitas</Text>
              </View>
            </>
          )}

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
            <View style={[styles.narasiBox, isNarasiError(narasi) && styles.narasiBoxError]}>
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
              {chartData.gender ? ` · ${chartData.gender === 'male' ? 'Pria' : 'Wanita'}` : ''}
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
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },

  tzRow:       { gap: 8 },
  tzBtn:       { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12 },
  tzBtnActive: { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  tzLabel:     { fontSize: 15, fontWeight: '700', color: C.textMuted },
  tzSub:       { fontSize: 12, color: C.textFaint, marginTop: 2 },

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
  strengthBadge:  {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  strengthText: { fontSize: 13, fontWeight: '700' },
  geJuBadge: {
    borderWidth: 1,
    borderColor: C.textFaint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  geJuText: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  yongShenRow:  { marginTop: 4 },
  yongShenLabel:{ fontSize: 11, color: C.textFaint, fontWeight: '600' },
  yongShenValue:{ fontSize: 13, color: C.goldSoft, fontWeight: '700' },

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

  // Stem Combinations
  comboCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  comboRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comboStems:     { fontSize: 15, fontWeight: '700' },
  comboPositions: { fontSize: 11, color: C.textFaint },

  // Luck Pillars
  lpScroll:        { marginBottom: 20 },
  lpScrollContent: { paddingHorizontal: 2, gap: 10 },
  lpCard: {
    width: 64,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
  },
  lpCardActive: {
    borderColor: C.gold,
    backgroundColor: C.surfaceHigh,
  },
  lpActiveTag: { fontSize: 7, fontWeight: '900', color: C.gold, letterSpacing: 0.5, marginBottom: 2 },
  lpStem:      { fontSize: 22, fontWeight: '900', color: C.textMuted },
  lpDivider:   { width: 16, height: 1, borderTopWidth: 1, marginVertical: 4 },
  lpBranch:    { fontSize: 22, fontWeight: '900', color: C.text },
  lpAge:       { fontSize: 10, color: C.textFaint, marginTop: 4, fontWeight: '700' },

  // Void Branches
  voidCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  voidBranchRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  voidBranchChip:    { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.textFaint },
  voidBranchChipText:{ fontSize: 22, fontWeight: '900', color: C.textFaint },
  voidBranchChipSub: { fontSize: 9, color: C.textFaint, marginTop: 2 },
  voidNote:          { fontSize: 12, color: C.textFaint, lineHeight: 18 },

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
  narasiBoxError:  { borderLeftColor: '#c0392b', borderColor: '#c0392b44' },
  narasiBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  narasiBoxLabel:  { fontSize: 11, fontWeight: '900', color: C.gold, letterSpacing: 0.8 },
  narasiBoxText:   { fontSize: 14, lineHeight: 24, color: C.text },
  narasiErrorText: { color: '#e07070', fontSize: 13 },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c0392b88',
    backgroundColor: '#c0392b22',
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: '#e07070' },

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
