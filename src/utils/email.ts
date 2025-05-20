import { Resend } from "resend";

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Function to send donation status email
export const sendEmail = async (
	to: string,
	donationId: string,
	status: string,
	amount?: number,
	quantity?: number,
	unit?: string
) => {
	try {
		// Validate input
		if (!to || !donationId || !status) {
			throw new Error("Missing required email parameters");
		}

		const subject = `Donation Status Update: ${status}`;
		const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Donation Status Update</h2>
        <p>Dear Donor,</p>
        <p>Your donation (ID: ${donationId}) has been updated to <strong>${status}</strong>.</p>
        ${amount
				? `<p>Amount: <strong>$${amount.toFixed(2)}</strong></p>`
				: `<p>Quantity: <strong>${quantity} ${unit || ""}</strong></p>`
			}
        <p>Thank you for your generous support!</p>
        <p>Best regards,<br>Your Organization</p>
      </div>
    `;

		const response = await resend.emails.send({
			from: "Donations <onboarding@resend.dev>",
			to: "jadavshailesh2354@gmail.com",
			subject,
			html,
		});

		console.log(`Email sent to ${to} for donation ${donationId}:`, response);
		return response;
	} catch (error) {
		console.error(`Failed to send email to ${to} for donation ${donationId}:`, error);
		throw new Error("Failed to send notification email");
	}
};