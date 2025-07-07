const daftarQuote = require('../handlers/daftarquote');

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
                    formatted = `✨ *Quote of today* ✨\n\n"${randomContent}"\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💫 Tetap semangat dan jangan pernah menyerah!`;
                    break;
                case 'pantun':
                    formatted = `🎭 *Pantun Hari Ini* 🎭\n\n${randomContent}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌟 Semoga menghibur dan memotivasi!`;
                    break;
                case 'motivasi':
                    formatted = `🔥 *Motivasi Hari Ini* 🔥\n\n${randomContent}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ Kamu pasti bisa! Semangat terus!`;
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