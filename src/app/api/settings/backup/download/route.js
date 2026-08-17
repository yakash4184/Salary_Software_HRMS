import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { SalaryModel } from "@/lib/models/Salary";
import { UserModel } from "@/lib/models/User";
import { SettingModel } from "@/lib/models/Setting";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { requirePermission } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request) {
    const { user, response } = await requirePermission("admin.manage");
    if (response)
        return response;
    await connectToDatabase();
    const backup = {
        format: "salary-management-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        collections: {
            employees: await EmployeeModel.find({}).lean(),
            salaries: await SalaryModel.find({}).lean(),
            users: await UserModel.find({}).lean(),
            settings: await SettingModel.find({}).lean(),
            auditLogs: await AuditLogModel.find({}).lean()
        }
    };
    const body = JSON.stringify(backup, null, 2);
    await writeAuditLog({ action: "Backup", actor: user, message: "Backup downloaded.", metadata: { bytes: Buffer.byteLength(body) }, request });
    return new NextResponse(body, {
        headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="salary-backup-${new Date().toISOString().slice(0, 10)}.json"`,
            "Cache-Control": "no-store"
        }
    });
}
