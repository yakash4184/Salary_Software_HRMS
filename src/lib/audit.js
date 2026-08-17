import { AuditLogModel } from "@/lib/models/AuditLog";

export async function writeAuditLog({ action, actor, status = "Success", message = "", metadata = {}, request }) {
    try {
        await AuditLogModel.create({
            action,
            actorEmail: actor?.email || "",
            actorName: actor?.name || "",
            status,
            message,
            metadata,
            ipAddress: request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
            userAgent: request?.headers?.get("user-agent") || ""
        });
    }
    catch (error) {
        console.error("Audit log write failed", error);
    }
}

export function serializeAuditLog(log) {
    return {
        _id: String(log._id),
        action: String(log.action || ""),
        actorEmail: String(log.actorEmail || ""),
        actorName: String(log.actorName || ""),
        status: log.status === "Failed" ? "Failed" : "Success",
        message: String(log.message || ""),
        metadata: log.metadata || {},
        createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : undefined
    };
}
