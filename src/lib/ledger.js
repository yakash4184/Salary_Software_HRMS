import { LedgerEntryModel } from "@/lib/models/LedgerEntry";

export async function getEmployeeLedgerBalance(employeeId) {
    const rows = await LedgerEntryModel.aggregate([
        { $match: { employeeId: String(employeeId), status: "Open" } },
        { $group: { _id: "$employeeId", balance: { $sum: "$balanceAmount" } } }
    ]);
    return round(rows[0]?.balance || 0);
}

export async function applyLedgerDeduction(employeeId, amount) {
    let remaining = Math.max(Number(amount) || 0, 0);
    let deducted = 0;
    if (remaining <= 0)
        return 0;
    const entries = await LedgerEntryModel.find({
        employeeId: String(employeeId),
        status: "Open",
        balanceAmount: { $gt: 0 }
    }).sort({ entryDate: 1, createdAt: 1 });
    for (const entry of entries) {
        if (remaining <= 0)
            break;
        const currentBalance = Math.max(Number(entry.balanceAmount) || 0, 0);
        const cut = Math.min(currentBalance, remaining);
        entry.deductedAmount = round((Number(entry.deductedAmount) || 0) + cut);
        entry.balanceAmount = round(currentBalance - cut);
        if (entry.balanceAmount <= 0) {
            entry.balanceAmount = 0;
            entry.status = "Closed";
            entry.closedAt = new Date().toISOString();
        }
        await entry.save();
        remaining = round(remaining - cut);
        deducted = round(deducted + cut);
    }
    return deducted;
}

function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
