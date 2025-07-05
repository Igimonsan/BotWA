# 🤖 WhatsApp Bot Multi-Fitur

Bot WhatsApp multifungsi berbasis Node.js dan Baileys dengan 8 fitur utama untuk memudahkan aktivitas digital Anda.

## ✨ Fitur Utama

### 1️⃣ Download TikTok ⚡
- Download video TikTok tanpa watermark
- Kategorisasi video otomatis
- Dukungan berbagai format link TikTok
- Auto cleanup file untuk menghemat storage

### 2️⃣ Chat AI 🤖
- Chat dengan AI menggunakan Hugging Face
- 3 model AI berbeda (Default, Creative, Smart)
- Mengingat konteks percakapan
- Rate limiting untuk mencegah spam

### 3️⃣ Bantuan & Info ℹ️
- Panduan penggunaan lengkap
- Informasi fitur bot
- Troubleshooting guide
- Status bot dan statistik

### 4️⃣ Pembuat Stiker 🎨
- Generate sticker dari foto
- Generate sticker dari video
- Support berbagai format file
- Konversi otomatis ke format WhatsApp

### 5️⃣ Generator Quote 💭
- Generate quotes inspiratif
- Generate pantun Indonesia
- Generate kata-kata motivasi
- Koleksi quotes random

### 6️⃣ Download Facebook 📘
- Download video Facebook
- Support link Facebook Watch
- Download dengan kualitas terbaik
- Auto cleanup setelah download

### 7️⃣ YouTube ke MP3 🎵
- Convert YouTube video ke MP3
- Kualitas audio terbaik
- Download musik dari YouTube
- Support playlist YouTube

### 8️⃣ YouTube ke MP4 🎬
- Download video YouTube
- Berbagai pilihan kualitas
- Support video panjang
- Download dengan thumbnail

## 🚀 Instalasi

### Persyaratan Sistem
- Node.js v16 atau lebih baru
- NPM atau Yarn
- Koneksi internet stabil

### Langkah Instalasi

1. **Clone Repository**
   ```bash
   git clone https://github.com/igimonsan/botnode3.git
   cd botnode3
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env
   ```

4. **Konfigurasi API Keys**
   Edit file `.env` dan tambahkan:
   ```env
  FERDEV_API_KEY=your_ferdev_api_key_here
   ```

5. **Hapus Session Lama (Penting!)**
   ```bash
   rm -rf sessions
   ```

6. **Jalankan Bot**
   ```bash
   npm start
   ```

## 🔧 Konfigurasi API


### Ferdev API
- Dokumentasi lengkap: [api.ferdev.my.id](https://api.ferdev.my.id)
- Dapatkan API key dari dashboard Ferdev
- Masukkan API key ke file `.env`

## 📱 Cara Penggunaan

### Setup WhatsApp
1. Jalankan bot dengan `npm start`
2. QR code akan muncul di terminal
3. Buka WhatsApp di HP
4. Pergi ke Settings > Linked Devices > Link a Device
5. Scan QR code yang muncul

### Menggunakan Bot
Ketik `/menu` atau `/start` untuk melihat menu utama dengan 8 fitur yang tersedia.

### Contoh Penggunaan

#### Download TikTok
```
/menu → Pilih "1️⃣ Download TikTok" → Kirim link TikTok
```

#### Chat AI
```
/ai → Mulai percakapan dengan AI
/model → Ganti model AI
/clear → Hapus history percakapan
```

#### Pembuat Stiker
```
/menu → Pilih "4️⃣ Pembuat Stiker" → Kirim gambar/video
```

#### Download YouTube
```
/menu → Pilih "7️⃣ YouTube ke MP3" atau "8️⃣ YouTube ke MP4" → Kirim link YouTube
```

## ⚙️ Fitur Teknis

### Rate Limiting
- AI Chat: 10 pesan per menit per user
- Download TikTok: 5 download per menit per user
- Download Facebook: 3 download per menit per user
- YouTube Download: 2 download per menit per user

### Auto Cleanup
- File download: Dihapus setelah 1 jam
- Session tidak aktif: Dibersihkan setelah 30 menit
- History AI: Maksimal 10 exchange per user

### Monitoring
- Total pengguna bot
- Total percakapan AI
- Jumlah file yang didownload
- Session aktif
- Uptime bot

## 🛠️ Development

### Development Mode
```bash
npm run dev
```

### Test Koneksi
```bash
npm test
```

### Struktur Project
```
├── src/
│   ├── handlers/          # Handler untuk setiap fitur
│   ├── utils/             # Utility functions
│   ├── services/          # Service integrations
│   └── config/            # Konfigurasi bot
├── sessions/              # WhatsApp session data
├── temp/                  # Temporary files
└── logs/                  # Log files
```

## 🔍 Troubleshooting

### Masalah AI Chat
- Pastikan API key Hugging Face benar
- Cek apakah token masih aktif
- Model mungkin sedang loading (tunggu 20 detik)
- Coba ganti model dengan `/model`

### Masalah Koneksi WhatsApp
- Cek koneksi internet
- Bot akan otomatis reconnect
- Jika gagal terus, restart bot
- Hapus folder `sessions` dan scan ulang QR

### Masalah Download
- Cek apakah link valid
- Pastikan video tidak private
- Coba download ulang
- Periksa quota API Ferdev

## 📊 Statistik Bot

Bot mencatat berbagai statistik penggunaan:
- Total pengguna aktif
- Jumlah download per platform
- Penggunaan fitur AI
- Uptime dan performa

## 🤝 Kontribusi

1. Fork repository
2. Buat branch baru: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push branch: `git push origin feature-name`
5. Submit pull request

## 📄 Lisensi

MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## 🔗 Dependencies

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Hugging Face](https://huggingface.co) - AI Models
- [Node.js](https://nodejs.org) - Runtime
- [Axios](https://axios-http.com) - HTTP Client
- [Ferdev API](https://api.ferdev.my.id) - Download Services

## 📞 Support

Jika ada pertanyaan atau issue:
- Buat issue di GitHub
- Cek dokumentasi [Ferdev API](https://api.ferdev.my.id)
- Lihat troubleshooting guide di atas
- Referensi: [botnode3](https://github.com/Igimonsan/botnode3)

## ⚠️ Catatan Penting

- **Update Sessions**: Harus dilakukan secara berkala jika bot offline
- **Gunakan dengan bijak**: Hormati terms of service platform
- **Backup session**: Simpan folder sessions secara berkala
- **Monitor usage**: Perhatikan quota API yang digunakan

---

**Made with ❤️ by [Your Name]**

*Gunakan bot ini dengan bijak dan bertanggung jawab*