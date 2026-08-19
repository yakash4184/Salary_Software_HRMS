import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { SettingModel } from "@/lib/models/Setting";
export async function GET() {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await verifySession(token);
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await connectToDatabase();
    const profile = await SettingModel.findOne({ key: `profile:${user.email}` }).lean();
    return NextResponse.json({ user: { ...user, profilePhoto: profile?.value?.photo || "" } });
}
