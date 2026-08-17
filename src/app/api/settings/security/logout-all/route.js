import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { connectToDatabase } from "@/lib/db";
import { ActiveSessionModel } from "@/lib/models/ActiveSession";
import { UserModel } from "@/lib/models/User";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await connectToDatabase();
    await Promise.all([
        ActiveSessionModel.updateMany({ email: user.email, revokedAt: null }, { revokedAt: new Date() }),
        UserModel.updateOne({ email: user.email }, { $inc: { sessionVersion: 1 } })
    ]);
    await writeAuditLog({ action: "Logout All Devices", actor: user, message: "All sessions revoked.", request });
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
