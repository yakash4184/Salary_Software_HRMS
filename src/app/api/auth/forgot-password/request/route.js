import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { getCredentialUsers } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { PasswordResetOtpModel } from "@/lib/models/PasswordResetOtp";
import { UserModel } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
    email: z.string().email()
});

export async function POST(request) {
    await connectToDatabase();
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await PasswordResetOtpModel.countDocuments({
        email,
        requestIp: ipAddress,
        createdAt: { $gte: since }
    });
    if (recentRequests >= 3) {
        return NextResponse.json({ message: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
    }
    const dbUser = await UserModel.findOne({ email, status: "Active" }).lean();
    const fallbackUser = getCredentialUsers().find((candidate) => candidate.email === email);
    if (!dbUser && !fallbackUser) {
        return NextResponse.json({ ok: true });
    }
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    await PasswordResetOtpModel.updateMany({ email, usedAt: null }, { usedAt: new Date() });
    await PasswordResetOtpModel.create({
        email,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        requestIp: ipAddress
    });
    try {
        await sendMail({
            to: email,
            subject: "Password reset OTP",
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your password reset OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
        });
    }
    catch (error) {
        return NextResponse.json({ message: error.message || "Unable to send OTP email." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
