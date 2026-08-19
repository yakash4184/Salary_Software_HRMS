export function serializeEmployee(doc, options = {}) {
    return {
        _id: String(doc._id),
        name: String(doc.name || ""),
        fatherOrSpouseName: String(doc.fatherOrSpouseName || ""),
        employeeId: String(doc.employeeId || ""),
        role: doc.role === "Staff" ? "Staff" : "Teacher",
        department: String(doc.department || ""),
        phone: String(doc.phone || ""),
        address: String(doc.address || ""),
        joiningDate: String(doc.joiningDate || ""),
        ...(options.includePhoto ? { photo: typeof doc.photo === "string" ? doc.photo : undefined } : {}),
        bankDetails: {
            accountNumber: String(doc.bankDetails?.accountNumber || ""),
            ifscCode: String(doc.bankDetails?.ifscCode || "")
        },
        baseSalary: Number(doc.baseSalary || 0),
        status: doc.status === "Inactive" ? "Inactive" : "Active",
        createdAt: toIso(doc.createdAt),
        updatedAt: toIso(doc.updatedAt)
    };
}
export function serializeSalary(doc, options = {}) {
    const employee = doc.employee && typeof doc.employee === "object" && "_id" in doc.employee
        ? serializeEmployee(doc.employee, { includePhoto: options.includeEmployeePhoto })
        : undefined;
    const absenceDeduction = toAmount(doc.absenceDeduction);
    const excessCLDeduction = toAmount(doc.excessCLDeduction);
    const advanceDeduction = toAmount(doc.advanceDeduction);
    const ledgerDeduction = toAmount(doc.ledgerDeduction);
    const carriedOverAdvance = toAmount(doc.carriedOverAdvance);
    const totalDeduction = toAmount(doc.totalDeduction);
    const pfAmount = resolvePfAmount({
        explicitPfAmount: doc.pfAmount,
        totalDeduction,
        absenceDeduction,
        excessCLDeduction,
        advanceDeduction,
        ledgerDeduction,
        carriedOverAdvance
    });
    const totalCL = Number(doc.totalCL || 14);
    const fullCLTaken = Number(doc.casualLeave || 0);
    const halfCLTaken = Number(doc.halfCLTaken || 0);
    const equivalentCLUsed = round(fullCLTaken + halfCLTaken / 2);
    return {
        _id: String(doc._id),
        employee,
        employeeId: String(doc.employeeId || employee?.employeeId || ""),
        month: Number(doc.month || 1),
        year: Number(doc.year || new Date().getFullYear()),
        baseSalary: Number(doc.baseSalary || 0),
        workingDays: Number(doc.workingDays || 0),
        daysPresent: Number(doc.daysPresent || 0),
        absentDays: Number(doc.absentDays || 0),
        totalCL,
        casualLeave: Number(doc.casualLeave || 0),
        fullCLTaken,
        halfCLTaken,
        equivalentCLUsed,
        remainingCL: round(Math.max(totalCL - equivalentCLUsed, 0)),
        excessCL: Number(doc.excessCL || 0),
        emergencyLeave: Number(doc.emergencyLeave || 0),
        bonus: Number(doc.bonus || 0),
        advanceDeduction,
        ledgerDeduction,
        actualLedgerDeduction: Number(doc.actualLedgerDeduction || 0),
        remainingLedgerDeduction: Number(doc.remainingLedgerDeduction || 0),
        advanceGiven: Number(doc.advanceGiven || 0),
        previousPendingAdvance: Number(doc.previousPendingAdvance || 0),
        remainingAdvance: Number(doc.remainingAdvance || 0),
        carriedOverAdvance: Number(doc.carriedOverAdvance || 0),
        unrecoveredAdvance: Number(doc.unrecoveredAdvance || 0),
        pfAmount,
        absenceDeduction,
        excessCLDeduction,
        totalDeduction,
        netSalary: Number(doc.netSalary || 0),
        perDaySalary: Number(doc.perDaySalary || 0),
        status: doc.status === "Paid" ? "Paid" : "Pending",
        paymentDate: typeof doc.paymentDate === "string" ? doc.paymentDate : null,
        notes: typeof doc.notes === "string" ? doc.notes : "",
        createdAt: toIso(doc.createdAt),
        updatedAt: toIso(doc.updatedAt)
    };
}
export function serializeLedgerEntry(doc, options = {}) {
    const employee = doc.employee && typeof doc.employee === "object" && "_id" in doc.employee
        ? serializeEmployee(doc.employee, { includePhoto: options.includeEmployeePhoto })
        : undefined;
    return {
        _id: String(doc._id),
        employee,
        employeeId: String(doc.employeeId || employee?.employeeId || ""),
        amount: Number(doc.amount || 0),
        deductedAmount: Number(doc.deductedAmount || 0),
        balanceAmount: Number(doc.balanceAmount || 0),
        entryDate: String(doc.entryDate || ""),
        notes: typeof doc.notes === "string" ? doc.notes : "",
        status: doc.status === "Closed" ? "Closed" : "Open",
        closedAt: typeof doc.closedAt === "string" ? doc.closedAt : null,
        createdAt: toIso(doc.createdAt),
        updatedAt: toIso(doc.updatedAt)
    };
}
function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function resolvePfAmount({ explicitPfAmount, totalDeduction, absenceDeduction, excessCLDeduction, advanceDeduction, ledgerDeduction = 0, carriedOverAdvance = 0 }) {
    const pfAmount = toAmount(explicitPfAmount);
    if (pfAmount > 0)
        return pfAmount;
    return Math.max(totalDeduction - absenceDeduction - excessCLDeduction - advanceDeduction - ledgerDeduction - carriedOverAdvance, 0);
}
function toAmount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}
function toIso(value) {
    if (!value)
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
