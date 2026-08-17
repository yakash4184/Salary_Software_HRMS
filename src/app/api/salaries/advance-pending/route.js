import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SalaryModel } from "@/lib/models/Salary";
export const dynamic = "force-dynamic";

/**
 * Compute the previous pending advance for a given employee before a specific month/year.
 * Looks at the most recent salary record prior to the given month/year and returns
 * its remainingAdvance. Falls back to legacy fields for backward compat with old records.
 */
export async function getPreviousPendingAdvance(employeeId, month, year) {
    await connectToDatabase();
    // Find the most recent salary record before the given month/year
    const previous = await SalaryModel.find({
        employeeId,
        $or: [
            { year: { $lt: year } },
            { year, month: { $lt: month } }
        ]
    })
        .sort({ year: -1, month: -1 })
        .limit(1)
        .select("remainingAdvance advanceGiven advanceDeduction previousPendingAdvance ledgerDeduction carriedOverAdvance unrecoveredAdvance baseSalary bonus absenceDeduction excessCLDeduction pfAmount")
        .lean();

    if (previous.length === 0) return 0;
    const last = previous[0];

    // 1. Prefer the explicit remainingAdvance field if it exists
    if (typeof last.remainingAdvance === "number") {
        return last.remainingAdvance;
    }

    // 2. Compute dynamic unrecovered balance as robust fallback for legacy records
    const totalAdvances = (last.previousPendingAdvance || 0) + (last.ledgerDeduction || 0) + (last.carriedOverAdvance || 0) + (last.advanceGiven || 0);
    const totalEarnings = (last.baseSalary || 0) + (last.bonus || 0);
    const otherDeductions = (last.absenceDeduction || 0) + (last.excessCLDeduction || 0) + (last.pfAmount || 0);
    const available = Math.max(totalEarnings - otherDeductions, 0);
    const actualDeducted = Math.min(last.advanceDeduction || 0, available);
    const unrecovered = Math.max(totalAdvances - actualDeducted, 0);

    if (unrecovered > 0) {
        return unrecovered;
    }

    // Legacy fallback: compute from old fields
    if (typeof last.unrecoveredAdvance === "number" && last.unrecoveredAdvance > 0) {
        return last.unrecoveredAdvance;
    }

    return 0;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!employeeId || !month || !year) {
        return NextResponse.json({ previousPendingAdvance: 0 });
    }

    const pending = await getPreviousPendingAdvance(employeeId, month, year);
    return NextResponse.json({ previousPendingAdvance: pending });
}
