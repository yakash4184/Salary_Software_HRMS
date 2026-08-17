import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { SalaryModel } from "@/lib/models/Salary";
import { applyLedgerDeduction, getEmployeeLedgerBalance } from "@/lib/ledger";
import { calculateSalary } from "@/lib/salary";
import { requirePermission } from "@/lib/server-auth";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";
export const dynamic = "force-dynamic";
const bulkSchema = z.object({
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
    workingDays: z.coerce.number().min(1).default(30),
    status: z.enum(["Paid", "Pending"]).default("Pending")
});
export async function POST(request) {
    const { response } = await requirePermission("salary.create");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid bulk salary details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const employees = await EmployeeModel.find({ status: "Active" }).lean();
    const existing = await SalaryModel.find({
        month: parsed.data.month,
        year: parsed.data.year,
        employeeId: { $in: employees.map((employee) => employee.employeeId) }
    }).select("employeeId");
    const existingIds = new Set(existing.map((salary) => salary.employeeId));
    
    const employeesToProcess = employees.filter((employee) => !existingIds.has(employee.employeeId));
    
    const docs = await Promise.all(employeesToProcess.map(async (employee) => {
        const previousPendingAdvance = await getPreviousPendingAdvance(
            employee.employeeId,
            parsed.data.month,
            parsed.data.year
        );
        const calculation = calculateSalary({
            month: parsed.data.month,
            annualClUsed: 0,
            baseSalary: employee.baseSalary,
            workingDays: parsed.data.workingDays,
            daysPresent: parsed.data.workingDays,
            casualLeave: 0,
            halfCLTaken: 0,
            excessCL: 0,
            emergencyLeave: 0,
            bonus: 0,
            advanceGiven: 0,
            previousPendingAdvance,
            advanceDeduction: 0,
            ledgerDeduction: await getEmployeeLedgerBalance(employee.employeeId)
        });
        return {
            employee: employee._id,
            employeeId: employee.employeeId,
            month: parsed.data.month,
            year: parsed.data.year,
            baseSalary: employee.baseSalary,
            workingDays: parsed.data.workingDays,
            daysPresent: parsed.data.workingDays,
            absentDays: calculation.absentDays,
            totalCL: 14,
            casualLeave: 0,
            halfCLTaken: 0,
            excessCL: 0,
            emergencyLeave: 0,
            bonus: 0,
            advanceGiven: 0,
            previousPendingAdvance: calculation.previousPendingAdvance,
            advanceDeduction: 0,
            ledgerDeduction: calculation.ledgerDeduction,
            actualLedgerDeduction: calculation.actualLedgerDeduction,
            remainingLedgerDeduction: calculation.remainingLedgerDeduction,
            remainingAdvance: calculation.remainingAdvance,
            carriedOverAdvance: 0,
            unrecoveredAdvance: 0,
            absenceDeduction: calculation.absenceDeduction,
            excessCLDeduction: calculation.excessCLDeduction,
            totalDeduction: calculation.totalDeduction,
            netSalary: calculation.netSalary,
            perDaySalary: calculation.perDaySalary,
            status: parsed.data.status,
            paymentDate: parsed.data.status === "Paid" ? new Date().toISOString() : null
        };
    }));
    
    if (docs.length > 0) {
        await SalaryModel.insertMany(docs, { ordered: false });
        await Promise.all(docs.map((doc) => applyLedgerDeduction(doc.employeeId, doc.actualLedgerDeduction || 0)));
    }
    return NextResponse.json({
        created: docs.length,
        skipped: existingIds.size,
        totalActiveEmployees: employees.length
    });
}
