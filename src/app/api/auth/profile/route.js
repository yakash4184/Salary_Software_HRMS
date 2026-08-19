import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SettingModel } from "@/lib/models/Setting";
import { getCurrentUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const photo = typeof body?.photo === "string" ? body.photo : "";
    if (photo && (!photo.startsWith("data:image/") || photo.length > 2500000)) {
        return NextResponse.json({ message: "Please upload a valid image under 2 MB." }, { status: 400 });
    }
    await connectToDatabase();
    const profile = await SettingModel.findOneAndUpdate(
        { key: `profile:${user.email}` },
        { value: { photo } },
        { upsert: true, new: true, runValidators: true }
    ).lean();
    return NextResponse.json({ profile: profile.value });
}
