import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Switch, ScrollView, Platform,
} from 'react-native';

const TIMEZONES = [
  { label: 'WIB', sub: 'Jakarta · Sumatera · Kalimantan Barat', value: 'Asia/Jakarta' },
  { label: 'WITA', sub: 'Makassar · Bali · Kalimantan Timur', value: 'Asia/Makassar' },
  { label: 'WIT', sub: 'Jayapura · Maluku · Papua', value: 'Asia/Jayapura' },
];

function parseDMY(dmy: string): string | null {
  const parts = dmy.replace(/\D/g, '/').split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return null;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return null;
  return iso;
}

export default function OnboardingScreen({ navigation }: any) {
  const [dateDMY, setDateDMY]         = useState('');
  const [time, setTime]               = useState('');
  const [timezone, setTimezone]       = useState('Asia/Jakarta');
  const [unknownHour, setUnknownHour] = useState(false);

  const handleNext = () => {
    const isoDate = parseDMY(dateDMY);
    if (!isoDate) {
      Alert.alert('Tanggal Tidak Valid', 'Masukkan tanggal dengan format DD/MM/YYYY\nContoh: 15/05/1990');
      return;
    }
    if (!unknownHour) {
      const timeRegex = /^\d{1,2}:\d{2}$/;
      if (!timeRegex.test(time)) {
        Alert.alert('Waktu Tidak Valid', 'Masukkan waktu dengan format HH:MM\nContoh: 14:30');
        return;
      }
      const [h, m] = time.split(':').map(Number);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        Alert.alert('Waktu Tidak Valid', 'Jam: 0–23, Menit: 00–59');
        return;
      }
    }
    navigation.navigate('Chart', {
      date: isoDate,
      time: unknownHour ? null : time.padStart(5, '0'),
      timezone,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>☯</Text>
        <Text style={styles.title}>BaZi Chart</Text>
        <Text style={styles.subtitle}>Masukkan data kelahiran untuk membaca empat pilar nasib</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tanggal Lahir</Text>
        <TextInput
          style={styles.input}
          value={dateDMY}
          onChangeText={setDateDMY}
          placeholder="DD/MM/YYYY  —  contoh: 15/05/1990"
          placeholderTextColor="#aaa"
          keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
          autoCorrect={false}
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.label}>Jam Tidak Diketahui</Text>
            <Text style={styles.hint}>Gunakan tengah hari sebagai default</Text>
          </View>
          <Switch
            value={unknownHour}
            onValueChange={setUnknownHour}
            trackColor={{ false: '#ddd', true: '#1B3A8C' }}
            thumbColor="#fff"
          />
        </View>

        {!unknownHour && (
          <>
            <Text style={styles.label}>Waktu Lahir</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM  —  contoh: 14:30"
              placeholderTextColor="#aaa"
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
              autoCorrect={false}
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Zona Waktu</Text>
        <View style={styles.tzRow}>
          {TIMEZONES.map((tz) => (
            <TouchableOpacity
              key={tz.value}
              style={[styles.tzBtn, timezone === tz.value && styles.tzBtnActive]}
              onPress={() => setTimezone(tz.value)}
            >
              <Text style={[styles.tzLabel, timezone === tz.value && styles.tzLabelActive]}>
                {tz.label}
              </Text>
              <Text style={[styles.tzSub, timezone === tz.value && styles.tzSubActive]}>
                {tz.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Hitung BaZi Chart →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#EEF2FF', padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', paddingVertical: 32 },
  headerIcon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F1B4C', letterSpacing: 1 },
  subtitle: { fontSize: 13, color: '#4A5A8A', textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 280 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1B2B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#0F1B4C', marginBottom: 8 },
  hint: { fontSize: 12, color: '#9AA5C4', marginTop: -4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#C7D0E8',
    padding: 13,
    marginBottom: 20,
    borderRadius: 10,
    fontSize: 15,
    backgroundColor: '#F5F7FF',
    color: '#0F1B4C',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  tzRow: { gap: 10 },
  tzBtn: {
    borderWidth: 1.5,
    borderColor: '#C7D0E8',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F5F7FF',
  },
  tzBtnActive: {
    borderColor: '#1B3A8C',
    backgroundColor: '#EEF2FF',
  },
  tzLabel: { fontSize: 15, fontWeight: '700', color: '#6B7BAD' },
  tzLabelActive: { color: '#1B3A8C' },
  tzSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  tzSubActive: { color: '#4A6AC8' },
  button: {
    backgroundColor: '#1B3A8C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#1B3A8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
