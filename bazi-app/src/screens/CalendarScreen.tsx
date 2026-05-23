import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';

const PILLAR_LABELS: Record<string, string> = {
  year:  '年\nTAHUN',
  month: '月\nBULAN',
  day:   '日\nHARI',
  hour:  '時\nJAM',
};

const INTERACTION_LABEL: Record<string, string> = {
  clash:           'BENTURAN',
  six_combination: 'KOMBINASI',
  harm:            'HAMBATAN',
  penalty:         'HUKUMAN',
  self_penalty:    'HUKUMAN DIRI',
};

export default function CalendarScreen({ route }: any) {
  const { chartId, timezone = 'Asia/Jakarta' } = route.params || {};

  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const tz  = encodeURIComponent(timezone);
        const url = chartId
          ? `${API_URL}/calendar/current?timezone=${tz}&chart_id=${chartId}`
          : `${API_URL}/calendar/current?timezone=${tz}`;
        const response = await axios.get(url);
        setCalendarData(response.data);
      } catch (err) {
        console.error(err);
        setError('Gagal memuat kalender BaZi. Pastikan backend berjalan.');
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [chartId, timezone]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0066cc" /></View>;
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  const interactions: any[] = calendarData?.interactions ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Kalender BaZi Saat Ini</Text>

      {calendarData?.current_pillars && (
        <View style={styles.chartContainer}>
          {(['year', 'month', 'day', 'hour'] as const).map((p) => {
            const pillar = calendarData.current_pillars[p];
            return (
              <View key={p} style={styles.pillar}>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[p]}</Text>
                <Text style={styles.stem}>{pillar?.stem || '-'}</Text>
                <Text style={styles.branch}>{pillar?.branch || '-'}</Text>
              </View>
            );
          })}
        </View>
      )}

      {chartId && (
        <View style={styles.interactions}>
          <Text style={styles.subtitle}>Interaksi dengan Chart Anda</Text>
          {interactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Tidak ada interaksi signifikan antara chart Anda dan kalender saat ini.
              </Text>
            </View>
          ) : (
            interactions.map((item: any, idx: number) => (
              <View key={idx} style={styles.interactionCard}>
                <Text style={styles.interactionType}>
                  {INTERACTION_LABEL[item.type] ?? item.type.toUpperCase()}
                </Text>
                <Text style={styles.interactionDesc}>{item.description}</Text>
                <Text style={styles.narasi}>
                  Kecenderungan: Terjadi dinamika energi antara {item.user_branch} (natal) dan {item.calendar_branch} (kalender).
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },

  chartContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
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

  interactions: { width: '100%' },
  interactionCard: {
    backgroundColor: '#ffe6e6',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  interactionType: { fontWeight: 'bold', color: '#cc0000', marginBottom: 4 },
  interactionDesc: { fontSize: 15, marginBottom: 4 },
  narasi: { fontStyle: 'italic', marginTop: 4, color: '#555', fontSize: 13 },

  emptyCard: {
    backgroundColor: '#e8f4fd',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  emptyText: { color: '#333', textAlign: 'center', lineHeight: 22 },
  error: { color: 'red', textAlign: 'center', padding: 20 },
});
