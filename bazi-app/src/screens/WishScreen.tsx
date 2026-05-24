import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import axios from 'axios';
import { API_URL } from '../config';
import { useChart } from '../context/ChartContext';
import { C } from '../theme';

interface Wish {
  id: string;
  content: string;
  analysis: string | null;
  created_at: string;
}

const MONTHS_ID = [
  'Jan','Feb','Mar','Apr','Mei','Jun',
  'Jul','Agu','Sep','Okt','Nov','Des',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export default function WishScreen() {
  const { chartId } = useChart();
  const [wishes,     setWishes]     = useState<Wish[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [inputText,  setInputText]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [analyzing,  setAnalyzing]  = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchWishes = useCallback(async () => {
    if (!chartId) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API_URL}/wishes?chart_id=${chartId}`);
      setWishes(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [chartId]);

  useEffect(() => { fetchWishes(); }, [fetchWishes]);

  const saveWish = async () => {
    const text = inputText.trim();
    if (!text || !chartId) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/wishes`, { chart_id: chartId, content: text });
      setWishes(prev => [res.data, ...prev]);
      setInputText('');
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyimpan keinginan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const analyzeWish = async (wish: Wish) => {
    if (!chartId) return;
    setAnalyzing(wish.id);
    setExpandedId(wish.id);
    try {
      const res = await axios.post(`${API_URL}/wishes/${wish.id}/analyze`, { chart_id: chartId });
      setWishes(prev => prev.map(w => w.id === wish.id ? res.data : w));
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menganalisis keinginan. Coba lagi.');
    } finally {
      setAnalyzing(null);
    }
  };

  const deleteWish = (wish: Wish) => {
    const preview = wish.content.length > 40 ? `${wish.content.slice(0, 40)}…` : wish.content;

    const doDelete = async () => {
      try {
        await axios.delete(`${API_URL}/wishes/${wish.id}`);
        setWishes(prev => prev.filter(w => w.id !== wish.id));
        if (expandedId === wish.id) setExpandedId(null);
      } catch {
        Alert.alert('Gagal', 'Tidak dapat menghapus.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Hapus keinginan ini?\n\n"${preview}"`)) doDelete();
      return;
    }

    Alert.alert('Hapus Keinginan', `Hapus "${preview}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: doDelete },
    ]);
  };

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  if (!chartId) {
    return (
      <View style={styles.noChartContainer}>
        <Text style={styles.noChartIcon}>✦</Text>
        <Text style={styles.noChartTitle}>Mulai dengan Profilmu</Text>
        <Text style={styles.noChartDesc}>
          Buat profil BaZi di tab Profil terlebih dahulu, lalu kembali ke sini untuk menuliskan keinginanmu dan mendapatkan pembacaan yang personal.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Input area */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Tulis keinginanmu</Text>
          <Text style={styles.inputHint}>AI akan menganalisisnya berdasarkan chart BaZi kamu</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Aku ingin…"
            placeholderTextColor={C.textFaint}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!inputText.trim() || saving) && styles.saveBtnDisabled]}
            onPress={saveWish}
            disabled={!inputText.trim() || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.bg} />
              : <Text style={styles.saveBtnText}>Simpan →</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Wishes list */}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={styles.loadingText}>Memuat keinginan…</Text>
          </View>
        ) : wishes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Belum ada keinginan</Text>
            <Text style={styles.emptyDesc}>Tulis keinginanmu di atas dan biarkan BaZi membantu kamu melihat polanya.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.listLabel}>TERSIMPAN ({wishes.length})</Text>
            {wishes.map(wish => {
              const expanded    = expandedId === wish.id;
              const isAnalyzing = analyzing === wish.id;
              return (
                <View key={wish.id} style={styles.wishCard}>
                  <TouchableOpacity onPress={() => toggleExpand(wish.id)} activeOpacity={0.85}>
                    <Text style={styles.wishContent}>{wish.content}</Text>
                    <Text style={styles.wishDate}>{formatDate(wish.created_at)}</Text>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.wishExpanded}>
                      {isAnalyzing ? (
                        <View style={styles.analyzingRow}>
                          <ActivityIndicator size="small" color={C.gold} />
                          <Text style={styles.analyzingText}>AI membaca chart BaZi kamu…</Text>
                        </View>
                      ) : wish.analysis ? (
                        <View style={styles.analysisBox}>
                          <Text style={styles.analysisLabel}>Pembacaan BaZi</Text>
                          <Text style={styles.analysisText}>{wish.analysis}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.analyzeBtn}
                          onPress={() => analyzeWish(wish)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.analyzeBtnText}>✦ Analisis dengan Chart BaZi</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <View style={styles.wishFooter}>
                    <TouchableOpacity onPress={() => toggleExpand(wish.id)} style={styles.footerBtn}>
                      <Text style={styles.footerBtnText}>{expanded ? 'Tutup' : wish.analysis ? 'Lihat Pembacaan' : 'Buka'}</Text>
                    </TouchableOpacity>
                    {wish.analysis && expanded && (
                      <TouchableOpacity onPress={() => analyzeWish(wish)} style={styles.footerBtn}>
                        <Text style={[styles.footerBtnText, { color: C.gold }]}>Analisis Ulang</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteWish(wish)} style={styles.footerBtn}>
                      <Text style={[styles.footerBtnText, { color: C.red }]}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, paddingBottom: 48 },

  noChartContainer: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: 36,
  },
  noChartIcon:  { fontSize: 40, color: C.gold, marginBottom: 16 },
  noChartTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 10, textAlign: 'center' },
  noChartDesc:  { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },

  inputCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputLabel: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  inputHint:  { fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 18 },
  textArea: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 13,
    color: C.text,
    fontSize: 15,
    minHeight: 110,
    marginBottom: 12,
    lineHeight: 22,
  },
  saveBtn: {
    backgroundColor: C.gold,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText:     { color: C.bg, fontWeight: '800', fontSize: 15 },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { color: C.textMuted, fontSize: 14 },

  emptyCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },

  listLabel: {
    fontSize: 11, fontWeight: '800', color: C.textFaint,
    letterSpacing: 1.5, marginBottom: 10,
  },

  wishCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  wishContent: { fontSize: 15, color: C.text, lineHeight: 23, marginBottom: 6 },
  wishDate:    { fontSize: 12, color: C.textFaint },

  wishExpanded: { marginTop: 12 },

  analyzingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzingText: { color: C.textMuted, fontSize: 13, flex: 1 },

  analyzeBtn: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  analyzeBtnText: { color: C.goldSoft, fontWeight: '700', fontSize: 14 },

  analysisBox: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 10,
    padding: 13,
  },
  analysisLabel: { fontSize: 11, fontWeight: '900', color: C.gold, marginBottom: 8, letterSpacing: 0.8 },
  analysisText:  { fontSize: 14, color: C.text, lineHeight: 23 },

  wishFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBtn:     { paddingVertical: 2 },
  footerBtnText: { fontSize: 13, color: C.textMuted, fontWeight: '600' },
});
