"use client";
import Link from "next/link";
import { Download, FileDown, Filter, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeading } from "@/components/page-heading";
import { exportSalaryLedgerExcel } from "@/lib/excel-export";
import { formatCurrency, formatDate, monthName } from "@/lib/utils";
export function ReportsClient() {
    const [employees, setEmployees] = useState([]);
    const [salaries, setSalaries] = useState([]);
    const [filters, setFilters] = useState({
        employeeId: "All",
        status: "All",
        month: "All",
        query: ""
    });
    const [exportOpen, setExportOpen] = useState(false);
    const [exportType, setExportType] = useState("month"); // "month", "employee", "custom"
    const [exportFilters, setExportFilters] = useState({
        employeeId: "All",
        month: "All",
        year: String(new Date().getFullYear()),
        status: "All",
        startDate: "",
        endDate: ""
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (exportType === "month" && exportFilters.month === "All") {
            setExportFilters((prev) => ({ ...prev, month: String(new Date().getMonth() + 1) }));
        }
        if (exportType === "employee" && exportFilters.employeeId === "All" && employees.length > 0) {
            setExportFilters((prev) => ({ ...prev, employeeId: employees[0].employeeId }));
        }
    }, [exportType, employees]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const [employeeResponse, salaryResponse] = await Promise.all([
                fetch("/api/employees", { cache: "no-store" }),
                fetch("/api/salaries", { cache: "no-store" })
            ]);
            const [employeeData, salaryData] = await Promise.all([
                employeeResponse.ok ? employeeResponse.json() : { employees: [] },
                salaryResponse.ok ? salaryResponse.json() : { salaries: [] }
            ]);
            setEmployees(employeeData.employees || []);
            setSalaries(salaryData.salaries || []);
            setLoading(false);
        }
        load();
    }, []);

    const filtered = useMemo(() => {
        const list = salaries.filter((salary) => {
            const employee = salary.employee;
            const queryTarget = `${employee?.name || ""} ${salary.employeeId} ${employee?.department || ""}`.toLowerCase();
            const matchesQuery = queryTarget.includes(filters.query.toLowerCase());
            const matchesEmployee = filters.employeeId === "All" || salary.employeeId === filters.employeeId;
            const matchesStatus = filters.status === "All" || salary.status === filters.status;
            const matchesMonth = filters.month === "All" || salary.month === Number(filters.month);
            return matchesQuery && matchesEmployee && matchesStatus && matchesMonth;
        });

        // Group by month/year (newest first), and sort alphabetically by Employee Name (A-Z) within that month/year
        return list.sort((a, b) => {
            if (a.year !== b.year) {
                return b.year - a.year;
            }
            if (a.month !== b.month) {
                return b.month - a.month;
            }
            const nameA = (a.employee?.name || a.employeeId || "").toLowerCase();
            const nameB = (b.employee?.name || b.employeeId || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }, [filters, salaries]);

    const totals = useMemo(() => ({
        net: filtered.reduce((sum, salary) => sum + salary.netSalary, 0),
        deductions: filtered.reduce((sum, salary) => sum + salary.totalDeduction, 0),
        paid: filtered.filter((salary) => salary.status === "Paid").length,
        pending: filtered.filter((salary) => salary.status === "Pending").length
    }), [filtered]);

    const exportRows = useMemo(() => {
        let list = [];
        if (exportType === "month") {
            const selMonth = exportFilters.month === "All" ? new Date().getMonth() + 1 : Number(exportFilters.month);
            const selYear = Number(exportFilters.year || new Date().getFullYear());
            list = salaries.filter((salary) => {
                const matchesMonth = salary.month === selMonth;
                const matchesYear = salary.year === selYear;
                const matchesStatus = exportFilters.status === "All" || salary.status === exportFilters.status;
                return matchesMonth && matchesYear && matchesStatus;
            });
            // Month-wise is sorted alphabetically by employee name (A-Z)
            return list.sort((a, b) => {
                const nameA = (a.employee?.name || a.employeeId || "").toLowerCase();
                const nameB = (b.employee?.name || b.employeeId || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (exportType === "employee") {
            const selEmpId = exportFilters.employeeId === "All" ? (employees[0]?.employeeId || "") : exportFilters.employeeId;
            const selYear = exportFilters.year ? Number(exportFilters.year) : null;
            list = salaries.filter((salary) => {
                const matchesEmployee = salary.employeeId === selEmpId;
                const matchesYear = !selYear || salary.year === selYear;
                const matchesStatus = exportFilters.status === "All" || salary.status === exportFilters.status;
                return matchesEmployee && matchesYear && matchesStatus;
            });
            // Employee-wise is sorted chronologically (newest first: year desc, month desc)
            return list.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });
        } else {
            // Custom filter
            list = salaries.filter((salary) => {
                const matchesEmployee = exportFilters.employeeId === "All" || salary.employeeId === exportFilters.employeeId;
                const matchesMonth = exportFilters.month === "All" || salary.month === Number(exportFilters.month);
                const matchesYear = !exportFilters.year || salary.year === Number(exportFilters.year);
                const matchesStatus = exportFilters.status === "All" || salary.status === exportFilters.status;
                const paymentTime = salary.paymentDate ? new Date(salary.paymentDate).getTime() : null;
                const afterStart = !exportFilters.startDate || (paymentTime && paymentTime >= new Date(exportFilters.startDate).getTime());
                const beforeEnd = !exportFilters.endDate || (paymentTime && paymentTime <= new Date(`${exportFilters.endDate}T23:59:59`).getTime());
                return matchesEmployee && matchesMonth && matchesYear && matchesStatus && afterStart && beforeEnd;
            });
            return list.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                if (a.month !== b.month) return b.month - a.month;
                const nameA = (a.employee?.name || a.employeeId || "").toLowerCase();
                const nameB = (b.employee?.name || b.employeeId || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }
    }, [exportType, exportFilters, salaries, employees]);

    function exportFilteredExcel() {
        let title = "Savitri Balika Inter College";
        let subtitle = "";
        let fileName = "salary-report.xls";

        if (exportType === "month") {
            const m = exportFilters.month === "All" ? new Date().getMonth() + 1 : Number(exportFilters.month);
            const y = exportFilters.year || new Date().getFullYear();
            subtitle = `Monthly Salary Ledger Report - ${monthName(m)} ${y}`;
            fileName = `monthly-salary-report-${monthName(m).toLowerCase()}-${y}.xls`;
        } else if (exportType === "employee") {
            const selEmpId = exportFilters.employeeId === "All" ? (employees[0]?.employeeId || "") : exportFilters.employeeId;
            const emp = employees.find(e => e.employeeId === selEmpId);
            const empName = emp ? emp.name : selEmpId;
            subtitle = `Employee Salary Ledger Report - ${empName} (${selEmpId})`;
            fileName = `employee-salary-report-${selEmpId}.xls`;
        } else {
            subtitle = `Custom Salary Ledger Report - Year ${exportFilters.year || "All"}`;
            fileName = `custom-salary-ledger-${exportFilters.year || "all"}.xls`;
        }

        exportSalaryLedgerExcel({
            salaries: exportRows,
            title,
            subtitle,
            fileName
        });
        setExportOpen(false);
    }
    function exportPdf() {
        const title = "Savitri Balika Inter College";
        const subtitle = `Salary Report — Generated: ${formatDate(new Date())}`;
        const columns = [
            "S.No", "Employee ID", "Employee Name", "Father/Spouse Name", "Role",
            "Department", "Phone", "Joining Date", "Status", "Bank Account", "IFSC",
            "Address", "Month", "Year", "Base Salary", "Per Day Salary",
            "Working Days", "Days Present", "Absent Days", "CL Remaining",
            "CL Taken (Full)", "Half CL", "Equiv CL", "Excess CL", "Emergency Leave",
            "Deductible Absence", "Absence Deduction", "Excess CL Ded.",
            "Bonus", "Advance Ded.", "PF", "Total Deduction", "Net Salary",
            "Payment Status", "Payment Date"
        ];
        const rows = filtered.map((salary, index) => [
            index + 1,
            salary.employeeId || "",
            salary.employee?.name || salary.employeeId || "",
            salary.employee?.fatherOrSpouseName || "",
            salary.employee?.role || "",
            salary.employee?.department || "",
            salary.employee?.phone || "",
            salary.employee?.joiningDate || "",
            salary.employee?.status || "Active",
            salary.employee?.bankDetails?.accountNumber || "",
            salary.employee?.bankDetails?.ifscCode || "",
            salary.employee?.address || "",
            monthName(salary.month),
            salary.year,
            `₹${Number(salary.baseSalary || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.perDaySalary || 0).toLocaleString("en-IN")}`,
            salary.workingDays,
            salary.daysPresent,
            salary.absentDays,
            Math.max((salary.totalCL || 14) - ((salary.casualLeave || 0) + (salary.halfCLTaken || 0) / 2), 0),
            salary.casualLeave || 0,
            `${salary.halfCLTaken || 0} Half`,
            salary.equivalentCLUsed || 0,
            salary.excessCL || 0,
            salary.emergencyLeave || 0,
            salary.deductibleAbsence || 0,
            `₹${Number(salary.absenceDeduction || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.excessCLDeduction || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.bonus || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.advanceDeduction || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.pfAmount || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.totalDeduction || 0).toLocaleString("en-IN")}`,
            `₹${Number(salary.netSalary || 0).toLocaleString("en-IN")}`,
            salary.status === "Paid" ? "Paid" : "Unpaid",
            salary.paymentDate ? formatDate(salary.paymentDate) : ""
        ]);
        const headerHtml = columns.map(c => `<th>${c}</th>`).join("");
        const bodyHtml = rows.map((row, ri) =>
            `<tr class="${ri % 2 === 0 ? "even" : "odd"}">${row.map(cell => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`
        ).join("");
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${title} — Salary Report</title>
  <style>
    @media print { @page { size: A3 landscape; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #172033; }
    .title { font-size: 18px; font-weight: 800; color: #1e40af; text-align: center; margin-bottom: 2px; }
    .subtitle { font-size: 11px; color: #475569; text-align: center; margin-bottom: 14px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1e40af; color: #fff; border: 1px solid #93c5fd; padding: 6px 7px; font-size: 9px; text-align: center; white-space: nowrap; }
    td { border: 1px solid #dbeafe; padding: 5px 7px; font-size: 9px; white-space: nowrap; vertical-align: middle; }
    tr.even td { background: #eff6ff; }
    tr.odd td { background: #fff; }
    .total { margin-top: 12px; font-weight: 700; font-size: 12px; color: #1e40af; }
    .no-print { text-align: center; margin-bottom: 16px; }
    @media print { .no-print { display: none; } }
    button { padding: 8px 20px; background: #1e40af; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">🖨️ Print / Save as PDF</button></div>
  <div class="title">${title}</div>
  <div class="subtitle">${subtitle}</div>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  <div class="total">Total Net Salary: ₹${totals.net.toLocaleString("en-IN")} &nbsp;|&nbsp; Total Deductions: ₹${totals.deductions.toLocaleString("en-IN")} &nbsp;|&nbsp; Paid: ${totals.paid} &nbsp;|&nbsp; Unpaid: ${totals.pending}</div>
</body>
</html>`;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    }
    return (<>
      <PageHeading title="Reports" description="Salary history with filters for employee, month, and payment status." action={<>
            <Button variant="secondary" onClick={exportPdf} disabled={filtered.length === 0}>
              <FileDown className="h-4 w-4"/>
              PDF
            </Button>
            <Button onClick={() => setExportOpen(true)} disabled={salaries.length === 0}>
              <Download className="h-4 w-4"/>
              Export Excel Report
            </Button>
          </>}/>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric label="Filtered Net" value={formatCurrency(totals.net)}/>
        <Metric label="Deductions" value={formatCurrency(totals.deductions)}/>
        <Metric label="Paid" value={String(totals.paid)} tone="text-emerald-600"/>
        <Metric label="Unpaid" value={String(totals.pending)} tone="text-blue-600"/>
      </div>

      <Card>
        <CardHeader title="Salary History" description={`${filtered.length} record${filtered.length === 1 ? "" : "s"} matched`} action={<Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4"/>
              Print
            </Button>}/>
        <div className="grid gap-3 border-b border-border p-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input className="pl-9" placeholder="Search report" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })}/>
          </div>
          <Select value={filters.employeeId} onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}>
            <option value="All">All Employees</option>
            {employees.map((employee) => (<option key={employee._id} value={employee.employeeId}>
                {employee.name}
              </option>))}
          </Select>
          <Select value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })}>
            <option value="All">All Months</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option value={month} key={month}>
                {monthName(month)}
              </option>))}
          </Select>
          <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Unpaid</option>
          </Select>
        </div>

        {filtered.length === 0 ? (<EmptyState title={loading ? "Loading reports" : "No salary history"} description={loading ? "Report data is loading." : "Change filters or generate a salary record."}/>) : (<div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Month</th>
                  <th className="px-5 py-3 font-semibold">Attendance</th>
                  <th className="px-5 py-3 font-semibold">Deductions</th>
                  <th className="px-5 py-3 font-semibold">Net Salary</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Payment Date</th>
                  <th className="px-5 py-3 text-right font-semibold">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((salary) => (<tr key={salary._id} className="hover:bg-muted/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{salary.employee?.name || salary.employeeId}</p>
                      <p className="text-xs text-muted-foreground">{salary.employeeId}</p>
                    </td>
                    <td className="px-5 py-4">{monthName(salary.month)} {salary.year}</td>
                    <td className="px-5 py-4">
                      <p>{salary.daysPresent}/{salary.workingDays} present</p>
                      <p className="text-xs text-muted-foreground">{salary.absentDays} absent, {salary.excessCL} excess CL</p>
                    </td>
                    <td className="px-5 py-4">{formatCurrency(salary.totalDeduction)}</td>
                    <td className="px-5 py-4 font-semibold">{formatCurrency(salary.netSalary)}</td>
                    <td className="px-5 py-4">
                      <Badge tone={salary.status === "Paid" ? "success" : "neutral"}>{salary.status === "Paid" ? "Paid" : "Unpaid"}</Badge>
                    </td>
                    <td className="px-5 py-4">{salary.paymentDate ? formatDate(salary.paymentDate) : "Unpaid"}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/slips/${salary._id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                        <Filter className="h-3.5 w-3.5"/>
                        View
                      </Link>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </Card>

      <Modal open={exportOpen} title="Export Excel Report" onClose={() => setExportOpen(false)} className="max-w-3xl">
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            <Button
              variant={exportType === "month" ? "default" : "secondary"}
              onClick={() => setExportType("month")}
              type="button"
            >
              Month-wise
            </Button>
            <Button
              variant={exportType === "employee" ? "default" : "secondary"}
              onClick={() => setExportType("employee")}
              type="button"
            >
              Employee-wise
            </Button>
            <Button
              variant={exportType === "custom" ? "default" : "secondary"}
              onClick={() => setExportType("custom")}
              type="button"
            >
              Custom Filter
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exportType === "employee" || exportType === "custom" ? (
              <Field label="Employee Name">
                <Select value={exportFilters.employeeId} onChange={(event) => setExportFilters({ ...exportFilters, employeeId: event.target.value })}>
                  {exportType === "custom" && <option value="All">All Employees</option>}
                  {employees.map((employee) => (<option key={employee._id} value={employee.employeeId}>
                      {employee.name}
                    </option>))}
                </Select>
              </Field>
            ) : null}

            {exportType === "month" || exportType === "custom" ? (
              <Field label="Month">
                <Select value={exportFilters.month} onChange={(event) => setExportFilters({ ...exportFilters, month: event.target.value })}>
                  {exportType === "custom" && <option value="All">All Months</option>}
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option value={month} key={month}>
                      {monthName(month)}
                    </option>))}
                </Select>
              </Field>
            ) : null}

            <Field label="Year">
              <Input type="number" value={exportFilters.year} onChange={(event) => setExportFilters({ ...exportFilters, year: event.target.value })}/>
            </Field>

            {exportType === "custom" ? (
              <>
                <Field label="Start Date">
                  <Input type="date" value={exportFilters.startDate} onChange={(event) => setExportFilters({ ...exportFilters, startDate: event.target.value })}/>
                </Field>
                <Field label="End Date">
                  <Input type="date" value={exportFilters.endDate} onChange={(event) => setExportFilters({ ...exportFilters, endDate: event.target.value })}/>
                </Field>
              </>
            ) : null}

            <Field label="Payment Status">
              <Select value={exportFilters.status} onChange={(event) => setExportFilters({ ...exportFilters, status: event.target.value })}>
                <option value="All">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Unpaid</option>
              </Select>
            </Field>
          </div>

          <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
            {exportType === "month" && (
              <p className="mb-1 font-medium text-primary">Month-wise Report Mode:</p>
            )}
            {exportType === "employee" && (
              <p className="mb-1 font-medium text-primary">Employee-wise Report Mode:</p>
            )}
            {exportType === "custom" && (
              <p className="mb-1 font-medium text-primary">Custom Filter Report Mode:</p>
            )}
            <p>
              {exportRows.length} record{exportRows.length === 1 ? "" : "s"} found. The exported Excel file will contain all employee and payment detail columns, including base salary, working days, days present, CL, half CL, equivalent CL, deductions, PF, bonus, net salary, and payment details.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={exportFilteredExcel} disabled={exportRows.length === 0}>
              <Download className="h-4 w-4"/>
              Export Excel Report
            </Button>
          </div>
        </div>
      </Modal>
    </>);
}
function Metric({ label, value, tone }) {
    return (<div className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone || ""}`}>{value}</p>
    </div>);
}
