import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/lib/models/User";
import { ADMIN_PERMISSIONS, PERMISSIONS, publicUser } from "@/lib/auth";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const userSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    permissions: z.array(z.enum(PERMISSIONS)).default([])
});

export async function GET() {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const users = await UserModel.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ users: users.map(publicUser) });
}

export async function POST(request) {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = userSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid user details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await UserModel.findOneAndUpdate({ email: parsed.data.email.toLowerCase() }, {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: "User",
        permissions: parsed.data.permissions.filter((permission) => permission !== "admin.manage" && ADMIN_PERMISSIONS.includes(permission)),
        status: "Active"
    }, { upsert: true, new: true, runValidators: true }).lean();
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
