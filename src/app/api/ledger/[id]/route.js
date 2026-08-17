import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { LedgerEntryModel } from "@/lib/models/LedgerEntry";
import { serializeLedgerEntry } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
    const { response } = await requirePermission("ledger.edit");
    if (response)
        return response;
    await connectToDatabase();
    const { id } = await context.params;
    const entry = await LedgerEntryModel.findById(id);
    if (!entry) {
        return NextResponse.json({ message: "Expense entry not found." }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    if (body?.status === "Closed") {
        entry.deductedAmount = entry.amount;
        entry.balanceAmount = 0;
        entry.status = "Closed";
        entry.closedAt = new Date().toISOString();
    } else if (body?.status === "Open") {
        entry.balanceAmount = Math.max(Number(entry.amount) - Number(entry.deductedAmount || 0), 0);
        entry.status = entry.balanceAmount > 0 ? "Open" : "Closed";
        entry.closedAt = entry.status === "Closed" ? entry.closedAt || new Date().toISOString() : undefined;
    } else {
        return NextResponse.json({ message: "Invalid expense update." }, { status: 400 });
    }
    await entry.save();
    const saved = await LedgerEntryModel.findById(entry._id).populate("employee").lean();
    return NextResponse.json({ entry: serializeLedgerEntry(saved) });
}

export async function DELETE(_, context) {
    const { response } = await requirePermission("ledger.delete");
    if (response)
        return response;
    await connectToDatabase();
    const { id } = await context.params;
    const deleted = await LedgerEntryModel.findByIdAndDelete(id).lean();
    if (!deleted) {
        return NextResponse.json({ message: "Expense entry not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
