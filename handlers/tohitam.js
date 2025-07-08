const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const uploader = require('../libs/uploader'); // path ke uploader.js Anda

/**
 * Command !tohitam - Convert gambar menjadi hitam putih menggunakan API
 * @param {Object} sock - Baileys socket connection
 * @param {Object} m - Message object dari Baileys
 */
async function tohitamCommand(sock, m) {
    try {
        // Cek apakah pesan mengandung gambar
        if (!m.message.imageMessage) {
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Silahkan kirim gambar dengan caption !tohitam'
            }, { quoted: m });
            return;
        }

        // Kirim pesan loading
        const loadingMsg = await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Proses penghitaman...'
        }, { quoted: m });

        // Download gambar dari WhatsApp
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        
        if (!buffer) {
            throw new Error('Gagal mendownload gambar dari WhatsApp');
        }
        
        // Upload gambar ke CDN untuk mendapatkan URL menggunakan uploader
        const imageUrl = await uploader(buffer);
        
        if (!imageUrl) {
            throw new Error('Gagal mengupload gambar ke CDN');
        }
        
        console.log('Image uploaded to CDN:', imageUrl);

        // Update pesan loading
        await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Proses penghitaman...\n'
        }, { quoted: m });

        // Panggil API tohitam dengan link dari uploader
        const apikey = process.env.FERDEV_API_KEY; // Ganti dengan API key yang valid
        const apiUrl = `https://api.ferdev.my.id/maker/tohitam?link=${encodeURIComponent(imageUrl)}&apikey=${apikey}`;
        
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer'
        });

        // Cek apakah response berhasil
        if (response.status !== 200) {
            throw new Error('API response tidak berhasil');
        }

        // Kirim hasil gambar hitam putih
        await sock.sendMessage(m.key.remoteJid, {
            image: Buffer.from(response.data.dlink),
            caption: '✅ Ramaikan lalu hitamkan!!!!'
        }, { quoted: m });

    } catch (error) {
        console.error('Error tohitam command:', error);
        await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Terjadi kesalahan saat memproses gambar. Silahkan coba lagi.'
        }, { quoted: m });
    }
}

module.exports = tohitamCommand;