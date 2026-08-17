import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { ActiveSessionModel } from "@/lib/models/ActiveSession";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await connectToDatabase();
    const sessions = await ActiveSessionModel.find({
        email: user.email,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
    }).sort({ lastSeenAt: -1 }).lean();
    return NextResponse.json({
        sessions: sessions.map((session) => ({
            sessionId: session.sessionId,
            current: session.sessionId === user.sid,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            lastSeenAt: session.lastSeenAt?.toISOString(),
            createdAt: session.createdAt?.toISOString(),
            expiresAt: session.expiresAt?.toISOString()
        }))
    });
}
