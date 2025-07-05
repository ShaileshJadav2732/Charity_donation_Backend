import { DonationType } from "../models/donation.model";
import Groq from "groq-sdk";

export interface VoiceCommand {
	type: "MONEY" | "ITEMS";
	amount?: number;
	itemType?: DonationType;
	quantity?: number;
	unit?: string;
	description?: string;
	confidence: number;
	originalText: string;

	// Contact Information
	contactPhone?: string;
	contactEmail?: string;
	donorName?: string;

	// Address Information
	address?: {
		street?: string;
		city?: string;
		state?: string;
		zipCode?: string;
		country?: string;
	};

	// Delivery/Pickup Information
	isPickup?: boolean;
	scheduledDate?: string;
	scheduledTime?: string;
	deliveryInstructions?: string;
}

export class VoiceCommandService {
	private static instance: VoiceCommandService;
	private groq: Groq;

	constructor() {
		// Initialize Groq with API key from environment variables
		this.groq = new Groq({
			apiKey: process.env.GROQ_API_KEY || "",
		});
	}

	public static getInstance(): VoiceCommandService {
		if (!VoiceCommandService.instance) {
			VoiceCommandService.instance = new VoiceCommandService();
		}
		return VoiceCommandService.instance;
	}

	public async processVoiceCommand(text: string): Promise<VoiceCommand> {
		if (!process.env.GROQ_API_KEY) {
			throw new Error(
				"Groq API key is required for voice command processing. Please configure GROQ_API_KEY in environment variables."
			);
		}

		try {
			const aiCommand = await this.processWithAI(text);
			return { ...aiCommand, originalText: text };
		} catch (error) {
			console.error("AI voice command processing failed:", error);
			throw new Error(
				`Failed to process voice command with AI: ${error.message}`
			);
		}
	}

	private async processWithAI(
		text: string
	): Promise<Omit<VoiceCommand, "originalText">> {
		try {
			// Check if Groq API key is configured
			if (!process.env.GROQ_API_KEY) {
				throw new Error(
					"Groq API key is required for voice command processing"
				);
			}

			const prompt = `
You are a comprehensive voice command parser for a charity donation platform. Parse the following voice command and extract ALL possible information including donation details, contact information, and address.

Voice Command: "${text}"

Extract ALL available information and return ONLY a valid JSON object with these possible fields:

DONATION INFORMATION (required):
- type: "MONEY" or "ITEMS"
- amount: number (for money donations, 10-1000000)
- itemType: "CLOTHES|FOOD|BOOKS|TOYS|FURNITURE|HOUSEHOLD|BLOOD|OTHER" (for item donations)
- quantity: number (for item donations, 1-1000)
- unit: "kg|items|pieces|boxes|bags" (for item donations)
- description: string
- confidence: 0.0-1.0

CONTACT INFORMATION (extract if mentioned):
- donorName: string (person's name)
- contactPhone: string (phone number)
- contactEmail: string (email address)

ADDRESS INFORMATION (extract if mentioned):
- address: {
    street: string,
    city: string,
    state: string,
    zipCode: string,
    country: string (default "India" if not specified)
  }

DELIVERY/PICKUP INFORMATION (extract if mentioned):
- isPickup: boolean (true if pickup mentioned, false if delivery)
- scheduledDate: string (YYYY-MM-DD format, default tomorrow if not specified)
- scheduledTime: string (HH:MM format, default "10:00" if not specified)
- deliveryInstructions: string (special instructions)

PARSING RULES:
- confidence: 0.8-1.0 for clear commands, 0.5-0.7 for unclear, 0.2-0.4 for very unclear
- Extract phone numbers in any format (with/without country code)
- Extract email addresses if mentioned
- Extract address components (street, city, state, zip, country)
- Infer pickup vs delivery from context
- Set reasonable defaults for missing scheduling info
- Return only the JSON object, no other text

EXAMPLES:

Simple donation:
"donate 500 rupees" → {"type":"MONEY","amount":500,"description":"Voice donation of ₹500","confidence":0.9}

Complete donation with contact:
"I want to donate 1000 rupees, my name is John Smith, phone 9876543210, email john@gmail.com" →
{
  "type":"MONEY",
  "amount":1000,
  "description":"Voice donation of ₹1000",
  "donorName":"John Smith",
  "contactPhone":"9876543210",
  "contactEmail":"john@gmail.com",
  "confidence":0.95
}

Item donation with address:
"I have 5 kg clothes to donate, pickup from 123 Main Street, Mumbai, Maharashtra 400001, contact me at 9876543210" →
{
  "type":"ITEMS",
  "itemType":"CLOTHES",
  "quantity":5,
  "unit":"kg",
  "description":"Voice donation: 5 kg of clothes",
  "contactPhone":"9876543210",
  "address":{
    "street":"123 Main Street",
    "city":"Mumbai",
    "state":"Maharashtra",
    "zipCode":"400001",
    "country":"India"
  },
  "isPickup":true,
  "scheduledDate":"2024-01-02",
  "scheduledTime":"10:00",
  "confidence":0.9
}

Complete form filling:
"Donate 2000 rupees for children, I'm Sarah Johnson, email sarah.j@email.com, phone +91-9123456789, address is 456 Park Avenue, Bangalore, Karnataka 560001, please call before delivery tomorrow at 2 PM" →
{
  "type":"MONEY",
  "amount":2000,
  "description":"Voice donation of ₹2000 for children",
  "donorName":"Sarah Johnson",
  "contactEmail":"sarah.j@email.com",
  "contactPhone":"+91-9123456789",
  "address":{
    "street":"456 Park Avenue",
    "city":"Bangalore",
    "state":"Karnataka",
    "zipCode":"560001",
    "country":"India"
  },
  "isPickup":false,
  "scheduledDate":"2024-01-02",
  "scheduledTime":"14:00",
  "deliveryInstructions":"please call before delivery",
  "confidence":0.95
}
`;

			const response = await this.groq.chat.completions.create({
				model: "llama-3.1-70b-versatile",
				messages: [
					{
						role: "system",
						content:
							"You are a precise voice command parser for charity donations. Extract ALL possible information from voice commands and return only valid JSON objects with comprehensive form data.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.1,
				max_tokens: 1000, // Increased for comprehensive form data
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
		} catch (error: any) {
			console.error("AI processing failed:", error);
			throw new Error(`Groq processing failed: ${error.message}`);
		}
	}

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
			if (typeof response.amount !== "number" || response.amount <= 0) {
				return false;
			}
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
			if (
				!validItemTypes.includes(response.itemType) ||
				typeof response.quantity !== "number" ||
				response.quantity <= 0 ||
				typeof response.unit !== "string"
			) {
				return false;
			}
		}

		// Validate optional contact fields (if present)
		if (response.contactPhone && typeof response.contactPhone !== "string") {
			return false;
		}
		if (response.contactEmail && typeof response.contactEmail !== "string") {
			return false;
		}
		if (response.donorName && typeof response.donorName !== "string") {
			return false;
		}

		// Validate optional address (if present)
		if (response.address && typeof response.address === "object") {
			const addr = response.address;
			if (
				(addr.street && typeof addr.street !== "string") ||
				(addr.city && typeof addr.city !== "string") ||
				(addr.state && typeof addr.state !== "string") ||
				(addr.zipCode && typeof addr.zipCode !== "string") ||
				(addr.country && typeof addr.country !== "string")
			) {
				return false;
			}
		}

		// Validate optional delivery fields (if present)
		if (response.isPickup && typeof response.isPickup !== "boolean") {
			return false;
		}
		if (response.scheduledDate && typeof response.scheduledDate !== "string") {
			return false;
		}
		if (response.scheduledTime && typeof response.scheduledTime !== "string") {
			return false;
		}

		return true;
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
