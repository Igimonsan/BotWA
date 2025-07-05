// Konfigurasi bot
const config = {

    // Folder untuk menyimpan file
    folders: {
        downloads: './downloads',
        temp: './temp',
        sessions: './sessions',
        stickers: './stickers'
    },

    // API keys dan URL untuk berbagai layanan
    ferdev: {
        apiKey: process.env.FERDEV_API_KEY, 
        apiUrl: 'https://api.ferdev.my.id',
    },

    // Ganti dengan konfigurasi API AI baru
AI: {
    apikey: process.env.FERDEV_API_KEY,
    apiUrl: 'https://api.ferdev.my.id/',
    models: {
        default: 'ai/gptlogic',

    },
    // parameter sesuai API baru
     maxTokens: 150,
    temperature: 0.7
},

    // Kategori video yang tersedia (masih bisa digunakan untuk default category)
    categories: {
        '1': 'Video tiktok',
        '2': 'Edukasi',
        '3': 'Olahraga',
        '4': 'Musik',
        '5': 'Kuliner',
        '6': 'Tutorial',
        '7': 'Lainnya'
    },

    // Sticker configuration
    sticker: {
        maxSize: 1024 * 1024 * 5, // 5MB max file size
        quality: 100,
        packname: 'IGIMONSAN BOT',
        author: 'Igimonsan Bot',
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'],
        maxDuration: 10 // seconds for video stickers
    },

    // Pesan bot
    messages: {
        info: `ℹ️ *INFO BOT*\n\n*Nama: Bot by IGIMONSAN*\n*Versi:* 4.0.0\n*Fitur:*\n!tiktok Download TikTok ⚡  
!ai Chat AI 🤖  
!bantuan Bantuan & Info ℹ  
!stiker Pembuat Stiker 🎨  
!quote Generator Quote 💭  
!facebook Download Facebook 📘  
!ytmp3 YouTube ke MP3 download 🎵  
!ytmp4 YouTube ke MP4 download
\n\n*Developer: Igimonsan*\n*Status:* 🟢 Online`
    },

    // Regex untuk validasi ytube link
    ytmp4Regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Add this to your config file
    ytmp3Regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Regex untuk validasi link TikTok
    facebookRegex: /https?:\/\/(?:www\.)?facebook\.com\/(?:watch\?v=|share\/|video\/|.*\/videos\/)([\w\-]+)/,
    // Regex untuk validasi link TikTok
    tiktokRegex: /https?:\/\/(?:www\.|vt\.)?tiktok\.com\/[\w\-\._~:\/?#\[\]@!\$&'\(\)\*\+,;=]*/
};

module.exports = config;
