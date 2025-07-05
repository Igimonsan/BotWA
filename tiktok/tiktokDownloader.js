const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

class TikTokDownloader {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    // Method untuk mengekstrak video ID dari URL
    extractVideoId(url) {
        try {
            const regex = /(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com\/@[\w.-]+\/video\/|vm\.tiktok\.com\/|tiktok\.com\/t\/)(\w+)/;
            const match = url.match(regex);
            return match ? match[1] : null;
        } catch (error) {
            console.error('Error extracting video ID:', error);
            return null;
        }
    }

    // Method untuk mendapatkan URL asli dari shortlink
    async getOriginalUrl(shortUrl) {
        try {
            const response = await axios.get(shortUrl, {
                headers: this.headers,
                maxRedirects: 5,
                timeout: 10000
            });
            return response.request.res.responseUrl || shortUrl;
        } catch (error) {
            console.error('Error getting original URL:', error);
            return shortUrl;
        }
    }

    // Method untuk download video menggunakan API publik
    async downloadVideo(url) {
        try {
            // Jika URL pendek, dapatkan URL asli
            if (url.includes('vm.tiktok.com') || url.includes('/t/')) {
                url = await this.getOriginalUrl(url);
            }

            // API alternatif untuk download TikTok
            const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`;
            
            const response = await axios.get(apiUrl, {
                headers: this.headers,
                timeout: 15000
            });

            if (response.data && response.data.video) {
                return {
                    success: true,
                    videoUrl: response.data.video.noWatermark || response.data.video.watermark,
                    title: response.data.title || 'TikTok Video',
                    author: response.data.author || 'Unknown'
                };
            }

            // Fallback method jika API pertama gagal
            return await this.fallbackDownload(url);

        } catch (error) {
            console.error('Error downloading video:', error);
            return await this.fallbackDownload(url);
        }
    }

    // Method fallback untuk download
    async fallbackDownload(url) {
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            
            const response = await axios.get(apiUrl, {
                headers: this.headers,
                timeout: 15000
            });

            if (response.data && response.data.code === 0) {
                return {
                    success: true,
                    videoUrl: response.data.data.play,
                    title: response.data.data.title || 'TikTok Video',
                    author: response.data.data.author.nickname || 'Unknown'
                };
            }

            throw new Error('Fallback API failed');

        } catch (error) {
            console.error('Fallback download failed:', error);
            return {
                success: false,
                error: 'Gagal mendownload video. Coba lagi nanti.'
            };
        }
    }

    // Method untuk download file video
    async downloadFile(videoUrl, fileName, category) {
        try {
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
                headers: this.headers,
                timeout: 30000
            });

            // Buat folder berdasarkan kategori
            const categoryFolder = path.join('./downloads', category);
            await fs.ensureDir(categoryFolder);

            const filePath = path.join(categoryFolder, fileName);
            const writer = fs.createWriteStream(filePath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });

        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    // Method untuk membersihkan nama file
    sanitizeFileName(fileName) {
        return fileName
            .replace(/[^\w\s-]/g, '') // Hapus karakter khusus
            .replace(/\s+/g, '_') // Ganti spasi dengan underscore
            .substring(0, 50); // Batasi panjang nama file
    }

    // Method utama untuk proses download
    async processDownload(url, category) {
        try {
            console.log('Starting download process for:', url);
            
            // Download video info
            const videoInfo = await this.downloadVideo(url);
            
            if (!videoInfo.success) {
                return {
                    success: false,
                    error: videoInfo.error || 'Gagal mendapatkan informasi video'
                };
            }

            // Buat nama file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sanitizedTitle = this.sanitizeFileName(videoInfo.title);
            const fileName = `${sanitizedTitle}_${timestamp}.mp4`;

            // Download file
            const filePath = await this.downloadFile(videoInfo.videoUrl, fileName, category);

            return {
                success: true,
                filePath: filePath,
                fileName: fileName,
                title: videoInfo.title,
                author: videoInfo.author
            };

        } catch (error) {
            console.error('Process download error:', error);
            return {
                success: false,
                error: 'Terjadi kesalahan saat memproses download'
            };
        }
    }
}

module.exports = TikTokDownloader;