import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

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

  const [chartData, setChartData]     = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [narasi, setNarasi]           = useState('');
  const [narasiLoading, setNarasiLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const fetchChart = async () => {
      try {
        const response = await axios.post(`${API_URL}/charts/calculate`, {
          birth_date: date,
          birth_time: time ? `${time}:00` : null,
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
    return <View style={styles.center}><ActivityIndicator size="large" color="#0066cc" /></View>;
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>BaZi Chart Anda</Text>

      {chartData?.pillars && (
        <View style={styles.chartContainer}>
          {(['year', 'month', 'day', 'hour'] as const).map((p) => {
            const pillar = chartData.pillars[p];
            const tenGod = p === 'day'
              ? '日主'
              : (chartData.ten_gods?.[`${p}_stem`] || '-');
            return (
              <View key={p} style={styles.pillar}>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[p]}</Text>
                <Text style={styles.stem}>{pillar?.stem || '-'}</Text>
                <Text style={styles.branch}>{pillar?.branch || '-'}</Text>
                <Text style={styles.tenGod}>{tenGod}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.strengthRow}>
        <Text style={styles.strengthLabel}>Kekuatan Day Master:</Text>
        <Text style={styles.strengthValue}>{chartData?.day_master_strength ?? '-'}</Text>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Interpretasi menggunakan framework 子平真詮 (Zi Ping Zhen Quan). Ini adalah kecenderungan dan pola, bukan prediksi absolut.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Interpretasi AI</Text>
      <View style={styles.sectionButtons}>
        {NARASI_SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectionBtn, activeSection === s.key && styles.sectionBtnActive]}
            onPress={() => generateNarasi(s.key)}
            disabled={narasiLoading}
          >
            <Text style={[styles.sectionBtnText, activeSection === s.key && styles.sectionBtnTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {narasiLoading && <ActivityIndicator style={styles.narasiLoader} color="#0066cc" />}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },

  chartContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  pillar: { alignItems: 'center', flex: 1 },
  pillarLabel: { fontSize: 10, color: '#888', marginBottom: 8, textAlign: 'center', lineHeight: 15 },
  stem: { fontSize: 30, fontWeight: 'bold', marginBottom: 4 },
  branch: { fontSize: 30, fontWeight: 'bold' },
  tenGod: { fontSize: 12, color: '#0066cc', marginTop: 8 },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  strengthLabel: { fontSize: 15, color: '#333' },
  strengthValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },

  error: { color: 'red', textAlign: 'center', padding: 20 },
  disclaimer: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  disclaimerText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', color: '#666' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, alignSelf: 'flex-start' },
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
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  sectionBtnActive: { backgroundColor: '#0066cc' },
  sectionBtnText: { color: '#0066cc', fontSize: 14 },
  sectionBtnTextActive: { color: '#fff' },

  narasiLoader: { marginVertical: 12 },
  narasiBox: {
    backgroundColor: '#e8f4fd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  narasiText: { fontSize: 14, lineHeight: 22, color: '#222' },

  calendarBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  calendarBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
