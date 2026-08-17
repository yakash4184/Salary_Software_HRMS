import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { SalaryModel } from "@/lib/models/Salary";
import { applyLedgerDeduction, getEmployeeLedgerBalance } from "@/lib/ledger";
import { ANNUAL_CL_ALLOWANCE, calculateSalary, sumAllowedClUsed, validateClRequest } from "@/lib/salary";
import { serializeSalary } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";
export const dynamic = "force-dynamic";
const salarySchema = z.object({
    employee: z.string().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
    baseSalary: z.coerce.number().min(0),
    workingDays: z.coerce.number().min(1),
    daysPresent: z.coerce.number().min(0),
    totalCL: z.coerce.number().min(0).default(ANNUAL_CL_ALLOWANCE),
    casualLeave: z.coerce.number().min(0).max(2).default(0),
    halfCLTaken: z.coerce.number().min(0).default(0),
    excessCL: z.coerce.number().min(0).default(0),
    emergencyLeave: z.coerce.number().min(0).default(0),
    bonus: z.coerce.number().min(0).default(0),
    advanceGiven: z.coerce.number().min(0).default(0),
    advanceDeduction: z.coerce.number().min(0).default(0),
    pfAmount: z.coerce.number().min(0).default(0),
    status: z.enum(["Paid", "Pending"]).default("Pending"),
    paymentDate: z.string().optional().nullable(),
    notes: z.string().optional()
});
export async function GET(request) {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const query = {};
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status");
    if (employeeId)
        query.employeeId = employeeId;
    if (month)
        query.month = Number(month);
    if (year)
        query.year = Number(year);
    if (status === "Paid" || status === "Pending")
        query.status = status;
    const salaries = await SalaryModel.find(query)
        .select("employee employeeId month year baseSalary workingDays daysPresent absentDays totalCL casualLeave halfCLTaken excessCL emergencyLeave bonus advanceGiven previousPendingAdvance advanceDeduction ledgerDeduction actualLedgerDeduction remainingLedgerDeduction remainingAdvance carriedOverAdvance unrecoveredAdvance pfAmount absenceDeduction excessCLDeduction totalDeduction netSalary perDaySalary status paymentDate notes createdAt updatedAt")
        .populate({
            path: "employee",
            select: "name employeeId role department baseSalary status createdAt updatedAt"
        })
        .sort({ year: -1, month: -1, createdAt: -1 })
        .lean();
    const activeEmployeeSalaries = salaries
        .map(serializeSalary)
        .filter((salary) => salary.employee?.status === "Active");
    return NextResponse.json({ salaries: activeEmployeeSalaries });
}
export async function POST(request) {
    const { response } = await requirePermission("salary.create");
    if (response)
        return response;
    await connectToDatabase();
    const parsed = salarySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid salary details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const employee = await EmployeeModel.findOne({ _id: parsed.data.employee, status: "Active" }).lean();
    if (!employee) {
        return NextResponse.json({ message: "Active employee not found." }, { status: 404 });
    }
    const annualClRecords = await SalaryModel.find({
        employeeId: employee.employeeId,
        year: parsed.data.year,
        month: { $ne: parsed.data.month }
    })
        .select("month casualLeave halfCLTaken")
        .lean();
    const clError = validateClRequest({
        casualLeave: parsed.data.casualLeave,
        halfCLTaken: parsed.data.halfCLTaken,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: parsed.data.totalCL
    });
    if (clError) {
        return NextResponse.json({ message: clError }, { status: 400 });
    }
    // Advance system: auto-compute previous pending from DB
    const previousPendingAdvance = await getPreviousPendingAdvance(
        String(employee.employeeId), parsed.data.month, parsed.data.year
    );
    const existingSalary = await SalaryModel.findOne({
        employeeId: employee.employeeId,
        month: parsed.data.month,
        year: parsed.data.year
    }).lean();
    const ledgerDeduction = Number(existingSalary?.ledgerDeduction || 0) > 0
        ? Number(existingSalary.ledgerDeduction)
        : await getEmployeeLedgerBalance(employee.employeeId);
    const totalPendingAdvance = previousPendingAdvance + ledgerDeduction + parsed.data.advanceGiven;
    if (parsed.data.advanceDeduction > totalPendingAdvance) {
        return NextResponse.json({ message: `Advance deduction (₹${parsed.data.advanceDeduction}) cannot exceed total pending advance (₹${totalPendingAdvance}).` }, { status: 400 });
    }
    const calculation = calculateSalary({
        month: parsed.data.month,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: parsed.data.totalCL,
        baseSalary: parsed.data.baseSalary,
        workingDays: parsed.data.workingDays,
        daysPresent: parsed.data.daysPresent,
        casualLeave: parsed.data.casualLeave,
        halfCLTaken: parsed.data.halfCLTaken,
        excessCL: parsed.data.excessCL,
        emergencyLeave: parsed.data.emergencyLeave,
        bonus: parsed.data.bonus,
        advanceGiven: parsed.data.advanceGiven,
        previousPendingAdvance,
        advanceDeduction: parsed.data.advanceDeduction,
        ledgerDeduction,
        pfAmount: parsed.data.pfAmount
    });
    const payload = {
        employee: employee._id,
        employeeId: String(employee.employeeId),
        month: parsed.data.month,
        year: parsed.data.year,
        baseSalary: parsed.data.baseSalary,
        workingDays: parsed.data.workingDays,
        daysPresent: parsed.data.daysPresent,
        absentDays: calculation.absentDays,
        totalCL: parsed.data.totalCL,
        casualLeave: parsed.data.casualLeave,
        halfCLTaken: parsed.data.halfCLTaken,
        excessCL: parsed.data.excessCL,
        emergencyLeave: parsed.data.emergencyLeave,
        bonus: parsed.data.bonus,
        advanceGiven: parsed.data.advanceGiven,
        previousPendingAdvance: calculation.previousPendingAdvance,
        advanceDeduction: calculation.advanceDeduction,
        ledgerDeduction: calculation.ledgerDeduction,
        actualLedgerDeduction: calculation.actualLedgerDeduction,
        remainingLedgerDeduction: calculation.remainingLedgerDeduction,
        remainingAdvance: calculation.remainingAdvance,
        carriedOverAdvance: 0,
        unrecoveredAdvance: 0,
        pfAmount: parsed.data.pfAmount,
        absenceDeduction: calculation.absenceDeduction,
        excessCLDeduction: calculation.excessCLDeduction,
        totalDeduction: calculation.totalDeduction,
        netSalary: calculation.netSalary,
        perDaySalary: calculation.perDaySalary,
        status: parsed.data.status,
        paymentDate: parsed.data.status === "Paid" ? parsed.data.paymentDate || new Date().toISOString() : null,
        notes: parsed.data.notes
    };
    const salary = await SalaryModel.findOneAndUpdate({ employeeId: employee.employeeId, month: payload.month, year: payload.year }, payload, { upsert: true, new: true, runValidators: true })
        .populate("employee")
        .lean();
    if (!existingSalary || Number(existingSalary.actualLedgerDeduction || 0) === 0) {
        await applyLedgerDeduction(employee.employeeId, calculation.actualLedgerDeduction);
    }
    return NextResponse.json({ salary: serializeSalary(salary) }, { status: 201 });
}
