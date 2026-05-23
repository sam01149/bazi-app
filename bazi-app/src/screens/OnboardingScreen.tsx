import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Switch, ScrollView, Platform,
} from 'react-native';

const C = {
  bgDeep:   '#070F2B',
  bgCard:   '#0D1F4E',
  bgInput:  '#091640',
  border:   '#1E3A80',
  gold:     '#F8D21B',
  white:    '#FFFFFF',
  muted:    '#8BAAD4',
  faint:    '#3A5A9A',
};

const TIMEZONES = [
  { label: 'WIB',  sub: 'Jakarta · Sumatera · Kalimantan Barat', value: 'Asia/Jakarta' },
  { label: 'WITA', sub: 'Makassar · Bali · Kalimantan Timur',    value: 'Asia/Makassar' },
  { label: 'WIT',  sub: 'Jayapura · Maluku · Papua',             value: 'Asia/Jayapura' },
];

function WebDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      max={new Date().toISOString().split('T')[0]}
      style={{
        width: '100%', padding: '13px', fontSize: '15px',
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px',
        backgroundColor: C.bgInput,
        color: value ? C.white : C.muted,
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer',
        colorScheme: 'dark',
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
        border: `1.5px solid ${value ? C.gold : C.border}`,
        borderRadius: '10px',
        backgroundColor: C.bgInput,
        color: value ? C.white : C.muted,
        marginBottom: '20px', boxSizing: 'border-box', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer',
        colorScheme: 'dark',
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
    navigation.navigate('Chart', { date, time: unknownHour ? null : time, timezone });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        {Platform.OS === 'web' ? (
          // @ts-ignore
          <img
            src={require('../../assets/logo.svg')}
            style={{ width: 96, height: 96, marginBottom: 14, borderRadius: 18 }}
            alt="BaZi Logo"
          />
        ) : (
          <Text style={styles.headerIcon}>☯</Text>
        )}
        <Text style={styles.title}>BaZi Chart</Text>
        <Text style={styles.subtitle}>Masukkan data kelahiran untuk membaca empat pilar nasib</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tanggal Lahir</Text>
        {Platform.OS === 'web'
          ? <WebDateInput value={date} onChange={setDate} />
          : <TextInput
              style={[styles.input, !!date && styles.inputFilled]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.faint}
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
            trackColor={{ false: C.border, true: C.gold }}
            thumbColor={unknownHour ? C.bgDeep : C.muted}
          />
        </View>

        {!unknownHour && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Waktu Lahir</Text>
            {Platform.OS === 'web'
              ? <WebTimeInput value={time} onChange={setTime} />
              : <TextInput
                  style={[styles.input, !!time && styles.inputFilled]}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  placeholderTextColor={C.faint}
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
          {TIMEZONES.map((tz) => {
            const active = timezone === tz.value;
            return (
              <TouchableOpacity
                key={tz.value}
                style={[styles.tzBtn, active && styles.tzBtnActive]}
                onPress={() => setTimezone(tz.value)}
              >
                <Text style={[styles.tzLabel, active && styles.tzLabelActive]}>{tz.label}</Text>
                <Text style={[styles.tzSub,   active && styles.tzSubActive]}>{tz.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Hitung BaZi Chart →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flexGrow: 1, backgroundColor: C.bgDeep, padding: 20, paddingBottom: 48 },
  header:      { alignItems: 'center', paddingVertical: 36 },
  headerIcon:  { fontSize: 52, marginBottom: 10 },
  title:       { fontSize: 28, fontWeight: '800', color: C.white, letterSpacing: 1 },
  subtitle:    { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 280 },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  label:      { fontSize: 14, fontWeight: '700', color: C.white, marginBottom: 8 },
  hint:       { fontSize: 12, color: C.muted, marginTop: -4 },

  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 13,
    marginBottom: 20,
    borderRadius: 10,
    fontSize: 15,
    backgroundColor: C.bgInput,
    color: C.white,
  },
  inputFilled: { borderColor: C.gold },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },

  tzRow:   { gap: 10 },
  tzBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: C.bgInput,
  },
  tzBtnActive:  { borderColor: C.gold, backgroundColor: '#151F3E' },
  tzLabel:      { fontSize: 15, fontWeight: '700', color: C.muted },
  tzLabelActive:{ color: C.gold },
  tzSub:        { fontSize: 12, color: C.faint, marginTop: 2 },
  tzSubActive:  { color: C.muted },

  button: {
    backgroundColor: C.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: { color: C.bgDeep, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
