import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  enquiryApi,
  studentApi,
} from "../services/api";

import {
  Panel,
  Stats,
  Badge,
  Pagination,
} from "../components/Ui";

// ======================================================
// STATUS HELPER
// ======================================================

function statusOf(row = {}) {
  return String(
    row.status ??
      row.final_status ??
      row.finalStatus ??
      "Pending"
  ).trim();
}

// ======================================================
// NORMALIZED STATUS
// ======================================================

function normalizedStatus(row = {}) {
  return statusOf(row)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// COMPLETED STATUS CHECK
// ======================================================

function isCompleted(row = {}) {
  return normalizedStatus(row) === "completed";
}

// ======================================================
// UNIQUE KEY HELPER
// ======================================================

function keyOf(row = {}) {
  return (
    row.mobile ||
    row.mobile_no ||
    row.phone ||
    row.id ||
    `${row.candidate_name || row.name || ""}-${
      row.course || row.course_name || ""
    }`
  );
}

// ======================================================
// NORMALIZE MOBILE
// ======================================================

function normalizeMobile(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);
}

// ======================================================
// CATEGORY HELPER
// ======================================================

function categoryOf(value) {
  const name =
    typeof value === "object"
      ? value?.name
      : value;

  const normalized = String(
    name || "Other"
  ).trim();

  if (
    normalized
      .toLowerCase()
      .includes("data analytics")
  ) {
    return "Data Analytics / DS";
  }

  return normalized || "Other";
}

// ======================================================
// DATE HELPER
// Supports:
// YYYY-MM-DD
// DD/MM/YYYY
// DD-MM-YYYY
// ISO date
// ======================================================

function getDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return null;
  }

  const indianDateMatch =
    stringValue.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
    );

  if (indianDateMatch) {
    const day = Number(
      indianDateMatch[1]
    );

    const month =
      Number(indianDateMatch[2]) - 1;

    const year = Number(
      indianDateMatch[3]
    );

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  const date =
    new Date(stringValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

// ======================================================
// NUMBER / MONEY HELPER
// ======================================================

function getNumberValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const cleaned = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;
}

// ======================================================
// GET PAID FEE
// ======================================================

function getPaidFee(student = {}) {
  const possibleValues = [
    student.paidFee,
    student.paid_fee,
    student.paid,
    student.amount_paid,
    student.payment_amount,
    student.paymentAmount,
    student.fee_paid,
    student.feePaid,
    student.paid_amount,
    student.paidAmount,
    student.amount,
    student.advance_paid,
    student.advancePaid,
    student.total_paid,
    student.totalPaid,
  ];

  for (
    const value of possibleValues
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return getNumberValue(
        value
      );
    }
  }

  return 0;
}

// ======================================================
// GET BALANCE FEE
// ======================================================

function getBalanceFee(student = {}) {
  const possibleValues = [
    student.balanceFee,
    student.balance_fee,
    student.balance,
    student.remaining_fee,
    student.remainingFee,
    student.pending_fee,
    student.pendingFee,
    student.amount_remaining,
    student.amountRemaining,
  ];

  for (
    const value of possibleValues
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return getNumberValue(
        value
      );
    }
  }

  return 0;
}

// ======================================================
// GET TOTAL FEE
// ======================================================

function getTotalFee(
  student = {},
  paidFee = 0,
  balanceFee = 0
) {
  const possibleValues = [
    student.totalFee,
    student.total_fee,
    student.course_fee,
    student.courseFee,
    student.total_amount,
    student.totalAmount,
    student.fee,
    student.fees,
  ];

  for (
    const value of possibleValues
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const number =
        getNumberValue(value);

      if (number > 0) {
        return number;
      }
    }
  }

  return (
    paidFee + balanceFee
  );
}

// ======================================================
// GET NAME
// ======================================================

function getName(row = {}) {
  return (
    row.name ||
    row.candidate_name ||
    row.student_name ||
    row.studentName ||
    ""
  );
}

// ======================================================
// GET MOBILE
// ======================================================

function getMobile(row = {}) {
  return (
    row.mobile ||
    row.mobile_no ||
    row.phone ||
    row.contact_number ||
    row.contactNumber ||
    ""
  );
}

// ======================================================
// GET CATEGORY
// ======================================================

function getCategory(row = {}) {
  return (
    row.category ||
    row.category_name ||
    row.categoryName ||
    ""
  );
}

// ======================================================
// GET COURSE
// ======================================================

function getCourse(row = {}) {
  return (
    row.course ||
    row.course_name ||
    row.courseName ||
    ""
  );
}

// ======================================================
// GET JOIN DATE
// ======================================================

function getJoinDate(row = {}) {
  return (
    row.joinDate ||
    row.join_date ||
    row.joiningDate ||
    row.joining_date ||
    row.joined_date ||
    row.completed_date ||
    row.completion_date ||
    row.date ||
    row.created_at ||
    row.createdAt ||
    null
  );
}

// ======================================================
// GET PAYMENT DATE
// ======================================================

function getPaymentDate(row = {}) {
  return (
    row.paymentDate ||
    row.payment_date ||
    row.paidDate ||
    row.paid_date ||
    row.feeDate ||
    row.fee_date ||
    row.paymentDateTime ||
    row.payment_datetime ||
    row.payment_date_time ||
    row.paid_on ||
    row.paidOn ||
    row.completed_date ||
    row.completion_date ||
    row.created_at ||
    row.createdAt ||
    getJoinDate(row) ||
    null
  );
}

// ======================================================
// GET DUE DATE
// ======================================================

function getDueDate(row = {}) {
  return (
    row.dueDate ||
    row.due_date ||
    row.feeDueDate ||
    row.fee_due_date ||
    row.paymentDueDate ||
    row.payment_due_date ||
    row.balanceDueDate ||
    row.balance_due_date ||
    row.nextPaymentDate ||
    row.next_payment_date ||
    row.nextDueDate ||
    row.next_due_date ||
    row.fee_due ||
    null
  );
}

// ======================================================
// NORMALIZE STUDENT
// ======================================================

function normalizeStudent(
  student = {}
) {
  const paidFee =
    getPaidFee(student);

  const balanceFee =
    getBalanceFee(student);

  const totalFee =
    getTotalFee(
      student,
      paidFee,
      balanceFee
    );

  const joinDate =
    getJoinDate(student);

  const paymentDate =
    getPaymentDate(student);

  const dueDate =
    getDueDate(student);

  return {
    ...student,

    id: student.id,

    name: getName(student),

    mobile: getMobile(student),

    city:
      student.city ||
      "",

    category:
      getCategory(student),

    course:
      getCourse(student),

    paidFee,

    balanceFee,

    totalFee,

    dueDate,

    joinDate,

    paymentDate,

    status: statusOf(
      student
    ),
  };
}

// ======================================================
// CHECK LAST N DAYS
// ======================================================

function isWithinLastDays(
  dateValue,
  days
) {
  const date =
    getDateValue(dateValue);

  if (!date) {
    return false;
  }

  const now =
    new Date();

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const cutOff =
    new Date(today);

  cutOff.setDate(
    cutOff.getDate() -
      (days - 1)
  );

  return (
    date >= cutOff &&
    date <= now
  );
}

// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(value) {
  const date =
    getDateValue(value);

  if (!date) {
    return "-";
  }

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const year =
    date.getFullYear();

  return `${day}/${month}/${year}`;
}

// ======================================================
// DASHBOARD
// ======================================================

export default function Dashboard() {

  // ====================================================
  // STATE
  // ====================================================

  const [rows, setRows] =
    useState([]);

  const [query, setQuery] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [students, setStudents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [currentYear, setCurrentYear] =
    useState(
      new Date().getFullYear()
    );

  // ====================================================
  // AUTOMATIC YEAR UPDATE
  // ====================================================

  useEffect(() => {

    const checkYear = () => {

      const year =
        new Date().getFullYear();

      setCurrentYear(
        previousYear =>
          previousYear === year
            ? previousYear
            : year
      );
    };

    const timer =
      setInterval(
        checkYear,
        60 * 1000
      );

    return () => {
      clearInterval(timer);
    };

  }, []);

  // ====================================================
  // LOAD DASHBOARD DATA
  // ====================================================

  const loadDashboardData =
    useCallback(
      async (
        showLoader = true
      ) => {

        if (showLoader) {
          setLoading(true);
        }

        try {

          const [
            enquiryResponse,
            studentResponse,
          ] = await Promise.all([
            enquiryApi.list(),
            studentApi.list(),
          ]);

          // ==================================================
          // ENQUIRIES
          // ==================================================

          const enquiryIncoming =
            enquiryResponse?.data
              ?.results ||
            enquiryResponse?.data ||
            [];

          const enquiryList =
            Array.isArray(
              enquiryIncoming
            )
              ? enquiryIncoming
              : [];

          const uniqueEnquiries =
            new Map();

          enquiryList.forEach(
            row => {
              uniqueEnquiries.set(
                String(
                  keyOf(row)
                ),
                row
              );
            }
          );

          setRows(
            Array.from(
              uniqueEnquiries.values()
            )
          );

          // ==================================================
          // STUDENTS
          // ==================================================

          const studentIncoming =
            studentResponse?.data
              ?.results ||
            studentResponse?.data ||
            [];

          const studentList =
            Array.isArray(
              studentIncoming
            )
              ? studentIncoming
              : [];

          const uniqueStudents =
            new Map();

          studentList.forEach(
            student => {

              const normalized =
                normalizeStudent(
                  student
                );

              const key =
                normalized.id ||
                normalizeMobile(
                  normalized.mobile
                ) ||
                `${normalized.name}-${normalized.course}`;

              uniqueStudents.set(
                String(key),
                normalized
              );
            }
          );

          setStudents(
            Array.from(
              uniqueStudents.values()
            )
          );

        } catch (error) {

          console.error(
            "Dashboard data loading error:",
            error
          );

          if (showLoader) {
            setRows([]);
            setStudents([]);
          }

        } finally {

          if (showLoader) {
            setLoading(false);
          }

        }

      },
      []
    );

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {

    loadDashboardData(true);

  }, [
    loadDashboardData,
  ]);

  // ====================================================
  // AUTO REFRESH DASHBOARD
  // ====================================================

  useEffect(() => {

    const handleFocus = () => {
      loadDashboardData(false);
    };

    const handleVisibilityChange =
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {
          loadDashboardData(false);
        }
      };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const refreshTimer =
      setInterval(
        () => {

          if (
            document.visibilityState ===
            "visible"
          ) {
            loadDashboardData(false);
          }

        },
        30000
      );

    return () => {

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      clearInterval(
        refreshTimer
      );

    };

  }, [
    loadDashboardData,
  ]);

  // ====================================================
  // ENQUIRY DATA
  // ====================================================

  const currentRows =
    rows;

  // ====================================================
  // FILTERED ENQUIRIES
  // ====================================================

  const filtered =
    currentRows.filter(
      row => {

        const searchText = `
          ${getName(row)}
          ${getMobile(row)}
          ${row.city || ""}
        `.toLowerCase();

        const rowStatus =
          normalizedStatus(row);

        const isCompletedRow =
          rowStatus ===
          "completed";

        return (
          searchText.includes(
            query.toLowerCase()
          ) &&
          (
            !status ||
            rowStatus ===
              status.toLowerCase()
          ) &&
          !isCompletedRow
        );
      }
    );

  // ====================================================
  // PAGINATION
  // ====================================================

  const visibleRows =
    filtered.slice(
      (page - 1) * 5,
      page * 5
    );

  // ====================================================
  // ENQUIRY COUNT
  // ====================================================

  const enquiryCount =
    value => {

      return currentRows.filter(
        row =>
          normalizedStatus(
            row
          ) ===
          value
            .toLowerCase()
            .trim()
      ).length;
    };

  // ====================================================
  // STUDENT DATA
  // ====================================================

  const studentEntries =
    useMemo(() => {

      return students.map(
        normalizeStudent
      );

    }, [students]);

  // ====================================================
  // COMPLETED ENQUIRIES
  // ====================================================

  const completedEnquiries =
    useMemo(() => {

      return currentRows.filter(
        row =>
          isCompleted(row)
      );

    }, [currentRows]);

  // ====================================================
  // CREATE COMPLETED STUDENTS
  // ====================================================

  const completedStudents =
    useMemo(() => {

      const result =
        new Map();

      studentEntries.forEach(
        student => {

          const studentMobile =
            normalizeMobile(
              student.mobile
            );

          const matchedEnquiry =
            completedEnquiries.find(
              enquiry => {

                const enquiryMobile =
                  normalizeMobile(
                    getMobile(enquiry)
                  );

                if (
                  studentMobile &&
                  enquiryMobile &&
                  studentMobile ===
                    enquiryMobile
                ) {
                  return true;
                }

                if (
                  student.id &&
                  enquiry.id &&
                  String(
                    student.id
                  ) ===
                    String(
                      enquiry.id
                    )
                ) {
                  return true;
                }

                const studentName =
                  String(
                    student.name || ""
                  )
                    .trim()
                    .toLowerCase();

                const enquiryName =
                  String(
                    getName(enquiry) ||
                      ""
                  )
                    .trim()
                    .toLowerCase();

                const studentCourse =
                  String(
                    student.course ||
                      ""
                  )
                    .trim()
                    .toLowerCase();

                const enquiryCourse =
                  String(
                    getCourse(enquiry) ||
                      ""
                  )
                    .trim()
                    .toLowerCase();

                return (
                  studentName &&
                  enquiryName &&
                  studentName ===
                    enquiryName &&
                  (
                    !studentCourse ||
                    !enquiryCourse ||
                    studentCourse ===
                      enquiryCourse
                  )
                );
              }
            );

          if (!matchedEnquiry) {
            return;
          }

          const enquiryPaid =
            getPaidFee(
              matchedEnquiry
            );

          const enquiryPaymentDate =
            getPaymentDate(
              matchedEnquiry
            );

          const currentStudentPaidFee =
            getPaidFee(
              student
            );

          const currentStudentBalanceFee =
            getBalanceFee(
              student
            );

          const currentStudentTotalFee =
            getTotalFee(
              student,
              currentStudentPaidFee,
              currentStudentBalanceFee
            );

          const completedStudent = {

            ...student,

            status:
              "Completed",

            name:
              student.name ||
              getName(
                matchedEnquiry
              ),

            mobile:
              student.mobile ||
              getMobile(
                matchedEnquiry
              ),

            city:
              student.city ||
              matchedEnquiry.city ||
              "",

            category:
              student.category ||
              getCategory(
                matchedEnquiry
              ),

            course:
              student.course ||
              getCourse(
                matchedEnquiry
              ),

            paidFee:
              currentStudentPaidFee,

            balanceFee:
              currentStudentBalanceFee,

            totalFee:
              currentStudentTotalFee >
              0
                ? currentStudentTotalFee
                : getTotalFee(
                    matchedEnquiry,
                    enquiryPaid,
                    0
                  ),

            joinDate:
              student.joinDate ||
              getJoinDate(
                matchedEnquiry
              ),

            paymentDate:
              student.paymentDate ||
              enquiryPaymentDate,

            dueDate:
              student.dueDate ||
              getDueDate(
                matchedEnquiry
              ),
          };

          const key =
            normalizeMobile(
              completedStudent.mobile
            ) ||
            completedStudent.id ||
            `${completedStudent.name}-${completedStudent.course}`;

          result.set(
            String(key),
            completedStudent
          );
        }
      );

      // ==================================================
      // COMPLETED ENQUIRY WITHOUT STUDENT RECORD
      // ==================================================

      completedEnquiries.forEach(
        enquiry => {

          const mobile =
            normalizeMobile(
              getMobile(enquiry)
            );

          const name =
            getName(enquiry);

          const course =
            getCourse(enquiry);

          const key =
            mobile ||
            enquiry.id ||
            `${name}-${course}`;

          const existing =
            result.get(
              String(key)
            );

          if (existing) {
            return;
          }

          const paidFee =
            getPaidFee(enquiry);

          const balanceFee =
            getBalanceFee(enquiry);

          const totalFee =
            getTotalFee(
              enquiry,
              paidFee,
              balanceFee
            );

          result.set(
            String(key),
            {

              ...enquiry,

              id:
                enquiry.id,

              name,

              mobile:
                getMobile(enquiry),

              city:
                enquiry.city ||
                "",

              category:
                getCategory(enquiry),

              course,

              paidFee,

              balanceFee,

              totalFee,

              dueDate:
                getDueDate(
                  enquiry
                ),

              joinDate:
                getJoinDate(
                  enquiry
                ),

              paymentDate:
                getPaymentDate(
                  enquiry
                ),

              status:
                "Completed",
            }
          );
        }
      );

      return Array.from(
        result.values()
      );

    }, [
      studentEntries,
      completedEnquiries,
    ]);

  // ====================================================
  // COUNTS
  // ====================================================

  const positiveCount =
    enquiryCount("Positive");

  const pendingCount =
    enquiryCount("Pending");

  const negativeCount =
    enquiryCount("Negative");

  const completedCount =
    enquiryCount("Completed");

  const totalEnquiries =
    positiveCount +
    pendingCount +
    negativeCount +
    completedCount;

  // ====================================================
  // OVERDUE FEES
  // ====================================================

  const allOverdueFees =
    useMemo(() => {

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      return studentEntries
        .filter(
          student => {

            const dueDate =
              getDateValue(
                student.dueDate
              );

            const balanceFee =
              getBalanceFee(
                student
              );

            if (!dueDate) {
              return false;
            }

            if (
              balanceFee <= 0
            ) {
              return false;
            }

            return (
              dueDate < today
            );
          }
        )
        .sort(
          (a, b) => {

            const dateA =
              getDateValue(
                a.dueDate
              );

            const dateB =
              getDateValue(
                b.dueDate
              );

            return (
              dateA - dateB
            );
          }
        );

    }, [
      studentEntries,
    ]);

  const overdueFees =
    allOverdueFees.slice(
      0,
      4
    );

  // ====================================================
  // GET STUDENT INCOME DATE
  // ====================================================

  const getStudentIncomeDate =
    student => {

      return (
        student.paymentDate ||
        student.joinDate ||
        null
      );
    };

  // ====================================================
  // LAST 15 DAYS STUDENTS
  // ====================================================

  const last15DaysStudents =
    completedStudents.filter(
      student =>
        isWithinLastDays(
          getStudentIncomeDate(
            student
          ),
          15
        )
    );

  // ====================================================
  // LAST 30 DAYS STUDENTS
  // ====================================================

  const last30DaysStudents =
    completedStudents.filter(
      student =>
        isWithinLastDays(
          getStudentIncomeDate(
            student
          ),
          30
        )
    );

  // ====================================================
  // CURRENT YEAR STUDENTS
  // ====================================================

  const yearlyStudents =
    completedStudents.filter(
      student => {

        const dateValue =
          getDateValue(
            getStudentIncomeDate(
              student
            )
          );

        if (!dateValue) {
          return false;
        }

        return (
          dateValue.getFullYear() ===
          currentYear
        );
      }
    );

  // ====================================================
  // INCOME
  // ====================================================

  const last15DaysIncome =
    last15DaysStudents.reduce(
      (sum, student) =>
        sum +
        getNumberValue(
          student.paidFee
        ),
      0
    );

  const last30DaysIncome =
    last30DaysStudents.reduce(
      (sum, student) =>
        sum +
        getNumberValue(
          student.paidFee
        ),
      0
    );

  const yearlyIncome =
    yearlyStudents.reduce(
      (sum, student) =>
        sum +
        getNumberValue(
          student.paidFee
        ),
      0
    );

  // ====================================================
  // DOWNLOAD INCOME
  // ====================================================

  const downloadIncome =
    (
      label,
      downloadRows
    ) => {

      const header = [
        "Student Name",
        "Mobile",
        "Category",
        "Course",
        "Join Date",
        "Payment Date",
        "Paid Fee",
      ];

      const csv = [
        header.join(","),

        ...downloadRows.map(
          row =>
            [
              row.name,
              row.mobile || "",
              categoryOf(
                row.category
              ),
              row.course || "",
              row.joinDate || "",
              row.paymentDate || "",
              row.paidFee || 0,
            ]
              .map(
                value =>
                  `"${String(
                    value
                  ).replace(
                    /"/g,
                    '""'
                  )}"`
              )
              .join(",")
        ),
      ].join("\n");

      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `${label
          .toLowerCase()
          .replace(
            /\s+/g,
            "-"
          )}.csv`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(
        url
      );
    };

  // ====================================================
  // DOWNLOAD BUTTON
  // ====================================================

  const downloadButton =
    (
      label,
      downloadRows
    ) => (

      <button
        type="button"
        className="secondary small"
        aria-label={`Download ${label}`}
        title={`Download ${label}`}
        style={{
          minWidth: "38px",
          width: "38px",
          height: "38px",
          padding: "0",
          display:
            "inline-flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          fontSize: "18px",
        }}
        onClick={() =>
          downloadIncome(
            label,
            downloadRows
          )
        }
      >
        ⭳
      </button>
    );

  // ====================================================
  // INCOME CARDS
  // ====================================================

  const incomeCards = [

    {
      icon: "⚡",
      color: "green",

      label:
        "Last 15 Days",

      value:
        `₹${last15DaysIncome.toLocaleString(
          "en-IN"
        )}`,

      sub:
        "Total Paid Amount",

      action:
        downloadButton(
          "15 Days Income",
          last15DaysStudents
        ),
    },

    {
      icon: "▣",
      color: "blue",

      label:
        "Last 30 Days",

      value:
        `₹${last30DaysIncome.toLocaleString(
          "en-IN"
        )}`,

      sub:
        "Total Paid Amount",

      action:
        downloadButton(
          "30 Days Income",
          last30DaysStudents
        ),
    },

    {
      icon: "▥",
      color: "purple",

      label:
        `Year ${currentYear}`,

      value:
        `₹${yearlyIncome.toLocaleString(
          "en-IN"
        )}`,

      sub:
        "Total Paid Amount",

      action:
        downloadButton(
          `${currentYear} Income`,
          yearlyStudents
        ),
    },

  ];

  // ====================================================
  // RECENT ENQUIRY ROW
  // ====================================================

  const recentRow =
    (
      row,
      index
    ) => [

      index + 1,

      getName(row),

      getMobile(row),

      row.city || "",

      categoryOf(
        getCategory(row)
      ),

      getCourse(row),

      row.next_followup_date ||
        "",

      statusOf(row),
    ];

  // ====================================================
  // STATS
  // ====================================================

  const statsItems = [

    {
      icon: "▣",
      color: "blue",

      label:
        "Total Enquiries",

      value:
        totalEnquiries,
    },

    {
      icon: "✓",
      color: "green",

      label:
        "Positive",

      value:
        positiveCount,

      sub: "",
    },

    {
      icon: "◷",
      color: "orange",

      label:
        "Pending",

      value:
        pendingCount,

      sub: "",
    },

    {
      icon: "↓",
      color: "red",

      label:
        "Negative",

      value:
        negativeCount,

      sub: "",
    },

    {
      icon: "♟",
      color: "purple",

      label:
        "Completed",

      value:
        completedCount,

      sub: "",
    },

    ...incomeCards.map(
      item => ({

        icon:
          item.icon,

        color:
          item.color,

        label:
          item.label,

        value:
          item.value,

        sub:
          item.sub,

        action:
          item.action,

      })
    ),

  ];

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <>

      {/* ==================================================
          DASHBOARD STATS
      ================================================== */}

      <Stats
        items={
          statsItems
        }
      />

      {/* ==================================================
          DASHBOARD GRID
      ================================================== */}

      <div className="dashboard-grid">

        {/* ==================================================
            OVERDUE FEES
        ================================================== */}

        <Panel
          title="Overdue Fees"
          subtitle={`${allOverdueFees.length} students have overdue fees`}
        >

          {overdueFees.length ? (

            overdueFees.map(
              (
                student,
                index
              ) => (

                <div
                  className="follow-item"
                  key={
                    `${student.id || normalizeMobile(
                      student.mobile
                    )}-${index}`
                  }
                >

                  <div>

                    <strong>
                      {
                        student.name ||
                        "Unknown Student"
                      }
                    </strong>

                    <small>
                      {
                        student.course ||
                        "Course not available"
                      }
                    </small>

                    <small>
                      Mobile:{" "}
                      {
                        student.mobile ||
                        "-"
                      }
                    </small>

                    <small>
                      Due Date:{" "}
                      {
                        formatDate(
                          student.dueDate
                        )
                      }
                    </small>

                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "flex-end",
                      gap: "4px",
                    }}
                  >

                    {/* ==================================================
                        BALANCE DUE AMOUNT - RED
                    ================================================== */}

                    <strong
                      style={{
                        fontSize:
                          "15px",

                        color:
                          "#dc2626",

                        fontWeight:
                          "700",
                      }}
                    >
                      ₹
                      {getNumberValue(
                        student.balanceFee
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                    <small>
                      Balance Due
                    </small>

                    <Badge
                      status="Due"
                    />

                  </div>

                </div>

              )
            )

          ) : (

            <div className="empty">
              No overdue fees.
            </div>

          )}

          {allOverdueFees.length >
            4 && (

            <Link
              className="link-btn"
              to="/students"
            >
              View all students
            </Link>

          )}

        </Panel>

        {/* ==================================================
            OVERDUE FOLLOW UPS
        ================================================== */}

        <Panel
          title="Overdue Follow-ups"
          subtitle={`${currentRows.filter(
            row => {

              const rowStatus =
                normalizedStatus(
                  row
                );

              if (
                [
                  "completed",
                  "negative",
                ].includes(
                  rowStatus
                )
              ) {
                return false;
              }

              if (
                !row.next_followup_date
              ) {
                return false;
              }

              const followupDate =
                getDateValue(
                  row.next_followup_date
                );

              if (!followupDate) {
                return false;
              }

              return (
                followupDate <
                new Date()
              );

            }
          ).length} follow-ups overdue`}
        >

          {(() => {

            const today =
              new Date();

            const allOverdue =
              currentRows.filter(
                row => {

                  const rowStatus =
                    normalizedStatus(
                      row
                    );

                  if (
                    [
                      "completed",
                      "negative",
                    ].includes(
                      rowStatus
                    )
                  ) {
                    return false;
                  }

                  if (
                    !row.next_followup_date
                  ) {
                    return false;
                  }

                  const followupDate =
                    getDateValue(
                      row.next_followup_date
                    );

                  if (!followupDate) {
                    return false;
                  }

                  return (
                    followupDate <
                    today
                  );

                }
              );

            const overdue =
              allOverdue.slice(
                0,
                4
              );

            return overdue.length ? (

              overdue.map(
                (
                  row,
                  index
                ) => (

                  <div
                    className="follow-item"
                    key={`${keyOf(
                      row
                    )}-${index}`}
                  >

                    <div>

                      <strong>
                        {
                          getName(
                            row
                          )
                        }
                      </strong>

                      <small>
                        {
                          getCourse(
                            row
                          )
                        }
                      </small>

                      <small>
                        Due{" "}
                        {
                          row.next_followup_date
                        }
                      </small>

                    </div>

                    <Badge
                      status={statusOf(
                        row
                      )}
                    />

                  </div>

                )
              )

            ) : (

              <div className="empty">
                No overdue
                follow-ups.
              </div>

            );

          })()}

        </Panel>

      </div>

      {/* ==================================================
          RECENT ENQUIRIES
      ================================================== */}

      <Panel
        title="Recent Enquiries"
        action={
          <Link
            className="link-btn"
            to="/enquiry-list"
          >
            View All
          </Link>
        }
        className="table-panel"
      >

        {/* ==================================================
            FILTERS
        ================================================== */}

        <div className="dashboard-filters">

          <input
            type="text"
            placeholder="Search candidate, mobile or city..."
            value={query}
            onChange={
              event => {

                setQuery(
                  event.target.value
                );

                setPage(1);

              }
            }
          />

          <select
            value={status}
            onChange={
              event => {

                setStatus(
                  event.target.value
                );

                setPage(1);

              }
            }
          >

            <option value="">
              All Status
            </option>

            {[
              "Positive",
              "Pending",
              "Low",
              "Hold",
              "Negative",
              "Completed",
            ].map(
              item => (

                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>

              )
            )}

          </select>

        </div>

        {/* ==================================================
            TABLE
        ================================================== */}

        <div className="table-scroll">

          <table>

            <thead>

              <tr>

                {[
                  "ID",
                  "Candidate",
                  "Mobile",
                  "City",
                  "Category",
                  "Course",
                  "Follow-up",
                  "Status",
                ].map(
                  header => (

                    <th
                      key={
                        header
                      }
                    >
                      {
                        header
                      }
                    </th>

                  )
                )}

              </tr>

            </thead>

            <tbody>

              {visibleRows.map(
                (
                  row,
                  index
                ) => {

                  const values =
                    recentRow(
                      row,
                      (page - 1) *
                        5 +
                        index
                    );

                  return (

                    <tr
                      key={`${keyOf(
                        row
                      )}-${index}`}
                    >

                      {values
                        .slice(
                          0,
                          7
                        )
                        .map(
                          (
                            value,
                            cell
                          ) => (

                            <td
                              key={
                                cell
                              }
                            >
                              {
                                value
                              }
                            </td>

                          )
                        )}

                      <td>

                        <Badge
                          status={statusOf(
                            row
                          )}
                        />

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

        {/* ==================================================
            EMPTY
        ================================================== */}

        {!loading &&
          filtered.length ===
            0 && (

          <div className="empty">
            No enquiries
            match these
            filters.
          </div>

        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading && (

          <div className="empty">
            Loading
            dashboard...
          </div>

        )}

        {/* ==================================================
            PAGINATION
        ================================================== */}

        <Pagination
          page={page}
          setPage={setPage}
          total={
            filtered.length
          }
        />

      </Panel>

    </>
  );
} 