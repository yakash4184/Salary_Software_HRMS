"use client";
import Link from "next/link";
import { Check, ClipboardList, Layers3, Percent, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeading } from "@/components/page-heading";
import { ANNUAL_CL_ALLOWANCE, calculateSalary, getAttendanceStats, getAttendanceSummary, getClPolicyMessage, getLeaveSummary, MAX_CL_PER_REQUEST, sumAllowedClUsed, validateClRequest } from "@/lib/salary";
import { formatCurrency, monthName } from "@/lib/utils";

const FIXED_YEAR = "2026";
const ALL_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
function getDefaultForm() {
    return {
    employee: "",
    month: "",
    year: FIXED_YEAR,
    baseSalary: "",
    workingDays: "30",
    daysPresent: "30",
    totalCL: String(ANNUAL_CL_ALLOWANCE),
    casualLeave: "0",
    halfCLTaken: "0",
    excessCL: "0",
    emergencyLeave: "0",
    bonus: "",
    advanceGiven: "",
    previousPendingAdvance: "0",
    advanceDeduction: "",
    ledgerDeduction: "0",
    pfAmount: "",
    status: "Paid",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: ""
};
}
const defaultForm = getDefaultForm();

const REMARK_SUGGESTIONS = [
    "Good performance",
    "Late joining penalty",
    "Festival bonus included",
    "Advance adjusted",
    "Emergency leave approved",
    "Salary revised",
    "No remarks"
];

export function SalaryClient() {
    const { notify } = useToast();
    const [employees, setEmployees] = useState([]);
    const [salaries, setSalaries] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkWorkingDays, setBulkWorkingDays] = useState("30");
    useEffect(() => {
        loadData();
        fetch("/api/auth/me")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setCurrentUser(data?.user || null))
            .catch(() => setCurrentUser(null));
    }, []);
    function can(permission) {
        return currentUser?.role === "Admin" || currentUser?.permissions?.includes(permission);
    }
    async function loadData() {
        setLoading(true);
        const [employeeResponse, salaryResponse, ledgerResponse] = await Promise.all([
            fetch("/api/employees?status=Active", { cache: "no-store" }),
            fetch("/api/salaries", { cache: "no-store" }),
            fetch("/api/ledger?status=Open", { cache: "no-store" })
        ]);
        const [employeeData, salaryData, ledgerData] = await Promise.all([
            employeeResponse.ok ? employeeResponse.json() : { employees: [] },
            salaryResponse.ok ? salaryResponse.json() : { salaries: [] },
            ledgerResponse.ok ? ledgerResponse.json() : { entries: [] }
        ]);
        setEmployees(employeeData.employees || []);
        setSalaries(salaryData.salaries || []);
        setLedgerEntries(ledgerData.entries || []);
        setLoading(false);
    }
    const selectedEmployee = employees.find((employee) => employee._id === form.employee);
    const ledgerBalanceByEmployee = useMemo(() => {
        return ledgerEntries.reduce((acc, entry) => {
            acc[entry.employeeId] = (acc[entry.employeeId] || 0) + (Number(entry.balanceAmount) || 0);
            return acc;
        }, {});
    }, [ledgerEntries]);
    const employeeMonthSalaries = useMemo(() => salaries.filter((salary) => salary.employee?._id === form.employee && salary.year === Number(form.year)), [form.employee, form.year, salaries]);
    const availableMonths = useMemo(() => {
        if (!form.employee)
            return ALL_MONTHS;
        const paidMonths = new Set(employeeMonthSalaries.filter((salary) => salary.status === "Paid").map((salary) => salary.month));
        return ALL_MONTHS.filter((month) => !paidMonths.has(month));
    }, [employeeMonthSalaries, form.employee]);
    const selectedExistingSalary = salaries.find((salary) => salary.employee?._id === form.employee &&
        salary.month === Number(form.month) &&
        salary.year === Number(form.year));
    const previousAttendanceRecords = useMemo(() => {
        if (!form.employee || !form.month)
            return [];
        const selectedMonth = Number(form.month);
        return employeeMonthSalaries
            .filter((salary) => salary.month < selectedMonth)
            .sort((a, b) => a.month - b.month);
    }, [employeeMonthSalaries, form.employee, form.month]);
    const currentAttendance = useMemo(() => getAttendanceStats({
        workingDays: Number(form.workingDays),
        daysPresent: Number(form.daysPresent)
    }), [form.workingDays, form.daysPresent]);
    const overallAttendance = useMemo(() => {
        if (!form.employee || !form.month)
            return getAttendanceSummary([]);
        return getAttendanceSummary([
            ...previousAttendanceRecords,
            {
                workingDays: Number(form.workingDays),
                daysPresent: Number(form.daysPresent)
            }
        ]);
    }, [form.employee, form.month, form.workingDays, form.daysPresent, previousAttendanceRecords]);
    const attendanceMonthBreakdown = useMemo(() => {
        if (!form.employee || !form.month)
            return [];
        return [
            ...previousAttendanceRecords.map((salary) => ({
                month: salary.month,
                stats: getAttendanceStats(salary),
                label: monthName(salary.month).slice(0, 3)
            })),
            {
                month: Number(form.month),
                stats: currentAttendance,
                label: monthName(Number(form.month)).slice(0, 3),
                current: true
            }
        ];
    }, [currentAttendance, form.employee, form.month, previousAttendanceRecords]);
    const annualClUsed = useMemo(() => {
        if (!form.employee)
            return 0;
        return sumAllowedClUsed(salaries.filter((salary) => salary.employee?._id === form.employee &&
            salary.year === Number(form.year) &&
            salary.month !== Number(form.month)));
    }, [form.employee, form.month, form.year, salaries]);
    const calculation = useMemo(() => calculateSalary({
        month: Number(form.month),
        annualClUsed,
        baseSalary: Number(form.baseSalary),
        workingDays: Number(form.workingDays),
        daysPresent: Number(form.daysPresent),
        casualLeave: Number(form.casualLeave),
        halfCLTaken: Number(form.halfCLTaken),
        excessCL: Number(form.excessCL),
        emergencyLeave: Number(form.emergencyLeave),
        bonus: Number(form.bonus),
        advanceGiven: Number(form.advanceGiven),
        previousPendingAdvance: Number(form.previousPendingAdvance),
        advanceDeduction: Number(form.advanceDeduction),
        ledgerDeduction: Number(form.ledgerDeduction),
        pfAmount: Number(form.pfAmount)
    }), [form, annualClUsed]);
    const clPolicyMessage = form.month ? getClPolicyMessage(Number(form.month), annualClUsed) : "Select a month to view CL policy.";
    const pastLeaveStats = useMemo(() => {
        if (!form.employee) return { full: 0, half: 0 };
        const pastSalaries = salaries.filter((salary) => salary.employee?._id === form.employee &&
            salary.year === Number(form.year) &&
            salary.month !== Number(form.month));
        return pastSalaries.reduce((acc, s) => {
            acc.full += Math.max(Number(s.casualLeave) || 0, 0);
            acc.half += Math.max(Number(s.halfCLTaken) || 0, 0);
            return acc;
        }, { full: 0, half: 0 });
    }, [form.employee, form.month, form.year, salaries]);
    const leaveSummary = useMemo(() => getLeaveSummary({
        pastFullCL: pastLeaveStats.full,
        pastHalfCL: pastLeaveStats.half,
        casualLeave: Number(form.casualLeave),
        halfCLTaken: Number(form.halfCLTaken),
        totalCL: Number(form.totalCL) || ANNUAL_CL_ALLOWANCE
    }), [pastLeaveStats, form.casualLeave, form.halfCLTaken, form.totalCL]);
    const clValidationMessage = validateClRequest({
        annualClUsed,
        casualLeave: Number(form.casualLeave),
        halfCLTaken: Number(form.halfCLTaken),
        totalCL: Number(form.totalCL) || ANNUAL_CL_ALLOWANCE
    });
    const clSalary = calculation.clAllowance * calculation.perDaySalary;
    const totalRecoverableAdvance = Math.max(
        (Number(form.previousPendingAdvance) || 0) +
        (Number(form.ledgerDeduction) || 0) +
        (Number(form.advanceGiven) || 0),
        0
    );

    useEffect(() => {
        if (!form.employee || loading)
            return;
        if (availableMonths.length === 0) {
            if (form.month !== "") {
                setForm((current) => ({
                    ...current,
                    month: "",
                    baseSalary: selectedEmployee ? String(selectedEmployee.baseSalary) : current.baseSalary,
                    workingDays: "30",
                    daysPresent: "30",
                    totalCL: String(ANNUAL_CL_ALLOWANCE),
                    casualLeave: "0",
                    halfCLTaken: "0",
                    excessCL: "0",
                    emergencyLeave: "0",
                    bonus: "",
                    advanceGiven: "",
                    previousPendingAdvance: "0",
                    advanceDeduction: "",
                    ledgerDeduction: "0",
                    pfAmount: "",
                    status: "Paid",
                    paymentDate: new Date().toISOString().slice(0, 10),
                    notes: ""
                }));
            }
            return;
        }
        if (form.month && !availableMonths.includes(Number(form.month))) {
            updateSelection({ month: "" });
        }
    }, [availableMonths, form.employee, form.month, loading, selectedEmployee]);

    function updateSelection(patch) {
        const next = { ...form, ...patch, year: FIXED_YEAR };
        if (Object.prototype.hasOwnProperty.call(patch, "employee")) {
            next.month = "";
        }
        const allowedMonths = getAvailableMonths(next.employee, next.year, salaries);
        if (next.month && !allowedMonths.includes(Number(next.month))) {
            next.month = "";
        }
        const employee = employees.find((item) => item._id === next.employee);
        const employeeLedgerBalance = employee ? Number(ledgerBalanceByEmployee[employee.employeeId] || 0) : 0;
        if (next.employee && allowedMonths.length === 0) {
            setForm({
                ...next,
                baseSalary: employee ? String(employee.baseSalary) : next.baseSalary,
                workingDays: "30",
                daysPresent: "30",
                totalCL: String(ANNUAL_CL_ALLOWANCE),
                casualLeave: "0",
                halfCLTaken: "0",
                excessCL: "0",
                emergencyLeave: "0",
                bonus: "",
                advanceGiven: "",
                previousPendingAdvance: "0",
                advanceDeduction: "",
                ledgerDeduction: "0",
                pfAmount: "",
                status: "Paid",
                paymentDate: new Date().toISOString().slice(0, 10),
                notes: ""
            });
            return;
        }

        let previousPending = "0";
        if (next.month) {
            const pastSalaries = salaries.filter(s => s.employee?._id === next.employee && (s.year < Number(next.year) || (s.year === Number(next.year) && s.month < Number(next.month))));
            if (pastSalaries.length > 0) {
                pastSalaries.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });
                const lastSalary = pastSalaries[0];
                
                if (typeof lastSalary.remainingAdvance === "number") {
                    previousPending = String(lastSalary.remainingAdvance);
                } else {
                    // Dynamically compute the unrecovered advance from the last salary record
                    const totalAdvances = (lastSalary.previousPendingAdvance || 0) + (lastSalary.ledgerDeduction || 0) + (lastSalary.advanceGiven || 0) + (lastSalary.carriedOverAdvance || 0);
                    const totalEarnings = (lastSalary.baseSalary || 0) + (lastSalary.bonus || 0);
                    const absenceDed = lastSalary.absenceDeduction || 0;
                    const excessCLDed = lastSalary.excessCLDeduction || 0;
                    const pfDed = lastSalary.pfAmount || 0;
                    const available = Math.max(totalEarnings - absenceDed - excessCLDed - pfDed, 0);
                    const actualDeducted = Math.min(lastSalary.advanceDeduction || 0, available);
                    const unrecovered = Math.max(totalAdvances - actualDeducted, 0);
                    
                    previousPending = String(Math.round(unrecovered * 100) / 100);
                }
            }
        }

        const existing = next.month ? salaries.find((salary) => salary.employee?._id === next.employee &&
            salary.month === Number(next.month) &&
            salary.year === Number(next.year)) : null;
        if (existing) {
            setForm({
                ...next,
                baseSalary: String(existing.baseSalary),
                workingDays: String(existing.workingDays),
                daysPresent: String(existing.daysPresent),
                totalCL: String(existing.totalCL || ANNUAL_CL_ALLOWANCE),
                casualLeave: String(existing.casualLeave),
                halfCLTaken: String(existing.halfCLTaken || 0),
                excessCL: String(existing.excessCL || 0),
                emergencyLeave: String(existing.emergencyLeave),
                bonus: existing.bonus ? String(existing.bonus) : "",
                advanceGiven: existing.advanceGiven ? String(existing.advanceGiven) : "",
                previousPendingAdvance: previousPending, // Use dynamic carry-over
                advanceDeduction: existing.advanceDeduction ? String(existing.advanceDeduction) : "",
                ledgerDeduction: String(existing.ledgerDeduction || 0),
                pfAmount: existing.pfAmount ? String(existing.pfAmount) : "",
                status: "Paid",
                paymentDate: existing.paymentDate ? existing.paymentDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
                notes: existing.notes || ""
            });
            return;
        }
        setForm({
            ...next,
            baseSalary: employee ? String(employee.baseSalary) : next.baseSalary,
            bonus: "",
            excessCL: "0",
            halfCLTaken: "0",
            advanceGiven: "",
            previousPendingAdvance: previousPending,
            advanceDeduction: "",
            ledgerDeduction: String(employeeLedgerBalance),
            pfAmount: "",
            status: "Paid",
            paymentDate: new Date().toISOString().slice(0, 10),
            notes: ""
        });
    }

    function handleAmountChange(field, value) {
        const cleaned = value.replace(/\D/g, "");
        if (field === "advanceDeduction") {
            const limitedDeduction = Math.min(Number(cleaned) || 0, totalRecoverableAdvance);
            setForm((current) => ({
                ...current,
                [field]: cleaned === "" ? "" : String(limitedDeduction)
            }));
            return;
        }
        setForm((current) => ({
            ...current,
            [field]: cleaned
        }));
    }

    function handleClChange(value) {
        const cleaned = value.replace(/[^\d.]/g, "");
        const number = Number(cleaned);
        setForm((current) => {
            const currentHalfCL = Number(current.halfCLTaken) || 0;
            const equivalentFromHalf = currentHalfCL / 2;
            const maxAllowed = Math.max(0, MAX_CL_PER_REQUEST - equivalentFromHalf);
            const safeMax = Math.floor(maxAllowed);
            return {
                ...current,
                casualLeave: Number.isFinite(number) ? String(Math.min(Math.max(number, 0), safeMax)) : ""
            };
        });
    }

    function handleHalfClChange(value) {
        const cleaned = value.replace(/[^\d.]/g, "");
        const number = Number(cleaned);
        setForm((current) => {
            const currentCasualLeave = Number(current.casualLeave) || 0;
            const maxAllowedEquivalent = Math.max(0, MAX_CL_PER_REQUEST - currentCasualLeave);
            const maxAllowedHalfCl = Math.floor(maxAllowedEquivalent * 2);
            return {
                ...current,
                halfCLTaken: Number.isFinite(number) ? String(Math.min(Math.max(number, 0), maxAllowedHalfCl)) : ""
            };
        });
    }

    function preventNumberStep(event) {
        event.preventDefault();
    }

    function preventInvalidAmountKey(event) {
        if (["e", "E", "+", "-", "."].includes(event.key)) {
            event.preventDefault();
        }
    }

    // Remark chip click handler
    function handleRemarkChip(remark) {
        if (remark === "No remarks") {
            setForm({ ...form, notes: "" });
            return;
        }
        const current = form.notes.trim();
        if (current && !current.endsWith(".")) {
            setForm({ ...form, notes: current + ". " + remark });
        } else if (current) {
            setForm({ ...form, notes: current + " " + remark });
        } else {
            setForm({ ...form, notes: remark });
        }
    }

    async function submit(event) {
        event.preventDefault();
        if (!form.employee) {
            notify({ tone: "error", title: "Select an employee first" });
            return;
        }
        if (!form.month) {
            notify({ tone: "error", title: "Select a month first" });
            return;
        }
        if (clValidationMessage) {
            notify({ tone: "error", title: clValidationMessage });
            return;
        }
        const previousPendingAdvance = Number(form.previousPendingAdvance) || 0;
        const advanceGiven = Number(form.advanceGiven) || 0;
        const ledgerDeduction = Number(form.ledgerDeduction) || 0;
        const advanceDeduction = Number(form.advanceDeduction) || 0;
        if (advanceDeduction > previousPendingAdvance + ledgerDeduction + advanceGiven) {
            notify({ tone: "error", title: `Deduction (₹${advanceDeduction}) cannot exceed total pending advance (₹${previousPendingAdvance + ledgerDeduction + advanceGiven})` });
            return;
        }
        setSaving(true);
        const response = await fetch("/api/salaries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee: form.employee,
                month: Number(form.month),
                year: Number(form.year),
                baseSalary: Number(form.baseSalary),
                workingDays: Number(form.workingDays),
                daysPresent: Number(form.daysPresent),
                totalCL: Number(form.totalCL) || ANNUAL_CL_ALLOWANCE,
                casualLeave: Number(form.casualLeave),
                halfCLTaken: Number(form.halfCLTaken),
                excessCL: Number(form.excessCL),
                emergencyLeave: Number(form.emergencyLeave),
                bonus: Number(form.bonus),
                advanceGiven,
                advanceDeduction,
                ledgerDeduction,
                pfAmount: Number(form.pfAmount),
                status: form.status,
                paymentDate: form.status === "Paid" ? new Date(form.paymentDate || new Date()).toISOString() : null,
                notes: form.notes
            })
        });
        setSaving(false);
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            notify({ tone: "error", title: data?.message || "Salary could not be generated" });
            return;
        }
        notify({ tone: "success", title: "Salary saved successfully", durationMs: 4000 });
        await loadData();
        setForm(getDefaultForm());
    }
    async function bulkGenerate() {
        if (!form.month) {
            notify({ tone: "error", title: "Select a month first" });
            return;
        }
        setSaving(true);
        const response = await fetch("/api/salaries/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                month: Number(form.month),
                year: Number(form.year),
                workingDays: Number(bulkWorkingDays),
                status: "Paid"
            })
        });
        setSaving(false);
        if (!response.ok) {
            notify({ tone: "error", title: "Bulk generation failed" });
            return;
        }
        const data = await response.json();
        notify({ tone: "success", title: `${data.created} salaries created` });
        setBulkOpen(false);
        await loadData();
    }
    const canCreateSalary = can("salary.create");
    if (!canCreateSalary) {
        return (<>
          <PageHeading title="Salary" description="View salary records. Salary creation is disabled for this user." action={<Button variant="secondary" onClick={loadData}>
                <RefreshCw className="h-4 w-4"/>
                Refresh
              </Button>}/>
          <Card>
            <CardHeader title="Salary View Only" description="You do not have Create salary permission, so salary generator controls are hidden."/>
            {salaries.length === 0 ? (<EmptyState title="No salary records" description="Salary records will appear here when available."/>) : (<div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Employee</th>
                      <th className="px-5 py-3 font-semibold">Month</th>
                      <th className="px-5 py-3 font-semibold">Base Salary</th>
                      <th className="px-5 py-3 font-semibold">Net Salary</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salaries.map((salary) => (<tr key={salary._id} className="hover:bg-muted/50">
                        <td className="px-5 py-4">
                          <p className="font-medium">{salary.employee?.name || salary.employeeId}</p>
                          <p className="text-xs text-muted-foreground">{salary.employeeId}</p>
                        </td>
                        <td className="px-5 py-4">{monthName(salary.month)} {salary.year}</td>
                        <td className="px-5 py-4">{formatCurrency(salary.baseSalary)}</td>
                        <td className="px-5 py-4 font-semibold">{formatCurrency(salary.netSalary)}</td>
                        <td className="px-5 py-4">{salary.status}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </Card>
        </>);
    }
    return (<>
      <PageHeading title="Salary" description="Generate monthly salaries with the updated annual CL policy, premium payroll controls, bonuses, advance deductions, and payment status." action={<>
            <Button variant="secondary" onClick={loadData}>
              <RefreshCw className="h-4 w-4"/>
              Refresh
            </Button>
            {canCreateSalary ? <Button onClick={() => setBulkOpen(true)}>
              <Layers3 className="h-4 w-4"/>
              Bulk Generate
            </Button> : null}
          </>}/>

      <div className="grid gap-6">
        <Card>
          <CardHeader title="Salary Generator" description={canCreateSalary ? "Monthly payroll calculation workspace." : "You have view access only. Salary creation is disabled for this user."}/>
          <form onSubmit={submit} className="grid gap-5 p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Employee">
                <Select value={form.employee} onChange={(event) => updateSelection({ employee: event.target.value })} required>
                  <option value="">Select employee</option>
                  {employees.map((employee) => (<option value={employee._id} key={employee._id}>
                      {employee.name} ({employee.employeeId})
                    </option>))}
                </Select>
              </Field>
              <Field label="Month">
                <Select value={form.month} onChange={(event) => updateSelection({ month: event.target.value })} disabled={Boolean(form.employee) && availableMonths.length === 0}>
                  <option value="">{availableMonths.length === 0 ? "All paid months are hidden" : "Select Month"}</option>
                  {availableMonths.map((month) => (<option value={month} key={month}>
                      {monthName(month)}
                    </option>))}
                </Select>
              </Field>
              <Field label="Year">
                <div className="static-year-display">{FIXED_YEAR}</div>
              </Field>
            </div>

            {selectedExistingSalary ? (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/50 bg-white/40 p-3 text-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
                <span>
                  Existing record for {monthName(selectedExistingSalary.month)} {selectedExistingSalary.year}
                </span>
                <Link href={`/slips/${selectedExistingSalary._id}`} className="font-medium text-primary hover:underline">
                  View slip
                </Link>
              </div>) : null}

            {form.employee && form.month ? (<AttendancePercentagePanel
              employeeName={selectedEmployee?.name}
              month={Number(form.month)}
              year={form.year}
              currentAttendance={currentAttendance}
              overallAttendance={overallAttendance}
              monthBreakdown={attendanceMonthBreakdown}
            />) : null}

            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 text-sm text-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Casual Leave Policy</p>
                  <p className="mt-1 text-muted-foreground">{clPolicyMessage}</p>
                  {clValidationMessage ? <p className="mt-1 font-medium text-rose-700 dark:text-rose-300">{clValidationMessage}</p> : null}
                </div>
                <div className="rounded-md border border-white/50 bg-white/45 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur dark:bg-white/10">
                  Yearly CL: {leaveSummary.yearlyCLUsed}/{leaveSummary.totalCL}
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-white/50 bg-white/35 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10 md:grid-cols-5">
              <LeaveBadge label="Total CL" value={leaveSummary.totalCL} tone="blue"/>
              <LeaveBadge label="Full CL Taken" value={leaveSummary.fullCLTaken} tone="red"/>
              <LeaveBadge label="Half CL Taken" value={`${leaveSummary.halfCLTaken} Half Days`} tone="orange"/>
              <LeaveBadge label="Equivalent CL Used" value={leaveSummary.equivalentCLUsed} tone="red"/>
              <LeaveBadge label="Remaining CL" value={leaveSummary.remainingCL} tone="green"/>
            </div>

            {form.employee ? (<div className="grid gap-2 rounded-lg border border-white/50 bg-white/35 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10">
                <p className="text-sm font-semibold">{selectedEmployee?.name}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                const status = employeeMonthSalaries.find((salary) => salary.month === month)?.status;
                return (<div key={month} className="rounded-md border border-white/50 bg-white/45 p-2 text-xs shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
                        <div className="flex items-center justify-between gap-1">
                          <span>{monthName(month).slice(0, 3)}</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${status === "Paid" ? "bg-emerald-500" : status === "Pending" ? "bg-amber-500" : "bg-muted-foreground/30"}`}/>
                        </div>
                        <p className="mt-1 text-muted-foreground">{status || "No slip"}</p>
                      </div>);
            })}
                </div>
              </div>) : null}

            <div className="payroll-field-panel">
              <div className="payroll-field-column">
                <PayrollFieldRow number={1} label="Base Salary" hint="Original salary without deductions">
                  <Input className="payroll-row-input" type="number" min="0" value={form.baseSalary} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })} required/>
                </PayrollFieldRow>
                <PayrollFieldRow number={2} label="Total Working Days">
                  <Input className="payroll-row-input" type="number" min="1" value={form.workingDays} onChange={(event) => setForm({ ...form, workingDays: event.target.value })} required/>
                </PayrollFieldRow>
                <PayrollFieldRow number={3} label="Days Present">
                  <Input className="payroll-row-input" type="number" min="0" max={form.workingDays} value={form.daysPresent} onChange={(event) => setForm({ ...form, daysPresent: event.target.value })} required/>
                </PayrollFieldRow>
                <PayrollFieldRow number={4} label="Absent Days">
                  <Input className="payroll-row-input" value={String(calculation.absentDays)} readOnly/>
                </PayrollFieldRow>
                <PayrollFieldRow number={5} label="Casual Leave Taken" hint={`Fixed max ${MAX_CL_PER_REQUEST} CL. CL Salary: ${formatCurrency(clSalary)}.`}>
                  <Input className="payroll-row-input" type="number" min="0" max={MAX_CL_PER_REQUEST} step="1" value={form.casualLeave} onChange={(event) => handleClChange(event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={6} label="1/2 CL" hint="Every 2 half days = 1 full CL">
                  <Input className="payroll-row-input" type="number" min="0" step="1" value={form.halfCLTaken} onChange={(event) => handleHalfClChange(event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={7} label="Excess Casual Leave" hint="Adjusts absent days; no salary deduction">
                  <Input className="payroll-row-input" type="number" min="0" value={form.excessCL} onChange={(event) => setForm({ ...form, excessCL: event.target.value })}/>
                </PayrollFieldRow>
              </div>

              <div className="payroll-field-column payroll-field-column-right">
                <PayrollFieldRow number={8} label="Emergency Leave" hint="No deduction for approved emergency leave">
                  <Input className="payroll-row-input" type="number" min="0" value={form.emergencyLeave} onChange={(event) => setForm({ ...form, emergencyLeave: event.target.value })}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={9} label="Bonus" hint="Enter amount only">
                  <Input className="payroll-row-input no-spinner" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter amount" value={form.bonus} onKeyDown={preventInvalidAmountKey} onWheel={preventNumberStep} onChange={(event) => handleAmountChange("bonus", event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={10} label="Previous Pending Advance" hint="Automatically brought over from previous month">
                  <Input className="payroll-row-input" type="text" value={form.previousPendingAdvance} readOnly disabled />
                </PayrollFieldRow>
                <PayrollFieldRow number={11} label="New Advance Given" hint="Enter advance amount given this month">
                  <Input className="payroll-row-input no-spinner" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter amount" value={form.advanceGiven} onKeyDown={preventInvalidAmountKey} onWheel={preventNumberStep} onChange={(event) => handleAmountChange("advanceGiven", event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={12} label="Advance Deduction" hint={`Cuts from school expense + pending advance. Max: ${formatCurrency(totalRecoverableAdvance)}.`}>
                  <Input className="payroll-row-input no-spinner" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter amount" value={form.advanceDeduction} onKeyDown={preventInvalidAmountKey} onWheel={preventNumberStep} onChange={(event) => handleAmountChange("advanceDeduction", event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={13} label="School Expense" hint="Auto cut from employee expense entry; cannot be edited here">
                  <Input className="payroll-row-input" type="text" value={formatCurrency(Number(form.ledgerDeduction) || 0)} readOnly disabled />
                </PayrollFieldRow>
                <PayrollFieldRow number={14} label="PF Apply" hint="Enter amount; appears on slip if greater than 0">
                  <Input className="payroll-row-input no-spinner" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Enter amount" value={form.pfAmount} onKeyDown={preventInvalidAmountKey} onWheel={preventNumberStep} onChange={(event) => handleAmountChange("pfAmount", event.target.value)}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={15} label="Payment Date">
                  <Input className="payroll-row-input" type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} disabled={form.status !== "Paid"}/>
                </PayrollFieldRow>
                <PayrollFieldRow number={16} label="Payment Status">
                  <div className="payroll-status-toggle payroll-row-input">
                    <button type="button" className={`payroll-status-option ${form.status === "Paid" ? "active" : ""}`} onClick={() => setForm({ ...form, status: "Paid" })}>Paid</button>
                    <button type="button" className={`payroll-status-option ${form.status !== "Paid" ? "active unpaid" : ""}`} onClick={() => setForm({ ...form, status: "Pending" })}>Unpaid</button>
                  </div>
                </PayrollFieldRow>
              </div>
            </div>

            {/* ── Remarks with Suggestion Chips (Req #7) ───── */}
            <div className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Notes / Remarks</span>
              <div className="flex flex-wrap gap-1.5">
                {REMARK_SUGGESTIONS.map((remark) => (
                  <button
                    key={remark}
                    type="button"
                    onClick={() => handleRemarkChip(remark)}
                    className="remark-chip"
                  >
                    {remark}
                  </button>
                ))}
              </div>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Click a suggestion above or type your remarks here…"
              />
            </div>

            {/* ── Salary Breakdown (Req #8) ─────────────────── */}
            <div className="salary-breakdown rounded-xl border border-white/50 bg-white/35 p-5 backdrop-blur dark:border-white/10 dark:bg-white/10">
              <p className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">Salary Breakdown</p>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Earnings */}
                <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-800/30 dark:bg-emerald-900/15">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total Earnings</p>
                  <div className="space-y-2">
                    <BreakdownRow label="Base Salary" value={formatCurrency(Number(form.baseSalary) || 0)} />
                    <BreakdownRow label="Bonus" value={formatCurrency(Number(form.bonus) || 0)} />
                    <div className="mt-2 border-t border-emerald-300/50 pt-2 dark:border-emerald-700/40">
                      <BreakdownRow label="Gross Earnings" value={formatCurrency(calculation.totalEarnings)} bold green />
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="rounded-lg border border-rose-200/60 bg-rose-50/50 p-4 dark:border-rose-800/30 dark:bg-rose-900/15">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Total Deductions</p>
                  <div className="space-y-2">
                    <BreakdownRow label="Absence Ded." value={formatCurrency(calculation.absenceDeduction)} />
                    <BreakdownRow label="Excess CL Ded." value={formatCurrency(calculation.excessCLDeduction)} />
                    {Number(form.previousPendingAdvance) > 0 ? <BreakdownRow label="Prev. Advance Pool" value={formatCurrency(Number(form.previousPendingAdvance))} /> : null}
                    {Number(form.ledgerDeduction) > 0 ? <BreakdownRow label="School Expense Added" value={formatCurrency(calculation.ledgerDeduction || 0)} /> : null}
                    {Number(form.advanceGiven) > 0 ? <BreakdownRow label="New Advance Added" value={formatCurrency(Number(form.advanceGiven))} /> : null}
                    {totalRecoverableAdvance > 0 ? <BreakdownRow label="Total Advance Pool" value={formatCurrency(totalRecoverableAdvance)} bold /> : null}
                    <BreakdownRow label="Advance Ded. (Box 12)" value={formatCurrency(calculation.advanceDeduction || 0)} />
                    {Number(form.pfAmount) > 0 ? <BreakdownRow label="PF Deduction" value={formatCurrency(Number(form.pfAmount))} /> : null}
                    <div className="mt-2 border-t border-rose-300/50 pt-2 dark:border-rose-700/40">
                      <BreakdownRow label="Total Deductions" value={formatCurrency(calculation.totalDeduction)} bold red />
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 dark:border-primary/15 dark:bg-primary/10">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Final Summary</p>
                  <div className="space-y-2">
                    <BreakdownRow label="Per Day Salary" value={formatCurrency(calculation.perDaySalary)} />
                    <BreakdownRow label="CL Salary" value={formatCurrency(clSalary)} />
                    <BreakdownRow label="CL Allowed" value={`${calculation.clAllowance} day${calculation.clAllowance === 1 ? "" : "s"}`} />
                    <BreakdownRow label="Half CL Taken" value={`${calculation.halfCLTaken} half day${calculation.halfCLTaken === 1 ? "" : "s"}`} />
                    <BreakdownRow label="Equivalent CL Used" value={`${calculation.equivalentCLUsed} day${calculation.equivalentCLUsed === 1 ? "" : "s"}`} />
                    <BreakdownRow label="Excess CL Adjusted" value={`${calculation.excessCLAdjusted} day${calculation.excessCLAdjusted === 1 ? "" : "s"}`} />
                    <BreakdownRow label="Emergency Leave" value={`${calculation.emergencyLeave} day${calculation.emergencyLeave === 1 ? "" : "s"}`} />
                    <BreakdownRow label="Deductible Absence" value={`${calculation.deductibleAbsence} day${calculation.deductibleAbsence === 1 ? "" : "s"}`} />
                    <div className="mt-2 border-t border-primary/20 pt-2">
                      <BreakdownRow
                        label="Balance After Deductions"
                        value={formatCurrency(calculation.balanceAfterDeductions)}
                        bold
                        red={calculation.balanceAfterDeductions < 0}
                      />
                      {calculation.remainingAdvance > 0 && (
                        <BreakdownRow
                          label="Remaining Advance"
                          value={formatCurrency(calculation.remainingAdvance)}
                          red
                        />
                      )}
                      <BreakdownRow label="Payable Salary" value={formatCurrency(calculation.payableSalary)} bold primary />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payable Salary Box (Req #9) ──────────────── */}
            <div className="payable-salary-box">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">Payable Salary</p>
                  <p className="mt-0.5 text-xs text-primary-foreground/50">
                    Cut: {formatCurrency(calculation.advanceDeduction || 0)} from advance pool.
                    Pending carry forward: {formatCurrency(calculation.remainingAdvance || 0)}.
                  </p>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-primary-foreground">
                  {formatCurrency(calculation.payableSalary)}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" type="button" onClick={() => setForm(getDefaultForm())}>
                Reset
              </Button>
              {canCreateSalary ? <Button type="submit" disabled={saving || loading || !form.month}>
                <Check className="h-4 w-4"/>
                {saving ? "Saving..." : "Save Salary"}
              </Button> : null}
            </div>
          </form>
        </Card>

      </div>

      <Modal open={bulkOpen} title="Bulk Salary Generation" onClose={() => setBulkOpen(false)} className="max-w-lg">
        <div className="grid gap-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            This creates paid salary records for every active employee without overwriting existing records for the selected month.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Month">
              <Select value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })}>
                <option value="">Select Month</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (<option value={month} key={month}>
                    {monthName(month)}
                  </option>))}
              </Select>
            </Field>
            <Field label="Year">
              <div className="static-year-display">{FIXED_YEAR}</div>
            </Field>
            <Field label="Working Days">
              <Input value={bulkWorkingDays} type="number" min="1" onChange={(event) => setBulkWorkingDays(event.target.value)}/>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={bulkGenerate} disabled={saving}>
              <ClipboardList className="h-4 w-4"/>
              {saving ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </Modal>
    </>);
}

function getAvailableMonths(employeeId, year, salaries) {
    if (!employeeId)
        return ALL_MONTHS;
    const paidMonths = new Set(salaries
        .filter((salary) => salary.employee?._id === employeeId &&
        salary.year === Number(year) &&
        salary.status === "Paid")
        .map((salary) => salary.month));
    return ALL_MONTHS.filter((month) => !paidMonths.has(month));
}

function PayrollFieldRow({ number, label, hint, children }) {
    return (
        <label className="payroll-field-row">
            <span className="payroll-field-number">{number}</span>
            <span className="payroll-field-copy">
                <span className="payroll-field-label">{label}</span>
                {hint ? <span className="payroll-field-hint">{hint}</span> : null}
            </span>
            <span className="payroll-field-control">{children}</span>
        </label>
    );
}

function LeaveBadge({ label, value, tone }) {
    const toneClass = {
        green: "border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200",
        blue: "border-blue-200/70 bg-blue-50/80 text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-200",
        orange: "border-orange-200/70 bg-orange-50/80 text-orange-800 dark:border-orange-800/40 dark:bg-orange-900/20 dark:text-orange-200",
        red: "border-rose-200/70 bg-rose-50/80 text-rose-800 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200"
    }[tone];
    return (<div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-medium opacity-80">✓ {label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>);
}

function AttendancePercentagePanel({ employeeName, month, year, currentAttendance, overallAttendance, monthBreakdown }) {
    return (
        <div className="attendance-percentage-panel">
            <div className="attendance-percentage-header">
                <div className="attendance-percentage-title">
                    <span className="attendance-percentage-icon">
                        <Percent className="h-5 w-5"/>
                    </span>
                    <span>
                        <span className="attendance-percentage-label">Attendance Percentage</span>
                        <span className="attendance-percentage-subtitle">{employeeName || "Employee"} - {monthName(month)} {year}</span>
                    </span>
                </div>
                <div className="attendance-percentage-value">
                    <strong>{formatAttendancePercent(overallAttendance.percentage)}</strong>
                    <span>({formatAttendanceDays(overallAttendance.daysPresent)} Present / {formatAttendanceDays(overallAttendance.workingDays)} Working Days)</span>
                </div>
            </div>
            <div className="attendance-percentage-metrics">
                <AttendanceMetric label="Current Month" stats={currentAttendance}/>
                <AttendanceMetric label="Overall Till Month" stats={overallAttendance}/>
                <div className="attendance-metric attendance-metric-note">
                    <span>CL Counted</span>
                    <strong>No</strong>
                    <small>Only present days used</small>
                </div>
            </div>
            {monthBreakdown.length > 1 ? (
                <div className="attendance-month-breakdown">
                    {monthBreakdown.map((item) => (
                        <div key={`${item.month}-${item.current ? "current" : "saved"}`} className={`attendance-month-chip ${item.current ? "current" : ""}`}>
                            <span>{item.label}</span>
                            <strong>{formatAttendancePercent(item.stats.percentage)}</strong>
                            <small>{formatAttendanceDays(item.stats.daysPresent)}/{formatAttendanceDays(item.stats.workingDays)}</small>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function AttendanceMetric({ label, stats }) {
    return (
        <div className="attendance-metric">
            <span>{label}</span>
            <strong>{formatAttendancePercent(stats.percentage)}</strong>
            <small>({formatAttendanceDays(stats.daysPresent)} Present / {formatAttendanceDays(stats.workingDays)} Working Days)</small>
        </div>
    );
}

function formatAttendancePercent(value) {
    const number = Number(value) || 0;
    const rounded = Math.round((number + Number.EPSILON) * 100) / 100;
    return `${rounded.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: rounded % 1 === 0 ? 0 : 2
    })}%`;
}

function formatAttendanceDays(value) {
    const number = Number(value) || 0;
    if (Number.isInteger(number))
        return String(number);
    return number.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function BreakdownRow({ label, value, bold, green, red, primary }) {
    return (
        <div className="flex items-center justify-between gap-2 text-sm">
            <span className={`${bold ? "font-bold" : "font-medium"} ${green ? "text-emerald-700 dark:text-emerald-300" : red ? "text-rose-700 dark:text-rose-300" : primary ? "text-primary" : "text-muted-foreground"}`}>
                {label}
            </span>
            <span className={`font-variant-numeric tabular-nums ${bold ? "text-base font-bold" : "font-semibold"} ${green ? "text-emerald-700 dark:text-emerald-300" : red ? "text-rose-700 dark:text-rose-300" : primary ? "text-primary" : "text-foreground"}`}>
                {value}
            </span>
        </div>
    );
}
