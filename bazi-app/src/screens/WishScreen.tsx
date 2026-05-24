import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
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
};

interface Wish {
  id: string;
  content: string;
  analysis: string | null;
  created_at: string;
}

export default function WishScreen() {
  const { chartId } = useChart();
  const [wishes,      setWishes]      = useState<Wish[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [inputText,   setInputText]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [analyzing,   setAnalyzing]   = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

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
    if (!text) return;
    if (!chartId) {
      Alert.alert('Profil Belum Ada', 'Buat profil BaZi di tab Profil terlebih dahulu.');
      return;
    }
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
    Alert.alert('Hapus Keinginan', `Hapus "${preview}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/wishes/${wish.id}`);
            setWishes(prev => prev.filter(w => w.id !== wish.id));
          } catch {
            Alert.alert('Gagal', 'Tidak dapat menghapus.');
          }
        },
      },
    ]);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (!chartId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>Profil Belum Ada</Text>
        <Text style={styles.emptyDesc}>
          Buat profil BaZi kamu dulu di tab Profil, lalu kembali ke sini untuk menuliskan keinginanmu.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Input area */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Tulis keinginanmu</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Aku ingin…"
            placeholderTextColor={C.faint}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!inputText.trim() || saving) && styles.saveBtnDisabled]}
            onPress={saveWish}
            disabled={!inputText.trim() || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.bgDeep} />
              : <Text style={styles.saveBtnText}>Simpan Keinginan →</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Wishes list */}
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} />
        ) : wishes.length === 0 ? (
          <View style={styles.emptyListCard}>
            <Text style={styles.emptyListText}>
              Belum ada keinginan yang tersimpan. Tulis keinginanmu di atas!
            </Text>
          </View>
        ) : (
          wishes.map((wish) => {
            const expanded = expandedId === wish.id;
            const isAnalyzing = analyzing === wish.id;
            return (
              <View key={wish.id} style={styles.wishCard}>
                <TouchableOpacity onPress={() => toggleExpand(wish.id)} activeOpacity={0.8}>
                  <Text style={styles.wishContent}>{wish.content}</Text>
                  <Text style={styles.wishDate}>{formatDate(wish.created_at)}</Text>
                </TouchableOpacity>

                {expanded && (
                  <>
                    {isAnalyzing ? (
                      <View style={styles.analyzingRow}>
                        <ActivityIndicator size="small" color={C.gold} />
                        <Text style={styles.analyzingText}>AI sedang menganalisis berdasarkan chart BaZi kamu…</Text>
                      </View>
                    ) : wish.analysis ? (
                      <View style={styles.analysisBox}>
                        <Text style={styles.analysisLabel}>Analisis BaZi</Text>
                        <Text style={styles.analysisText}>{wish.analysis}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.analyzeBtn}
                        onPress={() => analyzeWish(wish)}
                      >
                        <Text style={styles.analyzeBtnText}>✦ Analisis dengan BaZi Chart</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <View style={styles.wishActions}>
                  <TouchableOpacity onPress={() => toggleExpand(wish.id)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>{expanded ? 'Tutup ↑' : 'Lihat ↓'}</Text>
                  </TouchableOpacity>
                  {wish.analysis && expanded && (
                    <TouchableOpacity onPress={() => analyzeWish(wish)} style={styles.actionBtn}>
                      <Text style={[styles.actionBtnText, { color: C.gold }]}>Analisis Ulang</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => deleteWish(wish)} style={styles.actionBtn}>
                    <Text style={[styles.actionBtnText, { color: C.error }]}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: C.bgDeep, padding: 20, paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ fontSize: 20, fontWeight: '800', color: C.white, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },

  inputCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  inputLabel: { fontSize: 15, fontWeight: '700', color: C.white, marginBottom: 10 },
  textArea: {
    backgroundColor: C.bgInput,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    color: C.white,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: C.gold,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: C.bgDeep, fontWeight: '800', fontSize: 15 },

  emptyListCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyListText: { color: C.muted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

  wishCard: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  wishContent: { fontSize: 15, color: C.white, lineHeight: 22, marginBottom: 4 },
  wishDate:    { fontSize: 12, color: C.faint },

  wishActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actionBtn:    { paddingHorizontal: 4 },
  actionBtnText:{ fontSize: 13, color: C.muted, fontWeight: '600' },

  analyzeBtn: {
    backgroundColor: '#0F2860',
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  analyzeBtnText: { color: C.gold, fontWeight: '700', fontSize: 14 },

  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  analyzingText: { color: C.muted, fontSize: 13, flex: 1 },

  analysisBox: {
    backgroundColor: '#091640',
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  analysisLabel: { fontSize: 12, fontWeight: '800', color: C.gold, marginBottom: 6, letterSpacing: 0.5 },
  analysisText:  { fontSize: 14, color: C.white, lineHeight: 22 },
});
