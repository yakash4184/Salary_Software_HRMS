import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { SalaryModel } from "@/lib/models/Salary";
import { ANNUAL_CL_ALLOWANCE, calculateSalary, sumAllowedClUsed, validateClRequest } from "@/lib/salary";
import { serializeSalary } from "@/lib/serializers";
import { getCurrentUser, requirePermission } from "@/lib/server-auth";
import { validateCredentials } from "@/lib/auth";
import { getPreviousPendingAdvance } from "@/app/api/salaries/advance-pending/route";
export const dynamic = "force-dynamic";
const salaryPatchSchema = z.object({
    baseSalary: z.coerce.number().min(0).optional(),
    workingDays: z.coerce.number().min(1).optional(),
    daysPresent: z.coerce.number().min(0).optional(),
    totalCL: z.coerce.number().min(0).optional(),
    casualLeave: z.coerce.number().min(0).max(2).optional(),
    halfCLTaken: z.coerce.number().min(0).optional(),
    excessCL: z.coerce.number().min(0).optional(),
    emergencyLeave: z.coerce.number().min(0).optional(),
    bonus: z.coerce.number().min(0).optional(),
    advanceGiven: z.coerce.number().min(0).optional(),
    advanceDeduction: z.coerce.number().min(0).optional(),
    pfAmount: z.coerce.number().min(0).optional(),
    status: z.enum(["Paid", "Pending"]).optional(),
    paymentDate: z.string().optional().nullable(),
    notes: z.string().optional(),
    password: z.string().min(1)
});
export async function GET(_, context) {
    await connectToDatabase();
    const { id } = await context.params;
    const salary = await SalaryModel.findById(id).populate("employee").lean();
    if (!salary) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }
    return NextResponse.json({ salary: serializeSalary(salary) });
}
export async function PATCH(request, context) {
    const permission = await requirePermission("salary.edit");
    if (permission.response)
        return permission.response;
    await connectToDatabase();
    const { id } = await context.params;
    const existing = await SalaryModel.findById(id);
    if (!existing) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }
    const parsed = salaryPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid salary details.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const passwordResponse = await requirePassword(parsed.data.password);
    if (passwordResponse)
        return passwordResponse;
    const { password: _password, ...salaryData } = parsed.data;
    const merged = {
        month: existing.month,
        baseSalary: salaryData.baseSalary ?? existing.baseSalary,
        workingDays: salaryData.workingDays ?? existing.workingDays,
        daysPresent: salaryData.daysPresent ?? existing.daysPresent,
        totalCL: salaryData.totalCL ?? existing.totalCL ?? ANNUAL_CL_ALLOWANCE,
        casualLeave: salaryData.casualLeave ?? existing.casualLeave,
        halfCLTaken: salaryData.halfCLTaken ?? existing.halfCLTaken ?? 0,
        excessCL: salaryData.excessCL ?? existing.excessCL,
        emergencyLeave: salaryData.emergencyLeave ?? existing.emergencyLeave,
        bonus: salaryData.bonus ?? existing.bonus,
        advanceGiven: salaryData.advanceGiven ?? existing.advanceGiven ?? 0,
        advanceDeduction: salaryData.advanceDeduction ?? existing.advanceDeduction ?? 0,
        ledgerDeduction: existing.ledgerDeduction ?? 0,
        pfAmount: salaryData.pfAmount ?? existing.pfAmount
    };
    const annualClRecords = await SalaryModel.find({
        employeeId: existing.employeeId,
        year: existing.year,
        _id: { $ne: existing._id }
    })
        .select("month casualLeave halfCLTaken")
        .lean();
    const clError = validateClRequest({
        casualLeave: merged.casualLeave,
        halfCLTaken: merged.halfCLTaken,
        annualClUsed: sumAllowedClUsed(annualClRecords),
        totalCL: merged.totalCL
    });
    if (clError) {
        return NextResponse.json({ message: clError }, { status: 400 });
    }
    const previousPendingAdvance = await getPreviousPendingAdvance(
        existing.employeeId,
        existing.month,
        existing.year
    );
    const totalPendingAdvance = previousPendingAdvance + merged.ledgerDeduction + merged.advanceGiven;
    if (merged.advanceDeduction > totalPendingAdvance) {
        return NextResponse.json({ message: `Advance deduction (₹${merged.advanceDeduction}) cannot exceed total pending advance (₹${totalPendingAdvance}).` }, { status: 400 });
    }
    const calculation = calculateSalary({
        ...merged,
        previousPendingAdvance,
        annualClUsed: sumAllowedClUsed(annualClRecords)
    });
    existing.set({
        ...salaryData,
        ...merged,
        absentDays: calculation.absentDays,
        totalCL: merged.totalCL,
        halfCLTaken: merged.halfCLTaken,
        excessCL: merged.excessCL,
        perDaySalary: calculation.perDaySalary,
        absenceDeduction: calculation.absenceDeduction,
        excessCLDeduction: calculation.excessCLDeduction,
        advanceGiven: merged.advanceGiven,
        previousPendingAdvance: calculation.previousPendingAdvance,
        advanceDeduction: calculation.advanceDeduction,
        ledgerDeduction: calculation.ledgerDeduction,
        actualLedgerDeduction: existing.actualLedgerDeduction ?? calculation.actualLedgerDeduction,
        remainingLedgerDeduction: existing.remainingLedgerDeduction ?? calculation.remainingLedgerDeduction,
        remainingAdvance: calculation.remainingAdvance,
        carriedOverAdvance: 0,
        unrecoveredAdvance: 0,
        totalDeduction: calculation.totalDeduction,
        netSalary: calculation.netSalary,
        paymentDate: salaryData.status === "Paid"
            ? salaryData.paymentDate || existing.paymentDate || new Date().toISOString()
            : salaryData.status === "Pending"
                ? null
                : salaryData.paymentDate ?? existing.paymentDate
    });
    await existing.save();
    const salary = await SalaryModel.findById(id).populate("employee").lean();
    return NextResponse.json({ salary: serializeSalary(salary) });
}
export async function DELETE(request, context) {
    const permission = await requirePermission("salary.delete");
    if (permission.response)
        return permission.response;
    await connectToDatabase();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const passwordResponse = await requirePassword(String(body?.password || ""));
    if (passwordResponse)
        return passwordResponse;
    const salary = await SalaryModel.findByIdAndDelete(id).lean();
    if (!salary) {
        return NextResponse.json({ message: "Salary record not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
async function requirePassword(password) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const validUser = await validateCredentials(user.email, password);
    if (!validUser) {
        return NextResponse.json({ message: "Password is incorrect." }, { status: 403 });
    }
    return null;
}
