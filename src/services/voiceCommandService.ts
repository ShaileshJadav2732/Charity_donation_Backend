import { DonationType } from "../models/donation.model";
import OpenAI from "openai";

export interface VoiceCommand {
	type: "MONEY" | "ITEMS";
	amount?: number;
	itemType?: DonationType;
	quantity?: number;
	unit?: string;
	description?: string;
	confidence: number;
	originalText: string;
}

export class VoiceCommandService {
	private static instance: VoiceCommandService;
	private openai: OpenAI;

	constructor() {
		// Initialize OpenAI with API key from environment variables
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY || "",
		});
	}

	public static getInstance(): VoiceCommandService {
		if (!VoiceCommandService.instance) {
			VoiceCommandService.instance = new VoiceCommandService();
		}
		return VoiceCommandService.instance;
	}

	/**
	 * Process voice command text and extract donation intent
	 */
	public async processVoiceCommand(text: string): Promise<VoiceCommand> {
		const normalizedText = text.toLowerCase().trim();

		// Try to parse monetary donations first
		const moneyCommand = this.parseMonetaryDonation(normalizedText);
		if (moneyCommand.confidence > 0.7) {
			return { ...moneyCommand, originalText: text };
		}

		// Try to parse item donations
		const itemCommand = this.parseItemDonation(normalizedText);
		if (itemCommand.confidence > 0.7) {
			return { ...itemCommand, originalText: text };
		}

		// If both have low confidence, use AI service (OpenAI integration)
		const aiCommand = await this.processWithAI(text);
		return { ...aiCommand, originalText: text };
	}

	/**
	 * Parse monetary donation commands
	 */
	private parseMonetaryDonation(
		text: string
	): Omit<VoiceCommand, "originalText"> {
		// Enhanced regex patterns for monetary donations
		const patterns = [
			// "donate 500 rupees", "give 1000 rs", "send 250"
			/(?:donate|give|send|contribute)\s+(?:rupees?\s+)?(\d+)(?:\s+(?:rupees?|rs|inr))?/i,
			// "I want to donate 500", "I'd like to give 1000"
			/(?:want to|like to|going to)\s+(?:donate|give|contribute)\s+(\d+)/i,
			// "500 rupees donation", "1000 rs for charity"
			/(\d+)\s+(?:rupees?|rs|inr)?\s+(?:donation|for|to)/i,
			// "make a donation of 500"
			/(?:donation|contribution)\s+of\s+(\d+)/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				const amount = parseInt(match[1]);
				if (amount >= 10 && amount <= 1000000) {
					// Reasonable limits
					return {
						type: "MONEY",
						amount,
						description: `Voice donation of ₹${amount}`,
						confidence: 0.9,
					};
				}
			}
		}

		// Check for currency symbols
		const currencyPattern = /[₹$]\s*(\d+)/;
		const currencyMatch = text.match(currencyPattern);
		if (currencyMatch) {
			const amount = parseInt(currencyMatch[1]);
			return {
				type: "MONEY",
				amount,
				description: `Voice donation of ₹${amount}`,
				confidence: 0.85,
			};
		}

		return {
			type: "MONEY",
			confidence: 0.1,
		};
	}

	/**
	 * Parse item donation commands
	 */
	private parseItemDonation(text: string): Omit<VoiceCommand, "originalText"> {
		// Item type mappings
		const itemMappings: Record<string, DonationType> = {
			clothes: DonationType.CLOTHES,
			clothing: DonationType.CLOTHES,
			shirts: DonationType.CLOTHES,
			pants: DonationType.CLOTHES,
			food: DonationType.FOOD,
			meals: DonationType.FOOD,
			groceries: DonationType.FOOD,
			books: DonationType.BOOKS,
			textbooks: DonationType.BOOKS,
			novels: DonationType.BOOKS,
			toys: DonationType.TOYS,
			games: DonationType.TOYS,
			furniture: DonationType.FURNITURE,
			chairs: DonationType.FURNITURE,
			tables: DonationType.FURNITURE,
			household: DonationType.HOUSEHOLD,
			utensils: DonationType.HOUSEHOLD,
			blood: DonationType.BLOOD,
		};

		// Enhanced patterns for item donations
		const patterns = [
			// "donate 5 kg of clothes", "give 10 books"
			/(?:donate|give|contribute)\s+(\d+)\s*(kg|kilograms?|items?|pieces?|boxes?|bags?)?\s*(?:of\s+)?(\w+)/i,
			// "I have 5 bags of clothes to donate"
			/(?:have|got)\s+(\d+)\s*(kg|kilograms?|items?|pieces?|boxes?|bags?)\s*(?:of\s+)?(\w+)\s*(?:to\s+)?(?:donate|give)/i,
			// "clothes donation - 5 kg"
			/(\w+)\s+donation\s*[-–]\s*(\d+)\s*(kg|items?|pieces?)/i,
		];

		for (const pattern of patterns) {
			const match = text.match(pattern);
			if (match) {
				let quantity: number, unit: string, itemName: string;

				if (pattern.source.includes("donation\\s*[-–]")) {
					// Pattern 3: "clothes donation - 5 kg"
					itemName = match[1];
					quantity = parseInt(match[2]);
					unit = match[3] || "items";
				} else {
					// Patterns 1 & 2
					quantity = parseInt(match[1]);
					unit = match[2] || "items";
					itemName = match[3];
				}

				const itemType = this.findItemType(itemName, itemMappings);
				if (itemType && quantity > 0 && quantity <= 1000) {
					return {
						type: "ITEMS",
						itemType,
						quantity,
						unit,
						description: `Voice donation: ${quantity} ${unit} of ${itemName}`,
						confidence: 0.85,
					};
				}
			}
		}

		// Simple item detection without quantity
		for (const [keyword, itemType] of Object.entries(itemMappings)) {
			if (text.includes(keyword)) {
				return {
					type: "ITEMS",
					itemType,
					quantity: 1,
					unit: "items",
					description: `Voice donation: ${keyword}`,
					confidence: 0.6,
				};
			}
		}

		return {
			type: "ITEMS",
			confidence: 0.1,
		};
	}

	/**
	 * Find matching item type from text
	 */
	private findItemType(
		itemName: string,
		mappings: Record<string, DonationType>
	): DonationType | undefined {
		const normalizedName = itemName.toLowerCase();

		// Direct match
		if (mappings[normalizedName]) {
			return mappings[normalizedName];
		}

		// Partial match
		for (const [keyword, itemType] of Object.entries(mappings)) {
			if (
				normalizedName.includes(keyword) ||
				keyword.includes(normalizedName)
			) {
				return itemType;
			}
		}

		return DonationType.OTHER;
	}

	/**
	 * Process with AI service (OpenAI integration)
	 * This would integrate with OpenAI GPT for more sophisticated parsing
	 */
	private async processWithAI(
		text: string
	): Promise<Omit<VoiceCommand, "originalText">> {
		try {
			// Check if OpenAI API key is configured
			if (!process.env.OPENAI_API_KEY) {
				console.warn("OpenAI API key not configured, using fallback parser");
				return this.getFallbackCommand(text);
			}

			const prompt = `
You are a voice command parser for a charity donation platform. Parse the following voice command and extract donation information.

Voice Command: "${text}"

Extract the following information and return ONLY a valid JSON object:

For MONEY donations:
{
  "type": "MONEY",
  "amount": <number>,
  "description": "<description>",
  "confidence": <0.0-1.0>
}

For ITEMS donations:
{
  "type": "ITEMS",
  "itemType": "<CLOTHES|FOOD|BOOKS|TOYS|FURNITURE|HOUSEHOLD|BLOOD|OTHER>",
  "quantity": <number>,
  "unit": "<kg|items|pieces|boxes|bags>",
  "description": "<description>",
  "confidence": <0.0-1.0>
}

Rules:
- confidence should be 0.8-1.0 for clear commands, 0.5-0.7 for unclear, 0.2-0.4 for very unclear
- For money: amount should be reasonable (10-1000000)
- For items: quantity should be reasonable (1-1000)
- itemType must be one of the specified enum values
- Return only the JSON object, no other text

Examples:
"donate 500 rupees" → {"type":"MONEY","amount":500,"description":"Voice donation of ₹500","confidence":0.9}
"give 5 kg of clothes" → {"type":"ITEMS","itemType":"CLOTHES","quantity":5,"unit":"kg","description":"Voice donation: 5 kg of clothes","confidence":0.9}
`;

			const response = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content:
							"You are a precise voice command parser. Return only valid JSON objects as specified.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.1,
				max_tokens: 200,
			});

			const aiResponse = response.choices[0]?.message?.content?.trim();

			if (!aiResponse) {
				throw new Error("No response from OpenAI");
			}

			// Parse the JSON response
			const parsedCommand = JSON.parse(aiResponse);

			// Validate the response structure
			if (!this.validateAIResponse(parsedCommand)) {
				throw new Error("Invalid AI response structure");
			}

			return parsedCommand;
		} catch (error) {
			console.error("AI processing failed:", error);
			return this.getFallbackCommand(text);
		}
	}

	/**
	 * Validate AI response structure
	 */
	private validateAIResponse(response: any): boolean {
		if (!response || typeof response !== "object") {
			return false;
		}

		// Check required fields
		if (!response.type || !["MONEY", "ITEMS"].includes(response.type)) {
			return false;
		}

		if (
			typeof response.confidence !== "number" ||
			response.confidence < 0 ||
			response.confidence > 1
		) {
			return false;
		}

		// Validate money donations
		if (response.type === "MONEY") {
			return typeof response.amount === "number" && response.amount > 0;
		}

		// Validate item donations
		if (response.type === "ITEMS") {
			const validItemTypes = [
				"CLOTHES",
				"FOOD",
				"BOOKS",
				"TOYS",
				"FURNITURE",
				"HOUSEHOLD",
				"BLOOD",
				"OTHER",
			];
			return (
				validItemTypes.includes(response.itemType) &&
				typeof response.quantity === "number" &&
				response.quantity > 0 &&
				typeof response.unit === "string"
			);
		}

		return false;
	}

	/**
	 * Fallback command when parsing fails
	 */
	private getFallbackCommand(text: string): Omit<VoiceCommand, "originalText"> {
		// Extract any numbers from the text
		const numbers = text.match(/\d+/g);
		if (numbers && numbers.length > 0) {
			const firstNumber = parseInt(numbers[0]);

			// If it's a reasonable donation amount, assume it's money
			if (firstNumber >= 10 && firstNumber <= 100000) {
				return {
					type: "MONEY",
					amount: firstNumber,
					description: `Voice donation: ${text}`,
					confidence: 0.5,
				};
			}
		}

		// Default to a small monetary donation
		return {
			type: "MONEY",
			amount: 100,
			description: `Voice donation: ${text}`,
			confidence: 0.3,
		};
	}

	/**
	 * Validate parsed command
	 */
	public validateCommand(command: VoiceCommand): boolean {
		if (command.type === "MONEY") {
			return !!(
				command.amount &&
				command.amount >= 10 &&
				command.amount <= 1000000
			);
		}

		if (command.type === "ITEMS") {
			return !!(
				command.itemType &&
				command.quantity &&
				command.quantity > 0 &&
				command.quantity <= 1000
			);
		}

		return false;
	}

	/**
	 * Get suggested improvements for low-confidence commands
	 */
	public getSuggestions(command: VoiceCommand): string[] {
		const suggestions: string[] = [];

		if (command.confidence < 0.6) {
			suggestions.push("Try speaking more clearly");
			suggestions.push("Use specific amounts: 'donate 500 rupees'");
			suggestions.push("For items: 'donate 5 kg of clothes'");
		}

		if (command.type === "MONEY" && !command.amount) {
			suggestions.push("Please specify an amount: 'donate 100 rupees'");
		}

		if (command.type === "ITEMS" && !command.itemType) {
			suggestions.push(
				"Please specify item type: 'donate clothes' or 'give books'"
			);
		}

		return suggestions;
	}
}
