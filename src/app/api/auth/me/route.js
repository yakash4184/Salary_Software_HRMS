import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
export async function GET() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await verifySession(token);
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ user });
}
