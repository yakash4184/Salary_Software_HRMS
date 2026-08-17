"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDate, monthName } from "@/lib/utils";

const ASSET_BASE = "/salary-slip";
const SCHOOL_LOGO = "/school-logo.png";

export function SalarySlipClient({ id }) {
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const slipRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/salaries/${id}`, { cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      setSalary(data?.salary || null);
      setLoading(false);
    }

    load();
  }, [id]);

  async function downloadPdf() {
    if (!slipRef.current || !salary) return;

    setDownloading(true);
    const canvas = await html2canvas(slipRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(image, "PNG", 0, 0, width, height);
    pdf.save(`${salary.employeeId}-${monthName(salary.month)}-${salary.year}-salary-slip.pdf`);
    setDownloading(false);
  }

  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading salary slip" description="Please wait while the salary slip is prepared." />
      </Card>
    );
  }

  if (!salary) {
    return (
      <Card>
        <EmptyState title="Salary slip not found" description="The selected salary record is not available." />
      </Card>
    );
  }

  const slip = mapSalaryToSlip(salary);
  const hasPfDeduction = slip.pfAmount > 0;

  return (
    <div className="salary-slip-screen">
      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/reports">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={downloadPdf} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="salary-slip-preview">
        <div ref={slipRef} className="salary-slip-template">
          <div className="salary-slip">
            <div className="watermark">
              <img src={SCHOOL_LOGO} alt="Watermark" />
            </div>

            <div className="slip-header">
              <div className="logo-container">
                <img src={SCHOOL_LOGO} alt="School Logo" />
              </div>
              <div className="header-info">
                <div className="school-name">Savitri Balika Inter College</div>
                <div className="school-address">Khutaha Road, Jamunahiya, Mirzapur, Uttar Pradesh - 231001</div>
                <div className="school-affiliation">
                  Affiliated to Uttar Pradesh Madhyamik Shiksha Parishad, Prayagraj (Uttar Pradesh)
                </div>
              </div>
              <div className="slip-title-block">
                <div className="slip-title">Salary Slip</div>
                <div className="slip-meta">
                  <span>Month: {slip.monthYear}</span>
                  <span>Slip ID: {slip.slipId}</span>
                </div>
              </div>
            </div>

            <div className="employee-section">
              <div className="employee-grid">
                <SlipField label="Name:" value={slip.employeeName} />
                <SlipField label="Emp ID:" value={slip.employeeId} />
                <SlipField label="Designation:" value={slip.designation} />
                <SlipField label="Department:" value={slip.department} />
                <SlipField label="Bank A/C:" value={slip.bankAccount} />
                <SlipField label="IFSC:" value={slip.ifscCode} />
              </div>
            </div>

            <div className="financials">
              <div className="fin-column">
                <div className="fin-header earnings-header">
                  <span>Earnings</span>
                  <span>Amount (₹)</span>
                </div>
                <SlipLine label="Basic Salary" value={formatSlipCurrency(slip.basicSalary)} />
                <SlipLine label="Bonus" value={formatSlipCurrency(slip.bonus)} />
                <SlipSpacerLine />
                {hasPfDeduction ? <SlipSpacerLine /> : null}
                <div className="fin-total-row total-earnings">
                  <span>Gross Earnings</span>
                  <span>{formatSlipCurrency(slip.grossEarnings)}</span>
                </div>
              </div>

              <div className="fin-column">
                <div className="fin-header deductions-header">
                  <span>Deductions</span>
                  <span>Amount (₹)</span>
                </div>
                <SlipLine label="Absence Deduction" value={formatSlipCurrency(slip.absenceDeduction)} />
                <SlipLine label="Excess CL Deduction" value={formatSlipCurrency(0)} />
                <SlipLine label="Advance Salary Ded." value={formatSlipCurrency(slip.advanceSalaryDeduction)} />
                {hasPfDeduction ? <SlipLine label="PF Deduction" value={formatSlipCurrency(slip.pfAmount)} /> : null}
                <div className="fin-total-row total-deductions">
                  <span>Total Deductions</span>
                  <span>{formatSlipCurrency(slip.totalDeductions)}</span>
                </div>
              </div>
            </div>

            <div className={`balance-after-deductions ${slip.balanceAfterDeductions < 0 ? "balance-negative" : "balance-positive"}`}>
              <span>Balance After Deductions</span>
              <span>{formatSlipCurrency(slip.balanceAfterDeductions)}</span>
            </div>

            <div className="net-salary-section">
              <div>
                <div className="net-label">Net Salary Payable</div>
                <div className="net-words">{numberToWords(Math.round(slip.netSalary))}</div>
              </div>
              <div className="net-amount">{formatSlipCurrency(slip.netSalary)}</div>
            </div>

            <div className="remarks-section">
              <div className="remarks-label">Remarks / Notes</div>
              <div className="remarks-text">{slip.remarks}</div>
            </div>

            <div className="slip-footer">
              <div className="footer-left">
                <FooterField
                  label="Payment Status"
                  value={<span className={slip.status === "Paid" ? "status-paid" : "status-pending"}>{slip.status.toUpperCase()}</span>}
                />
                <FooterField label="Payment Date" value={slip.paymentDate} />
                <div className="footer-field">
                  <span className="footer-label">Payment Mode</span>
                  <span className="footer-value">
                    <span className="pay-mode-printed">{paymentMode}</span>
                    <span className="pay-mode-toggle no-print">
                      {["Bank Transfer", "Cash"].map((mode) => (
                        <button
                          className={`mode-btn ${paymentMode === mode ? "active" : ""}`}
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
              </div>

              <div className="stamp-signature-wrap">
                <div className="signature-block">
                  <img src={`${ASSET_BASE}/signature.png`} alt="Signature" className="signature-img" />
                  <div className="signature-line" />
                  <div className="signature-label">Authorized Signatory</div>
                </div>
                <img src={`${ASSET_BASE}/stamp.png`} alt="School Stamp" className="stamp-img" />
              </div>
            </div>

            <div className="system-note">
              This is a system-generated salary slip and does not require a physical signature.
              <br />
              For queries, contact: <strong>schoolsavitri1@gmail.com</strong>
            </div>

            <div className="cut-line-label">✂ Cut Here</div>
          </div>

          <div className="blank-half" />
        </div>
      </div>

      <style>{salarySlipCss}</style>
    </div>
  );
}

function SlipField({ label, value }) {
  return (
    <div className="emp-field">
      <span className="emp-label">{label}</span>
      <span className="emp-value">{value}</span>
    </div>
  );
}

function SlipLine({ label, value }) {
  return (
    <div className="fin-row">
      <span className="fin-row-label">{label}</span>
      <span className="fin-row-value">{value}</span>
    </div>
  );
}

function SlipSpacerLine() {
  return (
    <div className="fin-row fin-spacer-row" aria-hidden="true">
      <span className="fin-row-label">&nbsp;</span>
      <span className="fin-row-value">&nbsp;</span>
    </div>
  );
}

function FooterField({ label, value }) {
  return (
    <div className="footer-field">
      <span className="footer-label">{label}</span>
      <span className="footer-value">{value}</span>
    </div>
  );
}

function mapSalaryToSlip(salary) {
  const employee = salary.employee || {};
  const bankDetails = employee.bankDetails || {};
  const basicSalary = toSlipAmount(salary.baseSalary);
  const bonus = toSlipAmount(salary.bonus);
  const absenceDeduction = toSlipAmount(salary.absenceDeduction);
  const excessCLDeduction = 0;
  const advanceSalaryDeduction = toSlipAmount(salary.advanceDeduction);
  const ledgerSalaryDeduction = toSlipAmount(salary.ledgerDeduction);
  const savedTotalDeduction = toSlipAmount(salary.totalDeduction);
  const savedNetSalary = toSlipAmount(salary.netSalary);
  const grossEarnings = roundSlipAmount(basicSalary + bonus);
  const visibleDeductionsBeforePf = roundSlipAmount(absenceDeduction + excessCLDeduction + advanceSalaryDeduction);
  const pfAmount = resolvePfAmount({
    explicitPfAmount: salary.pfAmount,
    savedTotalDeduction,
    savedNetSalary,
    grossEarnings,
    visibleDeductionsBeforePf
  });
  const totalDeductions = roundSlipAmount(
    visibleDeductionsBeforePf + (pfAmount > 0 ? pfAmount : 0)
  );
  const balanceAfterDeductions = roundSlipAmount(grossEarnings - totalDeductions);
  const netSalary = roundSlipAmount(Math.max(balanceAfterDeductions, 0));

  return {
    employeeName: employee.name || salary.employeeId,
    employeeId: salary.employeeId,
    designation: employee.role || "Employee",
    department: employee.department || "Not recorded",
    bankAccount: bankDetails.accountNumber || "Not recorded",
    ifscCode: bankDetails.ifscCode || "Not recorded",
    monthYear: `${monthName(salary.month)} ${salary.year}`,
    slipId: buildSlipId(salary),
    basicSalary,
    bonus,
    grossEarnings,
    absenceDeduction,
    excessCLDeduction,
    advanceSalaryDeduction,
    ledgerSalaryDeduction,
    pfAmount,
    totalDeductions,
    balanceAfterDeductions,
    netSalary,
    status: salary.status === "Paid" ? "Paid" : "Unpaid",
    paymentDate: salary.paymentDate ? formatDate(salary.paymentDate) : "Unpaid",
    remarks: salary.notes?.trim() || "-"
  };
}

function toSlipAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? roundSlipAmount(Math.max(number, 0)) : 0;
}

function resolvePfAmount({ explicitPfAmount, savedTotalDeduction, savedNetSalary, grossEarnings, visibleDeductionsBeforePf }) {
  const pfAmount = toSlipAmount(explicitPfAmount);
  if (pfAmount > 0) return pfAmount;

  const pfFromTotalDeduction = roundSlipAmount(savedTotalDeduction - visibleDeductionsBeforePf);
  if (pfFromTotalDeduction > 0) return pfFromTotalDeduction;

  const pfFromNetSalary = roundSlipAmount(grossEarnings - savedNetSalary - visibleDeductionsBeforePf);
  return pfFromNetSalary > 0 ? pfFromNetSalary : 0;
}

function roundSlipAmount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildSlipId(salary) {
  const month = String(salary.month || 1).padStart(2, "0");
  const suffix = String(salary._id || salary.employeeId || "001").slice(-3).toUpperCase().padStart(3, "0");
  return `SBIC/${salary.year}/${month}/${suffix}`;
}

function formatSlipCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function numberToWords(value) {
  let num = Math.max(Number(value) || 0, 0);
  if (num === 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(input) {
    let n = input;
    let result = "";

    if (n >= 100) {
      result += `${ones[Math.floor(n / 100)]} Hundred `;
      n %= 100;
      if (n > 0) result += "and ";
    }

    if (n >= 20) {
      result += `${tens[Math.floor(n / 10)]} `;
      n %= 10;
    }

    if (n > 0) result += `${ones[n]} `;
    return result;
  }

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore > 0) result += `${convertLessThanThousand(crore)}Crore `;
  if (lakh > 0) result += `${convertLessThanThousand(lakh)}Lakh `;
  if (thousand > 0) result += `${convertLessThanThousand(thousand)}Thousand `;
  result += convertLessThanThousand(num);

  return `${result.trim()} Rupees Only`;
}

const salarySlipCss = `
.salary-slip-preview {
  overflow-x: auto;
  border-radius: 8px;
  background: #f0f2f5;
  padding: 20px;
}

.salary-slip-template,
.salary-slip-template * {
  box-sizing: border-box;
}

.salary-slip-template {
  --primary-slip: #1e3a8a;
  --primary-slip-light: #3b82f6;
  --accent-slip-light: #eef2ff;
  --text-slip-dark: #1a202c;
  --text-slip-medium: #4a5568;
  --text-slip-light: #718096;
  --border-slip: #e2e8f0;
  --border-slip-dark: #cbd5e0;
  --bg-slip-light: #f7fafc;
  --bg-slip-white: #ffffff;
  --success-slip: #38a169;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
  background: var(--bg-slip-white);
  box-shadow: 0 4px 24px rgba(30, 58, 138, 0.14);
  color: var(--text-slip-dark);
  font-family: Poppins, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.salary-slip-template .salary-slip {
  width: 100%;
  height: 148.5mm;
  overflow: hidden;
  position: relative;
  border-bottom: 1.5px dashed var(--border-slip-dark);
  padding: 10mm 12mm 8mm;
}

.salary-slip-template .blank-half {
  width: 100%;
  height: 148.5mm;
  position: relative;
}

.salary-slip-template .cut-line-label {
  position: absolute;
  top: -8px;
  right: 12mm;
  color: var(--text-slip-light);
  font-size: 7px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.salary-slip-template .watermark {
  position: absolute;
  z-index: 0;
  top: 50%;
  left: 50%;
  width: 220px;
  height: 220px;
  opacity: 0.04;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.salary-slip-template .watermark img,
.salary-slip-template .logo-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.salary-slip-template .slip-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid var(--primary-slip);
  padding-bottom: 8px;
}

.salary-slip-template .logo-container {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  overflow: hidden;
  border: 1.5px solid var(--border-slip);
  border-radius: 50%;
  background: #fff;
}

.salary-slip-template .header-info {
  flex: 1;
}

.salary-slip-template .school-name {
  color: var(--primary-slip);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1.2;
  text-transform: uppercase;
}

.salary-slip-template .school-address {
  margin-top: 2px;
  color: var(--text-slip-medium);
  font-size: 8.5px;
  font-weight: 400;
}

.salary-slip-template .school-affiliation {
  margin-top: 1px;
  color: var(--text-slip-medium);
  font-size: 7px;
}

.salary-slip-template .slip-title-block {
  flex-shrink: 0;
  text-align: right;
}

.salary-slip-template .slip-title {
  color: var(--primary-slip);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.salary-slip-template .slip-meta {
  margin-top: 3px;
  color: var(--text-slip-light);
  font-size: 8px;
}

.salary-slip-template .slip-meta span {
  display: block;
}

.salary-slip-template .employee-section {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  border: 1px solid #dbe9f7;
  border-radius: 4px;
  background: var(--accent-slip-light);
  padding: 7px 10px;
}

.salary-slip-template .employee-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px 20px;
}

.salary-slip-template .emp-field {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.salary-slip-template .emp-label {
  flex-shrink: 0;
  color: var(--text-slip-light);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  white-space: nowrap;
}

.salary-slip-template .emp-value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-slip-dark);
  font-size: 9.5px;
  font-weight: 600;
}

.salary-slip-template .financials {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
}

.salary-slip-template .fin-column {
  min-height: 0;
}

.salary-slip-template .fin-column:first-child {
  border-right: 1px solid var(--border-slip);
}

.salary-slip-template .fin-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-slip);
  padding: 5px 10px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.salary-slip-template .earnings-header {
  background: #f0fff4;
  color: #276749;
}

.salary-slip-template .deductions-header {
  background: #fff5f5;
  color: #9b2c2c;
}

.salary-slip-template .fin-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #f7fafc;
  padding: 4px 10px;
  font-size: 9px;
}

.salary-slip-template .fin-row:last-child {
  border-bottom: none;
}

.salary-slip-template .fin-row-label {
  color: var(--text-slip-medium);
  font-weight: 400;
}

.salary-slip-template .fin-row-value {
  color: var(--text-slip-dark);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.salary-slip-template .fin-total-row {
  display: flex;
  justify-content: space-between;
  border-top: 1.5px solid var(--border-slip-dark);
  background: var(--bg-slip-light);
  padding: 5px 10px;
  font-size: 9.5px;
  font-weight: 700;
}

.salary-slip-template .total-earnings {
  color: #276749;
}

.salary-slip-template .total-deductions {
  color: #9b2c2c;
}

.salary-slip-template .balance-after-deductions {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  margin-top: 7px;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
  background: #f8fafc;
  padding: 5px 10px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.salary-slip-template .balance-positive {
  color: #1a365d;
}

.salary-slip-template .balance-negative {
  border-color: #fed7d7;
  background: #fff5f5;
  color: #9b2c2c;
}

.salary-slip-template .net-salary-section {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  border-radius: 4px;
  background: var(--primary-slip);
  padding: 7px 12px;
}

.salary-slip-template .net-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.salary-slip-template .net-amount {
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.salary-slip-template .net-words {
  margin-top: 1px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 7.5px;
  font-style: italic;
}

.salary-slip-template .remarks-section {
  position: relative;
  z-index: 1;
  margin-top: 6px;
}

.salary-slip-template .remarks-label {
  margin-bottom: 2px;
  color: var(--text-slip-light);
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.salary-slip-template .remarks-text {
  min-height: 12px;
  border-bottom: 1px solid var(--border-slip);
  padding: 3px 0;
  color: var(--text-slip-medium);
  font-size: 8px;
}

.salary-slip-template .slip-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;
}

.salary-slip-template .footer-left {
  display: flex;
  gap: 16px;
}

.salary-slip-template .footer-field {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.salary-slip-template .footer-label {
  color: var(--text-slip-light);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.salary-slip-template .footer-value {
  color: var(--text-slip-dark);
  font-size: 9px;
  font-weight: 600;
}

.salary-slip-template .status-paid,
.salary-slip-template .status-pending {
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 8px;
  font-weight: 700;
}

.salary-slip-template .status-paid {
  border: 1px solid #c6f6d5;
  background: #f0fff4;
  color: var(--success-slip);
}

.salary-slip-template .status-pending {
  border: 1px solid #fefcbf;
  background: #fffff0;
  color: #d69e2e;
}

.salary-slip-template .signature-block {
  text-align: center;
}

.salary-slip-template .signature-line {
  width: 100px;
  margin-bottom: 2px;
  border-top: 1px solid var(--text-slip-medium);
}

.salary-slip-template .signature-label {
  color: var(--text-slip-light);
  font-size: 7px;
  font-weight: 500;
}

.salary-slip-template .stamp-signature-wrap {
  position: relative;
  text-align: center;
}

.salary-slip-template .signature-img {
  display: block;
  width: 80px;
  height: auto;
  margin: 0 auto -8px;
  opacity: 0.85;
}

.salary-slip-template .stamp-img {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 50%;
  width: 60px;
  height: 60px;
  object-fit: contain;
  opacity: 0.7;
  transform: translateX(-50%);
}

.salary-slip-template .pay-mode-toggle {
  display: inline-flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border-slip);
  border-radius: 4px;
}

.salary-slip-template .pay-mode-printed {
  display: none;
}

.salary-slip-template .mode-btn {
  border: 0;
  background: var(--bg-slip-light);
  color: var(--text-slip-light);
  cursor: pointer;
  padding: 3px 8px;
  font-family: Inter, sans-serif;
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.salary-slip-template .mode-btn:first-child {
  border-right: 1px solid var(--border-slip);
}

.salary-slip-template .mode-btn:hover {
  background: #e2e8f0;
}

.salary-slip-template .mode-btn.active {
  background: var(--primary-slip);
  color: #fff;
}

.salary-slip-template .system-note {
  position: relative;
  z-index: 1;
  margin-top: 6px;
  color: var(--text-slip-light);
  font-size: 6.5px;
  font-style: italic;
  text-align: center;
}

@media (max-width: 900px) {
  .salary-slip-preview {
    padding: 12px;
  }

  .salary-slip-template {
    transform-origin: top left;
  }
}

@media print {
  @page {
    size: A4;
    margin: 0;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  body * {
    visibility: hidden !important;
  }

  .salary-slip-screen,
  .salary-slip-screen * {
    visibility: visible !important;
  }

  .salary-slip-screen {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .salary-slip-preview {
    overflow: visible !important;
    padding: 0 !important;
    border-radius: 0 !important;
    background: #fff !important;
  }

  .salary-slip-screen .no-print {
    display: none !important;
    visibility: hidden !important;
  }

  .salary-slip-template {
    width: 210mm !important;
    height: 297mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    page-break-after: always;
  }

  .salary-slip-template .salary-slip {
    height: 148.5mm !important;
  }

  .salary-slip-template .blank-half {
    height: 148.5mm !important;
  }

  .salary-slip-template .pay-mode-printed {
    display: inline !important;
  }

  .salary-slip-template .pay-mode-toggle {
    display: none !important;
  }

  .salary-slip-template .signature-img,
  .salary-slip-template .stamp-img,
  .salary-slip-template .watermark,
  .salary-slip-template .net-salary-section,
  .salary-slip-template .employee-section,
  .salary-slip-template .earnings-header,
  .salary-slip-template .deductions-header,
  .salary-slip-template .balance-after-deductions,
  .salary-slip-template .fin-total-row,
  .salary-slip-template .status-paid,
  .salary-slip-template .status-pending {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
