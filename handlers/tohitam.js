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
            text: '⏳ Proses penghytaman'
        }, { quoted: m });

        // Download gambar dari WhatsApp
        const buffer = await downloadMediaMessage(m, 'buffer', {});
        
        if (!buffer) {
            throw new Error('Gagal mendownload gambar dari WhatsApp');
        }
        
        console.log('Image downloaded from WhatsApp, size:', buffer.length, 'bytes');

        // Update pesan loading
        await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Proses penghitaman',
            edit: loadingMsg.key
        });

        // Upload gambar ke CDN untuk mendapatkan URL menggunakan uploader
        const imageUrl = await uploader(buffer);
        
        if (!imageUrl) {
            throw new Error('Gagal mengupload gambar ke CDN');
        }
        
        console.log('Image uploaded to CDN:', imageUrl);

        // Update pesan loading
        await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Proses penghitaman',
            edit: loadingMsg.key
        });

        // Panggil API tohitam dengan link dari uploader
        const apikey = process.env.FERDEV_API_KEY;
        
        if (!apikey) {
            throw new Error('API key tidak ditemukan. Pastikan FERDEV_API_KEY sudah diset di environment variables');
        }
        
        const apiUrl = `https://api.ferdev.my.id/maker/tohitam?link=${encodeURIComponent(imageUrl)}&apikey=${apikey}`;
        
        console.log('Calling API:', apiUrl);

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30 detik timeout
            validateStatus: (status) => status === 200
        });

        // Cek apakah response berhasil
        if (response.status !== 200) {
            throw new Error(`API response status: ${response.status}`);
        }

        if (!response.data || response.data.length === 0) {
            throw new Error('API mengembalikan data kosong');
        }

        console.log('API response received, size:', response.data.length, 'bytes');

        // Hapus pesan loading
        await sock.sendMessage(m.key.remoteJid, {
            delete: loadingMsg.key
        });

        // Kirim hasil gambar hitam putih
        await sock.sendMessage(m.key.remoteJid, {
            image: Buffer.from(response.data),
            caption: '😈Ramaikan lalu hitamkan'
        }, { quoted: m });

        console.log('Tohitam command completed successfully');

    } catch (error) {
        console.error('Error tohitam command:', error);
        
        // Hapus pesan loading jika ada error
        try {
            if (loadingMsg) {
                await sock.sendMessage(m.key.remoteJid, {
                    delete: loadingMsg.key
                });
            }
        } catch (deleteError) {
            console.error('Error deleting loading message:', deleteError);
        }

        // Kirim pesan error yang lebih spesifik
        let errorMessage = '❌ Terjadi kesalahan saat memproses gambar.';
        
        if (error.message.includes('API key')) {
            errorMessage = '❌ Konfigurasi API key tidak valid. Silahkan hubungi admin.';
        } else if (error.message.includes('timeout')) {
            errorMessage = '❌ Timeout saat memproses gambar. Silahkan coba lagi.';
        } else if (error.message.includes('upload')) {
            errorMessage = '❌ Gagal mengupload gambar. Silahkan coba lagi.';
        } else if (error.message.includes('download')) {
            errorMessage = '❌ Gagal mendownload gambar dari WhatsApp. Silahkan coba lagi.';
        }

        await sock.sendMessage(m.key.remoteJid, {
            text: errorMessage
        }, { quoted: m });
    }
}

module.exports = tohitamCommand;