import * as XLSX from "xlsx";

/* ── Sample / Blank Excel template download ────────────── */

export function downloadSampleEmployeeExcel(isBlank = false) {
    const headers = [
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

    let rows = [];

    if (isBlank) {
        // 100 empty rows
        for (let i = 0; i < 100; i++) {
            rows.push(Array(headers.length).fill(""));
        }
    } else {
        // Sample rows
        rows = [
            [
                "Ramesh Kumar",
                "Suresh Kumar",
                "Teacher",
                "Mathematics",
                "9876543210",
                "15/01/2026",
                "45000",
                "1234567890123",
                "SBIN0001234",
                "Active",
                "123 Main Road, Mirzapur, UP"
            ],
            [
                "Sunita Devi",
                "Rajesh Prasad",
                "Staff",
                "Administration",
                "9876543211",
                "01/06/2025",
                "30000",
                "9876543210987",
                "BKID0001234",
                "Active",
                "456 Station Road, Mirzapur, UP"
            ]
        ];
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Name
        { wch: 20 }, // Father/Spouse Name
        { wch: 15 }, // Role
        { wch: 25 }, // Subject / Department
        { wch: 15 }, // Phone
        { wch: 25 }, // Joining Date
        { wch: 15 }, // Base Salary
        { wch: 20 }, // Account Number
        { wch: 15 }, // IFSC Code
        { wch: 20 }, // Employment Status
        { wch: 40 }  // Address
    ];

    // Freeze top row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

    XLSX.utils.book_append_sheet(wb, ws, "Employees");

    // Write file
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = isBlank ? "blank-employee-template.xlsx" : "sample-employee-template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
}
