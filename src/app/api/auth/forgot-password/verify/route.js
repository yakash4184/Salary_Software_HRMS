import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { PasswordResetOtpModel } from "@/lib/models/PasswordResetOtp";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/)
});

export async function POST(request) {
    await connectToDatabase();
    const parsed = verifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Enter the 6 digit OTP." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const record = await PasswordResetOtpModel.findOne({
        email,
        usedAt: null,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    if (!record || record.attempts >= 5) {
        return NextResponse.json({ message: "OTP is invalid or expired." }, { status: 400 });
    }
    const ok = await bcrypt.compare(parsed.data.otp, record.otpHash);
    if (!ok) {
        record.attempts += 1;
        await record.save();
        return NextResponse.json({ message: "OTP is invalid or expired." }, { status: 400 });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    record.verifiedAt = new Date();
    record.resetTokenHash = await bcrypt.hash(resetToken, 10);
    await record.save();
    return NextResponse.json({ resetToken });
}
