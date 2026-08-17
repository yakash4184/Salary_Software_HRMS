import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { LedgerEntryModel } from "@/lib/models/LedgerEntry";
import { getEmployeeLedgerBalance } from "@/lib/ledger";
import { serializeLedgerEntry } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const ledgerSchema = z.object({
    employee: z.string().min(1),
    amount: z.coerce.number().min(1),
    entryDate: z.string().min(1),
    notes: z.string().optional()
});

export async function GET(request) {
    const { response } = await requirePermission("ledger.view");
    if (response)
        return response;
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const query = {};
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    if (employeeId)
        query.employeeId = employeeId;
    if (status === "Open" || status === "Closed")
        query.status = status;
    const entries = await LedgerEntryModel.find(query)
        .select("employee employeeId amount deductedAmount balanceAmount entryDate notes status closedAt createdAt updatedAt")
        .populate({
            path: "employee",
            select: "name employeeId role department baseSalary status createdAt updatedAt"
        })
        .sort({ status: 1, entryDate: -1, createdAt: -1 })
        .lean();
    const balance = employeeId ? await getEmployeeLedgerBalance(employeeId) : undefined;
    return NextResponse.json({
        entries: entries.map(serializeLedgerEntry),
        balance
    });
}

export async function POST(request) {
    const { response } = await requirePermission("ledger.create");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = ledgerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid expense details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const employee = await EmployeeModel.findById(parsed.data.employee).lean();
    if (!employee) {
        return NextResponse.json({ message: "Employee not found." }, { status: 404 });
    }
    const entry = await LedgerEntryModel.create({
        employee: employee._id,
        employeeId: String(employee.employeeId),
        amount: parsed.data.amount,
        deductedAmount: 0,
        balanceAmount: parsed.data.amount,
        entryDate: parsed.data.entryDate,
        notes: parsed.data.notes || "",
        status: "Open"
    });
    const saved = await LedgerEntryModel.findById(entry._id).populate("employee").lean();
    return NextResponse.json({ entry: serializeLedgerEntry(saved) }, { status: 201 });
}
