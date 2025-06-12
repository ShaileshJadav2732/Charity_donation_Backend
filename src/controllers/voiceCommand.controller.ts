import { Request, Response } from "express";
import { VoiceCommandService } from "../services/voiceCommandService";
import { AuthRequest } from "../types";

/**
 * Process voice command for donation
 */
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

/**
 * Get voice command examples and help
 */
export const getVoiceCommandHelp = async (req: Request, res: Response) => {
	try {
		const examples = {
			monetary: [
				"Donate 500 rupees",
				"Give 1000 rs to charity",
				"I want to contribute 250",
				"Make a donation of 750 rupees",
				"Send ₹2000 for the cause",
			],
			items: [
				"Donate 5 kg of clothes",
				"Give 10 books to children",
				"I have 3 bags of toys to donate",
				"Contribute 2 boxes of food",
				"Donate household items",
			],
		};

		const tips = [
			"Speak clearly and at a normal pace",
			"Use specific amounts and quantities",
			"Mention the item type for non-monetary donations",
			"Use common units like kg, items, boxes, bags",
			"Try phrases like 'donate', 'give', 'contribute'",
		];

		const supportedItems = [
			"Clothes/Clothing",
			"Food/Meals",
			"Books/Textbooks",
			"Toys/Games",
			"Furniture",
			"Household items",
			"Blood donation",
		];

		res.status(200).json({
			success: true,
			data: {
				examples,
				tips,
				supportedItems,
				minimumAmount: 10,
				maximumAmount: 1000000,
			},
			message: "Voice command help retrieved successfully",
		});
	} catch (error) {
		console.error("Voice command help error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to get voice command help",
		});
	}
};

/**
 * Test voice command parsing (development only)
 */
export const testVoiceCommand = async (req: Request, res: Response) => {
	try {
		if (process.env.NODE_ENV === "production") {
			return res.status(403).json({
				success: false,
				message: "Test endpoint not available in production",
			});
		}

		const { text } = req.body;

		if (!text) {
			return res.status(400).json({
				success: false,
				message: "Text is required for testing",
			});
		}

		const voiceService = VoiceCommandService.getInstance();
		const command = await voiceService.processVoiceCommand(text);

		// Get detailed parsing information for debugging
		const debugInfo = {
			originalText: text,
			normalizedText: text.toLowerCase().trim(),
			parsedCommand: command,
			isValid: voiceService.validateCommand(command),
			suggestions: voiceService.getSuggestions(command),
			confidence: command.confidence,
			confidenceLevel: 
				command.confidence >= 0.8 ? "High" :
				command.confidence >= 0.6 ? "Medium" :
				command.confidence >= 0.4 ? "Low" : "Very Low",
		};

		res.status(200).json({
			success: true,
			data: debugInfo,
			message: "Voice command test completed",
		});
	} catch (error) {
		console.error("Voice command test error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to test voice command",
			error: process.env.NODE_ENV === "development" ? error : undefined,
		});
	}
};
