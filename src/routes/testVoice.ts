import express from 'express';
import { VoiceCommandService } from '../services/voiceCommandService';

const router = express.Router();

/**
 * Test endpoint for OpenAI voice command processing
 * POST /api/test/voice-command
 */
router.post('/voice-command', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Text is required and must be a string'
            });
        }

        const voiceService = VoiceCommandService.getInstance();
        const command = await voiceService.processVoiceCommand(text);

        res.json({
            success: true,
            data: {
                command,
                suggestions: voiceService.getSuggestions(command),
                isValid: voiceService.validateCommand(command)
            }
        });

    } catch (error) {
        console.error('Voice command test error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Test endpoint to check OpenAI API key configuration
 * GET /api/test/openai-status
 */
router.get('/openai-status', (req, res) => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.json({
        success: true,
        data: {
            openaiConfigured: hasApiKey,
            message: hasApiKey 
                ? 'OpenAI API key is configured' 
                : 'OpenAI API key is not configured - using fallback parser'
        }
    });
});

export default router;
