const fs = require('fs-extra');
require('dotenv').config();
const path = require('path');
const config = require('./config/config');
const WhatsAppClient = require('./wa/whatsappClient');


// ASCII Art untuk tampilan startup
const asciiArt = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ████████╗██╗██╗  ██╗████████╗ ██████╗ ██╗  ██╗              ║
║  ╚══██╔══╝██║██║ ██╔╝╚══██╔══╝██╔═══██╗██║ ██╔╝              ║
║     ██║   ██║█████╔╝    ██║   ██║   ██║█████╔╝               ║
║     ██║   ██║██╔═██╗    ██║   ██║   ██║██╔═██╗               ║
║     ██║   ██║██║  ██╗   ██║   ╚██████╔╝██║  ██╗              ║
║     ╚═╝   ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝              ║
║                                                              ║
║               WhatsApp Bot - TikTok Downloader               ║
║                     Tanpa Watermark                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

class TikTokBot {
    constructor() {
        this.client = new WhatsAppClient();
        this.startTime = new Date();
    }

    async start() {
        try {
            console.clear();
            console.log(asciiArt);
            console.log('🚀 Memulai TikTok WhatsApp Bot...\n');

            // Setup folders
            await this.setupFolders();
            
            // Initialize WhatsApp client
            console.log('📱 Menginisialisasi WhatsApp client...');
            await this.client.initialize();

            // Setup cleanup
            this.setupCleanup();

            // Setup monitoring
            this.setupMonitoring();

        } catch (error) {
            console.error('❌ Error starting bot:', error);
            process.exit(1);
        }
    }

    async setupFolders() {
        try {
            console.log('📁 Menyiapkan folder...');
            
            // Buat folder utama
            await fs.ensureDir(config.folders.downloads);
            await fs.ensureDir(config.folders.temp);
            await fs.ensureDir(config.folders.sessions);

            // Buat folder untuk setiap kategori
            for (const [key, category] of Object.entries(config.categories)) {
                const categoryPath = path.join(config.folders.downloads, category);
                await fs.ensureDir(categoryPath);
            }

            console.log('✅ Folder berhasil disiapkan');
            this.displayFolderStructure();

        } catch (error) {
            console.error('❌ Error setting up folders:', error);
            throw error;
        }
    }

    displayFolderStructure() {
        console.log('\n📂 STRUKTUR FOLDER:');
        console.log('├── downloads/');
        for (const [key, category] of Object.entries(config.categories)) {
            console.log(`│   ├── ${category}/`);
        }
        console.log('├── temp/');
        console.log('└── sessions/\n');
    }

    setupCleanup() {
        // Cleanup saat aplikasi ditutup
        process.on('SIGINT', async () => {
            console.log('\n🔄 Membersihkan dan menutup bot...');
            
            try {
                // Bersihkan file temporary
                const tempFiles = await fs.readdir(config.folders.temp);
                for (const file of tempFiles) {
                    await fs.remove(path.join(config.folders.temp, file));
                }
                console.log('🗑️  File temporary dibersihkan');
                
                // Tampilkan statistik akhir
                await this.displayFinalStats();
                
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
            
            console.log('👋 Bot ditutup. Terima kasih!');
            process.exit(0);
        });

        // Cleanup otomatis setiap 1 jam
        setInterval(async () => {
            await this.autoCleanup();
        }, 60 * 60 * 1000); // 1 jam
    }

    async autoCleanup() {
        try {
            console.log('🧹 Menjalankan pembersihan otomatis...');
            
            const tempDir = config.folders.temp;
            const files = await fs.readdir(tempDir);
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                const now = new Date();
                const fileAge = now - stats.mtime;
                
                // Hapus file yang lebih dari 30 menit
                if (fileAge > 30 * 60 * 1000) {
                    await fs.remove(filePath);
                    deletedCount++;
                    console.log(`🗑️  Menghapus file lama: ${file}`);
                }
            }
            
            if (deletedCount === 0) {
                console.log('✨ Tidak ada file lama yang perlu dihapus');
            } else {
                console.log(`✅ ${deletedCount} file lama berhasil dihapus`);
            }
            
        } catch (error) {
            console.error('Error during auto cleanup:', error);
        }
    }

    setupMonitoring() {
        // Tampilkan stats setiap 10 menit
        setInterval(async () => {
            await this.displayStats();
        }, 10 * 60 * 1000);

        // Log uptime setiap jam
        setInterval(() => {
            const uptime = new Date() - this.startTime;
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            console.log(`⏰ Bot uptime: ${hours} jam ${minutes} menit`);
        }, 60 * 60 * 1000);
    }

    async displayStats() {
        try {
            console.log('\n📊 STATISTIK BOT:');
            console.log('==================');
            
            let totalFiles = 0;
            
            // Hitung total file di setiap kategori
            for (const [key, category] of Object.entries(config.categories)) {
                const categoryPath = path.join(config.folders.downloads, category);
                const files = await fs.readdir(categoryPath);
                const fileCount = files.length;
                totalFiles += fileCount;
                
                console.log(`📁 ${category}: ${fileCount} file`);
            }
            
            // Hitung ukuran folder downloads
            const folderSize = await this.getFolderSize(config.folders.downloads);
            
            console.log('==================');
            console.log(`📋 Total file: ${totalFiles}`);
            console.log(`💾 Total ukuran: ${this.formatBytes(folderSize)}`);
            
            const uptime = new Date() - this.startTime;
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            console.log(`⏰ Uptime: ${hours}j ${minutes}m`);
            console.log('==================\n');
            
        } catch (error) {
            console.error('Error displaying stats:', error);
        }
    }

    async displayFinalStats() {
        console.log('\n📊 STATISTIK FINAL:');
        console.log('===================');
        
        let totalFiles = 0;
        for (const [key, category] of Object.entries(config.categories)) {
            const categoryPath = path.join(config.folders.downloads, category);
            const files = await fs.readdir(categoryPath);
            totalFiles += files.length;
            console.log(`📁 ${category}: ${files.length} file`);
        }
        
        const totalUptime = new Date() - this.startTime;
        const hours = Math.floor(totalUptime / (1000 * 60 * 60));
        const minutes = Math.floor((totalUptime % (1000 * 60 * 60)) / (1000 * 60));
        
        console.log('===================');
        console.log(`📋 Total file didownload: ${totalFiles}`);
        console.log(`⏰ Total runtime: ${hours} jam ${minutes} menit`);
        console.log('===================');
    }

    async getFolderSize(folderPath) {
        let size = 0;
        
        async function calculateSize(dir) {
            const files = await fs.readdir(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isDirectory()) {
                    await calculateSize(filePath);
                } else {
                    size += stats.size;
                }
            }
        }
        
        try {
            await calculateSize(folderPath);
        } catch (error) {
            console.error('Error calculating folder size:', error);
        }
        
        return size;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Jalankan bot
const bot = new TikTokBot();
bot.start().then(() => {
    console.log('🎉 Bot berhasil dimulai!');
    console.log('📝 Ketik Ctrl+C untuk menghentikan bot\n');
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});