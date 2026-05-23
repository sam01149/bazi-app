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

// Native HTML date/time input untuk web
function WebDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      max={new Date().toISOString().split('T')[0]}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: '1.5px solid #C7D0E8', borderRadius: '10px',
        backgroundColor: '#F5F7FF', color: value ? '#0F1B4C' : '#aaa',
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer',
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
        border: '1.5px solid #C7D0E8', borderRadius: '10px',
        backgroundColor: '#F5F7FF', color: value ? '#0F1B4C' : '#aaa',
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    />
  );
}

export default function OnboardingScreen({ navigation }: any) {
  const [date, setDate]               = useState('');
  const [time, setTime]               = useState('');
  const [timezone, setTimezone]       = useState('Asia/Jakarta');
  const [unknownHour, setUnknownHour] = useState(false);

  const handleNext = () => {
    if (!date) {
      Alert.alert('Tanggal Diperlukan', 'Pilih tanggal lahir terlebih dahulu');
      return;
    }
    if (!unknownHour && !time) {
      Alert.alert('Waktu Diperlukan', 'Pilih waktu lahir atau aktifkan "Jam Tidak Diketahui"');
      return;
    }
    navigation.navigate('Chart', {
      date,
      time: unknownHour ? null : time,
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
        {Platform.OS === 'web'
          ? <WebDateInput value={date} onChange={setDate} />
          : <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
        }

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
            {Platform.OS === 'web'
              ? <WebTimeInput value={time} onChange={setTime} />
              : <TextInput
                  style={styles.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  placeholderTextColor="#aaa"
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                />
            }
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
