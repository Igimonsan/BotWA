
const daftarquote = require('./daftarquote');

class QuoteGenerator {
    constructor() {
        this.quotes = daftarquote.quotes.random;
        this.pantun = daftarquote.quotes.pantun;
        this.motivasi = daftarquote.quotes.motivasi;
    }

    getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 1000; // 1000-4000ms (1-4 detik)
    }

    sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate random quote
    getRandomQuote() {
        try {
            const delay = this.getRandomDelay();
            const randomIndex = Math.floor(Math.random() * this.quotes.length);
            const quote = this.quotes[randomIndex];
            
            return {
                success: true,
                type: 'quote',
                content: quote.text,
                author: quote.author,
                formatted: this.formatQuote(quote)
            };
        } catch (error) {
            console.error('Error generating random quote:', error);
            return {
                success: false,
                error: 'Gagal mengambil quote random'
            };
        }
    }

    // Generate random pantun
    getRandomPantun() {
        try {
            const delay = this.getRandomDelay();
            const randomIndex = Math.floor(Math.random() * this.pantun.length);
            const pantun = this.pantun[randomIndex];
            
            return {
                success: true,
                type: 'pantun',
                content: pantun,
                formatted: this.formatPantun(pantun)
            };
        } catch (error) {
            console.error('Error generating random pantun:', error);
            return {
                success: false,
                error: 'Gagal mengambil pantun random'
            };
        }
    }

    // Generate random motivasi
    getRandomMotivasi() {
        try {
            const delay = this.getRandomDelay();
            const randomIndex = Math.floor(Math.random() * this.motivasi.length);
            const motivasi = this.motivasi[randomIndex];
            
            return {
                success: true,
                type: 'motivasi',
                content: motivasi.text,
                author: motivasi.author,
                formatted: this.formatMotivasi(motivasi)
            };
        } catch (error) {
            console.error('Error generating random motivasi:', error);
            return {
                success: false,
                error: 'Gagal mengambil kata motivasi random'
            };
        }
    }

    // Get all types (untuk sub menu)
    getAllTypes() {
        return {
            '1': { name: 'Quote Random', handler: 'getRandomQuote' },
            '2': { name: 'Pantun Random', handler: 'getRandomPantun' },
            '3': { name: 'Kata Motivasi', handler: 'getRandomMotivasi' }
        };
    }

    // Handle quote request berdasarkan pilihan
    handleQuoteRequest(choice) {
        const delay = this.getRandomDelay();
        const types = this.getAllTypes();
        const selectedType = types[choice];

        if (!selectedType) {
            return {
                success: false,
                error: 'Pilihan tidak valid. Pilih 1-3'
            };
        }

        // Call the appropriate handler method
        return this[selectedType.handler]();
    }

    // Format quote untuk tampilan
    formatQuote(quote) {
        return `💭 *QUOTE RANDOM*\n\n"${quote.text}"\n\n👤 *- ${quote.author}*\n\n✨ Semoga menginspirasi!`;
    }

    // Format pantun untuk tampilan
    formatPantun(pantun) {
        const delay = this.getRandomDelay();
        const lines = pantun.split('\n');
        const formattedLines = lines.map(line => `  ${line}`).join('\n');
        
        return `🎭 *PANTUN RANDOM*\n\n${formattedLines}\n\n😄 Semoga menghibur!`;
    }

    // Format motivasi untuk tampilan
    formatMotivasi(motivasi) {
        return `🔥 *KATA MOTIVASI*\n\n"${motivasi.text}"\n\n👤 *- ${motivasi.author}*\n\n💪 Tetap semangat!`;
    }

    // Get stats
    getStats() {
        return {
            totalQuotes: this.quotes.length,
            totalPantun: this.pantun.length,
            totalMotivasi: this.motivasi.length
        };
    }

    // Validate data
    validateData() {
        const errors = [];
        
        if (!this.quotes || this.quotes.length === 0) {
            errors.push('Quotes data is empty');
        }
        
        if (!this.pantun || this.pantun.length === 0) {
            errors.push('Pantun data is empty');
        }
        
        if (!this.motivasi || this.motivasi.length === 0) {
            errors.push('Motivasi data is empty');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = QuoteGenerator;