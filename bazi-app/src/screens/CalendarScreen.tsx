import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Dimensions,
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
  clash:   '#FF6B6B',
  harm:    '#FF9F43',
  combo:   '#26D0CE',
  today:   '#1A2E70',
};

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

const ELEMENT_INFO: Record<string, { name: string; color: string }> = {
  甲: { name: 'Kayu Yang', color: '#4CAF50' },
  乙: { name: 'Kayu Yin',  color: '#81C784' },
  丙: { name: 'Api Yang',  color: '#F44336' },
  丁: { name: 'Api Yin',   color: '#EF9A9A' },
  戊: { name: 'Tanah Yang',color: '#FF9800' },
  己: { name: 'Tanah Yin', color: '#FFCC80' },
  庚: { name: 'Logam Yang',color: '#9E9E9E' },
  辛: { name: 'Logam Yin', color: '#CFD8DC' },
  壬: { name: 'Air Yang',  color: '#2196F3' },
  癸: { name: 'Air Yin',   color: '#90CAF9' },
};

const BRANCH_INFO: Record<string, { name: string; animal: string }> = {
  子: { name: 'Zi – Air',   animal: 'Tikus' },
  丑: { name: 'Chou – Tanah', animal: 'Kerbau' },
  寅: { name: 'Yin – Kayu',  animal: 'Harimau' },
  卯: { name: 'Mao – Kayu',  animal: 'Kelinci' },
  辰: { name: 'Chen – Tanah',animal: 'Naga' },
  巳: { name: 'Si – Api',    animal: 'Ular' },
  午: { name: 'Wu – Api',    animal: 'Kuda' },
  未: { name: 'Wei – Tanah', animal: 'Kambing' },
  申: { name: 'Shen – Logam',animal: 'Monyet' },
  酉: { name: 'You – Logam', animal: 'Ayam' },
  戌: { name: 'Xu – Tanah',  animal: 'Anjing' },
  亥: { name: 'Hai – Air',   animal: 'Babi' },
};

const INTERACTION_LABEL: Record<string, string> = {
  clash:           'BENTURAN',
  six_combination: 'KOMBINASI',
  harm:            'HAMBATAN',
  penalty:         'HUKUMAN',
  self_penalty:    'HUKUMAN DIRI',
};

const INTERACTION_COLOR: Record<string, string> = {
  clash:           '#FF6B6B',
  six_combination: '#26D0CE',
  harm:            '#FF9F43',
  penalty:         '#FF6B6B',
  self_penalty:    '#FF9F43',
};

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_W - 40) / 7);

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const { chartId, timezone, loading: ctxLoading } = useChart();
  const today = new Date();

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split('T')[0]
  );

  const [dayData,    setDayData]    = useState<any>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError,   setDayError]   = useState('');

  const [narasiToday,    setNarasiToday]    = useState('');
  const [narasiLoading,  setNarasiLoading]  = useState(false);

  const loadDayData = useCallback(async (dateStr: string, withNarasi: boolean) => {
    setDayLoading(true);
    setDayError('');
    setDayData(null);
    if (withNarasi) { setNarasiToday(''); setNarasiLoading(true); }
    try {
      const tz = encodeURIComponent(timezone);
      const cid = chartId ? `&chart_id=${chartId}` : '';
      const url = withNarasi
        ? `${API_URL}/calendar/current?timezone=${tz}${cid}`
        : `${API_URL}/calendar/date/${dateStr}?timezone=${tz}${cid}`;
      const res = await axios.get(url);
      setDayData(res.data);
      if (withNarasi && res.data.narasi) setNarasiToday(res.data.narasi);
    } catch {
      setDayError('Gagal memuat data. Pastikan backend berjalan.');
    } finally {
      setDayLoading(false);
      if (withNarasi) setNarasiLoading(false);
    }
  }, [chartId, timezone]);

  // Re-fetch when chart becomes available (AsyncStorage loads after mount)
  useEffect(() => {
    if (!ctxLoading) {
      const ts = today.toISOString().split('T')[0];
      setSelectedDate(ts);
      loadDayData(ts, true);
    }
  }, [ctxLoading, loadDayData]);

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today.toISOString().split('T')[0];
    setSelectedDate(dateStr);
    loadDayData(dateStr, isToday);
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
  const todayStr = today.toISOString().split('T')[0];
  const interactions: any[] = dayData?.interactions ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTHS_ID[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={styles.weekRow}>
        {DAYS_ID.map(d => (
          <Text key={d} style={[styles.weekLabel, d === 'Min' && { color: C.error }]}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={styles.emptyCell} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday    = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isSunday   = idx % 7 === 0;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dayCell,
                isToday && styles.dayCellToday,
                isSelected && !isToday && styles.dayCellSelected,
              ]}
              onPress={() => handleDayPress(day)}
            >
              <Text style={[
                styles.dayNum,
                isSunday && { color: C.error },
                isToday && { color: C.bgDeep, fontWeight: '900' },
                isSelected && !isToday && { color: C.gold },
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected date info */}
      <View style={styles.dividerLine} />
      <Text style={styles.selectedDateLabel}>
        {formatDateID(selectedDate)}
      </Text>

      {dayLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Memuat energi BaZi…</Text>
        </View>
      ) : dayError ? (
        <Text style={styles.errorText}>{dayError}</Text>
      ) : dayData ? (
        <>
          {/* Pillars for the day */}
          <Text style={styles.sectionTitle}>Pilar BaZi Hari Ini</Text>
          <View style={styles.pillarsRow}>
            {(['year', 'month', 'day'] as const).map(p => {
              const pillar = dayData.current_pillars?.[p];
              const stemInfo = ELEMENT_INFO[pillar?.stem] ?? { name: pillar?.stem, color: C.gold };
              const branchInfo = BRANCH_INFO[pillar?.branch] ?? { name: pillar?.branch, animal: '' };
              return (
                <View key={p} style={styles.pillarCard}>
                  <Text style={styles.pillarPos}>
                    {p === 'year' ? '年 TAHUN' : p === 'month' ? '月 BULAN' : '日 HARI'}
                  </Text>
                  <Text style={[styles.pillarStem, { color: stemInfo.color }]}>
                    {pillar?.stem || '-'}
                  </Text>
                  <View style={styles.pillarDivider} />
                  <Text style={styles.pillarBranch}>{pillar?.branch || '-'}</Text>
                  <Text style={styles.pillarStemName}>{stemInfo.name}</Text>
                  <Text style={styles.pillarAnimal}>{branchInfo.animal}</Text>
                </View>
              );
            })}
          </View>

          {/* AI narasi untuk hari ini */}
          {selectedDate === todayStr && (
            <>
              {narasiLoading ? (
                <View style={styles.narasiLoadingRow}>
                  <ActivityIndicator size="small" color={C.gold} />
                  <Text style={styles.narasiLoadingText}>Membaca energi hari ini…</Text>
                </View>
              ) : !!narasiToday ? (
                <View style={styles.narasiBox}>
                  <Text style={styles.narasiTitle}>Energi Hari Ini</Text>
                  <Text style={styles.narasiText}>{narasiToday}</Text>
                </View>
              ) : null}
            </>
          )}

          {/* Interactions with user chart */}
          {chartId && (
            <View style={styles.interactionsSection}>
              <Text style={styles.sectionTitle}>Hubungan dengan Chart Anda</Text>
              {interactions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Tidak ada interaksi signifikan antara chart Anda dan kalender hari ini.
                  </Text>
                </View>
              ) : (
                interactions.map((item: any, idx: number) => {
                  const accentColor = INTERACTION_COLOR[item.type] ?? C.gold;
                  return (
                    <View key={idx} style={[styles.interactionCard, { borderLeftColor: accentColor }]}>
                      <Text style={[styles.interactionType, { color: accentColor }]}>
                        {INTERACTION_LABEL[item.type] ?? item.type.toUpperCase()}
                      </Text>
                      <Text style={styles.interactionDesc}>{item.description}</Text>
                      <Text style={styles.interactionSub}>
                        {item.user_branch} (natal) ↔ {item.calendar_branch} (kalender)
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {!chartId && (
            <View style={styles.noChartBanner}>
              <Text style={styles.noChartText}>
                Buat profil di tab Profil untuk melihat hubungan kalender dengan chart Anda.
              </Text>
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function formatDateID(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: C.bgDeep, padding: 20, paddingBottom: 48 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:   { padding: 8 },
  navArrow: { fontSize: 28, color: C.gold, fontWeight: '700', lineHeight: 30 },
  monthLabel:{ fontSize: 17, fontWeight: '800', color: C.white },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { width: CELL_W, textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.muted, paddingVertical: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCell: { width: CELL_W, height: 44 },
  dayCell: {
    width: CELL_W,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellToday:    { backgroundColor: C.gold },
  dayCellSelected: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.gold },
  dayNum: { fontSize: 14, color: C.white, fontWeight: '500' },

  dividerLine: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  selectedDateLabel: { fontSize: 16, fontWeight: '800', color: C.gold, marginBottom: 14 },

  center:      { alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingText: { color: C.muted, fontSize: 13 },
  errorText:   { color: C.error, textAlign: 'center', padding: 12, fontSize: 14 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.white, marginBottom: 10 },

  pillarsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pillarCard: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  pillarPos:    { fontSize: 9, color: C.faint, marginBottom: 6, textAlign: 'center' },
  pillarStem:   { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  pillarDivider:{ width: 20, height: 1, backgroundColor: C.border, marginVertical: 4 },
  pillarBranch: { fontSize: 28, fontWeight: '900', color: C.white, marginBottom: 4 },
  pillarStemName:{ fontSize: 10, color: C.muted, textAlign: 'center' },
  pillarAnimal: { fontSize: 10, color: C.faint, textAlign: 'center', marginTop: 2 },

  narasiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  narasiLoadingText: { color: C.muted, fontSize: 13 },
  narasiBox: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  narasiTitle: { fontSize: 13, fontWeight: '800', color: C.gold, marginBottom: 6 },
  narasiText:  { fontSize: 14, color: C.white, lineHeight: 22 },

  interactionsSection: { marginTop: 4 },
  interactionCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    padding: 13,
    borderRadius: 12,
    marginBottom: 8,
  },
  interactionType: { fontWeight: '800', fontSize: 12, marginBottom: 4, letterSpacing: 0.5 },
  interactionDesc: { fontSize: 14, color: C.white, marginBottom: 2 },
  interactionSub:  { fontSize: 12, fontStyle: 'italic', color: C.muted, marginTop: 4 },

  emptyCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: { color: C.muted, textAlign: 'center', lineHeight: 22, fontSize: 13 },

  noChartBanner: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  noChartText: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
