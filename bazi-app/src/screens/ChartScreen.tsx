import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

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

const PILLAR_LABELS: Record<string, string> = {
  year:  '年\nTAHUN',
  month: '月\nBULAN',
  day:   '日\nHARI',
  hour:  '時\nJAM',
};

const NARASI_SECTIONS = [
  { key: 'daymaster',    label: 'Day Master' },
  { key: 'career',       label: 'Karir' },
  { key: 'wealth',       label: 'Kekayaan' },
  { key: 'relationship', label: 'Hubungan' },
];

export default function ChartScreen({ route, navigation }: any) {
  const { date, time, timezone } = route.params;

  const [chartData, setChartData]         = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [narasi, setNarasi]               = useState('');
  const [narasiLoading, setNarasiLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const fetchChart = async () => {
      try {
        const response = await axios.post(`${API_URL}/charts/calculate`, {
          birth_date:     date,
          birth_time:     time ? `${time}:00` : null,
          birth_timezone: timezone,
        });
        setChartData(response.data);
      } catch (err) {
        console.error(err);
        setError(`Gagal menghitung BaZi. Pastikan backend berjalan di ${API_URL}`);
      } finally {
        setLoading(false);
      }
    };
    fetchChart();
  }, [date, time, timezone]);

  const generateNarasi = async (section: string) => {
    if (!chartData?.id) return;
    setActiveSection(section);
    setNarasiLoading(true);
    setNarasi('');
    try {
      const response = await axios.post(`${API_URL}/narasi/generate`, {
        chart_id: chartData.id,
        section,
      });
      setNarasi(response.data.narasi);
    } catch {
      setNarasi('Gagal menghasilkan narasi. Silakan coba lagi.');
    } finally {
      setNarasiLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadingText}>Menghitung pilar nasib…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>BaZi Chart Anda</Text>

      {chartData?.pillars && (
        <View style={styles.chartContainer}>
          {(['year', 'month', 'day', 'hour'] as const).map((p) => {
            const pillar = chartData.pillars[p];
            const tenGod = p === 'day'
              ? '日主'
              : (chartData.ten_gods?.[`${p}_stem`] || '-');
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
      )}

      <View style={styles.strengthCard}>
        <Text style={styles.strengthLabel}>Kekuatan Day Master</Text>
        <Text style={styles.strengthValue}>{chartData?.day_master_strength ?? '-'}</Text>
      </View>

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          Interpretasi menggunakan framework 子平真詮 (Zi Ping Zhen Quan). Ini adalah kecenderungan dan pola, bukan prediksi absolut.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Interpretasi AI</Text>
      <View style={styles.sectionButtons}>
        {NARASI_SECTIONS.map((s) => {
          const active = activeSection === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.sectionBtn, active && styles.sectionBtnActive]}
              onPress={() => generateNarasi(s.key)}
              disabled={narasiLoading}
            >
              <Text style={[styles.sectionBtnText, active && styles.sectionBtnTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {narasiLoading && (
        <ActivityIndicator style={styles.narasiLoader} color={C.gold} />
      )}
      {!!narasi && (
        <View style={styles.narasiBox}>
          <Text style={styles.narasiText}>{narasi}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.calendarBtn}
        onPress={() => navigation.navigate('Calendar', { chartId: chartData?.id, timezone })}
      >
        <Text style={styles.calendarBtnText}>Cek Kalender BaZi →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgDeep, gap: 12 },
  loadingText: { color: C.muted, fontSize: 14, marginTop: 4 },
  errorText:   { color: C.error, textAlign: 'center', padding: 20, fontSize: 15 },

  container: { flexGrow: 1, backgroundColor: C.bgDeep, padding: 20, paddingBottom: 48, alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: C.white, marginBottom: 20, letterSpacing: 0.5 },

  chartContainer: {
    flexDirection: 'row',
    width: '100%',
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
  pillarDay: { backgroundColor: '#0F2860' },
  pillarLabel: { fontSize: 10, color: C.faint, marginBottom: 10, textAlign: 'center', lineHeight: 15 },
  stem:     { fontSize: 32, fontWeight: '800', color: C.white, marginBottom: 4 },
  stemDay:  { color: C.gold },
  divider:  { width: 24, height: 1, backgroundColor: C.border, marginVertical: 4 },
  branch:   { fontSize: 32, fontWeight: '800', color: C.white },
  branchDay:{ color: C.gold },
  tenGod:   { fontSize: 11, color: C.gold, marginTop: 10, fontWeight: '600' },

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

  disclaimerCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  disclaimerText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', color: C.muted, lineHeight: 18 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.white, marginBottom: 12, alignSelf: 'flex-start' },
  sectionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  sectionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bgCard,
  },
  sectionBtnActive:     { borderColor: C.gold, backgroundColor: '#151F3E' },
  sectionBtnText:       { color: C.muted, fontSize: 14, fontWeight: '600' },
  sectionBtnTextActive: { color: C.gold },

  narasiLoader: { marginVertical: 16 },
  narasiBox: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  narasiText: { fontSize: 14, lineHeight: 24, color: C.white },

  calendarBtn: {
    backgroundColor: C.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  calendarBtnText: { color: C.bgDeep, fontSize: 16, fontWeight: '800' },
});
