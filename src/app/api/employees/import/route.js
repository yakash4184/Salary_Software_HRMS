import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectToDatabase } from "@/lib/db";
import { EmployeeModel } from "@/lib/models/Employee";
import { serializeEmployee } from "@/lib/serializers";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/* ── EXACT Column Headers ──────────────────────────────── */
const EXPECTED_HEADERS = [
    "Name",
    "Father/Spouse Name",
    "Role",
    "Subject / Department",
    "Phone",
    "Joining Date (DD/MM/YYYY)",
    "Base Salary",
    "Account Number",
    "IFSC Code",
    "Employment Status",
    "Address"
];

/* ── Generate next employee ID ─────────────────────────── */
async function generateEmployeeId(offset = 0) {
    const year = new Date().getFullYear();
    const prefix = `SBI-${year}-`;
    const latest = await EmployeeModel.findOne({ employeeId: { $regex: `^${prefix}` } })
        .sort({ employeeId: -1 })
        .lean();
    const lastSequence = latest?.employeeId
        ? Number(latest.employeeId.split("-").at(-1)) || 0
        : 0;
    return `${prefix}${String(lastSequence + 1 + offset).padStart(3, "0")}`;
}

/* ── Normalize a single row to an employee object ──────── */
function normalizeRow(row) {
    // 1. Mandatory Fields
    const rawName = String(row["Name"] ?? "").trim();
    const rawFather = String(row["Father/Spouse Name"] ?? "").trim();
    const rawSalary = String(row["Base Salary"] ?? "").replace(/[₹,\s]/g, "");
    
    if (!rawName || !rawFather || rawSalary === "") {
        return { error: "Mandatory fields missing (Name, Father/Spouse Name, or Base Salary)" };
    }

    const baseSalary = Number(rawSalary);
    if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
        return { error: "Base Salary must be a number greater than 0" };
    }

    // 2. Optional Fields
    const roleVal = String(row["Role"] ?? "").trim();
    let role = "Teacher";
    if (roleVal.toLowerCase() === "staff") role = "Staff";

    // 3. Date parsing (DD/MM/YYYY or excel serial)
    let joiningDate = new Date().toISOString().slice(0, 10);
    const rawDate = row["Joining Date (DD/MM/YYYY)"];
    if (rawDate) {
        if (typeof rawDate === "number") {
            // Excel serial date
            const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) joiningDate = d.toISOString().slice(0, 10);
        } else {
            // String DD/MM/YYYY
            const parts = String(rawDate).split(/[-/]/);
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) joiningDate = d.toISOString().slice(0, 10);
            }
        }
    }

    return {
        data: {
            name: rawName,
            fatherOrSpouseName: rawFather,
            role,
            department: String(row["Subject / Department"] ?? "General").trim() || "General",
            phone: String(row["Phone"] ?? "").trim() || "0000000000",
            address: String(row["Address"] ?? "").trim() || "N/A",
            joiningDate,
            photo: "",
            bankDetails: {
                accountNumber: String(row["Account Number"] ?? "").trim() || "0000000000",
                ifscCode: String(row["IFSC Code"] ?? "XXXX0000000").trim().toUpperCase(),
            },
            baseSalary,
            status: "Active",
        }
    };
}

/* ── POST /api/employees/import ────────────────────────── */
export async function POST(request) {
    const { response } = await requirePermission("employees.create");
    if (response) return response;

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json({ message: "No file uploaded." }, { status: 400 });
        }

        /* Read file buffer */
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });

        /* Use first sheet */
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return NextResponse.json({ message: "Excel file has no sheets." }, { status: 400 });
        }

        // Get header row to validate columns EXACTLY
        const headerRow = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })[0] || [];
        const missingHeaders = EXPECTED_HEADERS.filter(h => !headerRow.includes(h));
        
        if (missingHeaders.length > 0) {
            return NextResponse.json({ 
                message: "Excel structure mismatch. Columns must match the template exactly.", 
                errors: [{ row: 1, reason: `Missing columns: ${missingHeaders.join(", ")}` }]
            }, { status: 400 });
        }

        // Convert the rest to JSON using headers from the first row
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

        await connectToDatabase();

        const created = [];
        const errors = [];

        // Real excel row is roughly i + 2 (1 for header, 1 for 0-index offset)
        for (let i = 0; i < rows.length; i++) {
            const rowData = rows[i];

            // Skip completely empty rows
            const hasData = Object.values(rowData).some(v => String(v).trim() !== "");
            if (!hasData) continue;

            const normalized = normalizeRow(rowData);
            if (normalized.error) {
                errors.push({ row: i + 2, reason: normalized.error });
                continue;
            }

            const data = normalized.data;

            // Extra API validations
            if (data.name.length < 2) {
                errors.push({ row: i + 2, reason: "Name is too short (min 2 chars)" });
                continue;
            }

            try {
                const employeeId = await generateEmployeeId(created.length);
                const employee = await EmployeeModel.create({ ...data, employeeId });
                created.push(serializeEmployee(employee.toObject()));
            } catch (err) {
                errors.push({ row: i + 2, reason: err.message?.slice(0, 120) || "Database error" });
            }
        }

        return NextResponse.json({
            message: `${created.length} employee(s) imported successfully.${errors.length ? ` ${errors.length} row(s) failed.` : ""}`,
            imported: created.length,
            errorCount: errors.length,
            errors: errors.slice(0, 50), // Send up to 50 errors
        }, { status: 201 });
    } catch (err) {
        console.error("Import error:", err);
        return NextResponse.json({ message: "Failed to process Excel file." }, { status: 500 });
    }
}
