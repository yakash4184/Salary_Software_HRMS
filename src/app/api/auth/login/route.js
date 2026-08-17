import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession, validateCredentials } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
export async function POST(request) {
    const body = await request.json().catch(() => null);
    const email = String(body?.email || "");
    const password = String(body?.password || "");
    let user;
    try {
        user = await validateCredentials(email, password);
    }
    catch (error) {
        console.error("Login failed because the database is unavailable:", error);
        return NextResponse.json({
            message: "Database unavailable. Please start MongoDB, then try login again."
        }, { status: 503 });
    }
    if (!user) {
        await connectToDatabase().then(() => writeAuditLog({
            action: "Login",
            status: "Failed",
            message: "Invalid email or password.",
            actor: { email },
            request
        })).catch(() => null);
        return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }
    const token = await signSession(user, request);
    await writeAuditLog({ action: "Login", actor: user, message: "User signed in.", request }).catch(() => null);
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 60 * 60 * 8
    });
    return response;
}
