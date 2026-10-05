import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import {
  enquiryApi,
  studentApi,
} from "../services/api";
import { Panel } from "../components/Ui";

// ======================================================
// MONTHS
// ======================================================

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ======================================================
// STATUS HELPER
// ======================================================

function statusOf(row) {
  return String(
    row.status || row.final_status || row.finalStatus || "Pending"
  ).trim();
}

// ======================================================
// DATE HELPERS
// ======================================================

function enquiryDateOf(row) {
  return row.enquiry_date || row.created_at || row.date || "";
}

function joinDateOf(row) {
  return row.joinDate || row.join_date || row.date || row.created_at || "";
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();

  // DD-MM-YYYY
  const dp = s.split("-");
  if (dp.length === 3 && dp[0].length === 2 && dp[1].length === 2 && dp[2].length === 4) {
    const d = new Date(Number(dp[2]), Number(dp[1]) - 1, Number(dp[0]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY
  const sp = s.split("/");
  if (sp.length === 3 && sp[0].length === 2 && sp[1].length === 2 && sp[2].length === 4) {
    const d = new Date(Number(sp[2]), Number(sp[1]) - 1, Number(sp[0]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  if (!value) return "";
  const d = parseDate(value);
  return d ? d.toLocaleDateString("en-IN") : String(value);
}

// ======================================================
// STATUS CHECK
// ======================================================

function isCompleted(row) {
  const s = statusOf(row).toLowerCase().replace(/\s+/g, "").trim();
  return s === "completed" || s === "complated" || s === "complete" || s === "complate";
}

// ======================================================
// FEE HELPERS
// ======================================================

function numberValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/₹/g, "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function paidFeeOf(row)    { return numberValue(row.paidFee    ?? row.paid_fee    ?? 0); }
function totalFeeOf(row)   { return numberValue(row.totalFee   ?? row.total_fee   ?? 0); }
function balanceFeeOf(row) { return numberValue(row.balanceFee ?? row.balance_fee ?? 0); }

function formatAmount(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ======================================================
// LEAD SOURCE CONSTANTS
// ======================================================

const LEAD_SOURCE_ORDER = [
  "Direct Visit",
  "Website Lead",
  "Own Referral",
  "Staff Referral",
  "FB/Insta Leads",
  "OT Old Students",
  "SCOT Students",
  "JD Leads",
  "Others",
];

const LEAD_SOURCE_COLORS = {
  "Direct Visit":    "#3b82f6",
  "Website Lead":    "#10b981",
  "Own Referral":    "#f59e0b",
  "Staff Referral":  "#8b5cf6",
  "FB/Insta Leads":  "#ec4899",
  "OT Old Students": "#06b6d4",
  "SCOT Students":   "#f97316",
  "JD Leads":        "#ef4444",
  "Others":          "#a0aec0",
};

// Auto-colour palette for any referred_by values not in the predefined list
const EXTRA_COLORS = [
  "#14b8a6", "#a855f7", "#f43f5e", "#0ea5e9",
  "#84cc16", "#fb923c", "#6366f1", "#d946ef",
  "#22d3ee", "#4ade80", "#fbbf24", "#f87171",
];

// ======================================================
// STATUS COLORS
// ======================================================

const ENQUIRY_STATUS_COLORS = {
  Pending:   "#f97316",
  Positive:  "#10b981",
  Negative:  "#ef4444",
  Hold:      "#2563eb",
  Completed: "#8b5cf6",
};

const STUDENT_STATUS_COLORS = {
  Active:   "#10b981",
  Inactive: "#ef4444",
  Closed:   "#f59e0b",
  Placed:   "#2563eb",
  Other:    "#a0aec0",
};

// ======================================================
// SELECT STYLE HELPER
// ======================================================

const selectStyle = {
  padding: "8px 14px",
  border: "1px solid #d9e2ec",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "600",
  background: "#fff",
  color: "#172033",
  cursor: "pointer",
  outline: "none",
  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
};

// ======================================================
// DONUT CHART COMPONENT
// ======================================================

function DonutChart({ segments, total, centerLabel }) {
  return (
    <svg width="150" height="150" viewBox="0 0 42 42" style={{ display: "block" }}>
      {segments.length === 0 ? (
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
      ) : (
        segments.map((seg, i) => {
          const dash = (seg.pct / 100) * 100;
          const gap  = 100 - dash;
          const rotate = (seg.offset / 100) * 360 - 90;
          return (
            <circle
              key={i}
              cx="21" cy="21" r="15.915"
              fill="transparent"
              stroke={seg.color}
              strokeWidth="6"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset="0"
              style={{ transform: `rotate(${rotate}deg)`, transformOrigin: "21px 21px" }}
            />
          );
        })
      )}
      <text x="21" y="18" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="#172033">Total</text>
      <text x="21" y="24" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#172033">{total}</text>
      <text x="21" y="29" textAnchor="middle" fontSize="3" fill="#718096">{centerLabel}</text>
    </svg>
  );
}

// ======================================================
// BAR CHART ROW COMPONENT
// ======================================================

function BarRow({ label, count, max, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "12px", color: "#4a5568", minWidth: "120px", textAlign: "right" }}>
        {label}
      </span>
      <div style={{ flex: 1, background: "#f0f4f8", borderRadius: "6px", height: "14px", overflow: "hidden" }}>
        <div style={{
          width: `${Math.max(4, (count / max) * 100)}%`,
          height: "100%",
          background: color,
          borderRadius: "6px",
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: "700", color: "#172033", minWidth: "28px", textAlign: "right" }}>
        {count}
      </span>
    </div>
  );
}

// ======================================================
// COMPUTE SEGMENTS HELPER
// ======================================================

function buildSegments(rows, keyFn, colorMap, knownKeys) {
  const counts = {};
  rows.forEach((row) => {
    const value = String(keyFn(row) || "").trim();
    const key = knownKeys.find((item) => item.toLowerCase() === value.toLowerCase()) || knownKeys[knownKeys.length - 1];
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = rows.length || 1;
  let offset = 0;
  return knownKeys
    .filter((k) => counts[k] > 0)
    .map((key) => {
      const pct = (counts[key] / total) * 100;
      const segment = {
        label: key,
        count: counts[key],
        color: colorMap[key] || "#a0aec0",
        pct,
        offset,
      };
      offset += pct;
      return segment;
    });
}

function buildLeadSource(rows, sourceOf) {
  const counts = new Map();
  rows.forEach((row) => {
    const raw = String(sourceOf(row) || "").trim();
    if (!raw) return;
    const known = LEAD_SOURCE_ORDER.find(
      (source) => source.toLowerCase() === raw.toLowerCase()
    );
    const label = known || raw;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const knownSources = LEAD_SOURCE_ORDER
    .filter((source) => counts.has(source))
    .map((source) => ({
      label: source,
      count: counts.get(source),
      color: LEAD_SOURCE_COLORS[source],
    }));

  const extraSources = [...counts.keys()]
    .filter((source) => !LEAD_SOURCE_ORDER.includes(source))
    .sort((first, second) => first.localeCompare(second))
    .map((source, index) => ({
      label: source,
      count: counts.get(source),
      color: EXTRA_COLORS[index % EXTRA_COLORS.length],
    }));

  return [...knownSources, ...extraSources];
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function Reports() {
  const [enquiryRows, setEnquiryRows] = useState([]);
  const [studentRows, setStudentRows] = useState([]);
  const [loading, setLoading]         = useState(true);

  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const currentYear  = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth(); // 0-indexed

  useEffect(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const timeout = window.setTimeout(
      () => setCalendarDate(new Date()),
      nextMonth.getTime() - now.getTime()
    );

    return () => window.clearTimeout(timeout);
  }, [currentYear, currentMonth]);

  // ====================================================
  // FILTER STATE
  // ====================================================

  const [selectedYear,  setSelectedYear]  = useState(currentYear);
  // -1 means "Overall Year"
  const [selectedMonth, setSelectedMonth] = useState(-1);

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    setLoading(true);
    Promise.all([enquiryApi.list(), studentApi.list()])
      .then(([eRes, sRes]) => {
        const enquiries = eRes?.data?.results || eRes?.data || [];
        const students  = sRes?.data?.results || sRes?.data || [];
        setEnquiryRows(Array.isArray(enquiries) ? enquiries : []);
        setStudentRows(Array.isArray(students)  ? students  : []);
      })
      .catch((err) => {
        console.error("Reports loading error:", err);
        setEnquiryRows([]);
        setStudentRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // ====================================================
  // UNIQUE ENQUIRIES (deduplicated by mobile/id)
  // ====================================================

  const uniqueEnquiries = [
    ...new Map(
      enquiryRows.map((row) => [
        row.mobile || row.id || row.candidate_name || row.name || Math.random(),
        row,
      ])
    ).values(),
  ];

  // ====================================================
  // AVAILABLE YEARS  (auto-populated from data)
  // Auto-includes currentYear so 2027 appears when 2026 completes
  // ====================================================

  const dataYears = [
    ...uniqueEnquiries.map((r) => { const d = parseDate(enquiryDateOf(r)); return d ? d.getFullYear() : null; }),
    ...studentRows.map((s)  => { const d = parseDate(joinDateOf(s));      return d ? d.getFullYear() : null; }),
  ].filter(Boolean);

  const availableYears = [...new Set([...dataYears, currentYear])]
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);

  // ====================================================
  // AVAILABLE MONTHS for selected year
  // Up to current month if current year, else all 12
  // ====================================================

  const maxMonthIndex =
    selectedYear < currentYear  ? 11 :
    selectedYear === currentYear ? currentMonth : -1; // future year = no months

  const availableMonths = maxMonthIndex >= 0
    ? MONTH_LABELS.slice(0, maxMonthIndex + 1)
    : [];

  // When year changes, reset month to "Overall Year" if current month is unavailable
  const safeSelectedMonth =
    selectedMonth === -1
      ? -1
      : selectedMonth <= maxMonthIndex
        ? selectedMonth
        : -1;

  // ====================================================
  // FILTER: rows matching selected year + month
  // ====================================================

  function matchesFilter(dateValue) {
    const d = parseDate(dateValue);
    if (!d) return false;
    if (d.getFullYear() !== selectedYear) return false;
    if (safeSelectedMonth !== -1 && d.getMonth() !== safeSelectedMonth) return false;
    return true;
  }

  const filteredEnquiries = uniqueEnquiries.filter((row) =>
    matchesFilter(enquiryDateOf(row))
  );

  const filteredStudents = studentRows.filter((s) =>
    matchesFilter(joinDateOf(s))
  );

  const currentMonthEnquiries = uniqueEnquiries.filter((row) => {
    const date = parseDate(enquiryDateOf(row));
    return date &&
      date.getFullYear() === currentYear &&
      date.getMonth() === currentMonth;
  });

  // ====================================================
  // DERIVED COUNTS
  // ====================================================

  const completedCount = filteredEnquiries.filter(isCompleted).length;
  const positiveCount  = filteredEnquiries.filter((r) => statusOf(r).toLowerCase() === "positive").length;
  const pendingCount   = filteredEnquiries.filter((r) => statusOf(r).toLowerCase() === "pending").length;
  const joinedCount    = filteredStudents.length;
  const totalEnquiries = filteredEnquiries.length;
  const totalStudents  = filteredStudents.length;
  const yearlyAmount   = filteredStudents.reduce((s, st) => s + paidFeeOf(st), 0);
  const statusSummaryCounts = [
    { label: "Completed", count: currentMonthEnquiries.filter(isCompleted).length },
    { label: "Positive", count: currentMonthEnquiries.filter((row) => statusOf(row).toLowerCase() === "positive").length },
    { label: "Pending", count: currentMonthEnquiries.filter((row) => statusOf(row).toLowerCase() === "pending").length },
    { label: "Negative", count: currentMonthEnquiries.filter((row) => statusOf(row).toLowerCase() === "negative").length },
    { label: "Hold", count: currentMonthEnquiries.filter((row) => statusOf(row).toLowerCase() === "hold").length },
  ];

  const conversion = completedCount > 0
    ? ((joinedCount / completedCount) * 100).toFixed(2)
    : "0.00";

  // ====================================================
  // ENQUIRY STATUS DONUT SEGMENTS
  // ====================================================

  const enquiryStatusSegments = buildSegments(
    filteredEnquiries,
    (r) => statusOf(r),
    ENQUIRY_STATUS_COLORS,
    ["Positive", "Pending", "Negative", "Hold", "Completed"]
  );

  // ====================================================
  // STUDENT STATUS DONUT SEGMENTS
  // ====================================================

  const studentStatusSegments = buildSegments(
    filteredStudents,
    (s) => String(s.status || "Active").trim(),
    STUDENT_STATUS_COLORS,
    ["Active", "Inactive", "Closed", "Placed", "Other"]
  );

  // ====================================================
  // LEAD SOURCE
  // ====================================================

  const srcOfEnquiry = (row) => String(
    row.referred_by ||
      row.referredBy ||
      row.lead_source ||
      row.leadSource ||
      ""
  ).trim();

  const srcOfStudent = (row) => {
    let overrideRef;
    try {
      const overrides = JSON.parse(localStorage.getItem("scot_student_overrides") || "{}");
      const keys = [row.id, row.studentId, row.student_id].filter(Boolean);
      for (const k of keys) {
        if (overrides[String(k)]?.referred_by !== undefined) {
          overrideRef = overrides[String(k)].referred_by;
          break;
        }
      }
    } catch {}

    let src = String(
      overrideRef !== undefined
        ? overrideRef
        : (row.referred_by ||
           row.referredBy ||
           row.referral_source ||
           row.referralSource ||
           row.lead_source ||
           row.leadSource ||
           "")
    ).trim();

    return src;
  };

  const enquiryLeadSource = buildLeadSource(filteredEnquiries, srcOfEnquiry);
  const studentLeadSource = buildLeadSource(filteredStudents,  srcOfStudent);
  const maxEnqLead  = Math.max(1, ...enquiryLeadSource.map((s) => s.count));
  const maxStudLead = Math.max(1, ...studentLeadSource.map((s) => s.count));

  // ====================================================
  // MONTHLY BAR DATA (for amount chart — only Overall Year)
  // ====================================================

  const monthCount =
    selectedYear < currentYear  ? 12 :
    selectedYear === currentYear ? currentMonth + 1 : 0;

  const visibleMonths = MONTH_LABELS.slice(0, monthCount).map((label, index) => ({
    label, month: index, year: selectedYear,
  }));

  const monthlyAmounts = visibleMonths.map((m) =>
    studentRows
      .filter((s) => {
        const d = parseDate(joinDateOf(s));
        return d && d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((sum, s) => sum + paidFeeOf(s), 0)
  );

  const monthlyJoined = visibleMonths.map((m) =>
    studentRows.filter((s) => {
      const d = parseDate(joinDateOf(s));
      return d && d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length
  );

  const maxMonthlyAmount = Math.max(1, ...monthlyAmounts);

  // ====================================================
  // AMOUNT DETAILS FOR EXPORT
  // ====================================================

  const amountDetails = filteredStudents
    .map((student) => {
      const d = parseDate(joinDateOf(student));
      return {
        studentId: student.studentId || student.student_id || student.id || "",
        name:      student.name || student.candidate_name || "",
        mobile:    student.mobile || "",
        city:      student.city || "",
        category:  student.category || "",
        course:    student.course || "",
        joinDate:  d ? d.toISOString().split("T")[0] : joinDateOf(student),
        month:     d ? MONTH_LABELS[d.getMonth()] : "",
        totalFee:  totalFeeOf(student),
        paidFee:   paidFeeOf(student),
        balanceFee: balanceFeeOf(student),
      };
    })
    .sort((a, b) => {
      const da = parseDate(a.joinDate), db = parseDate(b.joinDate);
      return (!da || !db) ? 0 : da - db;
    });

  // ====================================================
  // PERIOD LABEL
  // ====================================================

  const periodLabel =
    safeSelectedMonth !== -1
      ? `${MONTH_FULL[safeSelectedMonth]} ${selectedYear}`
      : `${selectedYear} (Overall Year)`;

  // ====================================================
  // CSV HELPER
  // ====================================================

  function createCsvDownload(csvRows, fileName) {
    const csv = csvRows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ====================================================
  // DOWNLOAD EXCEL
  // ====================================================

  function downloadExcel() {
    const values = filteredEnquiries.map((row) => [
      row.candidate_name || row.name || "",
      row.mobile || "",
      row.city || "",
      row.category || "",
      row.course || "",
      isCompleted(row) ? "Completed" : statusOf(row),
      formatDate(enquiryDateOf(row)),
    ]);

    createCsvDownload(
      [
        ["SCOT IT Academy – Enquiry Report"],
        [`Period: ${periodLabel}`],
        [],
        ["Candidate","Mobile","City","Category","Course","Status","Enquiry Date"],
        ...values,
        [],
        ["Total Enquiries", totalEnquiries],
        ["Completed",       completedCount],
        ["Joined",          joinedCount],
        ["Conversion",      `${conversion}%`],
        ["Total Paid",      yearlyAmount],
      ],
      `scot-enquiry-report-${selectedYear}.csv`
    );
  }

  // ====================================================
  // DOWNLOAD MONTHLY AMOUNT
  // ====================================================

  function downloadMonthlyAmountDetails() {
    createCsvDownload(
      [
        ["SCOT IT Academy – Monthly Amount Details"],
        [`Period: ${periodLabel}`],
        [],
        ["Month","Joined Students","Paid Amount"],
        ...visibleMonths.map((m, i) => [
          `${m.label} ${selectedYear}`, monthlyJoined[i], monthlyAmounts[i],
        ]),
        [],
        ["Year Total", joinedCount, yearlyAmount],
        [],
        ["Student Amount Details"],
        ["Student ID","Student Name","Mobile","City","Category","Course","Join Date","Month","Total Fee","Paid Fee","Balance Fee"],
        ...amountDetails.map((s) => [
          s.studentId, s.name, s.mobile, s.city, s.category, s.course,
          s.joinDate, s.month, s.totalFee, s.paidFee, s.balanceFee,
        ]),
      ],
      `SCOT-Monthly-Amount-${selectedYear}.csv`
    );
  }

  // ====================================================
  // DOWNLOAD PDF
  // ====================================================

  function downloadPdf() {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text("SCOT IT Academy – Enquiry Report", 14, 18);
    pdf.setFontSize(10);
    pdf.text(`Period: ${periodLabel}`, 14, 26);
    pdf.setFontSize(12);
    pdf.text(`Total Enquiries: ${totalEnquiries}`, 14, 40);
    pdf.text(`Completed: ${completedCount}`,        14, 48);
    pdf.text(`Joined: ${joinedCount}`,              14, 56);
    pdf.text(`Conversion: ${conversion}%`,          14, 64);
    pdf.text(`Total Paid: ${formatAmount(yearlyAmount)}`, 14, 72);
    pdf.setFontSize(14);
    pdf.text("Status Summary", 14, 86);
    pdf.setFontSize(10);
    pdf.text(`${MONTH_FULL[currentMonth]} ${currentYear}`, 14, 92);
    statusSummaryCounts.forEach(({ label, count }, i) => {
      pdf.text(`${label}: ${count}`, 20, 100 + i * 7);
    });
    pdf.setFontSize(14);
    pdf.text("Monthly Amount", 14, 145);
    pdf.setFontSize(10);
    visibleMonths.forEach((m, i) => {
      const y = 155 + i * 7;
      if (y < 280) {
        pdf.text(`${m.label}: ${formatAmount(monthlyAmounts[i])} | ${monthlyJoined[i]} Joined`, 20, y);
      }
    });
    pdf.addPage();
    pdf.setFontSize(15);
    pdf.text("Amount Details", 14, 18);
    pdf.setFontSize(8);
    let detailY = 30;
    amountDetails.forEach((s) => {
      if (detailY > 280) { pdf.addPage(); detailY = 20; }
      pdf.text(
        `${s.studentId} | ${s.name} | ${s.course} | ${s.joinDate} | Paid: ${formatAmount(s.paidFee)} | Bal: ${formatAmount(s.balanceFee)}`,
        14, detailY
      );
      detailY += 7;
    });
    pdf.save(`scot-enquiry-report-${selectedYear}.pdf`);
  }

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#718096" }}>
        Loading reports...
      </div>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <>
      {/* ================================================
          HEADER
      ================================================ */}

      <div className="report-header">
        <div>
          <h2>Enquiry Reports</h2>
          <p>Current enquiry performance and conversion</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="secondary" onClick={downloadExcel}>Export Excel</button>
          <button className="primary"   onClick={downloadPdf}>Export PDF</button>
        </div>
      </div>

      {/* ================================================
          GLOBAL YEAR + MONTH FILTER
      ================================================ */}

      <div style={{
        display: "flex",
        gap: "16px",
        alignItems: "center",
        flexWrap: "wrap",
        // background: "#fff",
        borderRadius: "14px",
        padding: "16px 20px",
        // boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        // border: "1px solid #e2e8f0",
        marginBottom: "22px",
      }}>

        {/* YEAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#718096", display: "flex", alignItems: "center", gap: "5px" }}>
           Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedMonth(-1);
            }}
            style={selectStyle}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* MONTH */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#718096", display: "flex", alignItems: "center", gap: "5px" }}>
            Month
          </label>
          <select
            value={safeSelectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={-1}>Overall Year</option>
            {availableMonths.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
        </div>

        {/* PERIOD LABEL */}
        <div style={{
          marginLeft: "auto",
          fontSize: "13px",
          fontWeight: "600",
          color: "#4a5568",
          background: "#f0f4f8",
          borderRadius: "8px",
          padding: "6px 14px",
          whiteSpace: "nowrap",
        }}>
          📊 {periodLabel}
        </div>
      </div>

      {/* ================================================
          STAT CARDS
      ================================================ */}

      <div style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "22px",
      }}>
        {[
          { label: "Total Enquiries", value: totalEnquiries, icon: "👥", color: "#3b82f6", bg: "#eff6ff" },
          { label: "Positive",        value: positiveCount,  icon: "👍", color: "#10b981", bg: "#f0fdf4" },
          { label: "Pending",         value: pendingCount,   icon: "⏳", color: "#f59e0b", bg: "#fffbeb" },
          { label: "Completed",       value: completedCount, icon: "✅", color: "#8b5cf6", bg: "#f5f3ff" },
          { label: "Total Students",  value: totalStudents,  icon: "🎓", color: "#06b6d4", bg: "#ecfeff" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              flex: "1",
              minWidth: "150px",
              background: card.bg,
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: `1px solid ${card.color}22`,
            }}
          >
            <span style={{ fontSize: "28px" }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: "13px", color: "#718096", fontWeight: "500" }}>{card.label}</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: card.color, lineHeight: 1.1 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ================================================
          ENQUIRY STATUS DONUT + LEAD SOURCE
      ================================================ */}

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "22px" }}>

        {/* ENQUIRY STATUS DONUT */}
        <div style={{
          flex: "1", minWidth: "300px", background: "#fff",
          borderRadius: "14px", padding: "20px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "#172033", marginBottom: "4px" }}>
            📊 Enquiry Status Distribution
          </div>
          <div style={{ fontSize: "12px", color: "#718096", marginBottom: "16px" }}>
            {totalEnquiries} enquiries · {periodLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0 }}>
              <DonutChart segments={enquiryStatusSegments} total={totalEnquiries} centerLabel="Enquiries" />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              {enquiryStatusSegments.map((seg) => (
                <div key={seg.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 0", borderBottom: "1px solid #f0f4f8", gap: "8px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "#4a5568" }}>{seg.label}</span>
                  </div>
                  <strong style={{ fontSize: "13px", color: "#172033" }}>{seg.count}</strong>
                </div>
              ))}
              {enquiryStatusSegments.length === 0 && (
                <p style={{ color: "#a0aec0", fontSize: "13px" }}>No enquiries for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* ENQUIRY LEAD SOURCE */}
        <div style={{
          flex: "1", minWidth: "300px", background: "#fff",
          borderRadius: "14px", padding: "20px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "#172033", marginBottom: "4px" }}>
            👥 Enquiry Lead Source (Referred By)
          </div>
          <div style={{ fontSize: "12px", color: "#718096", marginBottom: "16px" }}>
            Source breakdown · {periodLabel}
          </div>
          {enquiryLeadSource.length === 0 ? (
            <p style={{ color: "#a0aec0", fontSize: "13px" }}>No lead source data for this period.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {enquiryLeadSource.map((src) => (
                <BarRow key={src.label} label={src.label} count={src.count} max={maxEnqLead} color={src.color} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================
          STUDENT STATUS DONUT + LEAD SOURCE
      ================================================ */}

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "22px" }}>

        {/* STUDENT STATUS DONUT */}
        <div style={{
          flex: "1", minWidth: "300px", background: "#fff",
          borderRadius: "14px", padding: "20px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "#172033", marginBottom: "4px" }}>
            👥 Student Status Distribution
          </div>
          <div style={{ fontSize: "12px", color: "#718096", marginBottom: "16px" }}>
            {totalStudents} students · {periodLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0 }}>
              <DonutChart segments={studentStatusSegments} total={totalStudents} centerLabel="Students" />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              {studentStatusSegments.map((seg) => (
                <div key={seg.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 0", borderBottom: "1px solid #f0f4f8", gap: "8px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "#4a5568" }}>{seg.label}</span>
                  </div>
                  <strong style={{ fontSize: "13px", color: "#172033" }}>{seg.count}</strong>
                </div>
              ))}
              {studentStatusSegments.length === 0 && (
                <p style={{ color: "#a0aec0", fontSize: "13px" }}>No students for this period.</p>
              )}
            </div>
          </div>
        </div>

        {/* STUDENT LEAD SOURCE */}
        <div style={{
          flex: "1", minWidth: "300px", background: "#fff",
          borderRadius: "14px", padding: "20px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "#172033", marginBottom: "4px" }}>
            👥 Student Lead Source (Referred By)
          </div>
          <div style={{ fontSize: "12px", color: "#718096", marginBottom: "16px" }}>
            Source breakdown · {periodLabel}
          </div>
          {studentLeadSource.length === 0 ? (
            <p style={{ color: "#a0aec0", fontSize: "13px" }}>No lead source data for this period.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {studentLeadSource.map((src) => (
                <BarRow key={src.label} label={src.label} count={src.count} max={maxStudLead} color={src.color} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================
          MONTHLY AMOUNT BAR CHART
          Only shown when "Overall Year" is selected
      ================================================ */}

      {safeSelectedMonth === -1 && (
        <div style={{ marginBottom: "22px" }}>
          <Panel
            title="Monthly Amount"
            subtitle={
              visibleMonths.length === 0
                ? `No amount data — ${selectedYear} hasn't started`
                : `${formatAmount(yearlyAmount)} collected from ${joinedCount} students`
            }
            action={
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong style={{ fontSize: "14px", color: "#172033" }}>
                  Total: {formatAmount(yearlyAmount)}
                </strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={downloadMonthlyAmountDetails}
                  style={{ padding: "7px 12px", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  Download Details
                </button>
              </div>
            }
          >
            {visibleMonths.length > 0 ? (
              <div style={{ width: "100%", overflowX: "auto", paddingBottom: "10px" }}>
                <div style={{
                  minWidth: Math.max(700, visibleMonths.length * 75) + "px",
                  height: "340px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "18px",
                  padding: "25px 20px 10px",
                  borderBottom: "1px solid #e2e8f0",
                }}>
                  {visibleMonths.map((month, index) => {
                    const amount = monthlyAmounts[index];
                    const joined = monthlyJoined[index];
                    const barHeight = amount > 0
                      ? Math.max(8, (amount / maxMonthlyAmount) * 245)
                      : 5;
                    return (
                      <div
                        key={`${month.year}-${month.month}-amt`}
                        style={{
                          flex: "1", minWidth: "50px", height: "100%",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "flex-end",
                        }}
                      >
                        <strong style={{ fontSize: "11px", color: "#172033", marginBottom: "6px", whiteSpace: "nowrap" }}>
                          {formatAmount(amount)}
                        </strong>
                        <div style={{
                          width: "32px",
                          height: `${barHeight}px`,
                          background: "#8b5cf6",
                          borderRadius: "7px 7px 0 0",
                          transition: "height 0.3s ease",
                        }} title={`${month.label} ${selectedYear}: ${formatAmount(amount)}`} />
                        <span style={{ marginTop: "8px", fontSize: "12px", fontWeight: "600", color: "#4a5568" }}>
                          {month.label}
                        </span>
                        <small style={{ marginTop: "3px", fontSize: "10px", color: "#718096" }}>
                          {joined} joined
                        </small>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{
                height: "250px", displnItems: "center", justifyContent: "center", color: "#a0aec0", gap: "8px",
              }}>
                <span style={{ fontSize: "36px" }}>₹</span>
                <strong style={{ fontSize: "15px", color: "#718096" }}>No amount data yet</strong>
                <p style={{ fontSize: "13px", color: "#a0aec0" }}>
                  Monthly amount will appear automatically when students are added.
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ================================================
          STATUS SUMMARY TABLE (always shown)
      ================================================ */}

      <div style={{ marginBottom: "22px" }}>
        <Panel title="Status Summary" subtitle={`Enquiry status breakdown · ${MONTH_FULL[currentMonth]} ${currentYear}`}>
          <div className="report-list">
            {statusSummaryCounts.map(({ label, count }) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}