import nodemailer from "nodemailer";

interface EmailOptions {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT),
	secure: process.env.SMTP_SECURE === "true",
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export const sendEmail = async (options: EmailOptions): Promise<void> => {
	try {
		await transporter.sendMail({
			from: process.env.SMTP_FROM,
			to: options.to,
			subject: options.subject,
			text: options.text,
			html: options.html,
		});
	} catch (error) {
		console.error("Email sending failed:", error);
		throw new Error("Failed to send email");
	}
};
