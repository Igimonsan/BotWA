const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config/config');

class StickerMaker {
    constructor() {
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.ensureDir(config.folders.stickers);
            await fs.ensureDir(config.folders.temp);
        } catch (error) {
            console.error('Error creating directories:', error);
        }
    }

    async createSticker(mediaBuffer, mediaType, options = {}) {
        try {
            const {
                packname = config.sticker.packname,
                author = config.sticker.author,
                quality = config.sticker.quality
            } = options;

            // Generate unique filename
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            const fileName = `sticker_${timestamp}_${randomId}`;
            
            let outputPath;
            let result;

            if (this.isImage(mediaType)) {
                outputPath = path.join(config.folders.stickers, `${fileName}.webp`);
                result = await this.createImageSticker(mediaBuffer, outputPath, { packname, author, quality });
            } else if (this.isVideo(mediaType)) {
                outputPath = path.join(config.folders.stickers, `${fileName}.webp`);
                result = await this.createVideoSticker(mediaBuffer, outputPath, { packname, author });
            } else {
                throw new Error('Unsupported media type');
            }

            return {
                success: true,
                filePath: outputPath,
                fileName: path.basename(outputPath),
                ...result
            };

        } catch (error) {
            console.error('Error creating sticker:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createImageSticker(imageBuffer, outputPath, options) {
        try {
            const { packname, author, quality } = options;

            // Process gambar dengan Sharp
            const processedImage = await sharp(imageBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
                })
                .webp({ 
                    quality: quality,
                    effort: 6 // Kompresi tinggi untuk ukuran file kecil
                })
                .toBuffer();

            // Simpan file
            await fs.writeFile(outputPath, processedImage);

            // Generate metadata untuk WhatsApp sticker
            const metadata = {
                packname: packname,
                author: author,
                type: 'image'
            };

            return {
                type: 'image',
                metadata: metadata,
                size: processedImage.length
            };

        } catch (error) {
            console.error('Error processing image sticker:', error);
            throw error;
        }
    }

    async createVideoSticker(videoBuffer, outputPath, options) {
        return new Promise(async (resolve, reject) => {
            try {
                const { packname, author } = options;
                
                // Simpan video sementara
                const tempVideoPath = path.join(config.folders.temp, `temp_${Date.now()}.mp4`);
                await fs.writeFile(tempVideoPath, videoBuffer);

                // Convert video ke sticker webp dengan ffmpeg
                ffmpeg(tempVideoPath)
                    .inputOptions([
                        '-t', config.sticker.maxDuration.toString(), // Batasi durasi
                        '-ss', '0' // Mulai dari detik 0
                    ])
                    .outputOptions([
                        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', // Resize dengan padding transparan
                        '-c:v', 'libwebp',
                        '-quality', '80',
                        '-compression_level', '6',
                        '-loop', '0', // Loop infinit
                        '-preset', 'default',
                        '-an' // Hapus audio
                    ])
                    .format('webp')
                    .output(outputPath)
                    .on('end', async () => {
                        try {
                            // Hapus file temporary
                            await fs.remove(tempVideoPath);
                            
                            // Get file size
                            const stats = await fs.stat(outputPath);
                            
                            const metadata = {
                                packname: packname,
                                author: author,
                                type: 'video'
                            };

                            resolve({
                                type: 'video',
                                metadata: metadata,
                                size: stats.size
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', async (error) => {
                        try {
                            await fs.remove(tempVideoPath);
                        } catch (cleanupError) {
                            console.error('Error cleaning up temp file:', cleanupError);
                        }
                        reject(error);
                    })
                    .run();

            } catch (error) {
                reject(error);
            }
        });
    }

    isImage(mediaType) {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        return imageTypes.includes(mediaType);
    }

    isVideo(mediaType) {
        const videoTypes = ['video/mp4', 'video/webm', 'video/gif'];
        return videoTypes.includes(mediaType);
    }

    isSupportedFormat(mediaType) {
        return this.isImage(mediaType) || this.isVideo(mediaType);
    }

    async validateMedia(mediaBuffer, mediaType) {
        const validation = {
            isValid: true,
            errors: []
        };

        // Check file size
        if (mediaBuffer.length > config.sticker.maxSize) {
            validation.isValid = false;
            validation.errors.push('File terlalu besar (max 5MB)');
        }

        // Check supported format
        if (!this.isSupportedFormat(mediaType)) {
            validation.isValid = false;
            validation.errors.push('Format file tidak didukung');
        }

        // Additional validation for video
        if (this.isVideo(mediaType)) {
            try {
                const tempPath = path.join(config.folders.temp, `validate_${Date.now()}.mp4`);
                await fs.writeFile(tempPath, mediaBuffer);
                
                const duration = await this.getVideoDuration(tempPath);
                await fs.remove(tempPath);
                
                if (duration > config.sticker.maxDuration) {
                    validation.isValid = false;
                    validation.errors.push(`Video terlalu panjang (max ${config.sticker.maxDuration} detik)`);
                }
            } catch (error) {
                validation.isValid = false;
                validation.errors.push('Error validating video');
            }
        }

        return validation;
    }

    getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    }

    async cleanup() {
        try {
            // Cleanup sticker files older than 1 hour
            const stickerDir = config.folders.stickers;
            const files = await fs.readdir(stickerDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000);

            for (const file of files) {
                const filePath = path.join(stickerDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.birthtimeMs < oneHourAgo) {
                    await fs.remove(filePath);
                    console.log(`🧹 Cleaned up old sticker: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error during sticker cleanup:', error);
        }
    }

    // Static method untuk mendapatkan format yang didukung
    static getSupportedFormats() {
        return {
            images: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            videos: ['mp4', 'webm']
        };
    }

    // Method untuk mendapatkan info sticker
    async getStickerInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const ext = path.extname(filePath);
            
            return {
                fileName: path.basename(filePath),
                size: stats.size,
                created: stats.birthtime,
                type: ext === '.webp' ? 'sticker' : 'unknown'
            };
        } catch (error) {
            console.error('Error getting sticker info:', error);
            return null;
        }
    }
}

module.exports = StickerMaker;