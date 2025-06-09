import PDFDocument from "pdfkit";
import { uploadBufferToCloudinary } from "../middleware/cloudinary.middleware";

interface DonationData {
	donationId: string;
	donorName: string;
	donorEmail: string;
	organizationName: string;
	organizationEmail: string;
	amount?: number;
	quantity?: number;
	unit?: string;
	type: string;
	description: string;
	receivedDate: Date;
	cause?: string;
}

export const generateDonationReceipt = async (
	donationData: DonationData
): Promise<string> => {
	return new Promise((resolve, reject) => {
		try {
			// Generate unique timestamp for PDF identification
			const timestamp = Date.now();

			// Create PDF document
			const doc = new PDFDocument({ margin: 50 });

			// Collect PDF data in memory instead of writing to file
			const chunks: Buffer[] = [];
			doc.on("data", (chunk) => chunks.push(chunk));
			doc.on("end", async () => {
				try {
					// Combine all chunks into a single buffer
					const pdfBuffer = Buffer.concat(chunks);

					// Upload PDF to Cloudinary
					const cloudinaryResult = await uploadBufferToCloudinary(
						pdfBuffer,
						"donation-receipts",
						{
							resource_type: "raw", // For non-image files like PDFs
							format: "pdf",
							public_id: `receipt-${donationData.donationId}-${timestamp}`,
						}
					);

					console.log(
						"✅ PDF receipt uploaded to Cloudinary:",
						cloudinaryResult.secure_url
					);
					resolve(cloudinaryResult.secure_url);
				} catch (uploadError) {
					reject(uploadError);
				}
			});

			doc.on("error", (error) => {
				reject(error);
			});

			// Header
			doc
				.fontSize(24)
				.fillColor("#0d9488")
				.text("DONATION RECEIPT", 50, 50, { align: "center" });

			// Organization Info
			doc
				.fontSize(16)
				.fillColor("#374151")
				.text("GreenGive Platform", 50, 100, { align: "center" })
				.fontSize(12)
				.text("Connecting Hearts, Creating Change", 50, 120, {
					align: "center",
				});

			// Receipt Details Box
			doc.rect(50, 160, 495, 200).stroke("#e5e7eb");

			// Receipt Info
			let yPosition = 180;

			doc
				.fontSize(14)
				.fillColor("#1f2937")
				.text("Receipt Details", 70, yPosition, { underline: true });

			yPosition += 30;

			// Receipt ID and Date
			doc
				.fontSize(11)
				.text(`Receipt ID: ${donationData.donationId}`, 70, yPosition)
				.text(
					`Date: ${donationData.receivedDate.toLocaleDateString()}`,
					350,
					yPosition
				);

			yPosition += 20;

			// Donor Information
			doc
				.text(`Donor: ${donationData.donorName}`, 70, yPosition)
				.text(`Email: ${donationData.donorEmail}`, 70, yPosition + 15);

			yPosition += 45;

			// Organization Information
			doc
				.text(`Organization: ${donationData.organizationName}`, 70, yPosition)
				.text(`Email: ${donationData.organizationEmail}`, 70, yPosition + 15);

			yPosition += 45;

			// Donation Details
			doc
				.fontSize(12)
				.fillColor("#1f2937")
				.text("Donation Information", 70, yPosition, { underline: true });

			yPosition += 25;

			doc.fontSize(11);

			if (donationData.type === "MONEY") {
				doc
					.text(`Type: Monetary Donation`, 70, yPosition)
					.text(
						`Amount: ₹${donationData.amount?.toFixed(2) || "0.00"}`,
						70,
						yPosition + 15
					);
			} else {
				doc
					.text(`Type: ${donationData.type} Donation`, 70, yPosition)
					.text(
						`Quantity: ${donationData.quantity || 0} ${donationData.unit || ""}`,
						70,
						yPosition + 15
					);
			}

			yPosition += 35;

			if (donationData.cause) {
				doc.text(`Cause: ${donationData.cause}`, 70, yPosition);
				yPosition += 20;
			}

			if (donationData.description) {
				doc.text(`Description: ${donationData.description}`, 70, yPosition, {
					width: 450,
					align: "left",
				});
			}

			// Thank you message
			yPosition = 450;
			doc
				.fontSize(14)
				.fillColor("#059669")
				.text("Thank You for Your Generous Donation!", 50, yPosition, {
					align: "center",
					width: 495,
				});

			yPosition += 30;
			doc
				.fontSize(11)
				.fillColor("#6b7280")
				.text(
					"Your contribution makes a real difference in our community.",
					50,
					yPosition,
					{
						align: "center",
						width: 495,
					}
				)
				.text(
					"This receipt serves as confirmation that your donation has been received.",
					50,
					yPosition + 20,
					{
						align: "center",
						width: 495,
					}
				);

			// Footer
			yPosition = 550;
			doc
				.fontSize(10)
				.fillColor("#9ca3af")
				.text("This is an automatically generated receipt.", 50, yPosition, {
					align: "center",
				})
				.text(
					"For questions, please contact the organization directly.",
					50,
					yPosition + 15,
					{ align: "center" }
				);

			// Finalize PDF
			doc.end();
		} catch (error) {
			reject(error);
		}
	});
};

export const generateDonationConfirmationReceipt = async (
	donationData: DonationData & { confirmationDate: Date }
): Promise<string> => {
	return new Promise((resolve, reject) => {
		try {
			// Generate unique timestamp for PDF identification
			const timestamp = Date.now();

			// Create PDF document
			const doc = new PDFDocument({ margin: 50 });

			// Collect PDF data in memory instead of writing to file
			const chunks: Buffer[] = [];
			doc.on("data", (chunk) => chunks.push(chunk));
			doc.on("end", async () => {
				try {
					// Combine all chunks into a single buffer
					const pdfBuffer = Buffer.concat(chunks);

					// Upload PDF to Cloudinary
					const cloudinaryResult = await uploadBufferToCloudinary(
						pdfBuffer,
						"donation-receipts",
						{
							resource_type: "raw", // For non-image files like PDFs
							format: "pdf",
							public_id: `confirmation-receipt-${donationData.donationId}-${timestamp}`,
						}
					);

					resolve(cloudinaryResult.secure_url);
				} catch (uploadError) {
					reject(uploadError);
				}
			});

			doc.on("error", (error) => {
				reject(error);
			});

			// Header
			doc
				.fontSize(24)
				.fillColor("#7c3aed")
				.text("DONATION CONFIRMATION RECEIPT", 50, 50, { align: "center" });

			// Organization Info
			doc
				.fontSize(16)
				.fillColor("#374151")
				.text("GreenGive Platform", 50, 100, { align: "center" })
				.fontSize(12)
				.text("Connecting Hearts, Creating Change", 50, 120, {
					align: "center",
				});

			// Confirmation message
			doc
				.fontSize(14)
				.fillColor("#059669")
				.text("✓ DONATION CONFIRMED & PROCESSED", 50, 160, {
					align: "center",
					width: 495,
				});

			// Receipt Details Box
			doc.rect(50, 200, 495, 220).stroke("#e5e7eb");

			// Receipt Info
			let yPosition = 220;

			doc
				.fontSize(14)
				.fillColor("#1f2937")
				.text("Confirmation Details", 70, yPosition, { underline: true });

			yPosition += 30;

			// Receipt ID and Dates
			doc
				.fontSize(11)
				.text(`Donation ID: ${donationData.donationId}`, 70, yPosition)
				.text(
					`Received: ${donationData.receivedDate.toLocaleDateString()}`,
					350,
					yPosition
				)
				.text(
					`Confirmed: ${donationData.confirmationDate.toLocaleDateString()}`,
					350,
					yPosition + 15
				);

			yPosition += 35;

			// Donor Information
			doc
				.text(`Donor: ${donationData.donorName}`, 70, yPosition)
				.text(`Email: ${donationData.donorEmail}`, 70, yPosition + 15);

			yPosition += 35;

			// Organization Information
			doc
				.text(`Organization: ${donationData.organizationName}`, 70, yPosition)
				.text(`Email: ${donationData.organizationEmail}`, 70, yPosition + 15);

			yPosition += 35;

			// Donation Details
			doc
				.fontSize(12)
				.fillColor("#1f2937")
				.text("Donation Summary", 70, yPosition, { underline: true });

			yPosition += 25;

			doc.fontSize(11);

			if (donationData.type === "MONEY") {
				doc
					.text(`Type: Monetary Donation`, 70, yPosition)
					.text(
						`Amount: ₹${donationData.amount?.toFixed(2) || "0.00"}`,
						70,
						yPosition + 15
					);
			} else {
				doc
					.text(`Type: ${donationData.type} Donation`, 70, yPosition)
					.text(
						`Quantity: ${donationData.quantity || 0} ${donationData.unit || ""}`,
						70,
						yPosition + 15
					);
			}

			yPosition += 35;

			if (donationData.cause) {
				doc.text(`Cause: ${donationData.cause}`, 70, yPosition);
				yPosition += 20;
			}

			if (donationData.description) {
				doc.text(`Description: ${donationData.description}`, 70, yPosition, {
					width: 450,
					align: "left",
				});
			}

			// Thank you message
			yPosition = 500;
			doc
				.fontSize(16)
				.fillColor("#7c3aed")
				.text("Thank You for Making a Difference!", 50, yPosition, {
					align: "center",
					width: 495,
				});

			yPosition += 30;
			doc
				.fontSize(11)
				.fillColor("#6b7280")
				.text(
					"Your donation has been successfully processed and confirmed.",
					50,
					yPosition,
					{
						align: "center",
						width: 495,
					}
				)
				.text(
					"This serves as your official donation receipt for tax purposes.",
					50,
					yPosition + 20,
					{
						align: "center",
						width: 495,
					}
				);

			// Footer
			yPosition = 600;
			doc
				.fontSize(10)
				.fillColor("#9ca3af")
				.text(
					"This is an automatically generated confirmation receipt.",
					50,
					yPosition,
					{ align: "center" }
				)
				.text("Keep this receipt for your records.", 50, yPosition + 15, {
					align: "center",
				});

			// Finalize PDF
			doc.end();
		} catch (error) {
			reject(error);
		}
	});
};
