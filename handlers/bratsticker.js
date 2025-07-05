const axios = require('axios');
const config = require('../config/config');
const { MessageMedia } = require('whatsapp-web.js');

class BratStickerHandler {
    constructor() {
        this.apiUrl = config.ferdev.apiUrl;
        this.apiKey = config.ferdev.apiKey;
    }

    /**
     * Membuat brat sticker dari teks
     * @param {string} text - Teks untuk sticker brat
     * @returns {Promise<Buffer>} Buffer gambar sticker brat
     */
    async generateBratSticker(text) {
        try {
            const response = await axios.get(`${this.apiUrl}/maker/brat`, {
                params: {
                    text: text,
                    apikey: this.apiKey
                },
                responseType: 'arraybuffer'
            });

            if (response.status === 200) {
                return Buffer.from(response.data);
            } else {
                throw new Error(`API Error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error generating brat sticker:', error);
            throw error;
        }
    }

    /**
     * Handle pesan untuk brat sticker
     * @param {Object} message - Pesan WhatsApp
     * @param {Object} client - Client WhatsApp
     * @param {Map} userStates - State pengguna
     */
    async handleBratSticker(message, client, userStates) {
        const chatId = message.from;
        const messageText = message.body.trim();

        try {
            // Cek apakah pesan adalah command brat sticker
            if (this.isBratStickerCommand(messageText)) {
                const text = this.extractTextFromCommand(messageText);
                
                if (!text) {
                    await message.reply('❌ Mohon sertakan teks untuk sticker brat!\n\n*Contoh:*\n/brat Hello World\n/bratmake Charli XCX');
                    return;
                }

                // Validasi panjang teks
                if (text.length > 100) {
                    await message.reply('❌ Teks terlalu panjang! Maksimal 100 karakter.');
                    return;
                }

                // Kirim status processing
                await message.reply('🎨 Sedang membuat brat sticker...');

                // Generate brat sticker
                const stickerBuffer = await this.generateBratSticker(text);

                // Konversi ke MessageMedia
                const media = new MessageMedia('image/png', stickerBuffer.toString('base64'), 'brat-sticker.png');

                // Kirim sebagai sticker
                await client.sendMessage(chatId, media, {
                    sendMediaAsSticker: true,
                    stickerAuthor: config.sticker.author,
                    stickerName: config.sticker.packname,
                    stickerCategories: ['🎨', '💚']
                });

                // Update statistik jika diperlukan
                console.log(`Brat sticker created for ${chatId}: "${text}"`);

            } else if (userStates.get(chatId) === 'BRAT_STICKER_MODE') {
                // Jika user dalam mode brat sticker, treat semua pesan sebagai teks untuk sticker
                await this.handleBratStickerMode(message, client, userStates);
            }

        } catch (error) {
            console.error('Error in brat sticker handler:', error);
            await message.reply('❌ Gagal membuat brat sticker. Silakan coba lagi.');
        }
    }

    /**
     * Handle mode brat sticker khusus
     */
    async handleBratStickerMode(message, client, userStates) {
        const chatId = message.from;
        const text = message.body.trim();

        // Cek command keluar
        if (this.isExitCommand(text)) {
            userStates.delete(chatId);
            await message.reply('✅ Keluar dari mode Brat Sticker.\n\nKetik /menu untuk kembali ke menu utama.');
            return;
        }

        // Validasi teks
        if (text.length > 100) {
            await message.reply('❌ Teks terlalu panjang! Maksimal 100 karakter.\n\nKetik /menu untuk keluar.');
            return;
        }

        try {
            await message.reply('🎨 Sedang membuat brat sticker...');

            const stickerBuffer = await this.generateBratSticker(text);
            const media = new MessageMedia('image/png', stickerBuffer.toString('base64'), 'brat-sticker.png');

            await client.sendMessage(chatId, media, {
                sendMediaAsSticker: true,
                stickerAuthor: config.sticker.author,
                stickerName: config.sticker.packname,
                stickerCategories: ['🎨', '💚']
            });

            await message.reply('✅ Brat sticker berhasil dibuat!\n\nKirim teks lagi untuk membuat sticker baru, atau ketik /menu untuk keluar.');

        } catch (error) {
            console.error('Error in brat sticker mode:', error);
            await message.reply('❌ Gagal membuat brat sticker. Silakan coba lagi.');
        }
    }

    /**
     * Cek apakah pesan adalah command brat sticker
     */
    isBratStickerCommand(text) {
        const commands = ['/brat', 'brat', '/bratmake', 'bratmake', '/bratsticker', 'bratsticker'];
        const lowerText = text.toLowerCase();
        
        return commands.some(cmd => 
            lowerText.startsWith(cmd + ' ') || lowerText === cmd
        );
    }

    /**
     * Extract teks dari command
     */
    extractTextFromCommand(text) {
        const commands = ['/brat', 'brat', '/bratmake', 'bratmake', '/bratsticker', 'bratsticker'];
        const lowerText = text.toLowerCase();
        
        for (const cmd of commands) {
            if (lowerText.startsWith(cmd + ' ')) {
                return text.substring(cmd.length + 1).trim();
            }
        }
        return null;
    }

    /**
     * Cek command keluar
     */
    isExitCommand(text) {
        const exitCommands = ['/menu', 'menu', '/exit', 'exit', 'keluar', '/keluar', 'kembali', '/kembali'];
        return exitCommands.includes(text.toLowerCase());
    }

    /**
     * Aktifkan mode brat sticker
     */
    async activateBratStickerMode(message, userStates) {
        const chatId = message.from;
        userStates.set(chatId, 'BRAT_STICKER_MODE');
        
        await message.reply(`💚 *BRAT STICKER MODE*

Kirim teks untuk dijadikan brat sticker!

*Contoh:*
• Charli XCX
• Hello World
• Your Text Here

*Batasan:*
• Maksimal 100 karakter
• Semua teks akan dijadikan sticker

*Perintah:*
• /menu - Kembali ke menu utama
• /exit - Keluar dari mode ini

Sekarang kirim teks yang ingin dibuat sticker! 🎨`);
    }
}

// Export untuk digunakan di main bot
module.exports = BratStickerHandler;