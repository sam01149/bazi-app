// Shared, classically-accurate explanations for BaZi branch interactions —
// single source of truth so CalendarScreen and ProfileScreen never drift into
// describing the same interaction type differently from each other.

export const PENALTY_NAME_ID: Record<string, string> = {
  'Ungrateful Penalty': 'Tidak Berterima Kasih',
  'Bullying Penalty': 'Penyalahgunaan Kuasa',
  'Uncivilized Penalty': 'Tidak Sopan',
};

export type InteractionDetail = { title: string; body: string };

export function getInteractionDetail(type: string, penaltyName?: string): InteractionDetail {
  if (type === 'clash') {
    return {
      title: 'Benturan (六冲)',
      body: 'Terjadi antara dua branch yang berhadapan 180° dalam siklus zodiak. Maknanya klasik adalah "gerakan" — perpisahan, perubahan mendadak, putusnya sesuatu yang sudah berjalan, kadang juga kecelakaan/cedera kecil. Bukan selalu soal konfrontasi terbuka, tapi soal sesuatu yang terdorong keluar dari posisinya.',
    };
  }
  if (type === 'six_combination') {
    return {
      title: 'Kombinasi (六合)',
      body: 'Terjadi saat dua branch yang berpasangan secara klasik bertemu dan "mengikat", menghasilkan elemen baru. Maknanya keharmonisan, dukungan, dan kemudahan bekerja sama — meski tidak selalu langsung memperkuat elemen yang chart-mu butuhkan.',
    };
  }
  if (type === 'harm') {
    return {
      title: 'Hambatan (六害)',
      body: 'Disebut juga 穿 ("menusuk"). BUKAN benturan terbuka seperti Benturan (Clash) — maknanya kerugian tersembunyi dari pihak yang seharusnya dekat atau membantumu: kecemburuan, bantuan yang berujung merugikan, atau dikhianati tanpa konfrontasi nyata.',
    };
  }
  if (type === 'self_penalty') {
    return {
      title: 'Hukuman Diri (自刑)',
      body: 'Terjadi saat branch yang sama (辰/午/酉/亥) bertemu dengan dirinya sendiri. Maknanya kontradiksi internal, sabotase diri, dan keragu-raguan — risiko terbesar datang dari dalam dirimu sendiri, bukan dari faktor luar.',
    };
  }
  if (type === 'penalty') {
    if (penaltyName === 'Ungrateful Penalty') {
      return {
        title: 'Hukuman Tidak Berterima Kasih (無恩之刑)',
        body: 'Terbentuk dari branch 寅-巳-申. Maknanya klasik: dikhianati atau tidak dihargai setelah memberi bantuan/kebaikan — bantuan yang diberikan tidak dibalas setara, kadang malah dibalas pengkhianatan.',
      };
    }
    if (penaltyName === 'Bullying Penalty') {
      return {
        title: 'Hukuman Penyalahgunaan Kuasa (持勢之刑)',
        body: 'Terbentuk dari branch 丑-戌-未. Maknanya klasik: konflik dari penyalahgunaan kekuasaan/posisi — entah kamu yang tertindas otoritas, atau kamu sendiri bersikap otoriter ke pihak yang lebih lemah.',
      };
    }
    if (penaltyName === 'Uncivilized Penalty') {
      return {
        title: 'Hukuman Tidak Sopan (無禮之刑)',
        body: 'Terbentuk dari branch 子-卯. Maknanya klasik: sengketa akibat kurangnya rasa hormat/batasan — sering muncul sebagai konflik keluarga atau situasi yang tidak menghormati posisimu.',
      };
    }
    return {
      title: 'Hukuman (刑)',
      body: 'Salah satu dari tiga jenis Hukuman klasik (Tidak Berterima Kasih, Penyalahgunaan Kuasa, atau Tidak Sopan) — masing-masing punya makna berbeda tergantung kombinasi branch yang terlibat.',
    };
  }
  return { title: type, body: 'Tidak ada penjelasan tambahan untuk tipe interaksi ini.' };
}
