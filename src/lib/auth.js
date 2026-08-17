import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getJwtSecret, SESSION_COOKIE } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { ActiveSessionModel } from "@/lib/models/ActiveSession";
import { UserModel } from "@/lib/models/User";
export { getJwtSecret, SESSION_COOKIE };
export const PERMISSIONS = [
    "dashboard.view",
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.delete",
    "salary.view",
    "salary.create",
    "salary.edit",
    "salary.delete",
    "ledger.view",
    "ledger.create",
    "ledger.edit",
    "ledger.delete",
    "reports.view",
    "admin.manage"
];
export const ADMIN_PERMISSIONS = [...PERMISSIONS];
export function getCredentialUsers() {
    const adminEmail = process.env.ADMIN_EMAIL || "Ashish";
    const accountantEmail = process.env.ACCOUNTANT_EMAIL || "accounts@savitri.edu";
    const users = [
        {
            email: adminEmail.toLowerCase(),
            name: "School Administrator",
            role: "Admin",
            password: process.env.ADMIN_PASSWORD || defaultDevPassword(),
            passwordHash: process.env.ADMIN_PASSWORD_HASH
        },
        {
            email: accountantEmail.toLowerCase(),
            name: "Accounts Office",
            role: "Accountant",
            password: process.env.ACCOUNTANT_PASSWORD || defaultDevPassword(),
            passwordHash: process.env.ACCOUNTANT_PASSWORD_HASH
        }
    ];
    return users.filter((user) => user.email);
}
export async function validateCredentials(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    await connectToDatabase();
    const dbUser = await UserModel.findOne({ email: normalizedEmail, status: "Active" }).lean();
    if (dbUser) {
        const matchesHash = await bcrypt.compare(password, dbUser.passwordHash);
        if (!matchesHash)
            return null;
        return publicUser(dbUser);
    }
    const user = getCredentialUsers().find((candidate) => candidate.email === normalizedEmail);
    if (!user)
        return null;
    if (user.passwordHash) {
        const matchesHash = await bcrypt.compare(password, user.passwordHash);
        if (!matchesHash)
            return null;
    }
    else if (user.password !== password) {
        return null;
    }
    return {
        email: user.email,
        name: user.name,
        role: user.role === "Admin" ? "Admin" : "User",
        permissions: user.role === "Admin" ? ADMIN_PERMISSIONS : ["dashboard.view", "employees.view", "salary.view", "ledger.view", "reports.view"],
        sessionVersion: 0
    };
}
export async function signSession(user, request) {
    const sessionId = crypto.randomUUID();
    const sessionVersion = await getSessionVersion(user.email);
    const expiresAt = new Date(Date.now() + 60 * 60 * 8 * 1000);
    await ActiveSessionModel.create({
        sessionId,
        email: user.email,
        userName: user.name,
        role: user.role,
        sessionVersion,
        ipAddress: request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
        userAgent: request?.headers?.get("user-agent") || "",
        expiresAt
    });
    return new SignJWT({ ...user, sid: sessionId, sessionVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(getJwtSecret());
}
export async function verifySession(token) {
    if (!token)
        return null;
    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        if (typeof payload.email !== "string" ||
            typeof payload.name !== "string" ||
            typeof payload.role !== "string") {
            return null;
        }
        if (typeof payload.sid === "string") {
            await connectToDatabase();
            const session = await ActiveSessionModel.findOne({
                sessionId: payload.sid,
                revokedAt: null,
                expiresAt: { $gt: new Date() }
            }).lean();
            if (!session)
                return null;
            const dbUser = await UserModel.findOne({ email: payload.email.toLowerCase(), status: "Active" }).lean();
            if (dbUser && Number(dbUser.sessionVersion || 0) !== Number(payload.sessionVersion || 0))
                return null;
            const lastSeenAt = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
            if (Date.now() - lastSeenAt > 60 * 1000) {
                await ActiveSessionModel.updateOne({ sessionId: payload.sid }, { lastSeenAt: new Date() });
            }
        }
        return {
            email: payload.email,
            name: payload.name,
            role: payload.role,
            permissions: Array.isArray(payload.permissions) ? payload.permissions.filter((item) => typeof item === "string") : [],
            sid: typeof payload.sid === "string" ? payload.sid : undefined,
            sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0
        };
    }
    catch {
        return null;
    }
}
export function canManageEmployees(role) {
    return role === "Admin";
}
export function hasPermission(user, permission) {
    return user?.role === "Admin" || user?.permissions?.includes(permission);
}
export function publicUser(user) {
    const role = user.role === "Admin" ? "Admin" : "User";
    return {
        email: String(user.email || "").toLowerCase(),
        name: String(user.name || ""),
        role,
        status: user.status === "Inactive" ? "Inactive" : "Active",
        permissions: role === "Admin" ? ADMIN_PERMISSIONS : Array.isArray(user.permissions) ? user.permissions : [],
        sessionVersion: Number(user.sessionVersion || 0)
    };
}
async function getSessionVersion(email) {
    await connectToDatabase();
    const dbUser = await UserModel.findOne({ email: email.toLowerCase() }).select("sessionVersion").lean();
    return Number(dbUser?.sessionVersion || 0);
}
function defaultDevPassword() {
    return undefined;
}
