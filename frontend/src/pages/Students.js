import { ResponsiveTable } from "../components/Ui";
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

import {
  studentApi,
  categoryApi,
  enquiryApi,
} from "../services/api";

import {
  Panel,
  Pagination,
} from "../components/Ui";

import {
  REFERRED_BY_OPTIONS,
} from "../data/referralOptions";

// ======================================================
// STATUS OPTIONS
// ======================================================

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Closed",
  "Placed",
];

// ======================================================
// NORMALIZE STATUS
// ======================================================

const normalizeStatus = (status) => {
  const value = String(status || "").trim();

  if (
    !value ||
    value.toLowerCase() === "joined"
  ) {
    return "Active";
  }

  const matched = STATUS_OPTIONS.find(
    (item) =>
      item.toLowerCase() ===
      value.toLowerCase()
  );

  return matched || "Active";
};

// ======================================================
// LOCAL STORAGE PERSISTENCE FOR STUDENT DETAILS
// Ensures Referred By and Comments / Discussion are saved
// immediately and persist across sessions and reloads.
// ======================================================

const STUDENT_OVERRIDES_KEY = "scot_student_overrides";

const getStudentOverrides = () => {
  try {
    const raw = localStorage.getItem(STUDENT_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStudentOverride = (keys = [], data = {}) => {
  try {
    const existing = getStudentOverrides();
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.filter(Boolean).forEach((k) => {
      existing[String(k)] = {
        ...(existing[String(k)] || {}),
        ...data,
      };
    });
    localStorage.setItem(STUDENT_OVERRIDES_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn("Could not save student override:", err);
  }
};

// ======================================================
// INITIAL FORM
// ======================================================

const initialForm = {
  studentId: "",
  name: "",
  course: "",
  mobile: "",
  email: "",
  city: "",
  category: "",
  referred_by: "",
  comments: "",

  totalFee: "",
  paidFee: "",
  staffPayout: "",
  netProfit: 0,
  balanceFee: "",

  dueDate: "",
  joinDate: "",

  status: "Active",
};

// ======================================================
// CALCULATE BALANCE FEE
// ======================================================

const calculateBalanceFee = (
  totalFee,
  paidFee
) => {
  const total = Number(totalFee) || 0;
  const paid = Number(paidFee) || 0;

  return Math.max(total - paid, 0);
};

const calculateNetProfit = (
  paidFee,
  staffPayout
) => Number(paidFee || 0) - Number(staffPayout || 0);

const requirePersistedStudentFinance = (response) => {
  return response?.data?.data || response?.data || {};
};


// ======================================================
// FORMAT DATE
// ======================================================

const formatDateForInput = (date) => {
  if (!date) {
    return "";
  }

  const value = String(date).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.substring(0, 10);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }

  return "";
};

// ======================================================
// STUDENT KEY
// ======================================================

const studentKey = (
  student = {}
) => {
  const identity =
    student.id ||
    `${student.name ||
      student.candidate_name ||
      "student"}-${
      student.mobile ||
      student.mobile_no ||
      student.email ||
      student.course ||
      "unknown"
    }`;

  return String(identity);
};

// ======================================================
// NORMALIZE STUDENT
// ======================================================

const normalize = (
  student = {}
) => {
  const paidFee =
    Number(
      student.paidFee ??
        student.paid_fee ??
        0
    ) || 0;

  const rawTotalFee =
    student.totalFee ??
    student.total_fee;

  const rawBalanceFee =
    Number(
      student.balanceFee ??
        student.balance_fee ??
        0
    ) || 0;

  const totalFee =
    rawTotalFee !== undefined &&
    rawTotalFee !== null &&
    rawTotalFee !== ""
      ? Number(rawTotalFee) || 0
      : paidFee + rawBalanceFee;

  const balanceFee =
    calculateBalanceFee(
      totalFee,
      paidFee
    );

  const rawStaffPayout = Number(
    student.staffPayout ??
      student.staff_payout ??
      0
  );
  const staffPayout = Number.isFinite(rawStaffPayout)
    ? rawStaffPayout
    : 0;
  const rawNetProfit =
    student.netProfit ??
    student.net_profit;
  const netProfit = rawNetProfit === undefined || rawNetProfit === null || rawNetProfit === ""
    ? calculateNetProfit(paidFee, staffPayout)
    : Number(rawNetProfit) || 0;

  const databaseId =
    student.id ??
    student.databaseId ??
    "";

  return {
    ...student,

    id: databaseId,

    studentId:
      student.studentId ||
      student.student_id ||
      "",

    displayStudentId:
      student.displayStudentId ||
      "",

    name:
      student.name ||
      student.candidate_name ||
      "",

    course:
      student.course ||
      "",

    mobile:
      student.mobile ||
      student.mobile_no ||
      "",

    email:
      student.email ||
      "",

    city:
      student.city ||
      "",

    category:
      student.category ||
      student.category_name ||
      student.categoryName ||
      "",

    referred_by: (() => {
      const overrides = getStudentOverrides();
      const keys = [student.id, student.studentId, student.student_id, studentKey(student)].filter(Boolean);
      for (const k of keys) {
        if (overrides[String(k)]?.referred_by !== undefined) {
          return overrides[String(k)].referred_by;
        }
      }
      return (
        student.referred_by ||
        student.referredBy ||
        student.referral_source ||
        student.referralSource ||
        student.lead_source ||
        student.leadSource ||
        ""
      );
    })(),

    comments: (() => {
      const overrides = getStudentOverrides();
      const keys = [student.id, student.studentId, student.student_id, studentKey(student)].filter(Boolean);
      for (const k of keys) {
        if (overrides[String(k)]?.comments !== undefined) {
          return overrides[String(k)].comments;
        }
      }
      return (
        student.comments ||
        student.comment ||
        ""
      );
    })(),

    totalFee,
    paidFee,
    staffPayout,
    netProfit,
    balanceFee,

    dueDate:
      formatDateForInput(
        student.dueDate ||
          student.due_date ||
          ""
      ),

    joinDate:
      formatDateForInput(
        student.joinDate ||
          student.join_date ||
          ""
      ),

    status:
      normalizeStatus(
        student.status ||
          student.final_status ||
          student.finalStatus ||
          "Active"
      ),
  };
};

// ======================================================
// MERGE STUDENTS
// ======================================================

const mergeStudents = (
  studentsList = []
) => {
  const map = new Map();

  studentsList.forEach(
    (student) => {
      const item =
        normalize(student);

      const key =
        studentKey(item);

      if (!map.has(key)) {
        map.set(key, item);
        return;
      }

      map.set(key, {
        ...map.get(key),
        ...item,
      });
    }
  );

  return [
    ...map.values(),
  ];
};

// ======================================================
// FORMAT MONEY
// ======================================================

const formatMoney = (
  value
) => {
  return Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  );
};

// ======================================================
// NORMALIZE CATEGORIES
// ======================================================

const normalizeCategories = (
  response
) => {
  const apiData =
    response?.data
      ?.results ||
    response?.data
      ?.data ||
    response?.data ||
    [];

  if (
    !Array.isArray(
      apiData
    )
  ) {
    return [];
  }

  const categoryNames =
    apiData
      .map((item) => {
        if (
          typeof item ===
          "string"
        ) {
          return item.trim();
        }

        return String(
          item.name ||
            item.category ||
            item.category_name ||
            item.title ||
            ""
        ).trim();
      })
      .filter(Boolean);

  return [
    ...new Set(
      categoryNames
    ),
  ];
};

// ======================================================
// STATUS STYLE
// ======================================================
// ACTIVE  = YELLOW
// INACTIVE = RED
// CLOSED  = GREEN
// PLACED  = BLUE
// ======================================================

const getStatusStyle = (
  status
) => {
  const normalized =
    normalizeStatus(status);

  // ACTIVE - YELLOW
  if (
    normalized ===
    "Active"
  ) {
    return {
      background: "#fff4cc",
      color: "#8a6500",
      border: "1px solid #f2cf55",
    };
  }

  // INACTIVE - RED
  if (
    normalized ===
    "Inactive"
  ) {
    return {
      background: "#fde2e2",
      color: "#b42318",
      border: "1px solid #f5a3a3",
    };
  }

  // CLOSED - GREEN
  if (
    normalized ===
    "Closed"
  ) {
    return {
      background: "#dff6e7",
      color: "#16703c",
      border: "1px solid #8ed3a8",
    };
  }

  // PLACED - BLUE
  return {
    background: "#eaf2ff",
    color: "#175cd3",
    border: "1px solid #a8c7fa",
  };
};

// ======================================================
// STUDENTS COMPONENT
// ======================================================

export default function Students() {

  // ====================================================
  // STUDENTS STATE
  // ====================================================

  const [
    students,
    setStudents,
  ] = useState([]);

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    ...initialForm,
  });

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    exportingExcel,
    setExportingExcel,
  ] = useState(false);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    editingStudent,
    setEditingStudent,
  ] = useState(null);

  // ====================================================
  // SEARCH FILTER STATE
  // ====================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  // ====================================================
  // CATEGORY
  // ====================================================

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    categoryLoading,
    setCategoryLoading,
  ] = useState(false);

  // ====================================================
  // CURRENT DATE (DYNAMIC REAL-TIME UPDATE)
  // Automatically tracks current month and year so on October 1st,
  // October becomes available, and on Jan 1st 2027, 2027 becomes available.
  // ====================================================

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  });

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    currentDate.month
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    currentDate.year
  );

  // Periodic calendar checker (e.g. at midnight or rollover)
  useEffect(() => {
    const checkCalendar = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      setCurrentDate((prev) => {
        if (
          prev.year !== currentYear ||
          prev.month !== currentMonth
        ) {
          return {
            year: currentYear,
            month: currentMonth,
          };
        }
        return prev;
      });
    };

    const timer = setInterval(checkCalendar, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ====================================================
  // MONTH NAMES
  // ====================================================

  const allMonthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // ====================================================
  // YEAR OPTIONS (AUTOMATIC STARTING FROM 2026 UP TO CURRENT YEAR)
  // When 2027 arrives, 2027 is automatically added to the dropdown!
  // ====================================================

  const yearOptions = useMemo(() => {
    const recordedYears = students.map(student => Number(String(student.joinDate || "").slice(0, 4)))
      .filter(year => Number.isInteger(year) && year >= 1900 && year <= 9999);
    const firstYear = Math.min(2026, currentDate.year, ...recordedYears);
    const lastYear = Math.max(currentDate.year, ...recordedYears);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  }, [students, currentDate.year]);

  // ====================================================
  // MONTH OPTIONS (AUTOMATIC UP TO CURRENT MONTH FOR CURRENT YEAR)
  // In 2026, shows months up to September.
  // On October 1st, October is automatically added!
  // If a past year or Overall Year is chosen, all 12 months show.
  // ====================================================

  const availableMonths = useMemo(() => {
    const isCurrentYear =
      selectedYear === currentDate.year ||
      (selectedYear !== "ALL" && Number(selectedYear) === currentDate.year);

    // For current year (2026), only allow months up to current calendar month (e.g. Sept = 9)
    // On Oct 1st, currentDate.month becomes 10, so October automatically appears!
    const maxMonth = isCurrentYear ? currentDate.month : 12;

    return allMonthNames
      .map((name, index) => ({
        name,
        value: index + 1,
      }))
      .filter((item) => item.value <= maxMonth);
  }, [selectedYear, currentDate.year, currentDate.month]);

  // If selectedMonth is not in availableMonths, adjust gracefully
  useEffect(() => {
    if (selectedMonth !== "ALL") {
      const isAvailable = availableMonths.some(
        (m) => m.value === Number(selectedMonth)
      );
      if (!isAvailable && availableMonths.length > 0) {
        setSelectedMonth(availableMonths[availableMonths.length - 1].value);
      }
    }
  }, [availableMonths, selectedMonth]);

  // ====================================================
  // GET JOIN YEAR / MONTH HELPER
  // ====================================================

  const getStudentJoinMonthYear = (student) => {
    const joinDate = formatDateForInput(
      student.joinDate ||
        student.join_date ||
        ""
    );

    if (!joinDate) {
      return null;
    }

    const parts = joinDate.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);

    if (!year || !month) {
      return null;
    }

    return {
      year,
      month,
    };
  };

  // ====================================================
  // LOAD CATEGORIES
  // ====================================================

  async function loadCategories() {
    try {
      setCategoryLoading(true);

      const response = await categoryApi.list();
      const categoryList = normalizeCategories(response);

      setCategories(categoryList);
    } catch (error) {
      console.error("Category API loading failed:", error);
      setCategories([]);
    } finally {
      setCategoryLoading(false);
    }
  }

  // ====================================================
  // LOAD ALL STUDENTS
  // ====================================================

  async function loadStudents() {
    try {
      setMessage("");

      const [studentResponse, enquiryResponse] = await Promise.allSettled([
        studentApi.list(),
        typeof enquiryApi?.list === "function"
          ? enquiryApi.list()
          : Promise.resolve({ data: [] }),
      ]);

      const apiData =
        studentResponse.status === "fulfilled"
          ? studentResponse.value?.data?.results ||
            studentResponse.value?.data?.data ||
            studentResponse.value?.data ||
            []
          : [];

      const enquiryData =
        enquiryResponse.status === "fulfilled"
          ? enquiryResponse.value?.data?.results ||
            enquiryResponse.value?.data?.data ||
            enquiryResponse.value?.data ||
            []
          : [];

      const enquiryMap = new Map();
      if (Array.isArray(enquiryData)) {
        enquiryData.forEach((e) => {
          if (e.mobile) enquiryMap.set(String(e.mobile).trim(), e);
          const name = String(e.candidate_name || e.name || "").trim().toLowerCase();
          if (name) enquiryMap.set(name, e);
        });
      }

      const apiStudents = Array.isArray(apiData)
        ? apiData.map(normalize)
        : [];

      setStudents(mergeStudents(apiStudents));
      setPage(1);
    } catch (error) {
      console.error("Student API loading failed:", error);
      setStudents([]);
      setMessage("Unable to load students. Please check the API connection.");
    }
  }

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    loadCategories();
    loadStudents();
  }, []);

  // ====================================================
  // STUDENTS WITH PERSISTED IDS
  // Keep identifiers stable across filtering, pagination and deletion.
  // ====================================================

  const studentsWithIds = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;

      if (idA && idB) {
        return idA - idB;
      }

      return String(a.joinDate || "").localeCompare(
        String(b.joinDate || "")
      );
    });

    return sorted.map((student, index) => {
      let displayStudentId = String(student.studentId || student.student_id || student.id || "").trim();

      // Ensure consistent SCOT-xxx sequential format (e.g. SCOT-001, SCOT-002, SCOT-005)
      if (!displayStudentId || !displayStudentId.startsWith("SCOT-")) {
        displayStudentId = `SCOT-${String(index + 1).padStart(3, "0")}`;
      }

      return {
        ...student,
        displayStudentId,
      };
    });
  }, [students]);

  // ====================================================
  // FILTER + SORT (YEAR, MONTH, SEARCH)
  // ====================================================

  const filteredStudents = useMemo(() => {
    return studentsWithIds.filter((student) => {
      // 1. Year and Month filter
      const isOverallYear = selectedYear === "ALL";
      const isOverallMonth = selectedMonth === "ALL";

      if (!isOverallYear || !isOverallMonth) {
        const date = getStudentJoinMonthYear(student);

        if (!date) {
          return false;
        }

        if (!isOverallYear && date.year !== Number(selectedYear)) {
          return false;
        }

        if (!isOverallMonth && date.month !== Number(selectedMonth)) {
          return false;
        }
      }

      // 2. Search query filter
      const q = searchTerm.trim().toLowerCase();

      if (q) {
        const rawStudentId = String(student.studentId || student.student_id || "").toLowerCase();
        const studentId = String(student.displayStudentId || rawStudentId || "").toLowerCase();
        const name = String(student.name || "").toLowerCase();
        const course = String(student.course || "").toLowerCase();
        const mobile = String(student.mobile || "").toLowerCase();
        const email = String(student.email || "").toLowerCase();
        const city = String(student.city || "").toLowerCase();
        const category = String(student.category || "").toLowerCase();
        const status = String(student.status || "").toLowerCase();
        const joinDate = String(student.joinDate || "").toLowerCase();
        const dueDate = String(student.dueDate || "").toLowerCase();

        const matchesSearch =
          rawStudentId.includes(q) ||
          studentId.includes(q) ||
          name.includes(q) ||
          course.includes(q) ||
          mobile.includes(q) ||
          email.includes(q) ||
          city.includes(q) ||
          category.includes(q) ||
          status.includes(q) ||
          joinDate.includes(q) ||
          dueDate.includes(q);

        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });
  }, [studentsWithIds, selectedYear, selectedMonth, searchTerm]);

  // ====================================================
  // RESET PAGE ON FILTER / SEARCH CHANGE
  // ====================================================

  useEffect(() => {
    setPage(1);
  }, [selectedMonth, selectedYear, searchTerm]);

  // ====================================================
  // PAGINATION
  // ====================================================

  useEffect(() => {
    setPage(current => Math.min(current, Math.max(1, Math.ceil(filteredStudents.length / 10))));
  }, [filteredStudents.length]);

  const visibleStudents = filteredStudents.slice(
    (page - 1) * 10,
    page * 10
  );

  // ====================================================
  // DOWNLOAD EXCEL FILE (.xlsx)
  // Join Date located before Student Name
  // When Overall is selected, exports all year and month data
  // ====================================================

  function downloadFilteredExcel() {
    if (filteredStudents.length === 0) {
      alert("No student data available to export for the current filters.");
      return;
    }

    try {
      setExportingExcel(true);

      const excelData = filteredStudents.map((student) => {
        const totalFee = Number(student.totalFee) || 0;
        const paidFee = Number(student.paidFee) || 0;
        const staffPayout = Number(student.staffPayout) || 0;
        const balanceFee = calculateBalanceFee(totalFee, paidFee);

        return {
          "Student ID": student.displayStudentId || "",
          "Join Date": student.joinDate || "",
          "Student Name": student.name || "",
          "Course": student.course || "",
          "Mobile": student.mobile || "",
          "Comments / Discussion": student.comments || "",
          "City": student.city || "",
          "Category": student.category || "",
          "Total Fee": totalFee,
          "Paid Fee": paidFee,
          "Staff Payout": staffPayout,
          "Net Profit": calculateNetProfit(paidFee, staffPayout),
          "Balance Fee": balanceFee,
          "Due Date": student.dueDate || "",
          "Status": normalizeStatus(student.status),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();

      let sheetName = "Students";
      if (selectedYear === "ALL" && selectedMonth === "ALL") {
        sheetName = "All Students";
      } else if (selectedMonth === "ALL") {
        sheetName = `Year ${selectedYear}`;
      } else if (selectedYear === "ALL") {
        sheetName = `${allMonthNames[selectedMonth - 1]}`;
      } else {
        sheetName = `${allMonthNames[selectedMonth - 1]} ${selectedYear}`;
      }

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sheetName.slice(0, 31)
      );

      worksheet["!cols"] = [
        { wch: 14 }, // Student ID
        { wch: 14 }, // Join Date
        { wch: 25 }, // Student Name
        { wch: 25 }, // Course
        { wch: 16 }, // Mobile
        { wch: 32 }, // Comments / Discussion
        { wch: 18 }, // City
        { wch: 22 }, // Category
        { wch: 14 }, // Total Fee
        { wch: 14 }, // Paid Fee
        { wch: 16 }, // Staff Payout
        { wch: 14 }, // Net Profit
        { wch: 14 }, // Balance Fee
        { wch: 14 }, // Due Date
        { wch: 14 }, // Status
      ];

      worksheet["!freeze"] = {
        xSplit: 0,
        ySplit: 1,
      };

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      let filePrefix = "SCOT-IT-Academy-Students";
      if (selectedYear === "ALL" && selectedMonth === "ALL") {
        filePrefix += "-Overall";
      } else if (selectedMonth === "ALL") {
        filePrefix += `-${selectedYear}-Overall-Month`;
      } else if (selectedYear === "ALL") {
        filePrefix += `-${allMonthNames[selectedMonth - 1]}-Overall-Year`;
      } else {
        filePrefix += `-${allMonthNames[selectedMonth - 1]}-${selectedYear}`;
      }

      const fileName = `${filePrefix}-${dateStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      setMessage(
        `Excel exported successfully: ${filteredStudents.length} student records downloaded.`
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Excel export failed:", error);
      alert("Unable to export Excel file.");
    } finally {
      setExportingExcel(false);
    }
  }

  // ====================================================
  // FORM CHANGE
  // ====================================================

  function change(event) {
    const { name, value } = event.target;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "paidFee" || name === "totalFee") {
        next.balanceFee = calculateBalanceFee(
          next.totalFee,
          next.paidFee
        );
      }

      if (name === "paidFee" || name === "staffPayout") {
        next.netProfit = calculateNetProfit(
          next.paidFee,
          next.staffPayout
        );
      }

      if (name === "status") {
        next.status = normalizeStatus(value);
      }

      return next;
    });
  }

  // ====================================================
  // ADD / EDIT STUDENT
  // ====================================================

  async function addStudent(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const editedDueDate = formatDateForInput(form.dueDate);

    const editedJoinDate = formatDateForInput(
      form.joinDate ||
        editingStudent?.joinDate ||
        editingStudent?.join_date ||
        ""
    );

    const editedTotalFee = Number(form.totalFee) || 0;
    const editedPaidFee = Number(form.paidFee) || 0;
    const editedStaffPayout = Number(form.staffPayout) || 0;
    const editedNetProfit = calculateNetProfit(
      editedPaidFee,
      editedStaffPayout
    );
    const editedBalanceFee = calculateBalanceFee(
      editedTotalFee,
      editedPaidFee
    );

    if (!Number.isFinite(editedStaffPayout) || editedStaffPayout < 0) {
      setMessage("Staff Payout must be a valid non-negative amount.");
      setSaving(false);
      return;
    }

    if (editedPaidFee > editedTotalFee) {
      setMessage("Paid Fee cannot be greater than Total Fee.");
      setSaving(false);
      return;
    }

    const selectedCategory = String(form.category || editingStudent?.category || "General").trim();
    const selectedStatus = normalizeStatus(form.status);

    const studentData = {
      name: form.name,
      course: form.course,
      mobile: form.mobile || editingStudent?.mobile || "",
      email: form.email || editingStudent?.email || "",
      city: form.city || editingStudent?.city || "",
      category: selectedCategory,
      referred_by: form.referred_by || "",
      comments: form.comments || "",
      totalFee: editedTotalFee,
      paidFee: editedPaidFee,
      staffPayout: editedStaffPayout,
      netProfit: editedNetProfit,
      balanceFee: editedBalanceFee,
      dueDate: editedDueDate,
      joinDate: editedJoinDate,
      status: selectedStatus,
    };

    if (form.studentId) {
      studentData.studentId = form.studentId;
      studentData.student_id = form.studentId;
    }

    // ==================================================
    // EDIT STUDENT
    // ==================================================

    if (editingStudent) {
      try {
        const studentIdKeys = [
          editingStudent.id,
          editingStudent.studentId,
          editingStudent.student_id,
          editingStudent.displayStudentId,
          studentKey(editingStudent),
        ];

        // Save override locally immediately so changes persist across reloads
        saveStudentOverride(studentIdKeys, {
          referred_by: studentData.referred_by,
          comments: studentData.comments,
          staffPayout: studentData.staffPayout,
          netProfit: studentData.netProfit,
        });

        if (
          editingStudent.id &&
          !String(editingStudent.id).startsWith("local-")
        ) {
          const response = await studentApi.update(
            editingStudent.id,
            studentData
          );
          requirePersistedStudentFinance(response);
        }

        const updatedStudent = {
          ...editingStudent,
          ...studentData,
          id: editingStudent.id,
          displayStudentId: editingStudent.displayStudentId,
          category: selectedCategory,
          referred_by: studentData.referred_by,
          comments: studentData.comments,
          totalFee: editedTotalFee,
          paidFee: editedPaidFee,
          staffPayout: editedStaffPayout,
          netProfit: editedNetProfit,
          balanceFee: editedBalanceFee,
          dueDate:
            editedDueDate || editingStudent.dueDate || "",
          joinDate:
            editedJoinDate || editingStudent.joinDate || "",
          status: selectedStatus,
        };

        setStudents((prev) =>
          prev.map((item) =>
            String(item.id) === String(editingStudent.id) ||
            studentKey(item) === studentKey(editingStudent)
              ? {
                  ...item,
                  ...updatedStudent,
                  id: editingStudent.id,
                }
              : item
          )
        );

        if (
          selected &&
          (String(selected.id) === String(editingStudent.id) ||
           studentKey(selected) === studentKey(editingStudent))
        ) {
          setSelected(updatedStudent);
        }

        setMessage("Student details updated successfully.");

        setTimeout(() => {
          setFormOpen(false);
          setEditingStudent(null);
          setForm({ ...initialForm, referred_by: "", comments: "" });
          setMessage("");
        }, 800);
      } catch (error) {
        console.error("Student update failed:", error);
        setMessage(
          error?.response?.data?.message ||
            error?.message ||
            "Unable to update student. Please check the API connection."
        );
      }

      setSaving(false);
      return;
    }

    // ==================================================
    // CREATE NEW STUDENT
    // ==================================================

    try {
      const response = await studentApi.create(studentData);
      const savedStudent = normalize(
        requirePersistedStudentFinance(response)
      );

      savedStudent.referred_by = studentData.referred_by;
      savedStudent.comments = studentData.comments;
      savedStudent.staffPayout = editedStaffPayout;
      savedStudent.netProfit = editedNetProfit;

      saveStudentOverride(
        [savedStudent.id, savedStudent.studentId, savedStudent.displayStudentId, studentKey(savedStudent)],
        {
          referred_by: studentData.referred_by,
          comments: studentData.comments,
          staffPayout: editedStaffPayout,
          netProfit: editedNetProfit,
        }
      );

      setStudents((prev) =>
        mergeStudents([...prev, savedStudent])
      );

      setMessage("Student added successfully.");

      setTimeout(() => {
        setFormOpen(false);
        setForm({ ...initialForm, referred_by: "", comments: "" });
        setMessage("");
        loadStudents();
      }, 800);
    } catch (error) {
      console.error("Student create failed:", error);
      setMessage(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to save student. Please check the API connection."
      );
    }

    setSaving(false);
  }

  // ====================================================
  // VIEW
  // ====================================================

  function openView(student) {
    setSelected(student);
  }

  // ====================================================
  // EDIT
  // ====================================================

  function openEdit(student) {
    loadCategories();
    setEditingStudent(student);

    const totalFee = Number(student.totalFee) || 0;
    const paidFee = Number(student.paidFee) || 0;
    const balanceFee = calculateBalanceFee(totalFee, paidFee);

    setForm({
      studentId: student.studentId || student.student_id || student.displayStudentId || "",
      name: student.name || "",
      course: student.course || "",
      mobile: student.mobile || "",
      email: student.email || "",
      city: student.city || "",
      category: student.category || "",
      referred_by:
        student.referred_by ||
        student.referredBy ||
        student.referral_source ||
        student.referralSource ||
        student.lead_source ||
        student.leadSource ||
        "",
      comments: student.comments || student.comment || "",
      totalFee,
      paidFee,
      staffPayout: Number(student.staffPayout ?? student.staff_payout ?? 0) || 0,
      netProfit: calculateNetProfit(
        paidFee,
        student.staffPayout ?? student.staff_payout ?? 0
      ),
      balanceFee,
      dueDate: formatDateForInput(
        student.dueDate || student.due_date || ""
      ),
      joinDate: formatDateForInput(
        student.joinDate || student.join_date || ""
      ),
      status: normalizeStatus(student.status),
    });

    setMessage("");
    setFormOpen(true);
  }

  // ====================================================
  // DELETE
  // ====================================================

  async function remove(student) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${student.name}?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      if (
        student.id &&
        !String(student.id).startsWith("local-")
      ) {
        await studentApi.delete(student.id);
      }

      setStudents((prev) =>
        prev.filter((item) => String(item.id) !== String(student.id))
      );

      if (
        selected &&
        String(selected.id) === String(student.id)
      ) {
        setSelected(null);
      }
    } catch (error) {
      console.error("Delete student failed:", error);
      alert("Unable to delete student. Please check the API connection.");
    }
  }

  // ====================================================
  // CLOSE FORM
  // ====================================================

  function closeForm() {
    setFormOpen(false);
    setEditingStudent(null);
    setForm({ ...initialForm });
    setMessage("");
  }

  // ====================================================
  // ADD STUDENT
  // ====================================================

  function openAddStudent() {
    loadCategories();
    setEditingStudent(null);

    // The API assigns the next SCOT ID when the record is saved.

    setForm({
      ...initialForm,
      studentId: "",
      category: "",
      referred_by: "",
      comments: "",
      status: "Active",
    });

    setFormOpen(true);
    setMessage("");
  }

  useEffect(() => {
    if (!formOpen && !selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = event => {
      if (event.key === "Escape" && !saving) { setFormOpen(false); setSelected(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [formOpen, selected, saving]);

  // ====================================================
  // OVERALL STATUS CHECK
  // ====================================================

  const isOverall =
    selectedYear === "ALL" && selectedMonth === "ALL";

  // ====================================================
  // UI RENDER
  // ====================================================

  return (
    <>
      {/* ==================================================
          STUDENTS PANEL
      ================================================== */}

      <Panel
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span>Students Details</span>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#1e40af",
                background: "#dbeafe",
                padding: "3px 10px",
                borderRadius: "12px",
              }}
            >
              {filteredStudents.length}{" "}
              {filteredStudents.length === 1 ? "student" : "students"}
            </span>

            {isOverall && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#065f46",
                  background: "#d1fae5",
                  padding: "3px 10px",
                  borderRadius: "12px",
                }}
              >
                Overall (All Years & All Months)
              </span>
            )}

            {!isOverall && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#4b5563",
                  background: "#f3f4f6",
                  padding: "3px 10px",
                  borderRadius: "12px",
                }}
              >
                {selectedMonth === "ALL"
                  ? "All Months"
                  : allMonthNames[selectedMonth - 1]}{" "}
                {selectedYear === "ALL"
                  ? "All Years"
                  : selectedYear}
              </span>
            )}
          </div>
        }
        subtitle="Students and their fee details"
        action={
          <button
            type="button"
            className="primary"
            onClick={openAddStudent}
          >
            + Add Student
          </button>
        }
      >
        {/* ==================================================
            FILTERS (INSIDE TABLE SESSION, NO TITLES)
        ================================================== */}

        <div
          className="student-filter-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            width: "100%",
            marginBottom: "16px",
          }}
        >
          {/* SEARCH FILTER INPUT (NO TITLE) */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: "1 1 240px",
              minWidth: "200px",
            }}
          >
            <input
              type="text"
              aria-label="Search students"
              placeholder="Search ID (SCOT-001), name, course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                height: "42px",
                paddingRight: searchTerm ? "36px" : "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
              }}
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                title="Clear search"
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  color: "#9ca3af",
                  cursor: "pointer",
                  padding: "4px 8px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* YEAR FILTER (NO TITLE) */}
          <div
            style={{
              minWidth: "140px",
              flex: "0 1 150px",
            }}
          >
            <select
              id="student-year" aria-label="Year"
              value={selectedYear}
              onChange={(event) => {
                const val = event.target.value;
                setSelectedYear(val === "ALL" ? "ALL" : Number(val));
              }}
              style={{
                height: "42px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                width: "100%",
              }}
            >
              <option value="ALL">Overall Year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* MONTH FILTER (NO TITLE) */}
          <div
            style={{
              minWidth: "150px",
              flex: "0 1 160px",
            }}
          >
            <select
              id="student-month" aria-label="Month"
              value={selectedMonth}
              onChange={(event) => {
                const val = event.target.value;
                setSelectedMonth(val === "ALL" ? "ALL" : Number(val));
              }}
              style={{
                height: "42px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                width: "100%",
              }}
            >
              <option value="ALL">Overall Month</option>
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* DOWNLOAD EXCEL FILE (.xlsx) */}
          <button
            type="button"
            className="primary"
            onClick={downloadFilteredExcel}
            disabled={exportingExcel}
            title="Download currently filtered students as Excel (.xlsx)"
            style={{
              height: "42px",
              marginBottom: 0,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
              borderRadius: "8px",
            }}
          >
            {exportingExcel
              ? "Exporting..."
              : isOverall
              ? "Download Overall Excel"
              : "Download Excel"}
          </button>
        </div>

        <div className="students-table-wrapper">
          <ResponsiveTable className="students-table">
            <thead>
              <tr>
                {/* 1. STUDENT ID */}
                <th>
                  Student ID
                </th>

                {/* 2. JOIN DATE (Located before Student Name) */}
                <th>
                  Join Date
                </th>

                {/* 3. STUDENT NAME */}
                <th>
                  Student Name
                </th>

                {/* 4. COURSE */}
                <th>
                  Course
                </th>

                {/* 5. MOBILE */}
                <th>
                  Mobile
                </th>

                {/* 6. REFERRED BY */}
                <th>
                  Referred By
                </th>

                {/* 7. TOTAL FEE */}
                <th>
                  Total Fee
                </th>

                {/* 6. PAID FEE */}
                <th>
                  Paid Fee
                </th>

                {/* 7. BALANCE FEE */}
                <th>
                  Balance Fee
                </th>

                {/* 8. DUE DATE */}
                <th>
                  Due Date
                </th>

                {/* 9. STATUS */}
                <th>
                  Status
                </th>

                {/* 10. ACTION */}
                <th className="action-column">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleStudents.length > 0 ? (
                visibleStudents.map((student) => {
                  const totalFee =
                    Number(student.totalFee) || 0;

                  const paidFee =
                    Number(student.paidFee) || 0;

                  const balanceFee =
                    calculateBalanceFee(
                      totalFee,
                      paidFee
                    );

                  const status =
                    normalizeStatus(student.status);

                  const statusStyle =
                    getStatusStyle(status);

                  return (
                    <tr
                      key={
                        student.id ||
                        studentKey(student)
                      }
                    >
                      {/* 1. STUDENT ID (Matches screenshot: bold, dark, sequential SCOT-001, SCOT-002...) */}
                      <td className="student-id-cell">
                        <span className="student-id-text">
                          {student.displayStudentId}
                        </span>
                      </td>

                      {/* 2. JOIN DATE (Located before Student Name) */}
                      <td className="date-cell">
                        {student.joinDate || "-"}
                      </td>

                      {/* 3. STUDENT NAME */}
                      <td className="student-name-cell">
                        <strong>
                          {student.name || "-"}
                        </strong>
                      </td>

                      {/* 4. COURSE */}
                      <td>
                        {student.course || "-"}
                      </td>

                      {/* 5. MOBILE */}
                      <td>
                        {student.mobile || "-"}
                      </td>

                      {/* 6. REFERRED BY */}
                      <td>
                        {student.referred_by || "-"}
                      </td>

                      {/* 7. TOTAL FEE */}
                      <td className="total-fee-cell">
                        ₹{formatMoney(totalFee)}
                      </td>

                      {/* 8. PAID FEE */}
                      <td className="fee-cell">
                        ₹{formatMoney(paidFee)}
                      </td>

                      {/* 9. BALANCE FEE */}
                      <td className="fee-cell">
                        ₹{formatMoney(balanceFee)}
                      </td>

                      {/* 10. DUE DATE */}
                      <td className="date-cell">
                        {student.dueDate || "-"}
                      </td>

                      {/* 11. STATUS */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: "999px",
                            fontSize: "14px",
                            fontWeight: 700,
                            minWidth: "75px",
                            textAlign: "center",
                            background: statusStyle.background,
                            color: statusStyle.color,
                            border: statusStyle.border,
                          }}
                        >
                          {status}
                        </span>
                      </td>

                      {/* 12. ACTION */}
                      <td className="action-column">
                        <div className="student-action-buttons">
                          <button
                            type="button"
                            className="icon-btn view-action"
                            title="View" aria-label={`View ${student.name}`}
                            onClick={() => openView(student)}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className="icon-btn edit-action"
                            title="Edit" aria-label={`Edit ${student.name}`}
                            onClick={() => openEdit(student)}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                              <path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className="icon-btn delete-btn"
                            title="Delete" aria-label={`Delete ${student.name}`}
                            onClick={() => remove(student)}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                              <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6" />
                              <path d="M10 11v5m4-5v5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="12"
                    className="no-students"
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "#6b7280",
                    }}
                  >
                    {searchTerm ? (
                      <>
                        No students found matching "
                        <strong>{searchTerm}</strong>".
                      </>
                    ) : isOverall ? (
                      "No students found in the academy records."
                    ) : selectedMonth === "ALL" ? (
                      `No students found for year ${selectedYear}.`
                    ) : selectedYear === "ALL" ? (
                      `No students found for ${
                        allMonthNames[selectedMonth - 1]
                      } (all years).`
                    ) : (
                      `No students found for ${
                        allMonthNames[selectedMonth - 1]
                      } ${selectedYear}.`
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </ResponsiveTable>
        </div>

        <Pagination
          page={page}
          setPage={setPage}
          perPage={10}
          total={filteredStudents.length}
        />
      </Panel>

      {/* ==================================================
          FEEDBACK MESSAGE
      ================================================== */}

      {message && !formOpen && (
        <div
          className="success-message"
          style={{
            marginTop: "12px",
          }}
        >
          {message}
        </div>
      )}

      {/* ==================================================
          ADD / EDIT MODAL
      ================================================== */}

      {formOpen && (
        <div
          className="modal-backdrop"
          onClick={closeForm}
        >
          <form
            className="modal edit-modal students-modal"
            role="dialog" aria-modal="true" aria-label={editingStudent ? "Edit student" : "Add student"}
            onSubmit={addStudent}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingStudent
                    ? "Edit Student"
                    : "Add Student"}
                </h3>

                <p>
                  {editingStudent
                    ? "Update student and fee details"
                    : "Add a student and fee details"}
                </p>
              </div>

              <button
                type="button"
                className="modal-close" aria-label="Close student form"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              {/* STUDENT ID */}
              <div className="form-group">
                <label htmlFor="student-studentId">
                  Student ID
                </label>

                <input
                  name="studentId" id="student-studentId"
                  value={form.studentId ?? ""}
                  type="text"
                  readOnly
                  disabled
                  placeholder="Auto generated on save"
                  style={{
                    backgroundColor: "#f3f4f6",
                    cursor: "not-allowed",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                />

                <small
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "#667085",
                    fontSize: "12px",
                  }}
                >
                  {editingStudent
                    ? "Student ID is unique and cannot be modified."
                    : "Auto-generated continuous sequence (e.g. SCOT-001, SCOT-002...)."}
                </small>
              </div>

              {/* NAME */}
              <div className="form-group">
                <label htmlFor="student-name">
                  Student Name *
                </label>

                <input
                  name="name" id="student-name"
                  value={form.name ?? ""}
                  onChange={change}
                  type="text"
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* COURSE */}
              <div className="form-group">
                <label htmlFor="student-course">
                  Course *
                </label>

                <input
                  name="course" id="student-course"
                  value={form.course ?? ""}
                  onChange={change}
                  type="text"
                  placeholder="e.g. Python Full Stack"
                  required
                />
              </div>

              {/* MOBILE */}
              <div className="form-group">
                <label htmlFor="student-mobile">
                  Mobile Number
                </label>

                <input
                  name="mobile" id="student-mobile"
                  value={form.mobile ?? ""}
                  onChange={change}
                  type="tel"
                  placeholder="10-digit mobile"
                />
              </div>

              {/* REFERRED BY */}
              <div className="form-group">
                <label htmlFor="student-referred_by">
                  Referred By
                </label>

                <select
                  name="referred_by" id="student-referred_by"
                  value={form.referred_by || ""}
                  onChange={change}
                >
                  <option value="">-- Select Referred By --</option>
                  {form.referred_by && !REFERRED_BY_OPTIONS.includes(form.referred_by) && (
                    <option value={form.referred_by}>
                      {form.referred_by}
                    </option>
                  )}
                  {REFERRED_BY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* CITY */}
              <div className="form-group">
                <label htmlFor="student-city">
                  City
                </label>

                <input
                  name="city" id="student-city"
                  value={form.city ?? ""}
                  onChange={change}
                  type="text"
                  placeholder="e.g. Chennai"
                />
              </div>

              {/* TOTAL FEE */}
              <div className="form-group">
                <label htmlFor="student-totalFee">
                  Total Fee *
                </label>

                <input
                  name="totalFee" id="student-totalFee"
                  value={form.totalFee ?? ""}
                  onChange={change}
                  type="number"
                  min="0"
                  placeholder="Enter total fee"
                  required
                />
              </div>

              {/* PAID FEE */}
              <div className="form-group">
                <label htmlFor="student-paidFee">
                  Paid Fee *
                </label>

                <input
                  name="paidFee" id="student-paidFee"
                  value={form.paidFee ?? ""}
                  onChange={change}
                  type="number"
                  min="0"
                  max={form.totalFee || undefined}
                  placeholder="Enter paid fee"
                  required
                />
              </div>

              {/* STAFF PAYOUT */}
              <div className="form-group">
                <label htmlFor="student-staffPayout">
                  Staff Payout
                </label>

                <input
                  name="staffPayout" id="student-staffPayout"
                  value={form.staffPayout ?? ""}
                  onChange={change}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter staff payout"
                />
              </div>

              {/* NET PROFIT */}
              <div className="form-group">
                <label htmlFor="student-netProfit">
                  Net Profit
                </label>

                <input
                  name="netProfit" id="student-netProfit"
                  value={calculateNetProfit(form.paidFee, form.staffPayout)}
                  type="number"
                  readOnly
                  tabIndex="-1"
                  style={{
                    backgroundColor: "#f3f4f6",
                    cursor: "not-allowed",
                  }}
                />

                <small
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "#667085",
                    fontSize: "12px",
                  }}
                >
                  Paid Fee − Staff Payout
                </small>
              </div>

              {/* BALANCE FEE */}
              <div className="form-group">
                <label htmlFor="student-balanceFee">
                  Balance Fee
                </label>

                <input
                  name="balanceFee" id="student-balanceFee"
                  value={calculateBalanceFee(
                    form.totalFee,
                    form.paidFee
                  )}
                  type="number"
                  readOnly
                  tabIndex="-1"
                  style={{
                    backgroundColor: "#f3f4f6",
                    cursor: "not-allowed",
                  }}
                />

                <small
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "#667085",
                    fontSize: "12px",
                  }}
                >
                  Total Fee − Paid Fee
                </small>
              </div>

              {/* JOIN DATE */}
              <div className="form-group">
                <label htmlFor="student-joinDate">
                  Join Date *
                </label>

                <input
                  type="date"
                  name="joinDate" id="student-joinDate"
                  value={form.joinDate || ""}
                  onChange={change}
                  required
                />
              </div>

              {/* DUE DATE */}
              <div className="form-group">
                <label htmlFor="student-dueDate">
                  Due Date
                </label>

                <input
                  type="date"
                  name="dueDate" id="student-dueDate"
                  value={form.dueDate || ""}
                  onChange={change}
                />
              </div>

              {/* STATUS */}
              <div className="form-group">
                <label htmlFor="student-status">
                  Status *
                </label>

                <select
                  name="status" id="student-status"
                  value={form.status || "Active"}
                  onChange={change}
                  required
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* COMMENTS */}
              <div className="form-group full">
                <label htmlFor="student-comments">
                  Comments / Discussion
                </label>

                <textarea
                  name="comments" id="student-comments"
                  value={form.comments ?? ""}
                  onChange={change}
                  placeholder="Add remarks, follow-up notes, or referral details"
                  rows="4"
                />
              </div>
            </div>

            {/* ERROR OR SUCCESS MESSAGE */}
            {message && (
              <div
                className={
                  message.includes("Unable") ||
                  message.includes("Please select") ||
                  message.includes("cannot be greater")
                    ? "error-message"
                    : "success-message"
                }
              >
                {message}
              </div>
            )}

            {/* FORM ACTIONS */}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={closeForm}
              >
                Close
              </button>

              <button
                type="submit"
                className="primary"
                disabled={saving || categoryLoading}
              >
                {saving
                  ? "Saving..."
                  : editingStudent
                  ? "Update Student"
                  : "Add Student"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================
          VIEW STUDENT MODAL (Join Date before Student Name)
      ================================================== */}

      {selected && (
        <div
          className="student-detail-modal"
          onClick={() => setSelected(null)}
        >
          <div
            className="student-detail-content"
            role="dialog" aria-modal="true" aria-label="Student details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="student-modal-header">
              <div>
                <h3>
                  Student Details
                </h3>

                <p>
                  Complete student information
                </p>
              </div>

              <button
                type="button"
                className="secondary small"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            <div className="student-details-grid">
              {[
                ["Student ID", selected.displayStudentId],
                ["Join Date", selected.joinDate],
                ["Student Name", selected.name],
                ["Course", selected.course],
                ["Mobile", selected.mobile],
                ["Email", selected.email],
                ["City", selected.city],
                ["Referred By", selected.referred_by],
                ["Category", selected.category],
                [
                  "Total Fee",
                  `₹${formatMoney(selected.totalFee)}`,
                ],
                [
                  "Paid Fee",
                  `₹${formatMoney(selected.paidFee)}`,
                ],
                [
                  "Balance Fee",
                  `₹${formatMoney(
                    calculateBalanceFee(
                      selected.totalFee,
                      selected.paidFee
                    )
                  )}`,
                ],
                ["Due Date", selected.dueDate],
                [
                  "Status",
                  normalizeStatus(selected.status),
                ],
              ].map(([label, value]) => (
                <div
                  className={
                    label === "Total Fee"
                      ? "detail-box total-detail-box"
                      : "detail-box"
                  }
                  key={label}
                >
                  <span>{label}</span>

                  <strong
                    style={
                      label === "Student ID"
                        ? {
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#0a2540",
                          }
                        : {}
                    }
                  >
                    {value || "-"}
                  </strong>
                </div>
              ))}

              {/* COMMENTS — full width below the grid */}
              {(selected.comments) && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginTop: "4px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#718096", display: "block", marginBottom: "6px" }}>
                    Comments / Discussion
                  </span>
                  <p style={{ margin: 0, fontSize: "14px", color: "#172033", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {selected.comments}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}