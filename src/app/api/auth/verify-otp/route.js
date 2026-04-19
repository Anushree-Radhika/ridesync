import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

// ── POST /api/auth/verify-otp ────────────────────────────────
export async function POST(req) {
  try {
    const { contact, otp } = await req.json();

    if (!contact || !otp) {
      return NextResponse.json({ error: "Missing contact or OTP." }, { status: 400 });
    }

    const docRef = adminDb.collection("otp_store").doc(contact);
    const docSnap = await docRef.get();

    // Not found
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "OTP not found. Please request a new one." },
        { status: 400 }
      );
    }

    const record = docSnap.data();

    // Expired
    if (Date.now() > record.expiresAt) {
      await docRef.delete();
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Too many attempts
    if (record.attempts >= 5) {
      await docRef.delete();
      return NextResponse.json(
        { error: "Too many attempts. Please request a new OTP." },
        { status: 429 }
      );
    }

    // Wrong OTP
    if (record.otp !== otp) {
      const newAttempts = record.attempts + 1;
      await docRef.update({ attempts: newAttempts });
      return NextResponse.json(
        { error: `Incorrect code. ${5 - newAttempts} attempt(s) remaining.` },
        { status: 400 }
      );
    }

    // ✅ OTP correct — clean up
    await docRef.delete();

    // Get or create Firebase Auth user
    let uid;
    try {
      const existing = await adminAuth.getUserByEmail(contact);
      uid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({ email: contact, emailVerified: true });
      uid = created.uid;
    }

    const customToken = await adminAuth.createCustomToken(uid);
    return NextResponse.json({ success: true, customToken });

  } catch (err) {
    console.error("[verify-otp] error:", err);
    return NextResponse.json({ error: "Verification failed: " + err.message }, { status: 500 });
  }
}