import { DonationStatus } from "../models/donation.model";
import { sendEmail } from "./email";

export const sendDonationStatusNotification = async (
	email: string,
	donationId: string,
	status: DonationStatus,
	userName: string
) => {
	const subject = `Donation Status Update - ${status}`;
	let message = `Dear ${userName},\n\n`;

	switch (status) {
		case DonationStatus.RECEIVED:
			message += `Your donation (ID: ${donationId}) has been received by the organization.`;
			break;
		case DonationStatus.CONFIRMED:
			message += `Your donation (ID: ${donationId}) has been confirmed and processed.`;
			break;
		case DonationStatus.CANCELLED:
			message += `Your donation (ID: ${donationId}) has been cancelled.`;
			break;
		default:
			message += `The status of your donation (ID: ${donationId}) has been updated to ${status}.`;
	}

	message += `\n\nThank you for your contribution!\nBest regards,\nThe Charity Donation Team`;

	await sendEmail(email, subject, message);
};
