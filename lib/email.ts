import "server-only";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    console.error("Sending email failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}
