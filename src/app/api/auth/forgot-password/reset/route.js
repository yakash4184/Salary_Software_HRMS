import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_PERMISSIONS, getCredentialUsers } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { PasswordResetOtpModel } from "@/lib/models/PasswordResetOtp";
import { UserModel } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
    email: z.string().email(),
    resetToken: z.string().min(32),
    password: z.string().min(6)
});

export async function POST(request) {
    await connectToDatabase();
    const parsed = resetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Password must be at least 6 characters." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();
    const record = await PasswordResetOtpModel.findOne({
        email,
        usedAt: null,
        verifiedAt: { $ne: null },
        expiresAt: { $gt: new Date() }
    }).sort({ verifiedAt: -1 });
    if (!record?.resetTokenHash) {
        return NextResponse.json({ message: "Reset session is invalid or expired." }, { status: 400 });
    }
    const tokenOk = await bcrypt.compare(parsed.data.resetToken, record.resetTokenHash);
    if (!tokenOk) {
        return NextResponse.json({ message: "Reset session is invalid or expired." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    let user = await UserModel.findOneAndUpdate({ email, status: "Active" }, {
        $set: { passwordHash },
        $inc: { sessionVersion: 1 }
    }, { new: true }).lean();
    if (!user) {
        const fallbackUser = getCredentialUsers().find((candidate) => candidate.email === email);
        if (!fallbackUser) {
            return NextResponse.json({ message: "User not found." }, { status: 404 });
        }
        user = await UserModel.findOneAndUpdate({ email }, {
            name: fallbackUser.name,
            email,
            passwordHash,
            role: fallbackUser.role === "Admin" ? "Admin" : "User",
            permissions: fallbackUser.role === "Admin" ? ADMIN_PERMISSIONS : ["dashboard.view", "employees.view", "salary.view", "reports.view"],
            status: "Active",
            sessionVersion: 1
        }, { upsert: true, new: true, runValidators: true }).lean();
    }
    record.usedAt = new Date();
    await record.save();
    await writeAuditLog({
        action: "Password Change",
        actor: { email: user.email, name: user.name },
        message: "Password reset with OTP.",
        request
    });
    return NextResponse.json({ ok: true });
}
