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
  analyzed_at: string | null;
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

const INTENT_CHIPS = [
  {
    label: '💼 Karier & Bisnis',
    placeholder: 'Ceritakan: Apakah ingin naik jabatan, ganti pekerjaan, mulai bisnis, atau menyelesaikan konflik di tempat kerja?',
  },
  {
    label: '❤️ Hubungan',
    placeholder: 'Ceritakan: Apakah soal pasangan, mencari jodoh, konflik keluarga, atau hubungan yang membebani?',
  },
  {
    label: '💰 Keuangan',
    placeholder: 'Ceritakan: Apakah ragu berinvestasi, ingin bebas hutang, gaji tidak cukup, atau peluang finansial yang sedang dipertimbangkan?',
  },
  {
    label: '🧘 Ketenangan Batin',
    placeholder: 'Ceritakan: Apakah merasa stagnan, kehilangan arah, kelelahan mental, atau mencari makna yang lebih dalam?',
  },
];

export default function WishScreen() {
  const { chartId, loading: ctxLoading } = useChart();
  const [wishes,     setWishes]     = useState<Wish[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [inputText,  setInputText]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [analyzing,  setAnalyzing]  = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Privacy blur
  const [revealed, setRevealed] = useState(false);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText,  setEditText]  = useState('');

  // Timing
  const [timingId,      setTimingId]      = useState<string | null>(null);
  const [timingText,    setTimingText]    = useState<Record<string, string>>({});
  const [timingLoading, setTimingLoading] = useState<string | null>(null);

  // Intent chips
  const [selectedChip, setSelectedChip] = useState<number | null>(null);

  const fetchWishes = useCallback(async () => {
    if (!chartId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/wishes?chart_id=${chartId}`);
      setWishes(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [chartId]);

  useEffect(() => {
    if (!ctxLoading) fetchWishes();
  }, [ctxLoading, fetchWishes]);

  const saveWish = async () => {
    const text = inputText.trim();
    if (!text || !chartId) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API_URL}/wishes`, { chart_id: chartId, content: text });
      setWishes(prev => [res.data, ...prev]);
      setInputText('');
      setSelectedChip(null);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyimpan keinginan. Periksa koneksi internet.');
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
      Alert.alert('Gagal', 'Tidak dapat menganalisis keinginan. Periksa koneksi internet.');
    } finally {
      setAnalyzing(null);
    }
  };

  const confirmReanalyze = (wish: Wish) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Analisis ulang akan menggantikan hasil sebelumnya. Lanjutkan?')) {
        analyzeWish(wish);
      }
      return;
    }
    Alert.alert(
      'Analisis Ulang',
      'Hasil analisis sebelumnya akan digantikan. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Analisis Ulang', onPress: () => analyzeWish(wish) },
      ]
    );
  };

  const startEdit = (wish: Wish) => {
    setEditingId(wish.id);
    setEditText(wish.content);
  };

  const saveEdit = async (wish: Wish) => {
    const text = editText.trim();
    if (!text || text === wish.content) { setEditingId(null); return; }
    try {
      const res = await axios.patch(`${API_URL}/wishes/${wish.id}`, { content: text });
      setWishes(prev => prev.map(w => w.id === wish.id ? res.data : w));
      setEditingId(null);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyimpan perubahan. Periksa koneksi internet.');
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

  const loadTiming = async (wish: Wish) => {
    if (!chartId) return;
    if (timingText[wish.id]) {
      setTimingId(prev => prev === wish.id ? null : wish.id);
      return;
    }
    setTimingId(wish.id);
    setTimingLoading(wish.id);
    try {
      const res = await axios.get(`${API_URL}/wishes/${wish.id}/timing?chart_id=${chartId}`);
      setTimingText(prev => ({ ...prev, [wish.id]: res.data.timing ?? '' }));
    } catch {
      setTimingText(prev => ({ ...prev, [wish.id]: 'Tidak dapat memuat rekomendasi waktu. Periksa koneksi internet.' }));
    } finally {
      setTimingLoading(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (editingId) setEditingId(null);
    setExpandedId(prev => prev === id ? null : id);
  };

  const activePlaceholder = selectedChip !== null
    ? INTENT_CHIPS[selectedChip].placeholder
    : 'Contoh: Aku ingin pindah ke karier di bidang teknologi dalam 1 tahun ini...';

  if (ctxLoading) {
    return (
      <View style={styles.noChartContainer}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

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

          {/* Intent chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {INTENT_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.chip, selectedChip === idx && styles.chipActive]}
                onPress={() => setSelectedChip(prev => prev === idx ? null : idx)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, selectedChip === idx && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            value={inputText}
            onChangeText={setInputText}
            placeholder={activePlaceholder}
            placeholderTextColor={C.textFaint}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{inputText.length}/500</Text>

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

        {/* Wishes list header with privacy toggle */}
        {!loading && wishes.length > 0 && (
          <View style={styles.listHeader}>
            <Text style={styles.listLabel}>TERSIMPAN ({wishes.length})</Text>
            <TouchableOpacity onPress={() => setRevealed(r => !r)} style={styles.revealBtn} activeOpacity={0.8}>
              <Text style={styles.revealBtnText}>{revealed ? '🙈 Sembunyikan' : '👁 Tampilkan'}</Text>
            </TouchableOpacity>
          </View>
        )}

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
          wishes.map(wish => {
            const expanded    = expandedId === wish.id;
            const isAnalyzing = analyzing === wish.id;
            const isEditing   = editingId === wish.id;
            const isStale     = wish.analyzed_at
              ? (Date.now() - new Date(wish.analyzed_at).getTime()) > 365 * 24 * 60 * 60 * 1000
              : false;

            const blurStyle = Platform.OS === 'web'
              ? (!revealed ? { filter: 'blur(6px)', userSelect: 'none' } as any : {})
              : (!revealed ? styles.blurredText : {});

            return (
              <View key={wish.id} style={styles.wishCard}>
                <TouchableOpacity onPress={() => toggleExpand(wish.id)} activeOpacity={0.85}>
                  {isEditing ? (
                    <TextInput
                      style={styles.editInput}
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      autoFocus
                      textAlignVertical="top"
                    />
                  ) : (
                    <Text style={[styles.wishContent, blurStyle]}>{wish.content}</Text>
                  )}
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
                      <>
                        <View style={styles.analysisBox}>
                          <Text style={styles.analysisLabel}>Pembacaan BaZi</Text>
                          <Text style={[styles.analysisText, blurStyle]}>{wish.analysis}</Text>
                          {wish.analyzed_at && (
                            <Text style={styles.analyzedAtText}>
                              Dianalisis {formatDate(wish.analyzed_at)}
                              {isStale ? ' · mungkin sudah tidak relevan dengan dekade saat ini' : ''}
                            </Text>
                          )}
                        </View>

                        {/* Timing section */}
                        {timingLoading === wish.id ? (
                          <View style={styles.timingLoadingRow}>
                            <ActivityIndicator size="small" color={C.teal} />
                            <Text style={styles.timingLoadingText}>Mencari waktu terbaik…</Text>
                          </View>
                        ) : timingText[wish.id] && timingId === wish.id ? (
                          <View style={styles.timingBox}>
                            <Text style={styles.timingLabel}>⏰ Waktu Terbaik untuk Bertindak</Text>
                            <Text style={styles.timingText}>{timingText[wish.id]}</Text>
                            <TouchableOpacity
                              onPress={() => setTimingId(null)}
                              style={styles.timingHideBtn}
                            >
                              <Text style={styles.timingHideBtnText}>Sembunyikan</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.timingBtn}
                            onPress={() => loadTiming(wish)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.timingBtnText}>⏰ Kapan Waktu Terbaik?</Text>
                          </TouchableOpacity>
                        )}
                      </>
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
                  {expanded && !isEditing && (
                    <TouchableOpacity onPress={() => startEdit(wish)} style={styles.footerBtn}>
                      <Text style={styles.footerBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {isEditing && (
                    <TouchableOpacity onPress={() => saveEdit(wish)} style={styles.footerBtn}>
                      <Text style={[styles.footerBtnText, { color: C.gold }]}>Simpan</Text>
                    </TouchableOpacity>
                  )}
                  {wish.analysis && expanded && !isEditing && (
                    <TouchableOpacity onPress={() => confirmReanalyze(wish)} style={styles.footerBtn}>
                      <Text style={[styles.footerBtnText, { color: C.gold }]}>Analisis Ulang</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => deleteWish(wish)} style={styles.footerBtn}>
                    <Text style={[styles.footerBtnText, { color: C.red }]}>Hapus</Text>
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

  // Intent chips
  chipsScroll: { marginBottom: 10 },
  chip: {
    borderWidth: 1, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: C.bg,
  },
  chipActive:     { borderColor: C.gold, backgroundColor: C.surfaceHigh },
  chipText:       { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  chipTextActive: { color: C.goldSoft },

  textArea: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 13,
    color: C.text,
    fontSize: 15,
    minHeight: 110,
    marginBottom: 4,
    lineHeight: 22,
  },
  charCount: { fontSize: 11, color: C.textFaint, textAlign: 'right', marginBottom: 12 },
  saveBtn: {
    backgroundColor: C.gold, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText:     { color: C.bg, fontWeight: '800', fontSize: 15 },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { color: C.textMuted, fontSize: 14 },

  // List header with privacy toggle
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listLabel: { fontSize: 11, fontWeight: '800', color: C.textFaint, letterSpacing: 1.5 },
  revealBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  revealBtnText: { fontSize: 12, color: C.textMuted, fontWeight: '600' },

  emptyCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },

  wishCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  wishContent: { fontSize: 15, color: C.text, lineHeight: 23, marginBottom: 6 },
  wishDate:    { fontSize: 12, color: C.textFaint },
  blurredText: {
    color: 'transparent',
    textShadowColor: C.textMuted,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // Edit input
  editInput: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderRadius: 10,
    padding: 10,
    color: C.text,
    fontSize: 15,
    minHeight: 80,
    marginBottom: 6,
    lineHeight: 22,
  },

  wishExpanded: { marginTop: 12 },

  analyzingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzingText: { color: C.textMuted, fontSize: 13, flex: 1 },

  analyzeBtn: {
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.gold,
    borderRadius: 10, paddingVertical: 11, alignItems: 'center',
  },
  analyzeBtnText: { color: C.goldSoft, fontWeight: '700', fontSize: 14 },

  analysisBox: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3, borderLeftColor: C.gold, borderRadius: 10, padding: 13,
  },
  analysisLabel:  { fontSize: 11, fontWeight: '900', color: C.gold, marginBottom: 8, letterSpacing: 0.8 },
  analysisText:   { fontSize: 14, color: C.text, lineHeight: 23 },
  analyzedAtText: { fontSize: 11, color: C.textFaint, marginTop: 8, fontStyle: 'italic' },

  wishFooter: {
    flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  footerBtn:     { paddingVertical: 2 },
  footerBtnText: { fontSize: 13, color: C.textMuted, fontWeight: '600' },

  // Timing
  timingBtn: {
    marginTop: 10, borderWidth: 1, borderColor: C.teal + '88',
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: C.teal + '15',
  },
  timingBtnText: { fontSize: 13, fontWeight: '700', color: C.teal },
  timingLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  timingLoadingText: { color: C.textMuted, fontSize: 13 },
  timingBox: {
    marginTop: 10, backgroundColor: C.teal + '12',
    borderWidth: 1, borderColor: C.teal + '44',
    borderLeftWidth: 3, borderLeftColor: C.teal,
    borderRadius: 10, padding: 12,
  },
  timingLabel:   { fontSize: 11, fontWeight: '900', color: C.teal, letterSpacing: 0.8, marginBottom: 8 },
  timingText:    { fontSize: 13, color: C.text, lineHeight: 22 },
  timingHideBtn: { marginTop: 8, alignItems: 'flex-end' },
  timingHideBtnText: { fontSize: 11, color: C.teal, fontWeight: '700' },
});
