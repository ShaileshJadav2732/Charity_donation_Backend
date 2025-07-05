import { Request, Response } from "express";
import { VoiceCommandService } from "../services/voiceCommandService";
import { AuthRequest } from "../types";

export const processVoiceCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { text } = req.body;

		if (!text || typeof text !== "string") {
			return res.status(400).json({
				success: false,
				message: "Voice command text is required",
			});
		}

		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "User authentication required",
			});
		}

		const voiceService = VoiceCommandService.getInstance();
		const command = await voiceService.processVoiceCommand(text);

		// Validate the parsed command
		const isValid = voiceService.validateCommand(command);
		const suggestions = voiceService.getSuggestions(command);

		res.status(200).json({
			success: true,
			data: {
				command,
				isValid,
				suggestions,
				confidence: command.confidence,
			},
			message: "Voice command processed successfully",
		});
	} catch (error) {
		console.error("Voice command processing error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to process voice command",
			error: process.env.NODE_ENV === "development" ? error : undefined,
		});
	}
};
