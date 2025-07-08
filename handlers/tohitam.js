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
            text: '⏳ Mengkonversi ke hitam putih...'
        }, { quoted: m });

        // Panggil API tohitam dengan link dari uploader
        const apikey = process.env.FERDEV_API_KEY; // Ganti dengan API key yang valid
        const apiUrl = `https://api.ferdev.my.id/maker/tohitam?link=${encodeURIComponent(imageUrl)}&apikey=${apikey}`;
        
        // Panggil API dan ambil response JSON
        const response = await axios.get(apiUrl);

        // Cek apakah response berhasil
        if (response.status !== 200 || !response.data.success) {
            throw new Error('API response tidak berhasil atau gagal memproses gambar');
        }

        // Ambil link download dari response JSON
        const downloadLink = response.data.dlink;
        
        if (!downloadLink) {
            throw new Error('Link download tidak ditemukan dalam response');
        }

        console.log('Download link:', downloadLink);

        // Update pesan loading
        await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Mendownload hasil...'
        }, { quoted: m });

        // Download gambar hasil dari link yang diberikan API
        const imageResponse = await axios.get(downloadLink, {
            responseType: 'arraybuffer'
        });

        if (imageResponse.status !== 200) {
            throw new Error('Gagal mendownload gambar hasil dari server');
        }

        // Kirim hasil gambar hitam putih
        await sock.sendMessage(m.key.remoteJid, {
            image: Buffer.from(imageResponse.data),
            caption: '✅ Ramaikan lalu hitamkan!!!!'
        }, { quoted: m });

    } catch (error) {
        console.error('Error tohitam command:', error);
        
        // Log detail error untuk debugging
        if (error.response) {
            console.log('Error Response Status:', error.response.status);
            console.log('Error Response Data:', error.response.data);
        }
        
        await sock.sendMessage(m.key.remoteJid, {
            text: `❌ Terjadi kesalahan saat memproses gambar: ${error.message}`
        }, { quoted: m });
    }
}

module.exports = tohitamCommand;