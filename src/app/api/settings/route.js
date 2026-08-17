import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { getSchoolInfo, getSmtpSettings, saveSchoolInfo, saveSmtpSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
    schoolInfo: z.object({
        name: z.string().min(2),
        address: z.string().min(2),
        phone: z.string().optional().or(z.literal("")),
        email: z.string().email().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal(""))
    }).optional(),
    smtpSettings: z.object({
        host: z.string().min(2),
        port: z.coerce.number().int().min(1).max(65535),
        email: z.string().email(),
        password: z.string().optional().or(z.literal("")),
        fromName: z.string().min(2)
    }).optional()
});

export async function GET() {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const [schoolInfo, smtpSettings, auditLogs, systemInfo] = await Promise.all([
        getSchoolInfo(),
        getSmtpSettings(),
        AuditLogModel.find({ action: { $in: ["Login", "Password Change", "Backup", "Restore"] } }).sort({ createdAt: -1 }).limit(50).lean(),
        getSystemInfo()
    ]);
    return NextResponse.json({
        schoolInfo,
        smtpSettings,
        auditLogs: auditLogs.map((log) => ({
            _id: String(log._id),
            action: log.action,
            actorEmail: log.actorEmail,
            actorName: log.actorName,
            status: log.status,
            message: log.message,
            createdAt: log.createdAt?.toISOString()
        })),
        systemInfo
    });
}

export async function PATCH(request) {
    const { response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid settings.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const result = {};
    if (parsed.data.schoolInfo) {
        result.schoolInfo = await saveSchoolInfo(parsed.data.schoolInfo);
    }
    if (parsed.data.smtpSettings) {
        result.smtpSettings = await saveSmtpSettings(parsed.data.smtpSettings);
    }
    return NextResponse.json(result);
}

async function getSystemInfo() {
    let mongoStatus = "Disconnected";
    let databaseName = process.env.MONGODB_DB || "";
    let storageUsage = null;
    try {
        const db = mongoose.connection.db;
        if (db) {
            mongoStatus = "Connected";
            databaseName = db.databaseName;
            const stats = await db.stats();
            storageUsage = {
                dataSize: stats.dataSize || 0,
                storageSize: stats.storageSize || 0,
                collections: stats.collections || 0
            };
        }
    }
    catch {
        mongoStatus = "Unavailable";
    }
    return {
        appVersion: process.env.npm_package_version || "1.0.0",
        mongoStatus,
        databaseName,
        storageUsage,
        nodeVersion: process.version
    };
}
