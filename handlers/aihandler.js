const axios = require('axios');
const config = require('../config/config');

class AIHandler {
    constructor() {
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0
        };
        
        console.log('🤖 AI Handler initialized');
    }

    /**
     * Process AI question directly
     */
    async processDirectAIQuestion(sender, question) {
        try {
            // Update statistics
            this.stats.totalRequests++;
            
            // Gunakan model default ChatGPT
            const apiEndpoint = `${config.AI.apiUrl}${config.AI.models.default}`;

            const requestData = {
                prompt: question,
                logic: 'Kamu adalah Igimonsan Bot, setiap prompt menggunakan bahasa indonesia tanpa pengecualianpun!. Jika ada keyword "Owner" maka jawab dengan "Owner adalah Igimonsan"',
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

            // Update statistics
            this.stats.successfulRequests++;

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

            // Update error statistics
            this.stats.errorRequests++;

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

    /**
     * Get statistics
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 
            ? Math.round((this.stats.successfulRequests / this.stats.totalRequests) * 100)
            : 0;
            
        return {
            ...this.stats,
            successRate
        };
    }

    /**
     * Test API connection
     */
    async testAPIConnection() {
        try {
            const testEndpoint = `${config.AI.apiUrl}${config.AI.models.default}`;
            const testData = {
                prompt: 'Hello',
                apikey: config.AI.apikey
            };

            console.log('🔧 Testing API connection...');
            console.log('Endpoint:', testEndpoint);

            const response = await axios.get(testEndpoint, {
                params: testData,
                timeout: 10000
            });

            console.log('✅ API Test Success:', response.data);
            return { success: true, data: response.data };

        } catch (error) {
            console.error('❌ API Test Failed:', error.message);
            console.error('Response:', error.response?.data);
            return { success: false, error: error.message, response: error.response?.data };
        }
    }
}

module.exports = AIHandler;