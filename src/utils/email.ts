import { Resend } from "resend";
import { DonationStatus } from "../types";

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
	photoUrl?: string,
	pdfReceiptUrl?: string
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
				<div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 16px 0;">
					<h3 style="color: #0369a1; margin: 0 0 8px 0;">🎉 Donation Confirmed!</h3>
					<p style="margin: 0; color: #0369a1;">Your donation has been <strong>confirmed</strong> and the donation process is now complete!</p>
				</div>
				<p>Thank you for making a difference in the community. Your generous contribution has been successfully processed and confirmed.</p>
				${
					pdfReceiptUrl
						? `
				<div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 16px 0;">
					<h4 style="color: #15803d; margin: 0 0 8px 0;">📄 Your Receipt is Ready!</h4>
					<p style="margin: 0; color: #15803d;">Your donation receipt has been generated and is available for download.</p>
					<p style="margin: 8px 0 0 0;">
						<a href="${process.env.BACKEND_URL || "http://localhost:5000"}${pdfReceiptUrl}"
						   style="background-color: #22c55e; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">
						   Download Receipt
						</a>
					</p>
				</div>
				`
						: ""
				}
				<p><strong>What happens next?</strong></p>
				<ul>
					<li>The donation is now marked as complete in our system</li>
					<li>You will receive impact reports showing how your donation helped</li>
					<li>You can track your donation history in your dashboard</li>
					<li>Keep your receipt for tax purposes</li>
				</ul>
			`;
		} else if (status === DonationStatus.APPROVED) {
			statusSpecificContent = `
				<p>Your donation has been <strong>approved</strong> by the organization and is being processed.</p>
			`;
		} else if (status === DonationStatus.PENDING) {
			statusSpecificContent = `
				<div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
					<h3 style="color: #92400e; margin: 0 0 8px 0;">📋 New Donation Received!</h3>
					<p style="margin: 0; color: #92400e;">A new donation has been submitted and is awaiting your review.</p>
				</div>
				<p>A donor has submitted a new donation to your organization. Please review the details and approve or take appropriate action.</p>
				<p><strong>What you need to do:</strong></p>
				<ul>
					<li>Review the donation details in your dashboard</li>
					<li>Approve the donation if everything looks correct</li>
					<li>Contact the donor if you need more information</li>
				</ul>
			`;
		} else if (status === "PAYMENT_CONFIRMED") {
			statusSpecificContent = `
				<div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 16px 0;">
					<h3 style="color: #15803d; margin: 0 0 8px 0;">💳 Payment Successful!</h3>
					<p style="margin: 0; color: #15803d;">Your payment has been successfully processed!</p>
				</div>
				<p>Thank you for your generous donation! Your payment has been confirmed and your donation is now pending approval by the organization.</p>
				<p><strong>What happens next?</strong></p>
				<ul>
					<li>The organization will review and approve your donation</li>
					<li>You will receive another notification once approved</li>
					<li>You can track your donation status in your dashboard</li>
					<li>Keep this email as confirmation of your payment</li>
				</ul>
			`;
		} else {
			statusSpecificContent = `
				<p>Your donation (ID: ${donationId}) has been updated to <strong>${status}</strong>.</p>
			`;
		}

		const greeting =
			status === DonationStatus.PENDING ? "Dear Organization," : "Dear Donor,";
		const title =
			status === DonationStatus.PENDING
				? "New Donation Notification"
				: status === "PAYMENT_CONFIRMED"
					? "Payment Confirmation"
					: "Donation Status Update";

		const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
        <h2>${title}</h2>
        <p>${greeting}</p>
        ${statusSpecificContent}
        ${
					amount
						? `<p>Amount: <strong>₹${amount.toFixed(2)}</strong></p>`
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

		return response;
	} catch (error) {
		console.error(
			`Failed to send email to ${to} for donation ${donationId}:`,
			error
		);
		throw new Error("Failed to send notification email");
	}
};
