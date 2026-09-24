import React, {
  useEffect,
  useRef,
  useState,
} from "react";

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

  // YYYY-MM-DD
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  // ISO datetime
  if (
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    return value.substring(0, 10);
  }

  // DD-MM-YYYY
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

  // DD/MM/YYYY
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
// STUDENT UNIQUE KEY
// ======================================================
// IMPORTANT:
// Use database ID first.
// If database ID is not available, use Student ID.
// Otherwise use name + mobile + email.
//
// This helps prevent the same student from appearing
// twice in the React table.
// ======================================================

const getStudentUniqueKey = (
  student = {}
) => {
  const databaseId =
    student.id ??
    student.studentId ??
    student.student_id;

  if (
    databaseId !== undefined &&
    databaseId !== null &&
    String(databaseId).trim() !== ""
  ) {
    return `id-${String(
      databaseId
    ).trim()}`;
  }

  const mobile =
    student.mobile ??
    student.mobile_no ??
    "";

  const email =
    student.email ?? "";

  const name =
    student.name ??
    student.candidate_name ??
    "";

  return `data-${[
    String(name)
      .trim()
      .toLowerCase(),

    String(mobile).trim(),

    String(email)
      .trim()
      .toLowerCase(),
  ].join("|")}`;
};

// ======================================================
// OLD STUDENT KEY
// ======================================================
// Kept for table fallback / compatibility.
// ======================================================

const studentKey = (
  student = {}
) => {
  return getStudentUniqueKey(student);
};

// ======================================================
// NORMALIZE STUDENT
// ======================================================

const normalize = (
  student = {}
) => {
  // ====================================================
  // PAID FEE
  // ====================================================

  const paidFee =
    Number(
      student.paidFee ??
        student.paid_fee ??
        0
    ) || 0;

  // ====================================================
  // TOTAL FEE
  // ====================================================

  const rawTotalFee =
    student.totalFee ??
    student.total_fee;

  // ====================================================
  // OLD BALANCE FEE
  // ====================================================

  const rawBalanceFee =
    Number(
      student.balanceFee ??
        student.balance_fee ??
        0
    ) || 0;

  // ====================================================
  // TOTAL FEE
  // ====================================================

  const totalFee =
    rawTotalFee !== undefined &&
    rawTotalFee !== null &&
    rawTotalFee !== ""
      ? Number(rawTotalFee) || 0
      : paidFee + rawBalanceFee;

  // ====================================================
  // ALWAYS CALCULATE BALANCE
  // ====================================================

  const balanceFee =
    calculateBalanceFee(
      totalFee,
      paidFee
    );

  return {
    ...student,

    // Database ID
    id:
      student.id ??
      student.studentId ??
      student.student_id ??
      "",

    // Keep Student ID fields available
    studentId:
      student.studentId ??
      student.student_id ??
      student.id ??
      "",

    student_id:
      student.student_id ??
      student.studentId ??
      student.id ??
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

    // ==================================================
    // FEE VALUES
    // ==================================================

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
// IMPORTANT:
// This function removes duplicate rows.
//
// Example:
// API returns the same student twice:
//
// ID 10
// ID 10
//
// Only one row will be displayed.
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
        getStudentUniqueKey(
          item
        );

      if (!map.has(key)) {
        map.set(
          key,
          item
        );

        return;
      }

      // If duplicate exists, merge latest data
      map.set(key, {
        ...map.get(key),
        ...item,
      });
    }
  );

  return Array.from(
    map.values()
  );
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

const getStatusStyle = (
  status
) => {
  const normalized =
    normalizeStatus(status);

  if (
    normalized ===
    "Active"
  ) {
    return {
      background:
        "#e8f7ee",
      color:
        "#1f7a45",
    };
  }

  if (
    normalized ===
    "Inactive"
  ) {
    return {
      background:
        "#f1f1f1",
      color:
        "#666666",
    };
  }

  if (
    normalized ===
    "Closed"
  ) {
    return {
      background:
        "#fdecec",
      color:
        "#b42318",
    };
  }

  return {
    background:
      "#eaf2ff",
    color:
      "#175cd3",
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
  ] = useState(
    initialForm
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    saving,
    setSaving,
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
        length:
          Math.max(
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

      console.error(
        "Category API error:",
        error.response?.data
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

      // ==================================================
      // IMPORTANT
      // Remove duplicates from API result.
      // ==================================================

      const uniqueStudents =
        mergeStudents(
          apiStudents
        );

      setStudents(
        uniqueStudents
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
  // FILTER BY SESSION
  // ====================================================

const filteredStudents = students
  .filter((student) => {
    const date = getStudentJoinMonthYear(student);

    if (!date) {
      return false;
    }

    return (
      date.year === Number(selectedYear) &&
      date.month === Number(selectedMonth)
    );
  })
  .sort((a, b) => {
    // Newest Join Date first
    const dateA = new Date(
      a.joinDate || a.join_date || 0
    );

    const dateB = new Date(
      b.joinDate || b.join_date || 0
    );

    const timeA = dateA.getTime() || 0;
    const timeB = dateB.getTime() || 0;

    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // If Join Date is same,
    // higher database ID comes first
    return Number(b.id || 0) - Number(a.id || 0);
  });

  // ====================================================
  // RESET PAGE WHEN SESSION CHANGES
  // ====================================================

  useEffect(() => {
    setPage(1);
  }, [
    selectedMonth,
    selectedYear,
  ]);

  // ====================================================
  // AUTOMATIC MONTH/YEAR UPDATE
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
        60 *
          60 *
          1000
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
  // DOWNLOAD SESSION
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
            student.studentId ||
              student.student_id ||
              student.id ||
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

      // ==================================================
      // PAID / TOTAL FEE CHANGE
      // ==================================================

      if (
        name ===
          "paidFee" ||
        name ===
          "totalFee"
      ) {
        const totalFee =
          Number(
            next.totalFee
          ) || 0;

        const paidFee =
          Number(
            next.paidFee
          ) || 0;

        next.balanceFee =
          calculateBalanceFee(
            totalFee,
            paidFee
          );
      }

      // ==================================================
      // STATUS
      // ==================================================

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

    // ==================================================
    // IMPORTANT:
    // Prevent double-click / multiple POST requests.
    // ==================================================

    if (saving) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      // ==================================================
      // DATE VALUES
      // ==================================================

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
            editingStudent?.next_followup_date ||
            ""
        );

      // ==================================================
      // FEE CALCULATION
      // ==================================================

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

      // ==================================================
      // VALIDATE PAID FEE
      // ==================================================

      if (
        editedPaidFee >
        editedTotalFee
      ) {
        setMessage(
          "Paid Fee cannot be greater than Total Fee."
        );

        return;
      }

      // ==================================================
      // STUDENT ID
      // ==================================================

      const enteredStudentId =
        String(
          form.studentId ||
            ""
        ).trim();

      if (
        !enteredStudentId
      ) {
        setMessage(
          "Student ID is required."
        );

        return;
      }

      // ==================================================
      // DUPLICATE STUDENT ID CHECK
      // ==================================================
      //
      // This prevents the user from submitting the
      // same Student ID again.
      //
      // ==================================================

      const duplicateStudent =
        students.find(
          (student) => {
            const existingStudentId =
              String(
                student.studentId ??
                  student.student_id ??
                  student.id ??
                  ""
              ).trim();

            const currentDatabaseId =
              String(
                editingStudent?.id ??
                  ""
              ).trim();

            const existingDatabaseId =
              String(
                student.id ??
                  ""
              ).trim();

            const isSameEditingStudent =
              editingStudent &&
              currentDatabaseId !==
                "" &&
              currentDatabaseId ===
                existingDatabaseId;

            return (
              existingStudentId ===
                enteredStudentId &&
              !isSameEditingStudent
            );
          }
        );

      if (
        duplicateStudent
      ) {
        setMessage(
          `Student ID "${enteredStudentId}" already exists. Please use a different Student ID.`
        );

        return;
      }

      // ==================================================
      // CATEGORY
      // ==================================================

      const selectedCategory =
        String(
          form.category ||
            ""
        ).trim();

      if (
        !selectedCategory
      ) {
        setMessage(
          "Please select a category."
        );

        return;
      }

      // ==================================================
      // STATUS
      // ==================================================

      const selectedStatus =
        normalizeStatus(
          form.status
        );

      // ==================================================
      // STUDENT DATA
      // ==================================================

      const studentData = {
        ...form,

        // Keep Student ID separate
        studentId:
          enteredStudentId,

        student_id:
          enteredStudentId,

        // Database ID only for edit
        id:
          editingStudent?.id ||
          undefined,

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
            response?.data ||
            {};

          updatedStudent =
            normalize({
              ...editingStudent,
              ...apiResponse,

              id:
                apiResponse.id ||
                editingStudent.id,

              studentId:
                apiResponse.studentId ||
                apiResponse.student_id ||
                enteredStudentId,

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
                apiResponse.next_followup_date ||
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
            });
        }

        // ==================================================
        // FORCE CORRECT VALUES
        // ==================================================

        updatedStudent = {
          ...updatedStudent,

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

        // ==================================================
        // UPDATE LOCAL LIST
        // ==================================================

        setStudents(
          (prev) =>
            mergeStudents(
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
                      }
                    : item
              )
            )
        );

        // ==================================================
        // UPDATE VIEW MODAL
        // ==================================================

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

        return;
      }

      // ==================================================
      // CREATE NEW STUDENT
      // ==================================================

      const response =
        await studentApi.create(
          studentData
        );

      console.log(
        "Student created:",
        response?.data
      );

      // ==================================================
      // IMPORTANT:
      //
      // DO NOT DO THIS:
      //
      // setStudents(prev => [
      //   ...prev,
      //   savedStudent
      // ]);
      //
      // Because the API list may already contain the
      // newly-created student.
      //
      // We reload from the database only once.
      // ==================================================

      setMessage(
        "Student added successfully."
      );

      // ==================================================
      // RELOAD FROM DATABASE
      // ==================================================

      await loadStudents();

      // ==================================================
      // CLOSE FORM
      // ==================================================

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
        "Student save failed:",
        error
      );

      console.error(
        "API error response:",
        error?.response?.data
      );

      // ==================================================
      // DUPLICATE STUDENT ID FROM BACKEND
      // ==================================================

      if (
        error?.response?.status ===
          409 ||
        error?.response?.data
          ?.message ===
          "Student ID already exists."
      ) {
        setMessage(
          "Student ID already exists. Please enter a different Student ID."
        );

        return;
      }

      // ==================================================
      // OTHER ERRORS
      // ==================================================

      setMessage(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Unable to save student. Please check the API connection."
      );
    } finally {
      setSaving(false);
    }
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
        student.studentId ||
        student.student_id ||
        student.id ||
        "",

      name:
        student.name ||
        "",

      course:
        student.course ||
        "",

      mobile:
        student.mobile ||
        "",

      email:
        student.email ||
        "",

      city:
        student.city ||
        "",

      category:
        student.category ||
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
        setSelected(
          null
        );
      }

      const remaining =
        filteredStudents.length -
        1;

      const maxPage =
        Math.max(
          1,
          Math.ceil(
            remaining /
              10
          )
        );

      if (
        page >
        maxPage
      ) {
        setPage(
          maxPage
        );
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

      category: "",

      status: "Active",
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
          YEAR / MONTH SESSION
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
        {/* YEAR */}

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

        {/* MONTH */}

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
                  key={
                    month
                  }
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

        {/* DOWNLOAD */}

        <button
          type="button"
          className="primary"
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
        {/* ==================================================
            TABLE
        ================================================== */}

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
                          getStudentUniqueKey(
                            student
                          )
                        }
                      >
                        <td className="student-id-cell">
                          {student.studentId ||
                            student.student_id ||
                            student.id ||
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

                        <td>
                          <span
                            style={{
                              display:
                                "inline-block",

                              padding:
                                "5px 10px",

                              borderRadius:
                                "999px",

                              fontSize:
                                "12px",

                              fontWeight:
                                600,

                              background:
                                statusStyle.background,

                              color:
                                statusStyle.color,
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="action-column">
                          <div className="student-action-buttons">
                            {/* VIEW */}

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

                            {/* EDIT */}

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

                            {/* DELETE */}

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
                    colSpan="9"
                    className="no-students"
                  >
                    No students found for{" "}
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

        {/* ==================================================
            PAGINATION
        ================================================== */}

        <Pagination
          page={page}
          setPage={setPage}
          total={
            filteredStudents.length
          }
        />
      </Panel>

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
            {/* HEADER */}

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

            {/* FORM */}

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
                  onChange={
                    change
                  }
                  type="text"
                  required
                />
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
                  ) ||
                  message.includes(
                    "already exists"
                  ) ||
                  message.includes(
                    "required"
                  )
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
            {/* HEADER */}

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

            {/* DETAILS */}

            <div className="student-details-grid">
              {[
                [
                  "Student ID",
                  selected.studentId ||
                    selected.student_id ||
                    selected.id,
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