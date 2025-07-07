// File: handlers/daftarquote.js

const daftarQuote = {
    quote: [
        "Hidup ini seperti sepeda. Agar tetap seimbang, kamu harus terus bergerak.",
        "Jangan menunggu kesempatan. Ciptakanlah kesempatan itu.",
        "Masa depan milik mereka yang percaya pada keindahan mimpi mereka.",
        "Kegagalan adalah sukses yang tertunda.",
        "Orang yang sukses adalah orang yang dapat membangun fondasi yang kuat dengan bata yang dilemparkan kepadanya.",
        "Mimpi tidak akan pernah menjadi kenyataan jika kamu hanya tidur.",
        "Jika kamu tidak dapat melakukan hal-hal besar, lakukan hal-hal kecil dengan cara yang besar.",
        "Kesuksesan adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.",
        "Jangan biarkan kemarin mengambil terlalu banyak dari hari ini.",
        "Kamu tidak harus menjadi hebat untuk memulai, tetapi kamu harus memulai untuk menjadi hebat."
    ],
    pantun: [
        "Jalan-jalan ke Kota Bogor\nBeli roti sama kacang\nWalau hidup serba susah\nJangan lupa tetap semangat",
        "Pergi ke pasar beli jambu\nJambu manis jambu merah\nHidup ini penuh cobaan\nTapi semangat jangan pernah merah",
        "Makan siang di warung tenda\nPesan nasi sama sayur\nHidup memang tidak mudah\nTapi jangan sampai mundur",
        "Ke pasar beli terong\nTerong ungu terong hijau\nJangan pernah putus asa\nMimpikanmu pasti tercapai",
        "Burung elang terbang tinggi\nHinggap di pohon beringin\nSetiap masalah pasti ada jalan\nYang penting kita tetap yakin",
        "Bunga melati bunga kenanga\nHarum semerbak di taman\nSemua orang punya mimpi\nTinggal bagaimana cara kita wujudkan",
        "Pergi ke sawah lihat padi\nPadi kuning siap dipanen\nHidup butuh kerja keras\nBiar mimpi bisa terwujud kemudian",
        "Ikan mas berenang di kolam\nAirnya jernih airnya bening\nJangan mudah menyerah\nKarena hidup butuh perjuangan yang panjang",
        "Pohon mangga berbuah lebat\nBuahnya manis buahnya segar\nSetiap orang punya rezeki\nYang penting kita selalu bersyukur",
        "Kucing garong lari ke hutan\nKejaran anjing si buntut putih\nHidup ini banyak rintangan\nTapi semangat jangan sampai putih"
    ],
    motivasi: [
        "💪 Jangan pernah menyerah! Setiap perjuangan memiliki hasil yang manis di ujungnya.",
        "🌟 Kamu lebih kuat dari yang kamu pikirkan. Terus berjuang dan buktikan!",
        "🚀 Mimpi bukanlah sesuatu yang kamu lihat saat tidur, tetapi sesuatu yang tidak membuatmu tidur.",
        "🔥 Kesuksesan dimulai dari langkah pertama. Jangan takut untuk memulai!",
        "⭐ Setiap hari adalah kesempatan baru untuk menjadi versi terbaik dari dirimu.",
        "🌈 Setelah hujan pasti ada pelangi. Setelah kesulitan pasti ada kemudahan.",
        "💎 Tekanan membuat berlian. Kesulitan membuatmu lebih kuat dan berharga.",
        "🏆 Kegagalan bukan akhir dari segalanya, tetapi awal dari kesuksesan yang sesungguhnya.",
        "🌺 Tumbuh dan berkembang membutuhkan waktu. Bersabarlah dengan prosesmu.",
        "🎯 Fokus pada tujuanmu, bukan pada hambatanmu. Kamu pasti bisa mencapainya!"
    ]
};

module.exports = daftarQuote;

// File: handlers/quote.js (Update QuoteGenerator class)

const daftarQuote = require('./daftarquote');

class QuoteGenerator {
    constructor() {
        this.stats = {
            totalQuotes: 0,
            totalPantun: 0,
            totalMotivasi: 0,
            lastGenerated: null
        };
    }

    getRandomContent(type) {
        try {
            const validTypes = ['quote', 'pantun', 'motivasi'];
            
            if (!validTypes.includes(type)) {
                return {
                    success: false,
                    error: '❌ Tipe konten tidak valid!'
                };
            }

            const contentList = daftarQuote[type];
            
            if (!contentList || contentList.length === 0) {
                return {
                    success: false,
                    error: `❌ Daftar ${type} tidak ditemukan atau kosong!`
                };
            }

            // Ambil konten random
            const randomIndex = Math.floor(Math.random() * contentList.length);
            const randomContent = contentList[randomIndex];

            // Update stats
            this.stats[`total${type.charAt(0).toUpperCase() + type.slice(1)}`]++;
            this.stats.lastGenerated = new Date();

            // Format output berdasarkan tipe
            let formatted = '';
            switch (type) {
                case 'quote':
                    formatted = `✨ *Quote Inspiratif* ✨\n\n"${randomContent}"\n\n━━━━━━━━━━━━━━━━━━━\n💫 Tetap semangat dan jangan pernah menyerah!`;
                    break;
                case 'pantun':
                    formatted = `🎭 *Pantun Hari Ini* 🎭\n\n${randomContent}\n\n━━━━━━━━━━━━━━━━━━━\n🌟 Semoga menghibur dan memotivasi!`;
                    break;
                case 'motivasi':
                    formatted = `🔥 *Motivasi Hari Ini* 🔥\n\n${randomContent}\n\n━━━━━━━━━━━━━━━━━━━\n✨ Kamu pasti bisa! Semangat terus!`;
                    break;
            }

            return {
                success: true,
                content: randomContent,
                formatted: formatted,
                type: type
            };

        } catch (error) {
            console.error('Error generating random content:', error);
            return {
                success: false,
                error: '❌ Terjadi kesalahan saat mengambil konten'
            };
        }
    }

    // Fungsi untuk mendapatkan statistik
    getStats() {
        return {
            ...this.stats,
            totalAvailable: {
                quotes: daftarQuote.quote?.length || 0,
                pantun: daftarQuote.pantun?.length || 0,
                motivasi: daftarQuote.motivasi?.length || 0
            }
        };
    }

    // Fungsi untuk menambah konten baru (jika diperlukan)
    addContent(type, content) {
        try {
            if (!daftarQuote[type]) {
                daftarQuote[type] = [];
            }
            daftarQuote[type].push(content);
            return {
                success: true,
                message: `✅ Konten ${type} berhasil ditambahkan!`
            };
        } catch (error) {
            return {
                success: false,
                error: '❌ Gagal menambahkan konten'
            };
        }
    }
}

module.exports = QuoteGenerator;