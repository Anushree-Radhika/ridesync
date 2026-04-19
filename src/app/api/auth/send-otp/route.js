import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb } from "../../../lib/firebaseAdmin";

// ── Nodemailer Transporter ───────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ── POST /api/auth/send-otp ──────────────────────────────────
export async function POST(req) {
  try {
    const { contact } = await req.json();

    if (!contact || !contact.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Save OTP to Firestore
    await adminDb.collection("otp_store").doc(contact).set({
      otp,
      expiresAt,
      attempts: 0,
      createdAt: new Date(),
    });

    // Send email
    try {
      await transporter.sendMail({
        from: `"RideSync" <${process.env.EMAIL_USER}>`,
        to: contact,
        subject: "Your RideSync Verification Code",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="margin-bottom: 8px;">RideSync Verification</h2>
            <p style="color: #6b7280;">Use the code below to verify your email. It expires in 10 minutes.</p>
            <div style="font-size: 2.5rem; font-weight: bold; letter-spacing: 0.2em; text-align: center; padding: 24px 0;">
              ${otp}
            </div>
            <p style="color: #9ca3af; font-size: 0.85rem;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("\n[SMTP ERROR] Could not send email. Your network might be blocking port 465 (ETIMEDOUT).");
      console.log("=================================================");
      console.log(`DEVELOPMENT FALLBACK: Your OTP for ${contact} is: ${otp}`);
      console.log("=================================================\n");
    }

    return NextResponse.json({ success: true, warning: "Check terminal for OTP if email fails" });
  } catch (err) {
    console.error("[send-otp] error:", err.message);
    return NextResponse.json({ error: "Failed to send OTP: " + err.message, stack: err.stack }, { status: 500 });
  }
}