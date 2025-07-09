const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');
const AIHandler = require('../handlers/aihandler');
const StickerMaker = require('../handlers/stickermaker');
const QuoteGenerator = require('../handlers/quote');
const axios = require('axios');

class WhatsAppClient {
    constructor() {
    this.sock = null;
    this.userStates = new Map();
    this.aiHandler = new AIHandler();
    this.stickerMaker = new StickerMaker();
    this.quoteGenerator = new QuoteGenerator();

    // ANTI-SPAM SYSTEM
    this.messageQueue = new Map();
    this.userLastMessage = new Map();
    this.userWelcomeCount = new Map();
    this.processingUsers = new Set();
    
    // STATISTIK BOT - TAMBAHAN BARU
    this.botStats = {
        startTime: Date.now(),
        totalMessages: 0,
        totalCommands: 0,
        downloadSuccess: 0,
        downloadFailed: 0,
        mediaProcessed: 0,
        stickersCreated: 0,
        audioDownloaded: 0,
        videoDownloaded: 0,
        activeUsers: new Set(),
        commandUsage: new Map(),
        lastActivity: Date.now()
    };
    
    this.setupCleanupInterval();
}

    getRandomDelay() {
        return Math.floor(Math.random() * 1000) + 1000;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // =================== STATISTIK METHODS ===================

updateBotStats(action, value = 1) {
    switch(action) {
        case 'message':
            this.botStats.totalMessages += value;
            break;
        case 'command':
            this.botStats.totalCommands += value;
            break;
        case 'download_success':
            this.botStats.downloadSuccess += value;
            break;
        case 'download_failed':
            this.botStats.downloadFailed += value;
            break;
        case 'media_processed':
            this.botStats.mediaProcessed += value;
            break;
        case 'sticker_created':
            this.botStats.stickersCreated += value;
            break;
        case 'audio_downloaded':
            this.botStats.audioDownloaded += value;
            break;
        case 'video_downloaded':
            this.botStats.videoDownloaded += value;
            break;
    }
    this.botStats.lastActivity = Date.now();
}

trackCommandUsage(command, sender) {
    // Track command usage
    const count = this.botStats.commandUsage.get(command) || 0;
    this.botStats.commandUsage.set(command, count + 1);
    
    // Track active user
    this.botStats.activeUsers.add(sender);
}

getTopCommands(limit = 5) {
    const sorted = Array.from(this.botStats.commandUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    
    return sorted.map(([command, count]) => ({ command, count }));
}

getUptime() {
    const uptimeMs = Date.now() - this.botStats.startTime;
    const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((uptimeMs % (60 * 1000)) / 1000);
    
    return { days, hours, minutes, seconds, totalMs: uptimeMs };
}

    // ANTI-SPAM: Cek apakah pesan duplicate
    isDuplicateMessage(sender, messageKey, text) {
        const userMessages = this.userLastMessage.get(sender) || [];
        const currentTime = Date.now();

        const recentMessages = userMessages.filter(msg => currentTime - msg.timestamp < 10000);

        const isDuplicate = recentMessages.some(msg =>
            msg.key === messageKey ||
            (msg.text === text && currentTime - msg.timestamp < 3000)
        );

        if (!isDuplicate) {
            recentMessages.push({
                key: messageKey,
                text: text,
                timestamp: currentTime
            });

            this.userLastMessage.set(sender, recentMessages.slice(-5));
        }

        return isDuplicate;
    }

    isUserBeingProcessed(sender) {
        return this.processingUsers.has(sender);
    }

    setUserProcessing(sender, processing = true) {
        if (processing) {
            this.processingUsers.add(sender);
        } else {
            this.processingUsers.delete(sender);
        }
    }

    async initialize() {
        try {
            await fs.ensureDir(config.folders.sessions);
            const { state, saveCreds } = await useMultiFileAuthState(config.folders.sessions);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                defaultQueryTimeoutMs: 60000,
            });

            this.setupEventHandlers(saveCreds);
            return this.sock;

        } catch (error) {
            console.error('Error initializing WhatsApp client:', error);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        if (!this.sock) {
            console.error('Socket belum diinisialisasi!');
            return;
        }

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n📱 Scan QR Code berikut untuk login:');
                qrcode.generate(qr, { small: true });
                console.log('\nBuka WhatsApp di HP > Pengaturan > Perangkat Tertaut > Tautkan Perangkat');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);

                if (shouldReconnect) {
                    this.initialize();
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp Bot terhubung!');
                console.log('🤖 Bot siap menerima pesan dengan command system...\n');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('messages.upsert', async (m) => {
            try {
                await this.handleMessage(m);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }

    async handleMessage(m) {
    const messages = m.messages;

    if (!messages || messages.length === 0) return;

    for (const message of messages) {
        if (message.key.fromMe) continue;

        const sender = message.key.remoteJid;
        const messageKey = message.key.id;
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

        // TRACKING STATISTIK - TAMBAHAN BARU
        this.updateBotStats('message');
        
        // Ambil caption dari gambar/video jika ada
        const imageCaption = message.message?.imageMessage?.caption || '';
        const videoCaption = message.message?.videoMessage?.caption || '';
        const caption = imageCaption || videoCaption || '';

            // =================== VALIDASI GRUP/CHAT PRIBADI ===================

            // Deteksi apakah pesan dari grup atau chat pribadi
            const isGroupChat = sender.endsWith('@g.us');
            const isPrivateChat = sender.endsWith('@s.whatsapp.net');

            // Cek apakah pesan adalah command (dimulai dengan !)
            const isCommand = (text && text.trim().startsWith('!')) ||
                (caption && caption.trim().startsWith('!'));

            console.log(`📨 ${isGroupChat ? '👥 GROUP' : '👤 PRIVATE'} - ${sender}: ${text || caption} ${message.message?.imageMessage || message.message?.videoMessage ? '[Media]' : ''}`);

            // VALIDASI: Jika dari grup dan bukan command, skip
            if (isGroupChat && !isCommand) {
                console.log(`🚫 Pesan dari grup tanpa command, diabaikan: ${sender}`);
                continue;
            }

            // ANTI-SPAM: Cek duplicate message
            if (this.isDuplicateMessage(sender, messageKey, text || caption)) {
                console.log(`🚫 Duplicate message from ${sender}, skipping...`);
                continue;
            }

            // ANTI-SPAM: Cek apakah user sedang diproses
            if (this.isUserBeingProcessed(sender)) {
                console.log(`⏳ User ${sender} sedang diproses, skipping...`);
                continue;
            }

            // PRIORITAS PERTAMA: Cek gambar dengan caption command
            if (message.message?.imageMessage || message.message?.videoMessage) {
                const lowerCaption = caption.toLowerCase().trim();

                // Command: !tohitam
                if (lowerCaption.includes('!tohitam') || lowerCaption.includes('!hitamkan')) {
                    const tohitamCommand = require('../handlers/tohitam');
                    await tohitamCommand(this.sock, message);
                    continue;
                }

                // Command: !sticker dengan caption
                if (lowerCaption === '!sticker' || lowerCaption.startsWith('!sticker ')) {
                    console.log(`🎨 Processing sticker from image with caption: ${caption}`);
                    // Tandai user sedang diproses
                    this.setUserProcessing(sender, true);

                    try {
                        await this.handleStickerCommand(sender, message);
                    } catch (error) {
                        console.error('Error processing sticker from caption:', error);
                        await this.sendMessage(sender, "❌ Terjadi kesalahan saat membuat sticker.");
                    } finally {
                        this.setUserProcessing(sender, false);
                    }
                    continue;
                }
            }

            const hasMedia = message.message?.imageMessage ||
                message.message?.videoMessage ||
                message.message?.stickerMessage ||
                message.message?.documentMessage;

            // Tandai user sedang diproses
            this.setUserProcessing(sender, true);

            try {
                await this.processMessage(sender, text, message, isGroupChat);
            } catch (error) {
                console.error('Error processing message:', error);
            } finally {
                this.setUserProcessing(sender, false);
            }
        }
    }

    async processMessage(sender, text, message, isGroupChat = false) {
        const lowerText = text.toLowerCase().trim();

        try {
            // =================== COMMAND SYSTEM ===================

            if (lowerText.startsWith('!')) {
            this.updateBotStats('command');
            const command = lowerText.split(' ')[0];
            this.trackCommandUsage(command, sender);
        }

            // Command: !help atau !menu
            if (lowerText === '!help' || lowerText === '!menu') {
                await this.sendHelpMessage(sender);
                return;
            }

            // Command: !tiktok [link]
            if (lowerText.startsWith('!tiktok ')) {
                const url = text.substring(8).trim(); // Hapus "!tiktok "
                await this.handleTikTokCommand(sender, url);
                return;
            }

            if (lowerText === '!ibot') {
            await this.sendBotStatsMessage(sender);
            return;
        }

            // Command: !sticker (dengan media)
            if (lowerText === '!sticker') {
                await this.handleStickerCommand(sender, message);
                return;
            }

           if (lowerText === '!quote') {
            await this.handleQuoteCommand(sender, 'quote');
            return;
            }

            // Command: !pantun
            if (lowerText === '!pantun') {
            await this.handleQuoteCommand(sender, 'pantun');
            return;
            }

            // Command: !motivasi
            if (lowerText === '!motivasi') {
              await this.handleQuoteCommand(sender, 'motivasi');
             return;
            }

            //!brat
            if (lowerText.startsWith('!brats')) {
                const url = text.substring(7).trim();
                await this.handleBratsticker(sender, url);
                return;
            }

            if (lowerText.startsWith('!ig ')) {
            const url = text.substring(4).trim();
            await this.handleInstagramCommand(sender, url);
            return;
            }
            
            // Command: !facebook [link]
            if (lowerText.startsWith('!fb')) {
                const url = text.substring(4).trim();
                await this.handleFacebookCommand(sender, url);
                return;
            }

            // Command: !ytmp4 [link]
            if (lowerText.startsWith('!ytmp4 ')) {
                const url = text.substring(7).trim();
                await this.handleYTMP4Command(sender, url);
                return;
            }

            // Command: !ytmp3 [link]
            if (lowerText.startsWith('!ytmp3 ')) {
                const url = text.substring(7).trim();
                await this.handleYTMP3Command(sender, url);
                return;
            }

            // Command: !ai [pertanyaan]
            if (lowerText.startsWith('!ai ')) {
                const question = text.substring(4).trim();
                await this.handleAICommand(sender, question);
                return;
            }

            // Command: !info
            if (lowerText === '!info') {
                await this.sendMessage(sender, config.messages.info);
                return;
            }

            // =================== PESAN TIDAK DIKENALI ===================

            // Jika pesan tidak dimulai dengan command
            if (!lowerText.startsWith('!')) {
                // Untuk grup: tidak ada respons karena sudah difilter di handleMessage
                // Untuk chat pribadi: berikan petunjuk
                if (!isGroupChat) {
                    await this.sendMessage(sender,
                        "🤖 *Igimonsan Bot*\n\n" +
                        "Halo! Silahkan respon dengan perintah\n" +
                        "Ketik *!help*\n\n" +
                        "Contoh penggunaan : `!hitamkan (kirim gambar)`"
                    );
                }
                return;
            }

            // Jika command tidak dikenali
            await this.sendMessage(sender,
                "❌ Perintah tidak dikenali!\n\n" +
                "Ketik *!help* untuk melihat daftar command yang tersedia."
            );

        } catch (error) {
            console.error('Error processing message:', error);
            await this.sendMessage(sender, "❌ Terjadi kesalahan dalam memproses pesan.");
        }
    }

    async sendBotStatsMessage(sender) {
    try {
        const uptime = this.getUptime();
        const topCommands = this.getTopCommands();
        const activeUsers = this.botStats.activeUsers.size;
        const totalUsers = this.userStates.size;

        const uptimeStr = `${uptime.days}d ${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s`;
        
        const topCommandsStr = topCommands.length > 0 
            ? topCommands.map((cmd, index) => `${index + 1}. ${cmd.command} (${cmd.count}x)`).join('\n')
            : 'Belum ada data';

        const statsMessage = `🤖 *INFORMASI BOT REAL-TIME*\n\n` +
            `⏱️ *Uptime:* ${uptimeStr}\n` +
            `📊 *Total Pesan:* ${this.botStats.totalMessages}\n` +
            `⚡ *Command Diproses:* ${this.botStats.totalCommands}\n\n` +
            `📥 *Download Statistics:*\n` +
            `✅ Berhasil: ${this.botStats.downloadSuccess}\n` +
            `❌ Gagal: ${this.botStats.downloadFailed}\n` +
            `🎬 Video: ${this.botStats.videoDownloaded}\n` +
            `🎵 Audio: ${this.botStats.audioDownloaded}\n\n` +
            `🎨 *Media Processing:*\n` +
            `📁 Media Diproses: ${this.botStats.mediaProcessed}\n` +
            `🎭 Sticker Dibuat: ${this.botStats.stickersCreated}\n\n` +
            `👥 *User Statistics:*\n` +
            `👤 Total Pengguna: ${totalUsers}\n` +
            `🟢 Pengguna Aktif: ${activeUsers}\n\n` +
            `🏆 *Top Commands:*\n${topCommandsStr}\n\n` +
            `📊 Status: Online dan Berjalan Normal`;

        await this.sendMessage(sender, statsMessage);
    } catch (error) {
        console.error('Error sending bot stats:', error);
        await this.sendMessage(sender, "❌ Terjadi kesalahan saat mengambil statistik bot");
    }
}

    // =================== COMMAND HANDLERS ===================

    async sendHelpMessage(sender) {
    const helpMessage = `🤖 *DAFTAR PERINTAH YANG TERSEDIA*\n\n` +
        `📱 *Media Downloader:*\n` +
        `• !tiktok [link] - Download video TikTok\n` +
        `• !fb [link] - Download video Facebook\n` +
        `• !ytmp4 [link] - Download video YouTube\n` +
        `• !ig [link] - Download video Instagram\n` +
        `• !ytmp3 [link] - Download audio YouTube\n\n` +
        `🎨 *Tools:*\n` +
        `• !sticker - Buat sticker (kirim gambar)\n` +
        `• !brats - Buat sticker dari teks\n` +
        `• !quote - Quote random\n` +
        `• !pantun - Pantun random\n` +
        `• !motivasi - Motivasi random\n` +
        `• !ai [pertanyaan] - Chat dengan AI\n` +
        `• !hitamkan - Penghitaman (kirim gambar)\n\n` +
        `ℹ️ *Info:*\n` +
        `• !help - Tampilkan pesan ini\n` +
        `• !info - Info bot\n` +
        `• !ibot - Statistik bot real-time\n\n` + // TAMBAHAN BARU
        `📝 *Cara Penggunaan:*\n` +
        `Contoh: !tiktok https://vt.tiktok.com/...\n` +
        `Contoh: !ai Siapa jokowi`;

    await this.sendMessage(sender, helpMessage);
}
    async handleTikTokCommand(sender, url) {
        if (!url) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan: `!tiktok [link]`\n" +
                "Contoh: `!tiktok https://vt.tiktok.com/...`"
            );
            return;
        }

        if (!config.tiktokRegex.test(url)) {
            await this.sendMessage(sender, "❌ Link TikTok tidak valid!");
            return;
        }

        await this.processTikTokDownload(sender, url);
    }

    async handleStickerCommand(sender, message) {
        const hasMedia = message.message?.imageMessage ||
            message.message?.videoMessage ||
            message.message?.stickerMessage ||
            message.message?.documentMessage;

        if (!hasMedia) {
            await this.sendMessage(sender,
                "❌ Tidak ada media ditemukan!\n\n" +
                "Cara penggunaan:\n" +
                "1. Kirim gambar/video dengan caption `!sticker`\n" +
                "2. Atau kirim media dulu, lalu balas dengan `!sticker`"
            );
            return;
        }

        // Cek apakah media adalah sticker (untuk convert sticker to image)
        if (message.message?.stickerMessage) {
            await this.sendMessage(sender,
                "ℹ️ Media yang dikirim adalah sticker.\n" +
                "Untuk membuat sticker, kirim gambar atau video dengan caption `!sticker`"
            );
            return;
        }

        await this.processStickerCreation(sender, message);
    }

    async handleBratsticker(sender, text) {
        if (!text) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan : !bratsticker\n" +
                "Contoh : !bratsticker"
            );
            return;
        }

        try {
            const url = config.ferdev.apiUrl + '/maker/brat?text=' + text + '&apikey=' + config.ferdev.apiKey
            const buffer = await this.getbuffer(url)

            const result = await this.stickerMaker.createSticker(buffer, "image/jpeg")

            if (result.success) {
                await this.sendSticker(sender, result.filePath);

                // Cleanup file setelah 60 detik
                setTimeout(async () => {
                    try {
                        await fs.remove(result.filePath);
                        console.log(`🗑️ File sticker ${result.fileName} telah dihapus`);
                    } catch (err) {
                        console.error('Error deleting sticker file:', err);
                    }
                }, 60000);
                
                console.log(`✅ Sticker created successfully for ${sender}`);

            } else {
                await this.sendMessage(sender, result.error || '❌ Gagal membuat sticker');
                console.error('Sticker creation failed:', result.error);
            }
        } catch (error) {
            console.error('Error processing bratsticker:', error);
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat membuat sticker');
        }
    }

    async getbuffer(url, options) {
        try {
            options ? options : {}
            const res = await axios({
                method: "get",
                url,
                headers: {
                    'DNT': 1,
                    'Upgrade-Insecure-Request': 1,
                    ...options,
                },
                ...options,
                responseType: 'arraybuffer'
            })
            return res.data
        } catch (err) {
            return false
        }
    }

    async handleInstagramCommand(sender, url) {
    if (!url) {
        await this.sendMessage(sender,
            "❌ Format salah!\n\n" +
            "Cara penggunaan: `!instagram [link]`\n" +
            "Contoh: `!instagram https://www.instagram.com/reel/...`\n" +
            "Atau: `!ig https://www.instagram.com/p/...`"
        );
        return;
    }

    // Update regex untuk menangani berbagai format Instagram URL
    const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+/;
    
    if (!instagramRegex.test(url)) {
        await this.sendMessage(sender, "❌ Link Instagram tidak valid!\n\nPastikan link adalah post, reel, atau IGTV Instagram");
        return;
    }

    await this.processInstagramDownload(sender, url);
}


    async handleFacebookCommand(sender, url) {
        if (!url) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan: `!facebook [link]`\n" +
                "Contoh: `!facebook https://www.facebook.com/...`"
            );
            return;
        }

        if (!config.facebookRegex.test(url)) {
            await this.sendMessage(sender, "❌ Link Facebook tidak valid!");
            return;
        }

        await this.processFacebookDownload(sender, url);
    }

    async handleYTMP4Command(sender, url) {
        if (!url) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan: `!ytmp4 [link]`\n" +
                "Contoh: `!ytmp4 https://youtube.com/watch?v=...`"
            );
            return;
        }

        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        if (!ytRegex.test(url)) {
            await this.sendMessage(sender, "❌ Link YouTube tidak valid!");
            return;
        }

        await this.processYTMP4Download(sender, url);
    }

    async handleYTMP3Command(sender, url) {
        if (!url) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan: `!ytmp3 [link]`\n" +
                "Contoh: `!ytmp3 https://youtube.com/watch?v=...`"
            );
            return;
        }

        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        if (!ytRegex.test(url)) {
            await this.sendMessage(sender, "❌ Link YouTube tidak valid!");
            return;
        }

        await this.processYTMP3Download(sender, url);
    }


    async processDirectAIQuestion(sender, question) {
        try {
            const axios = require('axios');

            // Gunakan model default ChatGPT
            const apiEndpoint = `${config.AI.apiUrl}${config.AI.models.default}`;

            const requestData = {
                prompt: question,
                logic: 'Kamu adalah Igimonsan Bot, setiap prompt menggunakan bahasa indonesia tanpa pengecualianpun!',
                apikey: config.AI.apikey
            };

            console.log(`🤖 Direct AI Request: ${question.substring(0, 50)}...`);

            // Call API dengan timeout
            const response = await axios.get(apiEndpoint, {
                params: requestData,
                timeout: 30000
            });

            console.log('🔍 API Response:', response.data);

            // Validasi response
            if (!response.data) {
                throw new Error('No response data from API');
            }

            if (response.data.success === false) {
                throw new Error(response.data.message || 'API returned error');
            }

            // Extract AI response dengan fallback
            let aiResponse = '';

            if (response.data.message) {
                aiResponse = response.data.message;
            } else if (response.data.data) {
                aiResponse = response.data.data;
            } else if (response.data.result) {
                aiResponse = response.data.result;
            } else if (response.data.response) {
                aiResponse = response.data.response;
            } else if (response.data.answer) {
                aiResponse = response.data.answer;
            } else if (typeof response.data === 'string') {
                aiResponse = response.data;
            } else {
                throw new Error('No valid response found in API data');
            }

            // Validasi response tidak kosong
            if (!aiResponse || aiResponse.trim() === '') {
                throw new Error('Empty response from AI');
            }

            return {
                success: true,
                message: `🤖 *ChatGPT Response*\n\n${aiResponse}`
            };

        } catch (error) {
            console.error('Error processing direct AI question:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            // Handle specific error types
            let errorMessage = "❌ Terjadi kesalahan saat memproses AI";

            if (error.code === 'ENOTFOUND') {
                errorMessage = '❌ Tidak dapat terhubung ke server AI. Periksa koneksi internet.';
            } else if (error.response?.status === 429) {
                errorMessage = '❌ Server AI sedang sibuk. Coba lagi dalam beberapa menit.';
            } else if (error.response?.status === 401) {
                errorMessage = '❌ API Key tidak valid. Hubungi administrator.';
            } else if (error.response?.status === 400) {
                const apiMessage = error.response?.data?.message || error.message;
                errorMessage = `❌ Request Error: ${apiMessage}`;
            } else if (error.message.includes('Empty response')) {
                errorMessage = '❌ AI tidak memberikan respons. Coba dengan pertanyaan yang berbeda.';
            } else if (error.message.includes('timeout')) {
                errorMessage = '❌ Request timeout. Server AI terlalu lambat merespons.';
            }

            return {
                success: false,
                message: errorMessage
            };
        }
    }

    async handleAICommand(sender, question) {
        if (!question) {
            await this.sendMessage(sender,
                "❌ Format salah!\n\n" +
                "Cara penggunaan: `!ai [pertanyaan]`\n" +
                "Contoh: `!ai Siapa presiden Indonesia?`"
            );
            return;
        }

        try {
            await this.sendMessage(sender, '🤖 Sedang memproses pertanyaan AI...');

            // Langsung proses pertanyaan AI tanpa session
            const result = await this.processDirectAIQuestion(sender, question);

            if (result && result.success) {
                await this.sendMessage(sender, result.message);
            } else {
                await this.sendMessage(sender, result?.message || "❌ Gagal memproses pertanyaan AI");
            }
        } catch (error) {
            console.error('Error processing AI command:', error);
            await this.sendMessage(sender, "❌ Terjadi kesalahan saat memproses AI");
        }
    }


    async handleQuoteCommand(sender, type) {
    try {
        await this.sendMessage(sender, '⏳ Tungu sebentar..');

        const result = this.quoteGenerator.getRandomContent(type);

        if (result.success) {
            await this.sendMessage(sender, result.formatted);
        } else {
            await this.sendMessage(sender, result.error || '❌ Gagal mengambil konten');
        }

    } catch (error) {
        console.error(`Error processing ${type} command:`, error);
        await this.sendMessage(sender, '❌ Terjadi kesalahan saat mengambil konten');
    }
}


    // =================== PROCESSING METHODS ===================

    async processQuoteGeneration(sender, type) {
    try {
        await this.sendMessage(sender, '⏳ Sedang mengambil konten...');

        const result = this.quoteGenerator.getRandomContent(type);

        if (result.success) {
            await this.sendMessage(sender, result.formatted);
        } else {
            await this.sendMessage(sender, result.error || '❌ Gagal mengambil konten');
        }

    } catch (error) {
        console.error('Error processing quote generation:', error);
        await this.sendMessage(sender, '❌ Terjadi kesalahan saat mengambil konten');
    }
}

    async processTikTokDownload(sender, url) {
        try {
            await this.sendMessage(sender, '⏳ Sedang memproses download...');

            const TikTokDownloader = require('../tiktok/tiktokDownloader');
            const downloader = new TikTokDownloader();

            const result = await downloader.processDownload(url, 'Video TikTok');

            if (result.success) {
                this.updateBotStats('download_success');
            this.updateBotStats('video_downloaded');
                await this.sendVideo(sender, result.filePath, result.title, result.author);

                setTimeout(async () => {
                    try {
                        await fs.remove(result.filePath);
                        console.log(`File ${result.fileName} telah dihapus`);
                    } catch (err) {
                        console.error('Error deleting file:', err);
                    }
                }, 60000);

            } else {
                this.updateBotStats('download_failed');
                await this.sendMessage(sender, result.error || '❌ Gagal mendownload video');
            }

        } catch (error) {
            console.error('Error processing TikTok download:', error);
            this.updateBotStats('download_failed'); // TAMBAHAN BARU
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat mendownload');
        }
    }

    async processStickerCreation(sender, message) {
        try {
        await this.sendMessage(sender, '⏳ Sedang membuat sticker...');

        // TRACKING - TAMBAHAN BARU
        this.updateBotStats('media_processed');

        const mediaData = await this.downloadMedia(message);

        if (!mediaData) {
            await this.sendMessage(sender, '❌ Gagal mengunduh media');
            return;
        }

            console.log(`📁 Media downloaded: ${mediaData.mimetype}, size: ${mediaData.buffer.length} bytes`);

            const validation = await this.stickerMaker.validateMedia(mediaData.buffer, mediaData.mimetype);

            if (!validation.isValid) {
                const errorMessage = validation.errors.join('\n');
                await this.sendMessage(sender, `❌ ${errorMessage}`);
                return;
            }

            const result = await this.stickerMaker.createSticker(mediaData.buffer, mediaData.mimetype);

            if (result.success) {
                this.updateBotStats('sticker_created');

            await this.sendSticker(sender, result.filePath);

                // Cleanup file setelah 60 detik
                setTimeout(async () => {
                    try {
                        await fs.remove(result.filePath);
                        console.log(`🗑️ File sticker ${result.fileName} telah dihapus`);
                    } catch (err) {
                        console.error('Error deleting sticker file:', err);
                    }
                }, 60000);

                await this.sendMessage(sender, '✅ Sticker berhasil dibuat!');
                console.log(`✅ Sticker created successfully for ${sender}`);

            } else {
                await this.sendMessage(sender, result.error || '❌ Gagal membuat sticker');
                console.error('Sticker creation failed:', result.error);
            }

        } catch (error) {
            console.error('Error processing sticker creation:', error);
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat membuat sticker');
        }
    }

    

    async processInstagramDownload(sender, url) {
    try {
        await this.sendMessage(sender, '⏳ Sedang memproses download Instagram...');
        
        const { data } = await axios.get(`${config.ferdev.apiUrl}/downloader/instagram`, {
            params: {
                link: url,
                apikey: config.ferdev.apiKey,
            },
            timeout: 30000 // 30 detik timeout
        });

        console.log('Instagram API Response:', JSON.stringify(data, null, 2));

        if (!data || !data.success) {
            await this.sendMessage(sender, '❌ Gagal mendownload konten Instagram');
            return;
        }

        const responseData = data.data;
        
        if (!responseData || !responseData.success) {
            await this.sendMessage(sender, '❌ Gagal memproses konten Instagram');
            return;
        }

        // Handle berbagai tipe konten Instagram
        if (responseData.type === 'video') {
            await this.handleInstagramVideo(sender, responseData);
        } else if (responseData.type === 'image') {
            await this.handleInstagramImage(sender, responseData);
        } else if (responseData.type === 'carousel') {
            await this.handleInstagramCarousel(sender, responseData);
        } else {
            await this.sendMessage(sender, '❌ Tipe konten Instagram tidak didukung');
        }

    } catch (error) {
        console.error('Error processing Instagram download:', error);
        
        if (error.code === 'ECONNABORTED') {
            await this.sendMessage(sender, '❌ Timeout: Server terlalu lambat merespons');
        } else if (error.response?.status === 429) {
            await this.sendMessage(sender, '❌ Terlalu banyak request. Coba lagi dalam beberapa menit');
        } else {
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat mendownload');
        }
    }
}

    async handleInstagramVideo(sender, responseData) {
    try {
        // Cek apakah ada video URLs
        if (!responseData.videoUrls || responseData.videoUrls.length === 0) {
            await this.sendMessage(sender, '❌ Video tidak ditemukan');
            return;
        }

        // Ambil video berkualitas terbaik (biasanya index 0)
        const videoData = responseData.videoUrls[0];
        const videoUrl = videoData.url;
        
        if (!videoUrl) {
            await this.sendMessage(sender, '❌ Link video tidak valid');
            return;
        }

        // Prepare caption
        const title = responseData.metadata?.title || 'Video Instagram';
        const caption = `🎬 *Instagram Video*\n\n${title}\n\n✅ Video berhasil didownload!`;

        // Kirim video
        await this.sock.sendMessage(sender, {
            video: { url: videoUrl },
            caption: caption,
            mimetype: 'video/mp4'
        });

        console.log(`✅ Instagram video sent successfully to ${sender}`);

    } catch (error) {
        console.error('Error handling Instagram video:', error);
        await this.sendMessage(sender, '❌ Gagal mengirim video Instagram');
    }
}


    async processFacebookDownload(sender, url) {
        try {
            await this.sendMessage(sender, '⏳ Sedang memproses download...');

            const { data } = await axios.get(`${config.ferdev.apiUrl}/downloader/facebook`, {
                params: {
                    link: url,
                    apikey: config.ferdev.apiKey,
                }
            });

            if (!data || !data.success) {
                await this.sendMessage(sender, '❌ Gagal mendownload video Facebook');
                return;
            }

            const videoUrl = data.data.hd;
            await this.sock.sendMessage(sender, {
                video: { url: videoUrl },
                caption: data?.data.title || 'Video Facebook',
                mimetype: 'video/mp4'
            });

            await this.sendMessage(sender, '✅ Video Facebook berhasil didownload!');

        } catch (error) {
            console.error('Error processing Facebook download:', error);
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat mendownload');
        }
    }

    async processYTMP4Download(sender, url) {
        try {
            await this.sendMessage(sender, '⏳ Sedang memproses download...');

            const { data } = await axios.get(`${config.ferdev.apiUrl}/downloader/ytmp4`, {
                params: {
                    link: url,
                    apikey: config.ferdev.apiKey,
                }
            });

            if (!data || !data.success) {
                await this.sendMessage(sender, '❌ Gagal mendownload video YouTube');
                return;
            }

            const videoUrl = data.data?.dlink || data.data?.video || data.data?.url || data.data?.download_url;

            if (!videoUrl) {
                await this.sendMessage(sender, '❌ Link video tidak ditemukan');
                return;
            }

            await this.sock.sendMessage(sender, {
                video: { url: videoUrl },
                caption: data?.data.title || 'Video YouTube',
                mimetype: 'video/mp4'
            });

            await this.sendMessage(sender, '✅ Video YouTube berhasil didownload!');

        } catch (error) {
            console.error('Error processing YTMP4 download:', error);
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat mendownload');
        }
    }

    async processYTMP3Download(sender, url) {
        try {
            await this.sendMessage(sender, '⏳ Sedang memproses download...');

            const { data } = await axios.get(`${config.ferdev.apiUrl}/downloader/ytmp3`, {
                params: {
                    link: url,
                    apikey: config.ferdev.apiKey,
                }
            });

            if (!data || !data.success) {
                await this.sendMessage(sender, '❌ Gagal mendownload audio YouTube');
                return;
            }

            const audioUrl = data.data?.dlink || data.data?.audio || data.data?.url || data.data?.download_url;

            if (!audioUrl) {
                await this.sendMessage(sender, '❌ Link audio tidak ditemukan');
                return;
            }

            const title = data.data?.title || 'Audio YouTube';

            await this.sock.sendMessage(sender, {
                audio: { url: audioUrl },
                caption: title,
                mimetype: 'audio/mp4',
                ptt: false
            });

            await this.sendMessage(sender, '✅ Audio YouTube berhasil didownload!');

        } catch (error) {
            console.error('Error processing YTMP3 download:', error);
            await this.sendMessage(sender, '❌ Terjadi kesalahan saat mendownload');
        }
    }

    async downloadMedia(message) {
        try {
            const mediaMessage = message.message?.imageMessage ||
                message.message?.videoMessage ||
                message.message?.stickerMessage ||
                message.message?.documentMessage;

            if (!mediaMessage) {
                console.log('❌ No media message found');
                return null;
            }

            const mimetype = mediaMessage.mimetype || 'application/octet-stream';
            console.log(`📥 Downloading media with mimetype: ${mimetype}`);

            const buffer = await downloadMediaMessage(message, 'buffer', {});

            if (!buffer || buffer.length === 0) {
                console.log('❌ Downloaded buffer is empty');
                return null;
            }

            console.log(`✅ Media downloaded successfully, size: ${buffer.length} bytes`);

            return {
                buffer: buffer,
                mimetype: mimetype,
                filename: mediaMessage.filename || 'media'
            };

        } catch (error) {
            console.error('Error downloading media:', error);
            return null;
        }
    }
    // =================== UTILITY METHODS ===================

    setupCleanupInterval() {
    setInterval(() => {
        this.cleanupInactiveUsers();
        this.aiHandler.cleanupInactiveSessions();
        this.stickerMaker.cleanup();
        
        // RESET STATISTIK HARIAN - TAMBAHAN BARU
        this.resetDailyStats();
    }, 30 * 60 * 1000);
}

resetDailyStats() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Reset active users setiap 24 jam
    if (now - this.botStats.lastActivity > oneDayMs) {
        this.botStats.activeUsers.clear();
        console.log('🔄 Daily stats reset: Active users cleared');
    }
}

    cleanupInactiveUsers() {
        const now = Date.now();
        const inactiveThreshold = 60 * 60 * 1000;

        for (const [userId, userData] of this.userStates.entries()) {
            const lastActivity = userData.lastActivity || new Date();
            if (now - lastActivity.getTime() > inactiveThreshold) {
                console.log(`🧹 Cleaning up inactive user session: ${userId}`);
                this.userStates.delete(userId);
                this.userLastMessage.delete(userId);
                this.userWelcomeCount.delete(userId);
                this.processingUsers.delete(userId);
            }
        }
    }

    async sendMessage(jid, text) {
        try {
            const delay = this.getRandomDelay();
            await this.sleep(delay);

            const lastSentKey = `${jid}_${text}`;
            const currentTime = Date.now();
            const lastSentTime = this.messageQueue.get(lastSentKey) || 0;

            if (currentTime - lastSentTime < 2000) {
                console.log(`🚫 Mencegah spam ke ${jid}: "${text.substring(0, 50)}..."`);
                return;
            }

            await this.sock.sendMessage(jid, { text: text });
            this.messageQueue.set(lastSentKey, currentTime);

            if (this.messageQueue.size > 100) {
                const oldEntries = Array.from(this.messageQueue.entries())
                    .filter(([key, time]) => currentTime - time > 10000);
                oldEntries.forEach(([key]) => this.messageQueue.delete(key));
            }

        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    async sendVideo(jid, filePath, title, author) {
        try {
            const delay = this.getRandomDelay();
            await this.sleep(delay);

            const videoBuffer = await fs.readFile(filePath);
            const caption = `🎬 *${title}*\n👤 By: ${author}\n\n✅ Video berhasil didownload tanpa watermark!`;

            await this.sock.sendMessage(jid, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4'
            });

            console.log(`✅ Video berhasil dikirim ke ${jid}`);

        } catch (error) {
            console.error('Error sending video:', error);
            throw error;
        }
    }

    async sendSticker(jid, filePath) {
        try {
            const delay = this.getRandomDelay();
            await this.sleep(delay);

            const stickerBuffer = await fs.readFile(filePath);

            await this.sock.sendMessage(jid, {
                sticker: stickerBuffer,
                mimetype: 'image/webp'
            });

            console.log(`✅ Sticker berhasil dikirim ke ${jid}`);

        } catch (error) {
            console.error('Error sending sticker:', error);
            throw error;
        }
    }

    getStats() {
        const aiStats = this.aiHandler.aiHandler?.getStats() || {};
        const activeSessions = this.aiHandler.getActiveSessions().length;
        const quoteStats = this.quoteGenerator.getStats();

        return {
            totalUsers: this.userStates.size,
            activeAISessions: activeSessions,
            aiStats: aiStats,
            supportedStickerFormats: this.stickerMaker.constructor.getSupportedFormats(),
            quoteStats: quoteStats
        };
    }
}

module.exports = WhatsAppClient;