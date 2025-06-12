import express from "express";
import { VoiceCommandService } from "../services/voiceCommandService";

const router = express.Router();

/**
 * Test endpoint for OpenAI voice command processing
 * POST /api/test/voice-command
 */
router.post("/voice-command", async (req, res) => {
	try {
		const { text } = req.body;

		if (!text || typeof text !== "string") {
			return res.status(400).json({
				success: false,
				message: "Text is required and must be a string",
			});
		}

		const voiceService = VoiceCommandService.getInstance();
		const command = await voiceService.processVoiceCommand(text);

		res.json({
			success: true,
			data: {
				command,
				suggestions: voiceService.getSuggestions(command),
				isValid: voiceService.validateCommand(command),
			},
		});
	} catch (error) {
		console.error("Voice command test error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
});

/**
 * Test endpoint to check Groq API key configuration
 * GET /api/test/groq-status
 */
router.get("/groq-status", async (req, res) => {
	const hasApiKey = !!process.env.GROQ_API_KEY;

	if (!hasApiKey) {
		return res.json({
			success: false,
			data: {
				groqConfigured: false,
				message: "Groq API key is not configured",
			},
		});
	}

	// Test actual Groq connection
	try {
		const Groq = (await import("groq-sdk")).default;
		const groq = new Groq({
			apiKey: process.env.GROQ_API_KEY,
		});

		// Make a simple test call
		const response = await groq.chat.completions.create({
			model: "llama-3.1-70b-versatile",
			messages: [
				{
					role: "user",
					content: "Say 'test successful' if you can read this.",
				},
			],
			max_tokens: 10,
			temperature: 0,
		});

		res.json({
			success: true,
			data: {
				groqConfigured: true,
				message: "Groq API key is working correctly",
				testResponse: response.choices[0]?.message?.content || "No response",
			},
		});
	} catch (error: any) {
		console.error("Groq test failed:", error);
		res.json({
			success: false,
			data: {
				groqConfigured: false,
				message: `Groq API test failed: ${error.message}`,
				error: error.code || "unknown_error",
			},
		});
	}
});

export default router;
