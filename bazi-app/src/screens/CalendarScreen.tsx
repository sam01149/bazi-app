import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';
import { C, STEM_COLOR, STEM_ELEMENT, BRANCH_ANIMAL, BRANCH_ELEMENT } from '../theme';

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

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_W - 32) / 7);

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
  // Track which date narasi was last requested for, to discard stale responses
  const narasi_dateRef = useRef<string>('');

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
      // Only update if user is still on the same date
      if (narasi_dateRef.current === dateStr) {
        setCalNarasi(res.data.narasi);
      }
    } catch (err: any) {
      if (narasi_dateRef.current === dateStr) {
        const detail = err?.response?.data?.detail;
        setCalNarasi(detail ?? 'Gagal memuat penjelasan. Coba lagi.');
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
      // Fetch AI narasi in parallel (doesn't block main data display)
      if (chartId) loadCalNarasi(dateStr);
    } catch {
      setDayError('Gagal memuat data. Pastikan backend berjalan.');
    } finally {
      setDayLoading(false);
    }
  }, [chartId, timezone, todayStr, loadCalNarasi]);

  useEffect(() => {
    if (!ctxLoading) loadDayData(todayStr);
  }, [ctxLoading, loadDayData]);

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

  const cells = buildCalendarDays(viewYear, viewMonth);
  const interactions: any[] = dayData?.interactions ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Month navigator ── */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS_ID[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
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
          if (!day) return <View key={idx} style={{ width: CELL_W, height: 40 }} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday    = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isSunday   = idx % 7 === 0;
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
                isSunday && { color: C.red },
                isToday  && { color: C.bg, fontWeight: '900' },
                isSelected && !isToday && { color: C.goldSoft },
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Selected date detail ── */}
      <View style={styles.detailSection}>
        <Text style={styles.selectedDateLabel}>{formatDateLong(selectedDate)}</Text>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  container: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

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

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { width: CELL_W, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.textMuted, paddingVertical: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  dayCell: {
    width: CELL_W,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dayCellToday:    { backgroundColor: C.gold },
  dayCellSelected: { backgroundColor: C.surfaceHigh },
  dayNum: { fontSize: 14, color: C.text, fontWeight: '500' },

  detailSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 20,
  },
  selectedDateLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text,
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 },
  loadingText: { color: C.textMuted, fontSize: 14 },
  errorCard:   { backgroundColor: C.surface, borderRadius: 12, padding: 16 },
  errorText:   { color: C.red, fontSize: 14, textAlign: 'center' },

  // Pillars
  pillarsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pillarCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
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
    fontSize: 13,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  interactCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  interactHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  interactBadge:  {
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  interactBranches: { fontSize: 13, color: C.textMuted, fontWeight: '600' },
  interactDesc:     { fontSize: 13, color: C.text, lineHeight: 20 },

  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: { color: C.textMuted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

  // AI narasi
  narasiLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingLeft: 2,
  },
  narasiLoadingText: { color: C.textMuted, fontSize: 13 },

  narasiBox: {
    marginTop: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 12,
    padding: 14,
  },
  narasiBoxError:  { borderLeftColor: '#c0392b', borderColor: '#c0392b44' },
  narasiBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  narasiBoxLabel:  { fontSize: 11, fontWeight: '900', color: C.gold, letterSpacing: 0.8 },
  narasiText:      { fontSize: 13, lineHeight: 22, color: C.text },
  narasiErrorText: { color: '#e07070' },

  retryBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
    borderColor: '#c0392b88', backgroundColor: '#c0392b22',
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: '#e07070' },

  noChartCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  noChartText: { color: C.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 22 },
});
