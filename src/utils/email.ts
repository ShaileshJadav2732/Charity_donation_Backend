import { Resend } from "resend";
import { DonationStatus } from "../models/donation.model";

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Function to send donation status email
export const sendEmail = async (
	to: string,
	donationId: string,
	status: string,
	amount?: number,
	quantity?: number,
	unit?: string,
	photoUrl?: string
) => {
	try {
		// Validate input
		if (!to || !donationId || !status) {
			throw new Error("Missing required email parameters");
		}

		const subject = `Donation Status Update: ${status}`;

		// Create different email content based on status
		let statusSpecificContent = "";

		if (status === DonationStatus.RECEIVED) {
			statusSpecificContent = `
				<p>Your donation has been <strong>received</strong> by the organization.</p>
				${
					photoUrl
						? `
				<p>The organization has uploaded a photo of your donation:</p>
				<div style="margin: 20px 0;">
					<img src="${process.env.BACKEND_URL || "http://localhost:5000"}${photoUrl}"
						alt="Donation Photo" style="max-width: 100%; max-height: 300px; border: 1px solid #ddd; border-radius: 4px;">
				</div>
				<p>Please confirm that you recognize this donation by clicking the "Confirm" button in your dashboard.</p>
				`
						: ""
				}
			`;
		} else if (status === DonationStatus.CONFIRMED) {
			statusSpecificContent = `
				<p>Your donation has been <strong>confirmed</strong>. Thank you for your contribution!</p>
			`;
		} else if (status === DonationStatus.APPROVED) {
			statusSpecificContent = `
				<p>Your donation has been <strong>approved</strong> by the organization and is being processed.</p>
			`;
		} else {
			statusSpecificContent = `
				<p>Your donation (ID: ${donationId}) has been updated to <strong>${status}</strong>.</p>
			`;
		}

		const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Donation Status Update</h2>
        <p>Dear Donor,</p>
        ${statusSpecificContent}
        ${
					amount
						? `<p>Amount: <strong>$${amount.toFixed(2)}</strong></p>`
						: quantity
							? `<p>Quantity: <strong>${quantity} ${unit || ""}</strong></p>`
							: ""
				}
        <p>Thank you for your generous support!</p>
        <p>Best regards,<br>Your Organization</p>
      </div>
    `;

		const response = await resend.emails.send({
			from: "Donations <onboarding@resend.dev>",
			to: "jadavshailesh2354@gmail.com", // For testing, replace with actual recipient in production
			subject,
			html,
		});

		console.log(`Email sent to ${to} for donation ${donationId}:`, response);
		return response;
	} catch (error) {
		console.error(
			`Failed to send email to ${to} for donation ${donationId}:`,
			error
		);
		throw new Error("Failed to send notification email");
	}
};
