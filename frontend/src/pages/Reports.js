import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import {
  enquiryApi,
  studentApi,
} from "../services/api";

import {
  Panel,
  Stats,
} from "../components/Ui";

// ======================================================
// MONTHS
// ======================================================

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ======================================================
// STATUS HELPERS
// ======================================================

function statusOf(row) {
  return String(
    row.status ||
      row.final_status ||
      row.finalStatus ||
      "Pending"
  ).trim();
}

// ======================================================
// ENQUIRY DATE
// ======================================================

function enquiryDateOf(row) {
  return (
    row.enquiry_date ||
    row.created_at ||
    row.date ||
    ""
  );
}

// ======================================================
// STUDENT JOIN DATE
// ======================================================

function joinDateOf(row) {
  return (
    row.joinDate ||
    row.join_date ||
    row.date ||
    row.created_at ||
    ""
  );
}

// ======================================================
// COMPLETED STATUS
// ======================================================

function isCompleted(row) {
  const status = statusOf(row)
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();

  return (
    status === "completed" ||
    status === "complated" ||
    status === "complete" ||
    status === "complate"
  );
}

// ======================================================
// NUMBER HELPER
// ======================================================

function numberValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const cleaned = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

// ======================================================
// STUDENT PAID FEE
// ======================================================

function paidFeeOf(row) {
  return numberValue(
    row.paidFee ??
      row.paid_fee ??
      0
  );
}

// ======================================================
// STUDENT TOTAL FEE
// ======================================================

function totalFeeOf(row) {
  return numberValue(
    row.totalFee ??
      row.total_fee ??
      0
  );
}

// ======================================================
// STUDENT BALANCE FEE
// ======================================================

function balanceFeeOf(row) {
  return numberValue(
    row.balanceFee ??
      row.balance_fee ??
      0
  );
}

// ======================================================
// FORMAT MONEY
// ======================================================

function formatAmount(value) {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(value) {
  if (!value) return "";

  const date = parseDate(value);

  if (!date) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN");
}

// ======================================================
// DATE PARSER
// ======================================================

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const stringValue = String(value).trim();

  // DD-MM-YYYY
  const dashParts =
    stringValue.split("-");

  if (
    dashParts.length === 3 &&
    dashParts[0].length === 2 &&
    dashParts[1].length === 2 &&
    dashParts[2].length === 4
  ) {
    const parsed = new Date(
      Number(dashParts[2]),
      Number(dashParts[1]) - 1,
      Number(dashParts[0])
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // DD/MM/YYYY
  const slashParts =
    stringValue.split("/");

  if (
    slashParts.length === 3 &&
    slashParts[0].length === 2 &&
    slashParts[1].length === 2 &&
    slashParts[2].length === 4
  ) {
    const parsed = new Date(
      Number(slashParts[2]),
      Number(slashParts[1]) - 1,
      Number(slashParts[0])
    );

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Normal JavaScript date
  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function Reports() {
  const [enquiryRows, setEnquiryRows] =
    useState([]);

  const [studentRows, setStudentRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const today = new Date();

  const currentYear =
    today.getFullYear();

  const currentMonth =
    today.getMonth();

  const [selectedYear, setSelectedYear] =
    useState(currentYear);

  // ====================================================
  // LOAD DATA
  // ====================================================

  useEffect(() => {
    setLoading(true);

    Promise.all([
      enquiryApi.list(),
      studentApi.list(),
    ])
      .then(
        ([
          enquiryResponse,
          studentResponse,
        ]) => {
          const enquiries =
            enquiryResponse?.data?.results ||
            enquiryResponse?.data ||
            [];

          const students =
            studentResponse?.data?.results ||
            studentResponse?.data ||
            [];

          setEnquiryRows(
            Array.isArray(enquiries)
              ? enquiries
              : []
          );

          setStudentRows(
            Array.isArray(students)
              ? students
              : []
          );
        }
      )
      .catch((error) => {
        console.error(
          "Reports loading error:",
          error
        );

        setEnquiryRows([]);
        setStudentRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ====================================================
  // UNIQUE ENQUIRIES
  // ====================================================

  const uniqueEnquiries = [
    ...new Map(
      enquiryRows.map((row) => [
        row.mobile ||
          row.id ||
          row.candidate_name ||
          row.name ||
          Math.random(),
        row,
      ])
    ).values(),
  ];

  // ====================================================
  // ENQUIRY YEAR ROWS
  // ====================================================

  const yearEnquiries =
    selectedYear > currentYear
      ? []
      : uniqueEnquiries.filter(
          (row) => {
            const date = parseDate(
              enquiryDateOf(row)
            );

            if (!date) return false;

            return (
              date.getFullYear() ===
              selectedYear
            );
          }
        );

  // ====================================================
  // COMPLETED ENQUIRIES
  // ====================================================

  const completedRows =
    yearEnquiries.filter(isCompleted);

  const completedCount =
    completedRows.length;

  // ====================================================
  // STUDENTS / JOINED
  // ====================================================

  const yearStudents =
    selectedYear > currentYear
      ? []
      : studentRows.filter(
          (student) => {
            const date = parseDate(
              joinDateOf(student)
            );

            if (!date) return false;

            return (
              date.getFullYear() ===
              selectedYear
            );
          }
        );

  // ====================================================
  // JOINED COUNT
  // ====================================================

  const joinedCount =
    yearStudents.length;

  // ====================================================
  // TOTAL ENQUIRIES
  //
  // IMPORTANT:
  // Total Enquiries = COMPLETED ONLY
  // ====================================================

  const totalEnquiries =
    completedCount;

  // ====================================================
  // CONVERSION
  //
  // Joined / Completed
  // ====================================================

  const conversion =
    totalEnquiries > 0
      ? (
          (joinedCount /
            totalEnquiries) *
          100
        ).toFixed(2)
      : "0.00";

  // ====================================================
  // MONTH VISIBILITY
  // ====================================================

  const monthCount =
    selectedYear < currentYear
      ? 12
      : selectedYear === currentYear
        ? currentMonth + 1
        : 0;

  const visibleMonths =
    MONTH_LABELS
      .slice(0, monthCount)
      .map((label, index) => ({
        label,
        month: index,
        year: selectedYear,
      }));

  // ====================================================
  // MONTHLY COMPLETED
  //
  // IMPORTANT:
  // Monthly Enquiries = COMPLETED ONLY
  // ====================================================

  const monthlyCompleted =
    visibleMonths.map((month) => {
      return yearEnquiries.filter(
        (row) => {
          const date = parseDate(
            enquiryDateOf(row)
          );

          if (!date) return false;

          return (
            date.getFullYear() ===
              month.year &&
            date.getMonth() ===
              month.month &&
            isCompleted(row)
          );
        }
      ).length;
    });

  // ====================================================
  // MONTHLY JOINED
  // ====================================================

  const monthlyJoined =
    visibleMonths.map((month) => {
      return yearStudents.filter(
        (student) => {
          const date = parseDate(
            joinDateOf(student)
          );

          if (!date) return false;

          return (
            date.getFullYear() ===
              month.year &&
            date.getMonth() ===
              month.month
          );
        }
      ).length;
    });

  // ====================================================
  // MONTHLY ENQUIRIES
  //
  // IMPORTANT:
  // DO NOT ADD JOINED HERE
  //
  // Monthly Enquiries = Completed only
  // ====================================================

  const monthlyEnquiries =
    monthlyCompleted;

  const maxMonthlyEnquiries =
    Math.max(
      1,
      ...monthlyEnquiries
    );

  // ====================================================
  // YEAR ENQUIRY TOTAL
  //
  // Completed only
  // ====================================================

  const yearEnquiryTotal =
    monthlyEnquiries.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  // ====================================================
  // MONTHLY AMOUNT
  // ====================================================

  const monthlyAmounts =
    visibleMonths.map((month) => {
      return yearStudents
        .filter((student) => {
          const date = parseDate(
            joinDateOf(student)
          );

          if (!date) return false;

          return (
            date.getFullYear() ===
              month.year &&
            date.getMonth() ===
              month.month
          );
        })
        .reduce(
          (sum, student) =>
            sum +
            paidFeeOf(student),
          0
        );
    });

  const maxMonthlyAmount =
    Math.max(
      1,
      ...monthlyAmounts
    );

  const yearlyAmount =
    monthlyAmounts.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  // ====================================================
  // MONTHLY STATUS SUMMARY
  // ====================================================

  const monthEnquiries =
    selectedYear > currentYear
      ? []
      : selectedYear === currentYear
        ? uniqueEnquiries.filter(
            (row) => {
              const date =
                parseDate(
                  enquiryDateOf(row)
                );

              if (!date) return false;

              return (
                date.getFullYear() ===
                  selectedYear &&
                date.getMonth() ===
                  currentMonth
              );
            }
          )
        : yearEnquiries;

  // ====================================================
  // MONTHLY JOINED COUNT FOR STATUS
  // ====================================================

  const monthStudents =
    selectedYear > currentYear
      ? []
      : selectedYear === currentYear
        ? yearStudents.filter(
            (student) => {
              const date =
                parseDate(
                  joinDateOf(student)
                );

              if (!date) return false;

              return (
                date.getFullYear() ===
                  selectedYear &&
                date.getMonth() ===
                  currentMonth
              );
            }
          )
        : yearStudents;

  // ====================================================
  // STATUS COUNT
  // ====================================================

  const countStatus = (value) => {
    if (value === "Completed") {
      return monthEnquiries.filter(
        isCompleted
      ).length;
    }

    if (value === "Joined") {
      return monthStudents.length;
    }

    return monthEnquiries.filter(
      (row) =>
        statusOf(row)
          .toLowerCase() ===
        value.toLowerCase()
    ).length;
  };

  // ====================================================
  // AVAILABLE YEARS
  // ====================================================

  const enquiryYears =
    uniqueEnquiries
      .map((row) => {
        const date = parseDate(
          enquiryDateOf(row)
        );

        return date
          ? date.getFullYear()
          : null;
      })
      .filter(Boolean);

  const studentYears =
    studentRows
      .map((student) => {
        const date = parseDate(
          joinDateOf(student)
        );

        return date
          ? date.getFullYear()
          : null;
      })
      .filter(Boolean);

  const availableYears = [
    ...new Set([
      ...enquiryYears,
      ...studentYears,
      currentYear,
    ]),
  ]
    .filter(
      (year) => !Number.isNaN(year)
    )
    .sort(
      (a, b) => b - a
    );

  // ====================================================
  // MONTHLY AMOUNT DETAILS
  // ====================================================

  const amountDetails =
    yearStudents
      .map((student) => {
        const date = parseDate(
          joinDateOf(student)
        );

        return {
          studentId:
            student.studentId ||
            student.student_id ||
            student.id ||
            "",

          name:
            student.name ||
            student.candidate_name ||
            "",

          mobile:
            student.mobile ||
            "",

          city:
            student.city ||
            "",

          category:
            student.category ||
            "",

          course:
            student.course ||
            "",

          joinDate: date
            ? date
                .toISOString()
                .split("T")[0]
            : joinDateOf(student),

          month: date
            ? MONTH_LABELS[
                date.getMonth()
              ]
            : "",

          totalFee:
            totalFeeOf(student),

          paidFee:
            paidFeeOf(student),

          balanceFee:
            balanceFeeOf(student),
        };
      })
      .sort((a, b) => {
        const dateA =
          parseDate(a.joinDate);

        const dateB =
          parseDate(b.joinDate);

        if (!dateA || !dateB) {
          return 0;
        }

        return dateA - dateB;
      });

  // ====================================================
  // CSV HELPER
  // ====================================================

  function createCsvDownload(
    csvRows,
    fileName
  ) {
    const csv = csvRows
      .map((row) =>
        row
          .map((value) => {
            return `"${String(
              value ?? ""
            ).replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);
  }

  // ====================================================
  // DOWNLOAD MONTHLY AMOUNT DETAILS
  // ====================================================

  function downloadMonthlyAmountDetails() {
    const csvRows = [];

    csvRows.push([
      "SCOT IT Academy - Monthly Amount Details",
    ]);

    csvRows.push([
      `Year: ${selectedYear}`,
    ]);

    csvRows.push([]);

    csvRows.push([
      "Monthly Amount Summary",
    ]);

    csvRows.push([
      "Month",
      "Joined Students",
      "Paid Amount",
    ]);

    visibleMonths.forEach(
      (month, index) => {
        csvRows.push([
          `${month.label} ${selectedYear}`,
          monthlyJoined[index],
          monthlyAmounts[index],
        ]);
      }
    );

    csvRows.push([]);

    csvRows.push([
      "Year Total",
      joinedCount,
      yearlyAmount,
    ]);

    csvRows.push([]);

    csvRows.push([
      "Student Amount Details",
    ]);

    csvRows.push([
      "Student ID",
      "Student Name",
      "Mobile",
      "City",
      "Category",
      "Course",
      "Join Date",
      "Month",
      "Total Fee",
      "Paid Fee",
      "Balance Fee",
    ]);

    amountDetails.forEach(
      (student) => {
        csvRows.push([
          student.studentId,
          student.name,
          student.mobile,
          student.city,
          student.category,
          student.course,
          student.joinDate,
          student.month,
          student.totalFee,
          student.paidFee,
          student.balanceFee,
        ]);
      }
    );

    createCsvDownload(
      csvRows,
      `SCOT-Monthly-Amount-${selectedYear}.csv`
    );
  }

  // ====================================================
  // DOWNLOAD FULL ENQUIRY REPORT
  // ====================================================

  function downloadExcel() {
    const headers = [
      "Candidate",
      "Mobile",
      "City",
      "Category",
      "Course",
      "Status",
      "Enquiry Date",
    ];

    const values =
      uniqueEnquiries.map(
        (row) => [
          row.candidate_name ||
            row.name ||
            "",

          row.mobile ||
            "",

          row.city ||
            "",

          row.category ||
            "",

          row.course ||
            "",

          isCompleted(row)
            ? "Completed"
            : statusOf(row),

          formatDate(
            enquiryDateOf(row)
          ),
        ]
      );

    const csvRows = [
      [
        "SCOT IT Academy - Enquiry Report",
      ],

      [
        `Year: ${selectedYear}`,
      ],

      [],

      headers,

      ...values,

      [],

      [
        "Total Enquiries",
        totalEnquiries,
      ],

      [
        "Completed",
        completedCount,
      ],

      [
        "Joined",
        joinedCount,
      ],

      [
        "Conversion",
        `${conversion}%`,
      ],

      [
        "Monthly Paid Amount",
        yearlyAmount,
      ],
    ];

    createCsvDownload(
      csvRows,
      `scot-enquiry-report-${selectedYear}.csv`
    );
  }

  // ====================================================
  // DOWNLOAD PDF
  // ====================================================

  function downloadPdf() {
    const pdf = new jsPDF();

    // HEADER

    pdf.setFontSize(18);

    pdf.text(
      "SCOT IT Academy - Enquiry Report",
      14,
      18
    );

    pdf.setFontSize(10);

    pdf.text(
      `Report Year: ${selectedYear}`,
      14,
      26
    );

    // SUMMARY

    pdf.setFontSize(12);

    pdf.text(
      `Total Enquiries: ${totalEnquiries}`,
      14,
      40
    );

    pdf.text(
      `Completed: ${completedCount}`,
      14,
      48
    );

    pdf.text(
      `Joined: ${joinedCount}`,
      14,
      56
    );

    pdf.text(
      `Conversion: ${conversion}%`,
      14,
      64
    );

    pdf.text(
      `Monthly Paid Amount: ${formatAmount(
        yearlyAmount
      )}`,
      14,
      72
    );

    // STATUS SUMMARY

    pdf.setFontSize(14);

    pdf.text(
      "Status Summary",
      14,
      86
    );

    pdf.setFontSize(10);

    const statuses = [
      "Completed",
      "Joined",
      "Pending",
      "Negative",
      "Hold",
      "Low",
    ];

    statuses.forEach(
      (value, index) => {
        pdf.text(
          `${value}: ${countStatus(
            value
          )}`,
          20,
          96 +
            index * 7
        );
      }
    );

    // MONTHLY AMOUNT

    pdf.setFontSize(14);

    pdf.text(
      "Monthly Amount",
      14,
      145
    );

    pdf.setFontSize(10);

    visibleMonths.forEach(
      (month, index) => {
        const y =
          155 +
          index * 7;

        if (y < 280) {
          pdf.text(
            `${month.label}: ${formatAmount(
              monthlyAmounts[index]
            )} | ${monthlyJoined[index]} Joined`,
            20,
            y
          );
        }
      }
    );

    // STUDENT DETAILS

    pdf.addPage();

    pdf.setFontSize(15);

    pdf.text(
      "Monthly Amount Details",
      14,
      18
    );

    pdf.setFontSize(8);

    let detailY = 30;

    amountDetails.forEach(
      (student) => {
        if (detailY > 280) {
          pdf.addPage();

          detailY = 20;
        }

        const text =
          `${student.studentId} | ` +
          `${student.name} | ` +
          `${student.course} | ` +
          `${student.joinDate} | ` +
          `Paid: ${formatAmount(
            student.paidFee
          )} | ` +
          `Balance: ${formatAmount(
            student.balanceFee
          )}`;

        pdf.text(
          text,
          14,
          detailY
        );

        detailY += 7;
      }
    );

    pdf.save(
      `scot-enquiry-report-${selectedYear}.pdf`
    );
  }

  // ====================================================
  // YEAR SELECT
  // ====================================================

  const yearSelect = (
    <select
      value={selectedYear}
      onChange={(e) =>
        setSelectedYear(
          Number(e.target.value)
        )
      }
      style={{
        padding: "6px 12px",
        border:
          "1px solid #d9e2ec",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        background: "#fff",
        color: "#172033",
        cursor: "pointer",
        outline: "none",
        minWidth: "90px",
        boxShadow:
          "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {availableYears.map(
        (year) => (
          <option
            key={year}
            value={year}
          >
            {year}
          </option>
        )
      )}
    </select>
  );

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#718096",
        }}
      >
        Loading reports...
      </div>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <>
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="report-header">
        <div>
          <h2>
            Enquiry Reports
          </h2>

          <p>
            Current enquiry performance
            and conversion
          </p>
        </div>

        <div>
          <button
            className="secondary"
            onClick={
              downloadExcel
            }
          >
            Export Excel
          </button>

          {" "}

          <button
            className="primary"
            onClick={
              downloadPdf
            }
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* ==================================================
          STAT CARDS
      ================================================== */}

      <Stats
        items={[
          {
            label:
              "Total Enquiries",

            value:
              totalEnquiries,

            icon: "▣",

            // sub:
            //   "Completed enquiries only",
          },

          {
            label:
              "Completed",

            value:
              completedCount,

            icon: "✓",

            color: "green",

            sub:
              `Year ${selectedYear}`,
          },

          {
            label:
              "Joined",

            value:
              joinedCount,

            icon: "♟",

            color: "purple",

            sub:
              `Year ${selectedYear}`,
          },

          // Conversion card can be enabled if needed
          // {
          //   label: "Conversion",
          //   value: `${conversion}%`,
          //   icon: "%",
          //   color: "orange",
          //   sub: "Joined / Completed",
          // },
        ]}
      />

      {/* ==================================================
          FIRST ROW
      ================================================== */}

      <div className="dashboard-grid">

        {/* ==================================================
            MONTHLY ENQUIRIES
        ================================================== */}

        <Panel
          title="Monthly Enquiries"
          subtitle={
            selectedYear >
            currentYear
              ? `No data yet — ${selectedYear} hasn't started`
              : `${yearEnquiryTotal} completed enquiries in ${selectedYear}`
          }
          action={
            yearSelect
          }
        >
          {visibleMonths.length >
          0 ? (
            <div className="monthly-chart">

              {visibleMonths.map(
                (
                  month,
                  index
                ) => {
                  // IMPORTANT:
                  // This is COMPLETED count only
                  const total =
                    monthlyCompleted[
                      index
                    ];

                  return (
                    <div
                      key={`${month.year}-${month.month}`}
                      style={{
                        position:
                          "relative",
                      }}
                    >

                      {/* MONTH */}

                      <span>
                        {
                          month.label
                        }
                      </span>

                      {/* BAR */}

                      <i
                        style={{
                          height:
                            `${Math.max(
                              5,
                              (
                                total /
                                maxMonthlyEnquiries
                              ) *
                                100
                            )}%`,
                        }}
                      />

                      {/* COMPLETED COUNT */}

                      <b
                        style={{
                          display:
                            "block",
                          marginTop:
                            "5px",
                        }}
                      >
                        {total}
                      </b>

                    </div>
                  );
                }
              )}

            </div>
          ) : (
            <div
              style={{
                height:
                  "200px",
                display:
                  "flex",
                flexDirection:
                  "column",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                color:
                  "#a0aec0",
                gap:
                  "8px",
              }}
            >
              <span
                style={{
                  fontSize:
                    "36px",
                }}
              >
                📅
              </span>

              <strong
                style={{
                  fontSize:
                    "15px",
                  color:
                    "#718096",
                }}
              >
                {
                  selectedYear
                }{" "}
                hasn't started
                yet
              </strong>

              <p
                style={{
                  fontSize:
                    "13px",
                  color:
                    "#a0aec0",
                }}
              >
                Monthly completed
                enquiry bars will
                appear automatically.
              </p>
            </div>
          )}
        </Panel>

        {/* ==================================================
            STATUS SUMMARY
        ================================================== */}

        <Panel
          title="Status Summary"
          subtitle={
            selectedYear >
            currentYear
              ? `No data — ${selectedYear} hasn't started`
              : selectedYear ===
                currentYear
                ? `${MONTH_LABELS[currentMonth]} ${currentYear} · current month`
                : `Full year ${selectedYear}`
          }
        >
          <div className="report-list">

            {[
              "Completed",
              "Joined",
              "Pending",
              "Negative",
              "Hold",
              "Low",
            ].map(
              (value) => (
                <div
                  key={value}
                >
                  <span>
                    {value}
                  </span>

                  <strong>
                    {
                      countStatus(
                        value
                      )
                    }
                  </strong>
                </div>
              )
            )}

          </div>
        </Panel>

      </div>

      {/* ==================================================
          MONTHLY AMOUNT
      ================================================== */}

      <div
        style={{
          marginTop:
            "22px",
        }}
      >
        <Panel
          title="Monthly Amount"
          subtitle={
            selectedYear >
            currentYear
              ? `No amount data — ${selectedYear} hasn't started`
              : `${formatAmount(
                  yearlyAmount
                )} collected from ${joinedCount} joined students`
          }
          action={
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "10px",
              }}
            >
              <strong
                style={{
                  fontSize:
                    "14px",
                  color:
                    "#172033",
                }}
              >
                Total:{" "}
                {formatAmount(
                  yearlyAmount
                )}
              </strong>

              <button
                type="button"
                className="secondary"
                onClick={
                  downloadMonthlyAmountDetails
                }
                style={{
                  padding:
                    "7px 12px",
                  fontSize:
                    "13px",
                  whiteSpace:
                    "nowrap",
                }}
              >
                Download Details
              </button>
            </div>
          }
        >

          {visibleMonths.length >
          0 ? (
            <div
              style={{
                width:
                  "100%",
                overflowX:
                  "auto",
                paddingBottom:
                  "10px",
              }}
            >
              <div
                style={{
                  minWidth:
                    Math.max(
                      700,
                      visibleMonths.length *
                        75
                    ) +
                    "px",

                  height:
                    "340px",

                  display:
                    "flex",

                  alignItems:
                    "flex-end",

                  gap:
                    "18px",

                  padding:
                    "25px 20px 10px",

                  borderBottom:
                    "1px solid #e2e8f0",
                }}
              >

                {visibleMonths.map(
                  (
                    month,
                    index
                  ) => {
                    const amount =
                      monthlyAmounts[
                        index
                      ];

                    const joined =
                      monthlyJoined[
                        index
                      ];

                    const barHeight =
                      amount > 0
                        ? Math.max(
                            8,
                            (
                              amount /
                              maxMonthlyAmount
                            ) *
                              245
                          )
                        : 5;

                    return (
                      <div
                        key={`${month.year}-${month.month}-amount`}
                        style={{
                          flex:
                            "1",

                          minWidth:
                            "50px",

                          height:
                            "100%",

                          display:
                            "flex",

                          flexDirection:
                            "column",

                          alignItems:
                            "center",

                          justifyContent:
                            "flex-end",
                        }}
                      >

                        <strong
                          style={{
                            fontSize:
                              "11px",

                            color:
                              "#172033",

                            marginBottom:
                              "6px",

                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatAmount(
                            amount
                          )}
                        </strong>

                        <div
                          style={{
                            width:
                              "32px",

                            height:
                              `${barHeight}px`,

                            background:
                              "#8b5cf6",

                            borderRadius:
                              "7px 7px 0 0",

                            transition:
                              "height 0.3s ease",
                          }}
                          title={`${month.label} ${selectedYear}: ${formatAmount(
                            amount
                          )}`}
                        />

                        <span
                          style={{
                            marginTop:
                              "8px",

                            fontSize:
                              "12px",

                            fontWeight:
                              "600",

                            color:
                              "#4a5568",
                          }}
                        >
                          {
                            month.label
                          }
                        </span>

                        <small
                          style={{
                            marginTop:
                              "3px",

                            fontSize:
                              "10px",

                            color:
                              "#718096",
                          }}
                        >
                          {
                            joined
                          }{" "}
                          joined
                        </small>

                      </div>
                    );
                  }
                )}

              </div>
            </div>
          ) : (
            <div
              style={{
                height:
                  "250px",

                display:
                  "flex",

                flexDirection:
                  "column",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                color:
                  "#a0aec0",

                gap:
                  "8px",
              }}
            >
              <span
                style={{
                  fontSize:
                    "36px",
                }}
              >
                ₹
              </span>

              <strong
                style={{
                  fontSize:
                    "15px",

                  color:
                    "#718096",
                }}
              >
                No amount data yet
              </strong>

              <p
                style={{
                  fontSize:
                    "13px",

                  color:
                    "#a0aec0",
                }}
              >
                Monthly amount
                will appear
                automatically
                when students
                are added.
              </p>
            </div>
          )}

        </Panel>
      </div>
    </>
  );
}