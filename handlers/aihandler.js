const axios = require('axios');
const config = require('../config/config');

class AIHandler {
    constructor() {
        // User sessions untuk menyimpan context percakapan
        this.userSessions = new Map();
        
        // Rate limiting - maksimal 10 pesan per menit per user
        this.rateLimiter = new Map();
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0,
            activeUsers: 0
        };
        
        // Cleanup interval
        this.setupCleanup();
        
        console.log('🤖 AI Handler initialized with Ferdev API');
    }

    /**
     * Handle pesan masuk dan cek apakah ini command AI
     */
    async handle(sender, text) {
        const lowerText = text.toLowerCase().trim();
        
        // Cek command AI khusus
        if (config.commands.ai.includes(lowerText)) {
            return await this.handleAICommand(sender);
        }
        
        // Cek apakah user dalam mode AI chat
        const session = this.getUserSession(sender);
        if (session && session.isActive) {
            return await this.handleAIChat(sender, text);
        }
        
        return null; // Bukan command AI
    }

    /**
     * Handle command /ai untuk masuk ke mode AI chat
     */
    async handleAICommand(sender) {
        try {
            // Create atau update session
            this.createSession(sender);
            
            return {
                success: true,
                message: config.messages.aiMenu,
                shouldContinue: false
            };
        } catch (error) {
            console.error('Error handling AI command:', error);
            return {
                success: false,
                message: config.messages.aiError,
                shouldContinue: false
            };
        }
    }

    /**
     * Handle chat dengan AI
     */
    async handleAIChat(sender, text) {
        const lowerText = text.toLowerCase().trim();
        
        try {
            // Cek command khusus AI
            if (this.isExitCommand(lowerText)) {
                this.endSession(sender);
                return {
                    success: true,
                    message: '👋 *Keluar dari mode AI Chat*\n\nKembali ke menu utama...',
                    shouldContinue: false
                };
            }
            
            if (lowerText === '/model' || lowerText === 'model') {
                return await this.handleModelSelection(sender);
            }
            
            if (lowerText === '/clear' || lowerText === 'clear') {
                return this.clearHistory(sender);
            }
            
            if (lowerText === '/stats' || lowerText === 'stats') {
                return this.getSessionStats(sender);
            }
            
            if (lowerText === '/help' || lowerText === 'help') {
                return {
                    success: true,
                    message: config.messages.aiHelp,
                    shouldContinue: false
                };
            }

            // Handle model selection (1, 2, 3)
            if (['1', '2', '3', '4','5'].includes(text.trim())) {
                return await this.changeModel(sender, text.trim());
            }
            
            // Rate limiting check
            if (!this.checkRateLimit(sender)) {
                return {
                    success: true,
                    message: '⏰ *Rate limit tercapai*\n\nTunggu sebentar sebelum mengirim pesan lagi (max 10 pesan per menit)',
                    shouldContinue: false
                };
            }
            
            // Process AI chat
            return await this.processAIChat(sender, text);
            
        } catch (error) {
            console.error('Error handling AI chat:', error);
            return {
                success: false,
                message: config.messages.aiError,
                shouldContinue: false
            };
        }
    }

    /**
     * Process chat dengan AI menggunakan Ferdev API
     */
    async processAIChat(sender, text) {
        const session = this.getUserSession(sender);
        
        try {
            // Update statistics
            this.stats.totalRequests++;
            
            // Prepare request - FIXED: Use 'prompt' instead of 'query'
            const apiEndpoint = `${config.AI.apiUrl}${session.model}`;
            console.log(session.model)
            const requestData = {
                prompt: text,// Changed from 'query' to 'prompt'
                ...(session.model.includes('gptlogic') ? {
                    logic: 'Kamu adalah Igimonsan Bot, setiap prompt menggunakan bahasa indonesia tanpa pengecualianpun!'
                } : {}),
                apikey: config.AI.apikey
            };

            console.log(`🤖 AI Request to ${session.model}: ${text.substring(0, 50)}...`);
            
            // Call Ferdev AI API
            const response = await axios.get(apiEndpoint, {
                params: requestData,
                timeout: 30000 // 30 second timeout
            });

            console.log('🔍 API Response:', response.data); // Debug log

            // IMPROVED: Better response handling
            if (!response.data) {
                throw new Error('No response data from API');
            }

            // Check if API returned success: false
            if (response.data.success === false) {
                throw new Error(response.data.message || 'API returned success: false');
            }

            // Extract AI response with multiple fallbacks
            let aiResponse = '';
            
            if (response.data.message) {
                aiResponse = response.data.message;  // This is where the actual response is!
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

            // Validate response
            if (!aiResponse || aiResponse.trim() === '') {
                throw new Error('Empty response from AI');
            }
            
            // Update session history
            this.updateHistory(sender, text, aiResponse);
            
            // Update statistics
            this.stats.successfulRequests++;
            
            return {
                success: true,
                message: `🤖 *${this.getModelName(session.model)}*\n\n${aiResponse}`,
                shouldContinue: false
            };
            
        } catch (error) {
            console.error('Error processing AI chat:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            
            this.stats.errorRequests++;
            
            // Handle specific error types
            let errorMessage = config.messages.aiError;
            
            if (error.code === 'ENOTFOUND') {
                errorMessage = '❌ *Tidak dapat terhubung ke server AI*\n\nPastikan koneksi internet stabil.';
            } else if (error.response?.status === 429) {
                errorMessage = '❌ *Server AI sedang sibuk*\n\nCoba lagi dalam beberapa menit.';
            } else if (error.response?.status === 401) {
                errorMessage = '❌ *API Key tidak valid*\n\nHubungi administrator.';
            } else if (error.response?.status === 400) {
                // Handle 400 errors specifically
                const apiMessage = error.response?.data?.message || error.message;
                errorMessage = `❌ *Request Error*\n\n${apiMessage}`;
            } else if (error.message.includes('Empty response')) {
                errorMessage = '❌ *AI tidak memberikan respons*\n\nCoba dengan pertanyaan yang berbeda.';
            } else if (error.message.includes('No valid response found')) {
                errorMessage = '❌ *Format respons tidak valid*\n\nServer AI mungkin sedang bermasalah.';
            }
            
            return {
                success: false,
                message: errorMessage,
                shouldContinue: false
            };
        }
    }

    /**
     * Handle model selection menu
     */
    async handleModelSelection(sender) {
        const modelMenu = `🤖 *PILIH MODEL AI*\n\n1️⃣ ChatGPT - Chat umum & problem solving 🧠\n2️⃣ Claude - Kreativitas & penulisan 🎨\n3️⃣ Gemini - Analisis & reasoning ⚡\n4️⃣ Felo ai\n 5️⃣ Venice ai\n\n*Model aktif:* ${this.getModelName(this.getUserSession(sender).model)}\n\nKetik angka (1-3) atau /menu untuk kembali`;
        
        return {
            success: true,
            message: modelMenu,
            shouldContinue: false
        };
    }

    /**
     * Change AI model
     */
    async changeModel(sender, choice) {
        const session = this.getUserSession(sender);
        
        let newModel;
        let modelName;
        
        switch (choice) {
            case '1':
                newModel = config.AI.models.default; // 'ai/chatgpt'
                modelName = 'ChatGPT';
                break;
            case '2':
                newModel = config.AI.models.creative; // 'ai/claude'
                modelName = 'Claude';
                break;
            case '3':
                newModel = config.AI.models.smart; // 'ai/Gemini'
                modelName = 'Gemini';
                break;
            case '4' :
            newModel = config.AI.models.logic;
            modelName = 'Felo'
            break;

            case '5' :
            newModel = config.AI.models.venice;
            modelName = 'venice'
            break;
            default:
                return {
                    success: true,
                    message: config.messages.invalidModelSelection,
                    shouldContinue: false
                };
        }
        
        // Update session model
        session.model = newModel;
        session.lastActivity = new Date();
        
        return {
            success: true,
            message: config.messages.modelChanged(modelName),
            shouldContinue: false
        };
    }

    /**
     * Clear chat history
     */
    clearHistory(sender) {
        const session = this.getUserSession(sender);
        if (session) {
            session.history = [];
            session.lastActivity = new Date();
        }
        
        return {
            success: true,
            message: '🗑️ *History chat telah dihapus*\n\nMemulai percakapan baru...',
            shouldContinue: false
        };
    }

    /**
     * Get session statistics
     */
    getSessionStats(sender) {
        const session = this.getUserSession(sender);
        const globalStats = this.getStats();
        
        const sessionStats = `📊 *STATISTIK CHAT*\n\n*Session Anda:*\n• Model: ${this.getModelName(session.model)}\n• Pesan: ${session.messageCount || 0}\n• Dibuat: ${session.createdAt.toLocaleString('id-ID')}\n• Aktif: ${session.lastActivity.toLocaleString('id-ID')}\n\n*Global:*\n• Total request: ${globalStats.totalRequests}\n• Success rate: ${globalStats.successRate}%\n• Active users: ${globalStats.activeUsers}`;
        
        return {
            success: true,
            message: sessionStats,
            shouldContinue: false
        };
    }

    /**
     * Create new session
     */
    createSession(sender) {
        const session = {
            isActive: true,
            model: config.AI.models.default, // Default to ChatGPT
            history: [],
            messageCount: 0,
            createdAt: new Date(),
            lastActivity: new Date()
        };
        
        this.userSessions.set(sender, session);
        this.updateActiveUsers();
        
        console.log(`🤖 New AI session created for ${sender}`);
        return session;
    }

    /**
     * Get user session
     */
    getUserSession(sender) {
        return this.userSessions.get(sender);
    }

    /**
     * End session
     */
    endSession(sender) {
        const session = this.userSessions.get(sender);
        if (session) {
            session.isActive = false;
            session.lastActivity = new Date();
        }
        
        this.updateActiveUsers();
        console.log(`🤖 AI session ended for ${sender}`);
    }

    /**
     * Update chat history
     */
    updateHistory(sender, userMessage, aiResponse) {
        const session = this.getUserSession(sender);
        if (session) {
            session.history.push({
                user: userMessage,
                ai: aiResponse,
                timestamp: new Date()
            });
            
            session.messageCount = (session.messageCount || 0) + 1;
            session.lastActivity = new Date();
            
            // Limit history to last 20 exchanges
            if (session.history.length > 20) {
                session.history = session.history.slice(-20);
            }
        }
    }

    /**
     * Check rate limiting
     */
    checkRateLimit(sender) {
        const now = Date.now();
        const userLimit = this.rateLimiter.get(sender) || { count: 0, resetTime: now + 60000 };
        
        // Reset if time window passed
        if (now > userLimit.resetTime) {
            userLimit.count = 0;
            userLimit.resetTime = now + 60000; // 1 minute window
        }
        
        userLimit.count++;
        this.rateLimiter.set(sender, userLimit);
        
        return userLimit.count <= 10; // Max 10 messages per minute
    }

    /**
     * Check if command is exit command
     */
    isExitCommand(text) {
        const exitCommands = [
            '/menu', 'menu', '/exit', 'exit', 
            'keluar', '/keluar', 'kembali', '/kembali'
        ];
        return exitCommands.includes(text);
    }

    /**
     * Get model display name
     */
    getModelName(model) {
        switch (model) {
            case config.AI.models.default:
                return 'ChatGPT';
            case config.AI.models.creative:
                return 'Claude';
            case config.AI.models.smart:
                return 'Gemini';
            default:
                return 'Unknown';
        }
    }

    /**
     * Update active users count
     */
    updateActiveUsers() {
        let activeCount = 0;
        for (const [_, session] of this.userSessions.entries()) {
            if (session.isActive) {
                activeCount++;
            }
        }
        this.stats.activeUsers = activeCount;
    }

    /**
     * Get active sessions
     */
    getActiveSessions() {
        const activeSessions = [];
        for (const [userId, session] of this.userSessions.entries()) {
            if (session.isActive) {
                activeSessions.push({
                    userId,
                    model: session.model,
                    messageCount: session.messageCount || 0,
                    createdAt: session.createdAt,
                    lastActivity: session.lastActivity
                });
            }
        }
        return activeSessions;
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
            successRate,
            totalSessions: this.userSessions.size
        };
    }

    /**
     * Cleanup inactive sessions
     */
    cleanupInactiveSessions() {
        const now = Date.now();
        const inactiveThreshold = 60 * 60 * 1000; // 1 hour
        
        let cleanedCount = 0;
        
        for (const [userId, session] of this.userSessions.entries()) {
            const lastActivity = session.lastActivity || session.createdAt;
            
            if (now - lastActivity.getTime() > inactiveThreshold) {
                this.userSessions.delete(userId);
                this.rateLimiter.delete(userId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} inactive AI sessions`);
            this.updateActiveUsers();
        }
    }

    /**
     * Setup cleanup interval
     */
    setupCleanup() {
        // Cleanup every 30 minutes
        setInterval(() => {
            this.cleanupInactiveSessions();
        }, 30 * 60 * 1000);
        
        console.log('🧹 AI Handler cleanup interval setup');
    }

    /**
     * Shutdown handler
     */
    shutdown() {
        console.log('🤖 AI Handler shutting down...');
        
        // End all active sessions
        for (const [userId, session] of this.userSessions.entries()) {
            if (session.isActive) {
                session.isActive = false;
                session.lastActivity = new Date();
            }
        }
        
        console.log('🤖 AI Handler shutdown complete');
    }

    /**
     * Test API connection - New method for debugging
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
            console.log('Params:', { ...testData, apikey: 'HIDDEN' });

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
