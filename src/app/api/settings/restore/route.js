import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { EmployeeModel } from "@/lib/models/Employee";
import { SalaryModel } from "@/lib/models/Salary";
import { SettingModel } from "@/lib/models/Setting";
import { UserModel } from "@/lib/models/User";
import { requirePermission } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const backupSchema = z.object({
    format: z.literal("salary-management-backup"),
    version: z.number(),
    collections: z.object({
        employees: z.array(z.record(z.any())).default([]),
        salaries: z.array(z.record(z.any())).default([]),
        users: z.array(z.record(z.any())).default([]),
        settings: z.array(z.record(z.any())).default([]),
        auditLogs: z.array(z.record(z.any())).default([])
    })
});

const collectionModels = {
    employees: EmployeeModel,
    salaries: SalaryModel,
    users: UserModel,
    settings: SettingModel,
    auditLogs: AuditLogModel
};

export async function POST(request) {
    const { user, response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();

    // Parse the FormData — the backup file is sent as a file field to avoid body size limits
    let backup;
    try {
        const formData = await request.formData();
        const confirmation = formData.get("confirmation");
        if (confirmation !== "RESTORE") {
            console.error("Restore failed: Confirmation text mismatch.");
            return NextResponse.json({ message: "Type RESTORE to confirm." }, { status: 400 });
        }
        const file = formData.get("file");
        if (!file || typeof file === "string") {
            console.error("Restore failed: No file or file is string.");
            return NextResponse.json({ message: "Choose a backup JSON file." }, { status: 400 });
        }
        const text = await file.text();
        let raw;
        try {
            raw = JSON.parse(text);
        } catch (parseError) {
            console.error("Restore failed: JSON parse error:", parseError.message);
            return NextResponse.json({ message: "The selected file is not valid JSON." }, { status: 400 });
        }
        const parsed = backupSchema.safeParse(raw);
        if (!parsed.success) {
            console.error("Restore failed: Zod validation failed:", parsed.error.issues);
            return NextResponse.json({ message: "Invalid backup file. Make sure you are uploading a file created by the backup system." }, { status: 400 });
        }
        backup = parsed.data;
    } catch (error) {
        console.error("Restore failed: Exception in formData/parsing:", error);
        return NextResponse.json({ message: "Invalid backup file or confirmation text. (Error: " + error.message + ")" }, { status: 400 });
    }

    const session = await maybeStartSession();
    try {
        const operation = async (mongoSession) => {
            for (const [key, Model] of Object.entries(collectionModels)) {
                await Model.deleteMany({}, mongoSession ? { session: mongoSession } : {});
                const docs = backup.collections[key] || [];
                if (docs.length > 0) {
                    await Model.insertMany(docs, {
                        ordered: true,
                        ...(mongoSession ? { session: mongoSession } : {})
                    });
                }
            }
        };
        if (session) {
            await session.withTransaction(() => operation(session));
        }
        else {
            await operation(null);
        }
        await writeAuditLog({ action: "Restore", actor: user, message: "Backup restored.", request });
        return NextResponse.json({ ok: true });
    }
    catch (error) {
        await writeAuditLog({ action: "Restore", actor: user, status: "Failed", message: error.message || "Restore failed.", request });
        return NextResponse.json({ message: "Restore failed safely. No further changes were applied after the error.", detail: error.message }, { status: 500 });
    }
    finally {
        await session?.endSession();
    }
}

async function maybeStartSession() {
    try {
        if (!mongoose.connection.client)
            return null;
        return await mongoose.startSession();
    }
    catch {
        return null;
    }
}
