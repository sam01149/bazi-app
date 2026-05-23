import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
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
  clash:   '#FF6B6B',
  harm:    '#FF9F43',
  combo:   '#26D0CE',
};

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

const INTERACTION_COLOR: Record<string, string> = {
  clash:           '#FF6B6B',
  six_combination: '#26D0CE',
  harm:            '#FF9F43',
  penalty:         '#FF6B6B',
  self_penalty:    '#FF9F43',
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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadingText}>Memuat kalender energi…</Text>
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

  const interactions: any[] = calendarData?.interactions ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Kalender BaZi Saat Ini</Text>

      {calendarData?.current_pillars && (
        <View style={styles.chartContainer}>
          {(['year', 'month', 'day', 'hour'] as const).map((p) => {
            const pillar = calendarData.current_pillars[p];
            return (
              <View key={p} style={styles.pillar}>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[p]}</Text>
                <Text style={styles.stem}>{pillar?.stem || '-'}</Text>
                <View style={styles.divider} />
                <Text style={styles.branch}>{pillar?.branch || '-'}</Text>
              </View>
            );
          })}
        </View>
      )}

      {chartId && (
        <View style={styles.interactions}>
          <Text style={styles.sectionTitle}>Interaksi dengan Chart Anda</Text>
          {interactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Tidak ada interaksi signifikan antara chart Anda dan kalender saat ini.
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
                  <Text style={styles.interactionNarasi}>
                    Kecenderungan: Terjadi dinamika energi antara {item.user_branch} (natal) dan {item.calendar_branch} (kalender).
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}
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
    marginBottom: 24,
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
  pillarLabel: { fontSize: 10, color: C.faint, marginBottom: 10, textAlign: 'center', lineHeight: 15 },
  stem:        { fontSize: 32, fontWeight: '800', color: C.white, marginBottom: 4 },
  divider:     { width: 24, height: 1, backgroundColor: C.border, marginVertical: 4 },
  branch:      { fontSize: 32, fontWeight: '800', color: C.white },

  interactions: { width: '100%' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.white, marginBottom: 12 },

  interactionCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  interactionType:  { fontWeight: '800', fontSize: 13, marginBottom: 6, letterSpacing: 0.5 },
  interactionDesc:  { fontSize: 15, color: C.white, marginBottom: 4 },
  interactionNarasi:{ fontStyle: 'italic', marginTop: 6, color: C.muted, fontSize: 13, lineHeight: 20 },

  emptyCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  emptyText: { color: C.muted, textAlign: 'center', lineHeight: 22 },
});
