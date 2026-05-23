import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Switch, ScrollView,
} from 'react-native';

export default function OnboardingScreen({ navigation }: any) {
  const [date, setDate]               = useState('2000-01-01');
  const [time, setTime]               = useState('12:00');
  const [timezone, setTimezone]       = useState('Asia/Jakarta');
  const [unknownHour, setUnknownHour] = useState(false);

  const validate = (): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('Format Salah', 'Tanggal harus dalam format YYYY-MM-DD\nContoh: 1990-05-15');
      return false;
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Tanggal Tidak Valid', 'Masukkan tanggal yang valid');
      return false;
    }

    if (!unknownHour) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(time)) {
        Alert.alert('Format Salah', 'Waktu harus dalam format HH:MM\nContoh: 14:30');
        return false;
      }
      const [h, m] = time.split(':').map(Number);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        Alert.alert('Waktu Tidak Valid', 'Jam: 00–23, Menit: 00–59');
        return false;
      }
    }

    if (!timezone.trim()) {
      Alert.alert('Timezone Diperlukan', 'Contoh: Asia/Jakarta, Asia/Makassar');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    navigation.navigate('Chart', {
      date,
      time: unknownHour ? null : time,
      timezone: timezone.trim(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Data Kelahiran</Text>
      <Text style={styles.subtitle}>
        Masukkan informasi kelahiran Anda untuk menghitung BaZi Chart
      </Text>

      <Text style={styles.label}>Tanggal Lahir</Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD  (contoh: 1990-05-15)"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Jam Tidak Diketahui</Text>
        <Switch value={unknownHour} onValueChange={setUnknownHour} />
      </View>

      {!unknownHour && (
        <>
          <Text style={styles.label}>Waktu Lahir</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM  (contoh: 14:30)"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
        </>
      )}
      {unknownHour && (
        <Text style={styles.hint}>
          Jam tidak diketahui: default 12:00 tengah hari (konvensi standar BaZi)
        </Text>
      )}

      <Text style={styles.label}>Timezone</Text>
      <TextInput
        style={styles.input}
        value={timezone}
        onChangeText={setTimezone}
        placeholder="Asia/Jakarta"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Contoh: Asia/Jakarta · Asia/Makassar · Asia/Jayapura · Asia/Singapore
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Hitung BaZi Chart →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: '#888', marginBottom: 16, marginTop: -10, lineHeight: 18 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
