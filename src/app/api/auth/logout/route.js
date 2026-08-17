import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { ActiveSessionModel } from "@/lib/models/ActiveSession";
import { connectToDatabase } from "@/lib/db";
import { cookies } from "next/headers";
export async function POST() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await verifySession(token);
    if (user?.sid) {
        await connectToDatabase();
        await ActiveSessionModel.updateOne({ sessionId: user.sid }, { revokedAt: new Date() });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
