import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/lib/models/User";
import { ADMIN_PERMISSIONS, PERMISSIONS, publicUser } from "@/lib/auth";
import { getCurrentUser, requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
    name: z.string().min(2).optional(),
    password: z.string().min(6).optional().or(z.literal("")),
    permissions: z.array(z.enum(PERMISSIONS)).optional(),
    status: z.enum(["Active", "Inactive"]).optional()
});

export async function PATCH(request, context) {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const { email } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid user details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const update = { ...parsed.data };
    if (update.password) {
        update.passwordHash = await bcrypt.hash(update.password, 10);
    }
    delete update.password;
    if (update.permissions) {
        update.permissions = update.permissions.filter((permission) => permission !== "admin.manage" && ADMIN_PERMISSIONS.includes(permission));
    }
    const user = await UserModel.findOneAndUpdate({ email: decodeURIComponent(email).toLowerCase(), role: { $ne: "Admin" } }, update, { new: true, runValidators: true }).lean();
    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user: publicUser(user) });
}

export async function DELETE(_, context) {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const current = await getCurrentUser();
    const { email } = await context.params;
    const targetEmail = decodeURIComponent(email).toLowerCase();
    if (current?.email === targetEmail) {
        return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 });
    }
    const user = await UserModel.findOneAndUpdate({ email: targetEmail, role: { $ne: "Admin" } }, { status: "Inactive" }, { new: true }).lean();
    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user: publicUser(user) });
}
