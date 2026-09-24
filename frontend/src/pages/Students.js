import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import * as XLSX from "xlsx";

import {
  studentApi,
  categoryApi,
} from "../services/api";

import {
  Panel,
  Pagination,
} from "../components/Ui";

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

  totalFee: "",
  paidFee: "",
  balanceFee: "",

  dueDate: "",
  joinDate: "",
  nextFollowUpDate: "",

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

// ======================================================
// FORMAT DATE
// ======================================================

const formatDateForInput = (date) => {
  if (!date) {
    return "";
  }

  const value = String(date).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  if (
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    return value.substring(0, 10);
  }

  if (
    /^\d{2}-\d{2}-\d{4}$/.test(value)
  ) {
    const [
      day,
      month,
      year,
    ] = value.split("-");

    return `${year}-${month}-${day}`;
  }

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(value)
  ) {
    const [
      day,
      month,
      year,
    ] = value.split("/");

    return `${year}-${month}-${day}`;
  }

  return "";
};

// ======================================================
// NEXT FOLLOW-UP DATE
// ======================================================

const getNextFollowUpDate = (
  student = {}
) => {
  return formatDateForInput(
    student.nextFollowUpDate ||
      student.next_follow_up_date ||
      student.next_followup_date ||
      student.nextFollowupDate ||
      student.next_followup ||
      student.followUpDate ||
      student.follow_up_date ||
      ""
  );
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

  const databaseId =
    student.id ??
    student.databaseId ??
    "";

  return {
    ...student,

    id: databaseId,

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

    totalFee,

    paidFee,

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

    nextFollowUpDate:
      getNextFollowUpDate(
        student
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
  // STUDENTS
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
  // CURRENT MONTH / YEAR
  // ====================================================

  const getCurrentMonthYear =
    () => {
      const now =
        new Date();

      return {
        month:
          now.getMonth() +
          1,

        year:
          now.getFullYear(),
      };
    };

  const initialDate =
    getCurrentMonthYear();

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    initialDate.month
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    initialDate.year
  );

  const lastAutoDateRef =
    useRef(
      initialDate
    );

  // ====================================================
  // MONTHS
  // ====================================================

  const monthNames = [
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
  // YEARS
  // ====================================================

  const START_YEAR = 2026;

  const currentYear =
    new Date().getFullYear();

  const yearOptions =
    Array.from(
      {
        length: Math.max(
          1,
          currentYear -
            START_YEAR +
            1
        ),
      },
      (_, index) =>
        START_YEAR +
        index
    );

  // ====================================================
  // LOAD CATEGORIES
  // ====================================================

  async function loadCategories() {
    try {
      setCategoryLoading(
        true
      );

      const response =
        await categoryApi.list();

      const categoryList =
        normalizeCategories(
          response
        );

      setCategories(
        categoryList
      );
    } catch (error) {
      console.error(
        "Category API loading failed:",
        error
      );

      setCategories([]);
    } finally {
      setCategoryLoading(
        false
      );
    }
  }

  // ====================================================
  // LOAD ALL STUDENTS
  // ====================================================

  async function loadStudents() {
    try {
      setMessage("");

      const response =
        await studentApi.list();

      const apiData =
        response?.data
          ?.results ||
        response?.data
          ?.data ||
        response?.data ||
        [];

      const apiStudents =
        Array.isArray(
          apiData
        )
          ? apiData.map(
              normalize
            )
          : [];

      setStudents(
        mergeStudents(
          apiStudents
        )
      );

      setPage(1);
    } catch (error) {
      console.error(
        "Student API loading failed:",
        error
      );

      console.error(
        "Student API error response:",
        error.response?.data
      );

      setStudents([]);

      setMessage(
        "Unable to load students. Please check the API connection."
      );
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
  // GET JOIN YEAR / MONTH
  // ====================================================

  const getStudentJoinMonthYear =
    (student) => {
      const joinDate =
        formatDateForInput(
          student.joinDate ||
            student.join_date ||
            ""
        );

      if (!joinDate) {
        return null;
      }

      const parts =
        joinDate.split("-");

      if (
        parts.length !==
        3
      ) {
        return null;
      }

      const year =
        Number(parts[0]);

      const month =
        Number(parts[1]);

      if (
        !year ||
        !month
      ) {
        return null;
      }

      return {
        year,
        month,
      };
    };

  // ====================================================
  // FILTER + SORT
  // ====================================================

  const filteredStudents =
    students
      .filter((student) => {
        const date =
          getStudentJoinMonthYear(
            student
          );

        if (!date) {
          return false;
        }

        return (
          date.year ===
            Number(
              selectedYear
            ) &&
          date.month ===
            Number(
              selectedMonth
            )
        );
      })
      .sort((a, b) => {
        const idA =
          Number(a.id) || 0;

        const idB =
          Number(b.id) || 0;

        return idA - idB;
      })
      .map(
        (student, index) => ({
          ...student,

          displayStudentId:
            (page - 1) * 10 +
            index +
            1,
        })
      );

  // ====================================================
  // ALL STUDENTS FOR EXCEL
  // ====================================================

  const allStudentsForExcel =
    [...students]
      .sort((a, b) => {
        const idA =
          Number(a.id) || 0;

        const idB =
          Number(b.id) || 0;

        return idA - idB;
      })
      .map(
        (student, index) => ({
          ...student,

          excelStudentId:
            index + 1,
        })
      );

  // ====================================================
  // RESET PAGE
  // ====================================================

  useEffect(() => {
    setPage(1);
  }, [
    selectedMonth,
    selectedYear,
  ]);

  // ====================================================
  // AUTOMATIC MONTH / YEAR UPDATE
  // ====================================================

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          const current =
            getCurrentMonthYear();

          const previous =
            lastAutoDateRef.current;

          const calendarChanged =
            current.month !==
              previous.month ||
            current.year !==
              previous.year;

          if (
            !calendarChanged
          ) {
            return;
          }

          const stillUsingPrevious =
            selectedMonth ===
              previous.month &&
            selectedYear ===
              previous.year;

          if (
            stillUsingPrevious
          ) {
            setSelectedMonth(
              current.month
            );

            setSelectedYear(
              current.year
            );

            loadStudents();
          }

          lastAutoDateRef.current =
            current;
        },
        60 * 60 * 1000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [
    selectedMonth,
    selectedYear,
  ]);

  // ====================================================
  // PAGINATION
  // ====================================================

  const visibleStudents =
    filteredStudents.slice(
      (page - 1) * 10,
      page * 10
    );

  // ====================================================
  // CSV ESCAPE
  // ====================================================

  function escapeCsvValue(
    value
  ) {
    const stringValue =
      String(
        value ?? ""
      );

    return `"${stringValue.replace(
      /"/g,
      '""'
    )}"`;
  }

  // ====================================================
  // DOWNLOAD SELECTED MONTH CSV
  // ====================================================

  function downloadSelectedMonthStudents() {
    if (
      filteredStudents.length ===
      0
    ) {
      alert(
        `No students found for ${
          monthNames[
            selectedMonth - 1
          ]
        } ${selectedYear}.`
      );

      return;
    }

    const headers = [
      "Student ID",
      "Student Name",
      "Course",
      "Mobile",
      "Email",
      "City",
      "Category",
      "Total Fee",
      "Paid Fee",
      "Balance Fee",
      "Due Date",
      "Join Date",
      "Next Follow-up Date",
      "Status",
    ];

    const rows =
      filteredStudents.map(
        (student) => {
          const totalFee =
            Number(
              student.totalFee
            ) || 0;

          const paidFee =
            Number(
              student.paidFee
            ) || 0;

          const balanceFee =
            calculateBalanceFee(
              totalFee,
              paidFee
            );

          return [
            student.displayStudentId ||
              "",
            student.name ||
              "",
            student.course ||
              "",
            student.mobile ||
              "",
            student.email ||
              "",
            student.city ||
              "",
            student.category ||
              "",
            totalFee,
            paidFee,
            balanceFee,
            student.dueDate ||
              "",
            student.joinDate ||
              "",
            getNextFollowUpDate(
              student
            ),
            normalizeStatus(
              student.status
            ),
          ].map(
            escapeCsvValue
          );
        }
      );

    const csvContent = [
      headers
        .map(
          escapeCsvValue
        )
        .join(","),
      ...rows.map(
        (row) =>
          row.join(",")
      ),
    ].join("\r\n");

    const blob =
      new Blob(
        [
          "\uFEFF" +
            csvContent,
        ],
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
      `Students-${
        monthNames[
          selectedMonth - 1
        ]
      }-${selectedYear}.csv`;

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
  }

  // ====================================================
  // EXPORT ALL STUDENTS TO EXCEL
  // ====================================================

  function exportAllStudentsToExcel() {
    if (
      allStudentsForExcel.length ===
      0
    ) {
      alert(
        "No student data available to export."
      );

      return;
    }

    try {
      setExportingExcel(true);

      const excelData =
        allStudentsForExcel.map(
          (student) => {
            const totalFee =
              Number(
                student.totalFee
              ) || 0;

            const paidFee =
              Number(
                student.paidFee
              ) || 0;

            const balanceFee =
              calculateBalanceFee(
                totalFee,
                paidFee
              );

            return {
              "Student ID":
                student.excelStudentId,

              "Database ID":
                student.id || "",

              "Student Name":
                student.name || "",

              "Course":
                student.course || "",

              "Mobile":
                student.mobile || "",

              "Email":
                student.email || "",

              "City":
                student.city || "",

              "Category":
                student.category || "",

              "Total Fee":
                totalFee,

              "Paid Fee":
                paidFee,

              "Balance Fee":
                balanceFee,

              "Due Date":
                student.dueDate || "",

              "Join Date":
                student.joinDate || "",

              "Next Follow-up Date":
                getNextFollowUpDate(
                  student
                ),

              "Status":
                normalizeStatus(
                  student.status
                ),
            };
          }
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          excelData
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "All Students"
      );

      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 12 },
        { wch: 25 },
        { wch: 30 },
        { wch: 16 },
        { wch: 30 },
        { wch: 20 },
        { wch: 28 },
        { wch: 15 },
        { wch: 15 },
        { wch: 16 },
        { wch: 15 },
        { wch: 15 },
        { wch: 22 },
        { wch: 15 },
      ];

      worksheet["!freeze"] = {
        xSplit: 0,
        ySplit: 1,
      };

      const now =
        new Date();

      const year =
        now.getFullYear();

      const month =
        String(
          now.getMonth() + 1
        ).padStart(2, "0");

      const day =
        String(
          now.getDate()
        ).padStart(2, "0");

      const fileName =
        `SCOT-IT-Academy-All-Students-${year}-${month}-${day}.xlsx`;

      XLSX.writeFile(
        workbook,
        fileName
      );

      setMessage(
        `Excel exported successfully. ${allStudentsForExcel.length} student records downloaded.`
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error(
        "Excel export failed:",
        error
      );

      alert(
        "Unable to export Excel file."
      );
    } finally {
      setExportingExcel(false);
    }
  }

  // ====================================================
  // FORM CHANGE
  // ====================================================

  function change(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (
        name ===
          "paidFee" ||
        name ===
          "totalFee"
      ) {
        next.balanceFee =
          calculateBalanceFee(
            next.totalFee,
            next.paidFee
          );
      }

      if (
        name ===
        "status"
      ) {
        next.status =
          normalizeStatus(
            value
          );
      }

      return next;
    });
  }

  // ====================================================
  // ADD / EDIT STUDENT
  // ====================================================

  async function addStudent(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    const editedDueDate =
      formatDateForInput(
        form.dueDate
      );

    const editedJoinDate =
      formatDateForInput(
        form.joinDate ||
          editingStudent?.joinDate ||
          editingStudent?.join_date ||
          ""
      );

    const editedNextFollowUpDate =
      formatDateForInput(
        form.nextFollowUpDate ||
          editingStudent?.nextFollowUpDate ||
          editingStudent?.next_follow_up_date ||
          ""
      );

    const editedTotalFee =
      Number(
        form.totalFee
      ) || 0;

    const editedPaidFee =
      Number(
        form.paidFee
      ) || 0;

    const editedBalanceFee =
      calculateBalanceFee(
        editedTotalFee,
        editedPaidFee
      );

    if (
      editedPaidFee >
      editedTotalFee
    ) {
      setMessage(
        "Paid Fee cannot be greater than Total Fee."
      );

      setSaving(false);

      return;
    }

    const selectedCategory =
      String(
        form.category || ""
      ).trim();

    if (
      !selectedCategory
    ) {
      setMessage(
        "Please select a category."
      );

      setSaving(false);

      return;
    }

    const selectedStatus =
      normalizeStatus(
        form.status
      );

    const studentData = {
      name:
        form.name,

      course:
        form.course,

      mobile:
        form.mobile,

      email:
        form.email,

      city:
        form.city,

      category:
        selectedCategory,

      totalFee:
        editedTotalFee,

      paidFee:
        editedPaidFee,

      balanceFee:
        editedBalanceFee,

      dueDate:
        editedDueDate,

      joinDate:
        editedJoinDate,

      nextFollowUpDate:
        editedNextFollowUpDate,

      status:
        selectedStatus,
    };

    // ==================================================
    // EDIT STUDENT
    // ==================================================

    if (
      editingStudent
    ) {
      try {
        let updatedStudent;

        if (
          editingStudent.id &&
          !String(
            editingStudent.id
          ).startsWith(
            "local-"
          )
        ) {
          const response =
            await studentApi.update(
              editingStudent.id,
              studentData
            );

          const apiResponse =
            response.data || {};

          updatedStudent =
            normalize({
              ...editingStudent,
              ...apiResponse,

              id:
                editingStudent.id,

              category:
                selectedCategory,

              totalFee:
                editedTotalFee,

              paidFee:
                editedPaidFee,

              balanceFee:
                editedBalanceFee,

              dueDate:
                apiResponse.dueDate ||
                apiResponse.due_date ||
                editedDueDate,

              joinDate:
                apiResponse.joinDate ||
                apiResponse.join_date ||
                editedJoinDate,

              nextFollowUpDate:
                apiResponse.nextFollowUpDate ||
                apiResponse.next_follow_up_date ||
                editedNextFollowUpDate,

              status:
                apiResponse.status ||
                selectedStatus,
            });
        } else {
          updatedStudent =
            normalize({
              ...editingStudent,
              ...studentData,

              id:
                editingStudent.id,
            });
        }

        updatedStudent = {
          ...updatedStudent,

          id:
            editingStudent.id,

          category:
            selectedCategory,

          totalFee:
            editedTotalFee,

          paidFee:
            editedPaidFee,

          balanceFee:
            editedBalanceFee,

          dueDate:
            editedDueDate ||
            updatedStudent.dueDate ||
            "",

          joinDate:
            editedJoinDate ||
            updatedStudent.joinDate ||
            "",

          nextFollowUpDate:
            editedNextFollowUpDate ||
            updatedStudent.nextFollowUpDate ||
            "",

          status:
            selectedStatus,
        };

        setStudents(
          (prev) =>
            prev.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  editingStudent.id
                )
                  ? {
                      ...item,
                      ...updatedStudent,
                      id:
                        editingStudent.id,
                    }
                  : item
            )
        );

        if (
          selected &&
          String(
            selected.id
          ) ===
            String(
              editingStudent.id
            )
        ) {
          setSelected(
            updatedStudent
          );
        }

        setMessage(
          "Student details updated successfully."
        );

        setTimeout(() => {
          setFormOpen(
            false
          );

          setEditingStudent(
            null
          );

          setForm({
            ...initialForm,
          });

          setMessage("");
        }, 800);
      } catch (error) {
        console.error(
          "Student update failed:",
          error
        );

        console.error(
          "API error response:",
          error.response?.data
        );

        setMessage(
          error?.response?.data
            ?.message ||
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
      const response =
        await studentApi.create(
          studentData
        );

      const savedStudent =
        normalize(
          response.data
        );

      setStudents(
        (prev) =>
          mergeStudents([
            ...prev,
            savedStudent,
          ])
      );

      setMessage(
        "Student added successfully."
      );

      setTimeout(() => {
        setFormOpen(
          false
        );

        setForm({
          ...initialForm,
        });

        setMessage("");

        loadStudents();
      }, 800);
    } catch (error) {
      console.error(
        "Student create failed:",
        error
      );

      console.error(
        "API error response:",
        error.response?.data
      );

      setMessage(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Unable to save student. Please check the API connection."
      );
    }

    setSaving(false);
  }

  // ====================================================
  // VIEW
  // ====================================================

  function openView(
    student
  ) {
    setSelected(
      student
    );
  }

  // ====================================================
  // EDIT
  // ====================================================

  function openEdit(
    student
  ) {
    loadCategories();

    setEditingStudent(
      student
    );

    const totalFee =
      Number(
        student.totalFee
      ) || 0;

    const paidFee =
      Number(
        student.paidFee
      ) || 0;

    const balanceFee =
      calculateBalanceFee(
        totalFee,
        paidFee
      );

    setForm({
      studentId:
        student.displayStudentId ||
        "",

      name:
        student.name || "",

      course:
        student.course || "",

      mobile:
        student.mobile || "",

      email:
        student.email || "",

      city:
        student.city || "",

      category:
        student.category || "",

      totalFee,

      paidFee,

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

      nextFollowUpDate:
        getNextFollowUpDate(
          student
        ),

      status:
        normalizeStatus(
          student.status
        ),
    });

    setMessage("");

    setFormOpen(
      true
    );
  }

  // ====================================================
  // DELETE
  // ====================================================

  async function remove(
    student
  ) {
    const confirmDelete =
      window.confirm(
        `Are you sure you want to delete ${student.name}?`
      );

    if (
      !confirmDelete
    ) {
      return;
    }

    try {
      if (
        student.id &&
        !String(
          student.id
        ).startsWith(
          "local-"
        )
      ) {
        await studentApi.delete(
          student.id
        );
      }

      setStudents(
        (prev) =>
          prev.filter(
            (item) =>
              String(
                item.id
              ) !==
              String(
                student.id
              )
          )
      );

      if (
        selected &&
        String(
          selected.id
        ) ===
          String(
            student.id
          )
      ) {
        setSelected(null);
      }
    } catch (error) {
      console.error(
        "Delete student failed:",
        error
      );

      alert(
        "Unable to delete student. Please check the API connection."
      );
    }
  }

  // ====================================================
  // CLOSE FORM
  // ====================================================

  function closeForm() {
    setFormOpen(
      false
    );

    setEditingStudent(
      null
    );

    setForm({
      ...initialForm,
    });

    setMessage("");
  }

  // ====================================================
  // ADD STUDENT
  // ====================================================

  function openAddStudent() {
    loadCategories();

    setEditingStudent(
      null
    );

    setForm({
      ...initialForm,

      studentId:
        "",

      category:
        "",

      status:
        "Active",
    });

    setFormOpen(
      true
    );

    setMessage("");
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <>
      {/* ==================================================
          YEAR / MONTH FILTER
      ================================================== */}

      <div
        className="student-month-filter"
        style={{
          display:
            "flex",

          justifyContent:
            "flex-end",

          alignItems:
            "flex-end",

          gap: "12px",

          flexWrap:
            "wrap",

          width: "100%",

          marginBottom:
            "18px",
        }}
      >
        <div
          className="form-group"
          style={{
            marginBottom: 0,
          }}
        >
          <label>
            Year
          </label>

          <select
            value={
              selectedYear
            }
            onChange={(
              event
            ) => {
              setSelectedYear(
                Number(
                  event.target
                    .value
                )
              );
            }}
          >
            {yearOptions.map(
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
        </div>

        <div
          className="form-group"
          style={{
            marginBottom: 0,
          }}
        >
          <label>
            Month
          </label>

          <select
            value={
              selectedMonth
            }
            onChange={(
              event
            ) => {
              setSelectedMonth(
                Number(
                  event.target
                    .value
                )
              );
            }}
          >
            {monthNames.map(
              (
                month,
                index
              ) => (
                <option
                  key={month}
                  value={
                    index + 1
                  }
                >
                  {month}
                </option>
              )
            )}
          </select>
        </div>

        {/* DOWNLOAD CURRENT MONTH CSV */}

        <button
          type="button"
          className="secondary"
          onClick={
            downloadSelectedMonthStudents
          }
          style={{
            height:
              "44px",

            marginBottom:
              0,
          }}
        >
          Download{" "}
          {
            monthNames[
              selectedMonth -
                1
            ]
          }{" "}
          {selectedYear}
        </button>

        {/* EXPORT ALL STUDENTS EXCEL */}

        <button
          type="button"
          className="primary"
          onClick={
            exportAllStudentsToExcel
          }
          disabled={
            exportingExcel
          }
          style={{
            height:
              "44px",

            marginBottom:
              0,

            minWidth:
              "170px",
          }}
        >
          {exportingExcel
            ? "Exporting..."
            : "📊 Export All Excel"}
        </button>
      </div>

      {/* ==================================================
          STUDENTS PANEL
      ================================================== */}

      <Panel
        title="Students Details"
        subtitle="Students and their fee details"
        action={
          <button
            type="button"
            className="primary"
            onClick={
              openAddStudent
            }
          >
            + Add Student
          </button>
        }
      >
        <div className="students-table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>
                  Student ID
                </th>

                <th>
                  Student Name
                </th>

                <th>
                  Course
                </th>

                <th>
                  Total Fee
                </th>

                <th>
                  Paid Fee
                </th>

                <th>
                  Balance Fee
                </th>

                <th>
                  Due Date
                </th>

                <th>
                  Join Date
                </th>

                <th>
                  Status
                </th>

                <th className="action-column">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleStudents.length >
              0 ? (
                visibleStudents.map(
                  (
                    student
                  ) => {
                    const totalFee =
                      Number(
                        student.totalFee
                      ) || 0;

                    const paidFee =
                      Number(
                        student.paidFee
                      ) || 0;

                    const balanceFee =
                      calculateBalanceFee(
                        totalFee,
                        paidFee
                      );

                    const status =
                      normalizeStatus(
                        student.status
                      );

                    const statusStyle =
                      getStatusStyle(
                        status
                      );

                    return (
                      <tr
                        key={
                          student.id ||
                          studentKey(
                            student
                          )
                        }
                      >
                        <td className="student-id-cell">
                          {student.displayStudentId ||
                            "-"}
                        </td>

                        <td className="student-name-cell">
                          <strong>
                            {student.name ||
                              "-"}
                          </strong>
                        </td>

                        <td>
                          {student.course ||
                            "-"}
                        </td>

                        <td className="total-fee-cell">
                          ₹
                          {formatMoney(
                            totalFee
                          )}
                        </td>

                        <td className="fee-cell">
                          ₹
                          {formatMoney(
                            paidFee
                          )}
                        </td>

                        <td className="fee-cell">
                          ₹
                          {formatMoney(
                            balanceFee
                          )}
                        </td>

                        <td className="date-cell">
                          {student.dueDate ||
                            "-"}
                        </td>

                        <td className="date-cell">
                          {student.joinDate ||
                            "-"}
                        </td>

                        {/* ==================================
                            UPDATED STATUS COLOR
                        ================================== */}

                        <td>
                          <span
                            style={{
                              display:
                                "inline-block",

                              padding:
                                "6px 12px",

                              borderRadius:
                                "999px",

                              fontSize:
                                "12px",

                              fontWeight:
                                700,

                              minWidth:
                                "75px",

                              textAlign:
                                "center",

                              background:
                                statusStyle.background,

                              color:
                                statusStyle.color,

                              border:
                                statusStyle.border,
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="action-column">
                          <div className="student-action-buttons">
                            <button
                              type="button"
                              className="icon-btn view-action"
                              title="View"
                              onClick={() =>
                                openView(
                                  student
                                )
                              }
                            >
                              👁
                            </button>

                            <button
                              type="button"
                              className="icon-btn edit-action"
                              title="Edit"
                              onClick={() =>
                                openEdit(
                                  student
                                )
                              }
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              className="icon-btn delete-btn"
                              title="Delete"
                              onClick={() =>
                                remove(
                                  student
                                )
                              }
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="no-students"
                  >
                    No students found
                    for{" "}
                    {
                      monthNames[
                        selectedMonth -
                          1
                      ]
                    }{" "}
                    {selectedYear}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          setPage={setPage}
          total={
            filteredStudents.length
          }
        />
      </Panel>

      {/* ==================================================
          MESSAGE
      ================================================== */}

      {message && !formOpen && (
        <div
          className="success-message"
          style={{
            marginTop:
              "12px",
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
          onClick={
            closeForm
          }
        >
          <form
            className="modal edit-modal students-modal"
            onSubmit={
              addStudent
            }
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
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
                className="modal-close"
                onClick={
                  closeForm
                }
              >
                ×
              </button>
            </div>

            <div className="form-grid">

              {/* STUDENT ID */}

              <div className="form-group">
                <label>
                  Student ID
                </label>

                <input
                  name="studentId"
                  value={
                    form.studentId ??
                    ""
                  }
                  type="text"
                  readOnly
                  disabled
                  placeholder={
                    editingStudent
                      ? "Student ID"
                      : "Auto Generated"
                  }
                  style={{
                    backgroundColor:
                      "#f3f4f6",

                    cursor:
                      "not-allowed",
                  }}
                />

                <small
                  style={{
                    display:
                      "block",

                    marginTop:
                      "5px",

                    color:
                      "#667085",

                    fontSize:
                      "12px",
                  }}
                >
                  {editingStudent
                    ? "Student ID cannot be changed."
                    : "Student ID will be generated automatically."}
                </small>
              </div>

              {/* NAME */}

              <div className="form-group">
                <label>
                  Student Name
                </label>

                <input
                  name="name"
                  value={
                    form.name ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="text"
                  required
                />
              </div>

              {/* COURSE */}

              <div className="form-group">
                <label>
                  Course
                </label>

                <input
                  name="course"
                  value={
                    form.course ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="text"
                  required
                />
              </div>

              {/* MOBILE */}

              <div className="form-group">
                <label>
                  Mobile Number
                </label>

                <input
                  name="mobile"
                  value={
                    form.mobile ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="tel"
                />
              </div>

              {/* EMAIL */}

              <div className="form-group">
                <label>
                  Email
                </label>

                <input
                  name="email"
                  value={
                    form.email ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="email"
                />
              </div>

              {/* CITY */}

              <div className="form-group">
                <label>
                  City
                </label>

                <input
                  name="city"
                  value={
                    form.city ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="text"
                />
              </div>

              {/* TOTAL FEE */}

              <div className="form-group">
                <label>
                  Total Fee
                </label>

                <input
                  name="totalFee"
                  value={
                    form.totalFee ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="number"
                  min="0"
                  placeholder="Enter total fee"
                  required
                />
              </div>

              {/* PAID FEE */}

              <div className="form-group">
                <label>
                  Paid Fee
                </label>

                <input
                  name="paidFee"
                  value={
                    form.paidFee ??
                    ""
                  }
                  onChange={
                    change
                  }
                  type="number"
                  min="0"
                  max={
                    form.totalFee ||
                    undefined
                  }
                  placeholder="Enter paid fee"
                  required
                />
              </div>

              {/* BALANCE FEE */}

              <div className="form-group">
                <label>
                  Balance Fee
                </label>

                <input
                  name="balanceFee"
                  value={calculateBalanceFee(
                    form.totalFee,
                    form.paidFee
                  )}
                  type="number"
                  readOnly
                  tabIndex="-1"
                  style={{
                    backgroundColor:
                      "#f3f4f6",

                    cursor:
                      "not-allowed",
                  }}
                />

                <small
                  style={{
                    display:
                      "block",

                    marginTop:
                      "5px",

                    color:
                      "#667085",

                    fontSize:
                      "12px",
                  }}
                >
                  Total Fee − Paid Fee
                </small>
              </div>

              {/* CATEGORY */}

              <div className="form-group">
                <label>
                  Category
                </label>

                <select
                  name="category"
                  value={
                    form.category ||
                    ""
                  }
                  onChange={
                    change
                  }
                  required
                >
                  <option value="">
                    {categoryLoading
                      ? "Loading Categories..."
                      : "Select Category"}
                  </option>

                  {categories.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* DUE DATE */}

              <div className="form-group">
                <label>
                  Due Date
                </label>

                <input
                  type="date"
                  name="dueDate"
                  value={
                    form.dueDate ||
                    ""
                  }
                  onChange={
                    change
                  }
                  required
                />
              </div>

              {/* JOIN DATE */}

              <div className="form-group">
                <label>
                  Join Date
                </label>

                <input
                  type="date"
                  name="joinDate"
                  value={
                    form.joinDate ||
                    ""
                  }
                  onChange={
                    change
                  }
                  required={
                    !editingStudent
                  }
                  readOnly={
                    !!editingStudent
                  }
                />
              </div>

              {/* STATUS */}

              <div className="form-group">
                <label>
                  Status
                </label>

                <select
                  name="status"
                  value={
                    form.status ||
                    "Active"
                  }
                  onChange={
                    change
                  }
                  required
                >
                  {STATUS_OPTIONS.map(
                    (
                      status
                    ) => (
                      <option
                        key={
                          status
                        }
                        value={
                          status
                        }
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* MESSAGE */}

            {message && (
              <div
                className={
                  message.includes(
                    "Unable"
                  ) ||
                  message.includes(
                    "Please select"
                  ) ||
                  message.includes(
                    "cannot be greater"
                  )
                    ? "error-message"
                    : "success-message"
                }
              >
                {message}
              </div>
            )}

            {/* ACTIONS */}

            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={
                  closeForm
                }
              >
                Close
              </button>

              <button
                type="submit"
                className="primary"
                disabled={
                  saving ||
                  categoryLoading
                }
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
          VIEW STUDENT
      ================================================== */}

      {selected && (
        <div
          className="student-detail-modal"
          onClick={() =>
            setSelected(
              null
            )
          }
        >
          <div
            className="student-detail-content"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
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
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                Close
              </button>
            </div>

            <div className="student-details-grid">
              {[
                [
                  "Student ID",
                  selected.displayStudentId,
                ],

                [
                  "Student Name",
                  selected.name,
                ],

                [
                  "Course",
                  selected.course,
                ],

                [
                  "Mobile",
                  selected.mobile,
                ],

                [
                  "Email",
                  selected.email,
                ],

                [
                  "City",
                  selected.city,
                ],

                [
                  "Category",
                  selected.category,
                ],

                [
                  "Total Fee",
                  `₹${formatMoney(
                    selected.totalFee
                  )}`,
                ],

                [
                  "Paid Fee",
                  `₹${formatMoney(
                    selected.paidFee
                  )}`,
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

                [
                  "Due Date",
                  selected.dueDate,
                ],

                [
                  "Join Date",
                  selected.joinDate,
                ],

                [
                  "Next Follow-up Date",
                  getNextFollowUpDate(
                    selected
                  ),
                ],

                [
                  "Status",
                  normalizeStatus(
                    selected.status
                  ),
                ],
              ].map(
                ([
                  label,
                  value,
                ]) => (
                  <div
                    className={
                      label ===
                      "Total Fee"
                        ? "detail-box total-detail-box"
                        : "detail-box"
                    }
                    key={
                      label
                    }
                  >
                    <span>
                      {label}
                    </span>

                    <strong>
                      {value ||
                        "-"}
                    </strong>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}