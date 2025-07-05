const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client();
const userCategory = {};

function initWhatsapp() {
    client.on('qr', qr => {
        console.log('🔐 Scan QR di WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('✅ Bot WhatsApp sudah aktif!');
    });

    client.on('message', async msg => {
        const chatId = msg.from;

        // Pilih kategori
        if (msg.body.startsWith('kategori:')) {
            const kategori = msg.body.split(':')[1].trim();
            userCategory[chatId] = kategori;
            msg.reply(`✅ Kategori disimpan: *${kategori}*\nSilakan kirim link TikTok!`);
            return;
        }

        // Link TikTok
        if (msg.body.includes('tiktok.com')) {
            const kategori = userCategory[chatId];
            if (!kategori) {
                msg.reply('❗ Harap pilih kategori terlebih dahulu. Gunakan:\n`kategori: <nama_kategori>`');
                return;
            }

            msg.reply('⏳ Mendownload video...');

            try {
                const videoUrl = await downloadVideo(msg.body);
                client.sendMessage(chatId, `🎥 *Kategori: ${kategori}* \nBerikut link videonya:\n${videoUrl}`);
            } catch (e) {
                msg.reply('❌ Gagal mendownload video. Coba cek link TikTok kamu.');
                console.error(e.message);
            }
        }
    });

    client.initialize();
}

module.exports = { initWhatsapp };
