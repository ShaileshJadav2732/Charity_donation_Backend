import twilio from "twilio";

interface WhatsAppOptions {
	to: string;
	message: string;
}

const client = twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
);

export const sendWhatsAppMessage = async (
	options: WhatsAppOptions
): Promise<void> => {
	try {
		await client.messages.create({
			body: options.message,
			from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
			to: `whatsapp:${options.to}`,
		});
	} catch (error) {
		console.error("WhatsApp message sending failed:", error);
		throw new Error("Failed to send WhatsApp message");
	}
};
