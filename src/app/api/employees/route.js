import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { serializeEmployee } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";
export const dynamic = "force-dynamic";
const employeeSchema = z.object({
    name: z.string().trim().min(1),
    fatherOrSpouseName: z.string().optional().or(z.literal("")).default(""),
    role: z.enum(["Teacher", "Staff"]).default("Staff"),
    department: z.string().optional().or(z.literal("")).default(""),
    phone: z.string().optional().or(z.literal("")).default(""),
    address: z.string().optional().or(z.literal("")).default(""),
    joiningDate: z.string().optional().or(z.literal("")).default(""),
    photo: z.string().optional().or(z.literal("")),
    bankDetails: z.object({
        accountNumber: z.string().optional().or(z.literal("")).default(""),
        ifscCode: z.string().optional().or(z.literal("")).default("")
    }).default({ accountNumber: "", ifscCode: "" }),
    baseSalary: z.coerce.number().min(0).default(0),
    status: z.enum(["Active", "Inactive"]).default("Active")
});
export async function GET(request) {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const includePhoto = searchParams.get("includePhoto") === "1";
    const query = { status: status === "Inactive" ? "Inactive" : "Active" };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { employeeId: { $regex: search, $options: "i" } },
            { department: { $regex: search, $options: "i" } }
        ];
    }
    const employees = await EmployeeModel.find(query).lean();
    employees.sort(compareEmployeeNames);
    return NextResponse.json({ employees: employees.map((employee) => serializeEmployee(employee, { includePhoto })) });
}
export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = employeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid employee details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const employeeId = await generateEmployeeId();
    const employeeData = withEmployeeDefaults(parsed.data);
    const employee = await EmployeeModel.create({
        ...employeeData,
        employeeId,
        bankDetails: {
            ...employeeData.bankDetails,
            ifscCode: employeeData.bankDetails.ifscCode.toUpperCase()
        }
    });
    return NextResponse.json({ employee: serializeEmployee(employee.toObject()) }, { status: 201 });
}
async function generateEmployeeId() {
    const year = new Date().getFullYear();
    const prefix = `SBI-${year}-`;
    const latest = await EmployeeModel.findOne({ employeeId: { $regex: `^${prefix}` } })
        .sort({ employeeId: -1 })
        .lean();
    const lastSequence = latest?.employeeId ? Number(latest.employeeId.split("-").at(-1)) || 0 : 0;
    return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}
function withEmployeeDefaults(employee) {
    return {
        ...employee,
        fatherOrSpouseName: employee.fatherOrSpouseName?.trim() || "N/A",
        department: employee.department?.trim() || "General",
        phone: employee.phone?.trim() || "",
        address: employee.address?.trim() || "",
        joiningDate: employee.joiningDate || new Date().toISOString().slice(0, 10),
        baseSalary: Number(employee.baseSalary || 0)
    };
}
function compareEmployeeNames(first, second) {
    const firstName = String(first?.name || "").trim();
    const secondName = String(second?.name || "").trim();
    const firstStartsWithLetter = /^[a-z]/i.test(firstName);
    const secondStartsWithLetter = /^[a-z]/i.test(secondName);
    if (firstStartsWithLetter !== secondStartsWithLetter)
        return firstStartsWithLetter ? -1 : 1;
    return firstName.localeCompare(secondName, "en", { sensitivity: "base" });
}
