import nodemailer from 'nodemailer';
import { configDotenv } from 'dotenv';

configDotenv();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS
    }
});

export const sendOtpEmail = async (toEmail, otp) => {
    try {
        const mailOptions = {
            from: `"Research Assistance" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: "Password Reset Verification Code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>You recently requested to reset your password. Use the verification code below to proceed:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
                        <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2b6cb0;">${otp}</span>
                    </div>
                    <p style="font-size: 13px; color: #666;">This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EmailService] OTP email sent successfully:', info.messageId);
        return true;
    } catch (err) {
        console.error('[EmailService Error]: Failed to send OTP email:', err.message);
        throw new Error('Could not send OTP email. Please try again later.');
    }
}