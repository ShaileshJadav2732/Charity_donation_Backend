import nodemailer from "nodemailer";

// Initialize transporter with connection pooling
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || "smtp.example.com",
	port: parseInt(process.env.SMTP_PORT || "465"),
	secure: true,
	pool: true, // Enable connection pooling
	maxConnections: 5, // Maximum simultaneous connections
	maxMessages: 100, // Maximum messages per connection
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

// Function to send donation status email
export const sendDonationStatusEmail = async (
	to: string,
	donationId: string,
	status: string,
	amount?: number,
	quantity?: number,
	unit?: string
) => {
	const subject = `Donation Status Update: ${status}`;
	const text = `
    Dear Donor,

    Your donation (ID: ${donationId}) has been updated to "${status}".
    ${
			amount
				? `Amount: $${amount.toFixed(2)}`
				: `Quantity: ${quantity} ${unit || ""}`
		}

    Thank you for your generous support!

    Best regards,
    Your Organization
  `;

	const mailOptions = {
		from: process.env.EMAIL_FROM || "Donations <noreply@example.com>",
		to,
		subject,
		text,
	};

	try {
		await transporter.sendMail(mailOptions);
		console.log(`Email sent to ${to} for donation ${donationId}`);
	} catch (error) {
		console.error(`Error sending email to ${to}:`, error);
		throw new Error("Failed to send notification email");
	}
};
