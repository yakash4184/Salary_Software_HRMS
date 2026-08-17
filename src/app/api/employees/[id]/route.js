import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { serializeEmployee } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";
export const dynamic = "force-dynamic";
const employeePatchSchema = z.object({
    name: z.string().trim().min(1).optional(),
    fatherOrSpouseName: z.string().optional().or(z.literal("")),
    role: z.enum(["Teacher", "Staff"]).optional(),
    department: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    joiningDate: z.string().optional().or(z.literal("")),
    photo: z.string().optional().or(z.literal("")),
    bankDetails: z
        .object({
        accountNumber: z.string().optional().or(z.literal("")).default(""),
        ifscCode: z.string().optional().or(z.literal("")).default("")
    })
        .optional(),
    baseSalary: z.coerce.number().min(0).optional(),
    status: z.enum(["Active", "Inactive"]).optional()
});
export async function GET(_, context) {
    await connectToDatabase();
    const { id } = await context.params;
    const employee = await EmployeeModel.findById(id).lean();
    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ employee: serializeEmployee(employee) });
}
export async function PATCH(request, context) {
    const { response } = await requirePermission("employees.edit");
    if (response)
        return response;
    await connectToDatabase();
    const { id } = await context.params;
    const parsed = employeePatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid employee details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const bankDetails = parsed.data.bankDetails
        ? {
            accountNumber: parsed.data.bankDetails.accountNumber || "",
            ifscCode: (parsed.data.bankDetails.ifscCode || "").toUpperCase()
        }
        : undefined;
    const update = withEmployeeDefaults({
        ...parsed.data,
        bankDetails
    });
    const employee = await EmployeeModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ employee: serializeEmployee(employee) });
}
function withEmployeeDefaults(employee) {
    const update = { ...employee };
    if ("fatherOrSpouseName" in update)
        update.fatherOrSpouseName = update.fatherOrSpouseName?.trim() || "N/A";
    if ("department" in update)
        update.department = update.department?.trim() || "General";
    if ("phone" in update)
        update.phone = update.phone?.trim() || "";
    if ("address" in update)
        update.address = update.address?.trim() || "";
    if ("joiningDate" in update)
        update.joiningDate = update.joiningDate || new Date().toISOString().slice(0, 10);
    if ("baseSalary" in update)
        update.baseSalary = Number(update.baseSalary || 0);
    return update;
}
export async function DELETE(request, context) {
    const { response } = await requirePermission("employees.delete");
    if (response)
        return response;
    await connectToDatabase();
    const { id } = await context.params;
    const employee = await EmployeeModel.findById(id).lean();
    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body?.confirmName) {
        const inactiveEmployee = await EmployeeModel.findByIdAndUpdate(id, { status: "Inactive" }, { new: true }).lean();
        return NextResponse.json({ employee: serializeEmployee(inactiveEmployee), inactive: true });
    }
    if (String(body?.confirmName || "").trim() !== String(employee.name || "").trim()) {
        return NextResponse.json({ message: "Employee name confirmation did not match." }, { status: 400 });
    }
    await EmployeeModel.findByIdAndDelete(id);
    return NextResponse.json({ employee: serializeEmployee(employee), deleted: true });
}
