import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  enquiryApi,
  referralApi,
} from "../services/api";

import {
  Panel,
  Badge,
  Pagination,
} from "../components/Ui";

/* =========================================================
   DEFAULT FORM
========================================================= */

const emptyForm = {
  candidate_name: "",
  mobile: "",
  city: "",
  type: "",
  category: "",
  course: "",
  referred_by: "",
  comments: "",
  next_followup_date: "",
  status: "Pending",
};

/* =========================================================
   DEFAULT TYPES FOR ADD / EDIT FORM

   IMPORTANT:
   These are ONLY for the Add/Edit Type dropdown.

   They are NOT used for the Type FILTER.
========================================================= */

const DEFAULT_TYPES = [
  "Students",
  "Freshers",
  "Experience in Non IT",
  "Experience in IT",
  "Career Gap",
  "Others",
];

/* =========================================================
   TYPE CACHE

   Used only as a compatibility fallback for older
   enquiries where the backend may not yet return `type`.

   IMPORTANT:
   The Type FILTER itself is generated ONLY from
   the current enquiry table rows.
========================================================= */

const TYPE_CACHE_KEY =
  "scot_it_enquiry_types";

/* =========================================================
   TYPE NAME HELPER
========================================================= */

function getTypeName(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return String(
      value.name ||
        value.type ||
        value.title ||
        value.type_name ||
        ""
    ).trim();
  }

  return String(value).trim();
}

/* =========================================================
   NORMALIZE TYPE

   Old "Experience" values are converted to "Others".
========================================================= */

function normalizeTypeValue(value) {
  const type = getTypeName(value);

  if (!type) {
    return "";
  }

  if (
    type.toLowerCase() ===
    "experience"
  ) {
    return "Others";
  }

  return type.trim();
}

/* =========================================================
   TYPE CACHE HELPERS
========================================================= */

function getAllCachedTypes() {
  try {
    const value =
      localStorage.getItem(
        TYPE_CACHE_KEY
      );

    if (!value) {
      return {};
    }

    const parsed =
      JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return {};
    }

    return parsed;
  } catch (error) {
    console.warn(
      "Unable to read Type cache:",
      error
    );

    return {};
  }
}

function getCachedType(id) {
  if (!id) {
    return "";
  }

  const cache =
    getAllCachedTypes();

  return normalizeTypeValue(
    cache[String(id)] || ""
  );
}

function setCachedType(
  id,
  type
) {
  if (!id) {
    return;
  }

  const cache =
    getAllCachedTypes();

  const normalizedType =
    normalizeTypeValue(type);

  if (normalizedType) {
    cache[String(id)] =
      normalizedType;
  } else {
    delete cache[String(id)];
  }

  try {
    localStorage.setItem(
      TYPE_CACHE_KEY,
      JSON.stringify(cache)
    );
  } catch (error) {
    console.warn(
      "Unable to save Type cache:",
      error
    );
  }
}

/* =========================================================
   DATE HELPERS
========================================================= */

function normalizeDateForInput(
  value
) {
  if (!value) {
    return "";
  }

  const str =
    String(value).trim();

  if (!str) {
    return "";
  }

  /* YYYY-MM-DD */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      str
    )
  ) {
    return str;
  }

  /* YYYY-MM-DDTHH:mm:ss */

  if (
    /^\d{4}-\d{2}-\d{2}T/.test(
      str
    )
  ) {
    return str.substring(0, 10);
  }

  /* YYYY-MM-DD HH:mm:ss */

  if (
    /^\d{4}-\d{2}-\d{2}\s/.test(
      str
    )
  ) {
    return str.substring(0, 10);
  }

  /* DD-MM-YYYY */

  if (
    /^\d{2}-\d{2}-\d{4}$/.test(
      str
    )
  ) {
    const [
      day,
      month,
      year,
    ] = str.split("-");

    return `${year}-${month}-${day}`;
  }

  /* DD/MM/YYYY */

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(
      str
    )
  ) {
    const [
      day,
      month,
      year,
    ] = str.split("/");

    return `${year}-${month}-${day}`;
  }

  return "";
}

/* =========================================================
   NORMALIZE ENQUIRY

   TYPE RULE:

   1. First use row.type.
   2. For old records only, use cached Type.
   3. DO NOT use degree/education/type_name as Type.
========================================================= */

function normalize(row = {}) {
  const backendType =
    normalizeTypeValue(
      row.type
    );

  const cachedType =
    getCachedType(row.id);

  const finalType =
    backendType ||
    cachedType ||
    "";

  const followupDate =
    normalizeDateForInput(
      row.next_followup_date ??
        row.nextFollowUpDate ??
        row.next_follow_up_date ??
        row.followup_date ??
        row.follow_up_date ??
        row.date ??
        ""
    );

  return {
    ...row,

    id: row.id,

    name:
      row.name ||
      row.candidate_name ||
      "",

    candidate_name:
      row.candidate_name ||
      row.name ||
      "",

    mobile:
      row.mobile ||
      row.mobile_no ||
      "",

    city:
      row.city ||
      "",

    /* TYPE */

    type: finalType,

    /* Compatibility */

    type_name: finalType,

    education:
      row.education ||
      "",

    category:
      row.category ||
      "",

    course:
      row.course ||
      "",

    comments:
      row.comments ||
      "",

    next_followup_date:
      followupDate,

    date:
      followupDate,

    status:
      row.status ||
      row.final_status ||
      row.finalStatus ||
      "Pending",

    referred_by:
      row.referred_by ||
      row.referredBy ||
      "",
  };
}

/* =========================================================
   FORM BUILDER
========================================================= */

function enquiryToForm(
  row = {}
) {
  const normalized =
    normalize(row);

  return {
    ...emptyForm,

    candidate_name:
      normalized.candidate_name,

    mobile:
      normalized.mobile,

    city:
      normalized.city,

    type:
      normalizeTypeValue(
        normalized.type
      ),

    category:
      normalized.category,

    course:
      normalized.course,

    referred_by:
      normalized.referred_by,

    comments:
      normalized.comments,

    next_followup_date:
      normalizeDateForInput(
        normalized.next_followup_date
      ),

    status:
      normalized.status ||
      "Pending",
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function EnquiryList() {
  const [rows, setRows] =
    useState([]);

  const [q, setQ] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [modal, setModal] =
    useState(null);

  const [form, setForm] =
    useState({
      ...emptyForm,
    });

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [referrals, setReferrals] =
    useState([]);

  const [
    referralsLoading,
    setReferralsLoading,
  ] = useState(false);

  const ITEMS_PER_PAGE = 10;

  /* =========================================================
     LOAD ENQUIRIES
  ========================================================= */

  async function loadEnquiries() {
    setLoading(true);
    setError("");

    try {
      const response =
        await enquiryApi.list();

      const responseData =
        response?.data;

      const data =
        responseData?.results ||
        responseData ||
        [];

      if (Array.isArray(data)) {
        const normalizedRows =
          data.map(normalize);

        setRows(
          normalizedRows
        );
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error(
        "Failed to load enquiries:",
        err
      );

      setRows([]);

      setError(
        "Unable to load enquiries. Please check the API connection."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD REFERRED BY
  ========================================================= */

  async function loadReferrals() {
    setReferralsLoading(true);

    try {
      const response =
        await referralApi.list();

      const responseData =
        response?.data;

      const data =
        responseData?.results ||
        responseData ||
        [];

      const cleanData =
        Array.isArray(data)
          ? data
              .map((item) => ({
                id: item.id,

                name: String(
                  item.name ||
                    item.referral_name ||
                    item.title ||
                    ""
                ).trim(),
              }))
              .filter(
                (item) =>
                  item.name
              )
          : [];

      cleanData.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );

      setReferrals(
        cleanData
      );
    } catch (err) {
      console.error(
        "Failed to load Referred By data:",
        err
      );

      setReferrals([]);
    } finally {
      setReferralsLoading(
        false
      );
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadEnquiries();
    loadReferrals();
  }, []);

  /* =========================================================
     TYPE FILTER LIST

     IMPORTANT:

     This list contains ONLY Types currently
     available in the All Enquiries table.

     It does NOT contain DEFAULT_TYPES.

     Example current table:

       Students
       Freshers
       Career Gap

     Filter becomes:

       All Types
       Career Gap
       Freshers
       Students
  ========================================================= */

  const types = useMemo(() => {
    const typeSet =
      new Set();

    rows.forEach((row) => {
      const type =
        normalizeTypeValue(
          row.type
        );

      if (type) {
        typeSet.add(type);
      }
    });

    return Array.from(
      typeSet
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [rows]);

  /* =========================================================
     EDIT FORM TYPE LIST

     IMPORTANT:

     This is DIFFERENT from `types`.

     The Edit form always shows all standard Types:

       Students
       Freshers
       Experience in Non IT
       Experience in IT
       Career Gap
       Others

     It also adds any custom Type currently
     available in the enquiry table.

     It also keeps the current form value.
  ========================================================= */

  const editTypes = useMemo(() => {
    const values = [];

    /* ---------------------------------------------
       1. Add standard Types first
    --------------------------------------------- */

    DEFAULT_TYPES.forEach(
      (type) => {
        const normalized =
          normalizeTypeValue(
            type
          );

        if (
          normalized &&
          !values.includes(
            normalized
          )
        ) {
          values.push(
            normalized
          );
        }
      }
    );

    /* ---------------------------------------------
       2. Add custom Types from current table
    --------------------------------------------- */

    rows.forEach((row) => {
      const type =
        normalizeTypeValue(
          row.type
        );

      if (
        type &&
        !values.includes(type)
      ) {
        values.push(type);
      }
    });

    /* ---------------------------------------------
       3. Add currently selected form Type
    --------------------------------------------- */

    const currentFormType =
      normalizeTypeValue(
        form.type
      );

    if (
      currentFormType &&
      !values.includes(
        currentFormType
      )
    ) {
      values.push(
        currentFormType
      );
    }

    /* ---------------------------------------------
       Keep default order.
       Sort only custom Types.
    --------------------------------------------- */

    const defaultSet =
      new Set(
        DEFAULT_TYPES.map(
          normalizeTypeValue
        )
      );

    const customTypes =
      values
        .filter(
          (type) =>
            !defaultSet.has(
              type
            )
        )
        .sort((a, b) =>
          a.localeCompare(b)
        );

    return [
      ...DEFAULT_TYPES.map(
        normalizeTypeValue
      ),
      ...customTypes,
    ].filter(
      (type, index, array) =>
        type &&
        array.indexOf(
          type
        ) === index
    );
  }, [
    rows,
    form.type,
  ]);

  /* =========================================================
     AUTOMATICALLY RESET TYPE FILTER

     Example:

     Current table:
       Students
       Career Gap

     User selects:
       Career Gap

     Then edits the last Career Gap record to:
       Students

     Career Gap disappears from `types`.

     This automatically clears the old filter,
     so the table does not become unexpectedly empty.
  ========================================================= */

  useEffect(() => {
    const selectedType =
      normalizeTypeValue(
        typeFilter
      );

    if (
      selectedType &&
      !types.includes(
        selectedType
      )
    ) {
      setTypeFilter("");
      setPage(1);
    }
  }, [
    types,
    typeFilter,
  ]);

  /* =========================================================
     CATEGORIES
  ========================================================= */

  const categories =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .map(
              (row) =>
                row.category
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [rows]);

  /* =========================================================
     STATUSES
  ========================================================= */

  const statuses =
    useMemo(() => {
      return [
        ...new Set(
          rows
            .map(
              (row) =>
                row.status
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [rows]);

  /* =========================================================
     FILTER
  ========================================================= */

  const allFiltered =
    useMemo(() => {
      const search =
        q
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          const matchesSearch =
            !search ||
            `${row.name || ""} ${
              row.mobile || ""
            } ${
              row.course || ""
            }`
              .toLowerCase()
              .includes(search);

          const rowType =
            normalizeTypeValue(
              row.type
            );

          const selectedType =
            normalizeTypeValue(
              typeFilter
            );

          const matchesType =
            !selectedType ||
            rowType ===
              selectedType;

          const matchesCategory =
            !category ||
            row.category ===
              category;

          const matchesStatus =
            !status ||
            row.status ===
              status;

          return (
            matchesSearch &&
            matchesType &&
            matchesCategory &&
            matchesStatus
          );
        }
      );
    }, [
      rows,
      q,
      typeFilter,
      category,
      status,
    ]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        allFiltered.length /
          ITEMS_PER_PAGE
      )
    );

  useEffect(() => {
    if (
      page >
      totalPages
    ) {
      setPage(
        totalPages
      );
    }
  }, [
    page,
    totalPages,
  ]);

  const filtered =
    useMemo(() => {
      const sorted = [
        ...allFiltered,
      ].sort(
        (a, b) =>
          Number(b.id || 0) -
          Number(a.id || 0)
      );

      const start =
        (page - 1) *
        ITEMS_PER_PAGE;

      return sorted.slice(
        start,
        start +
          ITEMS_PER_PAGE
      );
    }, [
      allFiltered,
      page,
    ]);

  /* =========================================================
     SEARCH / FILTER
  ========================================================= */

  function updateFilter(
    setter,
    value
  ) {
    setter(value);
    setPage(1);
  }

  /* =========================================================
     VIEW
  ========================================================= */

  async function openView(row) {
    setMessage("");
    setError("");

    try {
      const response =
        await enquiryApi.detail(
          row.id
        );

      const detail =
        normalize({
          ...row,
          ...(response?.data ||
            {}),
        });

      setModal({
        type: "view",
        row: detail,
      });
    } catch (err) {
      console.error(
        "View enquiry failed:",
        err
      );

      setModal({
        type: "view",
        row: normalize(row),
      });
    }
  }

  /* =========================================================
     EDIT
  ========================================================= */

  async function openEdit(row) {
    setMessage("");
    setError("");

    await loadReferrals();

    let editData =
      normalize(row);

    try {
      const response =
        await enquiryApi.detail(
          row.id
        );

      editData =
        normalize({
          ...row,
          ...(response?.data ||
            {}),
        });
    } catch (err) {
      console.warn(
        "Could not load enquiry detail. Using table data.",
        err
      );
    }

    const editForm =
      enquiryToForm(
        editData
      );

    editForm.type =
      normalizeTypeValue(
        editForm.type
      );

    setForm(
      editForm
    );

    setModal({
      type: "edit",
      row: editData,
    });
  }

  /* =========================================================
     FORM CHANGE
  ========================================================= */

  function change(event) {
    const {
      name,
      value,
    } = event.target;

    let nextValue =
      value;

    if (
      name === "type"
    ) {
      nextValue =
        normalizeTypeValue(
          value
        );
    }

    if (
      name ===
      "next_followup_date"
    ) {
      nextValue =
        normalizeDateForInput(
          value
        );
    }

    setForm(
      (previous) => ({
        ...previous,
        [name]: nextValue,
      })
    );
  }

  /* =========================================================
     DELETE
  ========================================================= */

  async function remove(row) {
    const confirmed =
      window.confirm(
        `Delete the enquiry for ${row.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await enquiryApi.remove(
        row.id
      );

      setRows(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== row.id
          )
      );

      setCachedType(
        row.id,
        ""
      );

      if (
        filtered.length === 1 &&
        page > 1
      ) {
        setPage(
          page - 1
        );
      }

      setMessage(
        "Enquiry deleted successfully."
      );
    } catch (err) {
      console.error(
        "Delete enquiry failed:",
        err
      );

      setError(
        "Unable to delete enquiry."
      );
    }
  }

  /* =========================================================
     SAVE / UPDATE

     Type is sent using both:
       type
       education

     This keeps compatibility with the
     existing backend.
  ========================================================= */

  async function save(event) {
    event.preventDefault();

    if (!modal?.row?.id) {
      setError(
        "Enquiry ID is missing."
      );

      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    const selectedType =
      normalizeTypeValue(
        form.type
      );

    const selectedReferredBy =
      String(
        form.referred_by || ""
      ).trim();

    const payload = {
      candidate_name:
        String(
          form.candidate_name ||
            ""
        ).trim(),

      mobile:
        String(
          form.mobile || ""
        ).trim(),

      city:
        String(
          form.city || ""
        ).trim(),

      type:
        selectedType,

      education:
        selectedType,

      category:
        String(
          form.category || ""
        ).trim(),

      course:
        String(
          form.course || ""
        ).trim(),

      referred_by:
        selectedReferredBy,

      comments:
        String(
          form.comments || ""
        ).trim(),

      status:
        String(
          form.status ||
            "Pending"
        ).trim(),

      next_followup_date:
        normalizeDateForInput(
          form.next_followup_date
        ),
    };

    console.log(
      "Updating enquiry:",
      modal.row.id
    );

    console.log(
      "Selected Type:",
      selectedType
    );

    console.log(
      "Selected Referred By:",
      selectedReferredBy
    );

    console.log(
      "Update payload:",
      payload
    );

    try {
      const response =
        await enquiryApi.update(
          modal.row.id,
          payload
        );

      console.log(
        "Update API response:",
        response?.data
      );

      const responseData =
        response?.data || {};

      /* =====================================================
         BUILD UPDATED OBJECT
      ===================================================== */

      const updated =
        normalize({
          ...modal.row,
          ...responseData,

          type:
            responseData.type ||
            responseData.type_name ||
            selectedType,

          education:
            responseData.education ||
            selectedType,

          referred_by:
            responseData.referred_by ??
            selectedReferredBy,

          candidate_name:
            responseData.candidate_name ||
            payload.candidate_name,

          mobile:
            responseData.mobile ||
            payload.mobile,

          city:
            responseData.city ||
            payload.city,

          category:
            responseData.category ||
            payload.category,

          course:
            responseData.course ||
            payload.course,

          comments:
            responseData.comments ??
            payload.comments,

          status:
            responseData.status ||
            payload.status,

          next_followup_date:
            responseData.next_followup_date ||
            payload.next_followup_date,
        });

      /* =====================================================
         SAVE TYPE LOCALLY
      ===================================================== */

      setCachedType(
        modal.row.id,
        selectedType
      );

      /* =====================================================
         IMPORTANT:

         UPDATE TABLE IMMEDIATELY.

         Because `types` depends on `rows`,
         the Type FILTER will automatically
         update here.
      ===================================================== */

      setRows(
        (previous) =>
          previous.map(
            (row) =>
              row.id ===
              modal.row.id
                ? normalize({
                    ...row,
                    ...updated,

                    type:
                      selectedType,

                    education:
                      selectedType,

                    referred_by:
                      selectedReferredBy,

                    candidate_name:
                      payload.candidate_name,

                    mobile:
                      payload.mobile,

                    city:
                      payload.city,

                    category:
                      payload.category,

                    course:
                      payload.course,

                    comments:
                      payload.comments,

                    status:
                      payload.status,

                    next_followup_date:
                      payload.next_followup_date,
                  })
                : row
          )
      );

      /* =====================================================
         FINAL UPDATED DATA
      ===================================================== */

      const finalUpdated =
        normalize({
          ...modal.row,
          ...updated,

          type:
            selectedType,

          education:
            selectedType,

          referred_by:
            selectedReferredBy,

          candidate_name:
            payload.candidate_name,

          mobile:
            payload.mobile,

          city:
            payload.city,

          category:
            payload.category,

          course:
            payload.course,

          comments:
            payload.comments,

          status:
            payload.status,

          next_followup_date:
            payload.next_followup_date,
        });

      setForm(
        enquiryToForm(
          finalUpdated
        )
      );

      setModal(
        (previous) => ({
          ...previous,
          row: finalUpdated,
        })
      );

      setMessage(
        "Enquiry updated successfully."
      );

      /* =====================================================
         REFRESH FROM BACKEND
      ===================================================== */

      await loadEnquiries();

      /* =====================================================
         VERIFY BACKEND VALUE
      ===================================================== */

      try {
        const verifyResponse =
          await enquiryApi.detail(
            modal.row.id
          );

        const verifyData =
          verifyResponse?.data ||
          {};

        console.log(
          "Verified DB/API enquiry after update:",
          verifyData
        );

        console.log(
          "Verified Type:",
          verifyData.type ||
            verifyData.type_name ||
            "(backend did not return Type)"
        );
      } catch (
        verifyError
      ) {
        console.warn(
          "Could not verify updated enquiry:",
          verifyError
        );
      }
    } catch (err) {
      console.error(
        "Enquiry update failed:",
        err
      );

      console.error(
        "Backend response:",
        err?.response?.data
      );

      const apiMessage =
        err?.response?.data
          ?.message ||
        err?.response?.data
          ?.detail ||
        err?.response?.data
          ?.error;

      setError(
        apiMessage ||
          "Unable to update enquiry. Please check the API connection."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     RESET FILTERS
  ========================================================= */

  function resetFilters() {
    setQ("");
    setTypeFilter("");
    setCategory("");
    setStatus("");
    setPage(1);
  }

  /* =========================================================
     EXPORT CSV
  ========================================================= */

  function exportToExcel() {
    const data = rows;

    if (
      !data ||
      data.length === 0
    ) {
      alert(
        "No enquiry data to export."
      );

      return;
    }

    const columns = [
      {
        header: "S.No",
        key: null,
      },
      {
        header: "Candidate Name",
        key: "candidate_name",
      },
      {
        header: "Mobile",
        key: "mobile",
      },
      {
        header: "City",
        key: "city",
      },
      {
        header: "Type",
        key: "type",
      },
      {
        header: "Category",
        key: "category",
      },
      {
        header: "Course",
        key: "course",
      },
      {
        header: "Referred By",
        key: "referred_by",
      },
      {
        header: "Enquiry Date",
        key: "enquiry_date",
      },
      {
        header: "Follow-up Date",
        key: "next_followup_date",
      },
      {
        header: "Status",
        key: "status",
      },
      {
        header: "Comments",
        key: "comments",
      },
    ];

    function csvCell(value) {
      const str =
        String(
          value ?? ""
        ).trim();

      if (
        str.includes(",") ||
        str.includes("\n") ||
        str.includes('"')
      ) {
        return `"${str.replace(
          /"/g,
          '""'
        )}"`;
      }

      return str;
    }

    const headerRow =
      columns
        .map(
          (column) =>
            csvCell(
              column.header
            )
        )
        .join(",");

    const dataRows =
      data.map(
        (row, index) =>
          columns
            .map(
              (column) => {
                if (
                  column.key ===
                  null
                ) {
                  return csvCell(
                    index + 1
                  );
                }

                if (
                  column.key ===
                  "type"
                ) {
                  return csvCell(
                    normalizeTypeValue(
                      row.type
                    )
                  );
                }

                return csvCell(
                  row[
                    column.key
                  ]
                );
              }
            )
            .join(",")
      );

    const csvContent =
      "\uFEFF" +
      [
        headerRow,
        ...dataRows,
      ].join("\r\n");

    const blob =
      new Blob(
        [csvContent],
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

    const now =
      new Date();

    const dateStr =
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}-${String(
        now.getDate()
      ).padStart(
        2,
        "0"
      )}`;

    link.href = url;

    link.setAttribute(
      "download",
      `Enquiries_${dateStr}.csv`
    );

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

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <Panel
        title="All Enquiries"
        subtitle="Manage and track all candidate enquiries"
        action={
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems:
                "center",
              flexWrap:
                "wrap",
            }}
          >
            <button
              type="button"
              className="secondary"
              onClick={
                exportToExcel
              }
              title="Export all enquiries to Excel"
              style={{
                whiteSpace:
                  "nowrap",
              }}
            >
              ⬇ Export Excel
            </button>

            <a
              className="primary button-link"
              href="/add-enquiry"
            >
              + Add Enquiry
            </a>
          </div>
        }
      >
        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="filters">
          <input
            type="text"
            placeholder="Search candidate / mobile / course..."
            value={q}
            onChange={(e) =>
              updateFilter(
                setQ,
                e.target.value
              )
            }
          />

          {/* =================================================
              TYPE FILTER

              ONLY CURRENT TABLE TYPES
          ================================================= */}

          <select
            value={typeFilter}
            onChange={(e) =>
              updateFilter(
                setTypeFilter,
                e.target.value
              )
            }
          >
            <option value="">
              All Types
            </option>

            {types.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <select
            value={category}
            onChange={(e) =>
              updateFilter(
                setCategory,
                e.target.value
              )
            }
          >
            <option value="">
              All Categories
            </option>

            {categories.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <select
            value={status}
            onChange={(e) =>
              updateFilter(
                setStatus,
                e.target.value
              )
            }
          >
            <option value="">
              All Status
            </option>

            {statuses.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          {/* Clear Filters intentionally kept commented */}

          {/*
          {(q ||
            typeFilter ||
            category ||
            status) && (
            <button
              type="button"
              className="secondary"
              onClick={resetFilters}
            >
              Clear Filters
            </button>
          )}
          */}
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {message &&
          !modal && (
            <div className="success-message">
              {message}
            </div>
          )}

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "#",
                  "Candidate",
                  "Mobile",
                  "City",
                  "Type",
                  "Category",
                  "Course",
                  "Referred By",
                  "Follow-up",
                  "Status",
                  "Action",
                ].map(
                  (heading) => (
                    <th
                      key={
                        heading
                      }
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="11"
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "30px",
                    }}
                  >
                    Loading enquiries...
                  </td>
                </tr>
              ) : filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="11"
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "30px",
                    }}
                  >
                    No enquiries found.
                  </td>
                </tr>
              ) : (
                filtered.map(
                  (
                    row,
                    index
                  ) => (
                    <tr
                      key={
                        row.id
                      }
                    >
                      <td>
                        {(page -
                          1) *
                          ITEMS_PER_PAGE +
                          index +
                          1}
                      </td>

                      <td>
                        <strong>
                          {
                            row.name
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          row.mobile
                        }
                      </td>

                      <td>
                        {
                          row.city
                        }
                      </td>

                      <td>
                        {normalizeTypeValue(
                          row.type
                        ) || "-"}
                      </td>

                      <td>
                        {
                          row.category
                        }
                      </td>

                      <td>
                        {
                          row.course
                        }
                      </td>

                      <td>
                        {
                          row.referred_by ||
                          "-"
                        }
                      </td>

                      <td>
                        {normalizeDateForInput(
                          row.next_followup_date ||
                            row.date
                        ) || "-"}
                      </td>

                      <td>
                        <Badge
                          status={
                            row.status
                          }
                        />
                      </td>

                      <td>
                        <div className="action-buttons">
                          <button
                            className="icon-btn"
                            aria-label={`View ${row.name}`}
                            title="View"
                            onClick={() =>
                              openView(
                                row
                              )
                            }
                          >
                            👁
                          </button>

                          <button
                            className="icon-btn"
                            aria-label={`Edit ${row.name}`}
                            title="Edit"
                            onClick={() =>
                              openEdit(
                                row
                              )
                            }
                          >
                            ✎
                          </button>

                          <button
                            className="icon-btn delete-btn"
                            aria-label={`Delete ${row.name}`}
                            title="Delete"
                            onClick={() =>
                              remove(
                                row
                              )
                            }
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <Pagination
          page={page}
          setPage={setPage}
          total={
            allFiltered.length
          }
        />

        {/* =================================================
            VIEW MODAL
        ================================================= */}

        {modal?.type ===
          "view" && (
          <div
            className="modal-backdrop"
            onClick={() =>
              setModal(null)
            }
          >
            <div
              className="modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <h3>
                    {
                      modal.row
                        .name
                    }
                  </h3>

                  <p>
                    Previous follow-up
                    details
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  X
                </button>
              </div>

              <div className="detail-grid">
                <div>
                  <small>
                    Mobile
                  </small>

                  <strong>
                    {
                      modal.row
                        .mobile
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    City
                  </small>

                  <strong>
                    {
                      modal.row
                        .city ||
                      "—"
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    Type
                  </small>

                  <strong>
                    {normalizeTypeValue(
                      modal.row
                        .type
                    ) || "—"}
                  </strong>
                </div>

                <div>
                  <small>
                    Status
                  </small>

                  <Badge
                    status={
                      modal.row
                        .status
                    }
                  />
                </div>

                <div>
                  <small>
                    Follow-up Date
                  </small>

                  <strong>
                    {normalizeDateForInput(
                      modal.row
                        .next_followup_date ||
                        modal.row
                          .date
                    ) ||
                      "Not scheduled"}
                  </strong>
                </div>

                <div>
                  <small>
                    Course
                  </small>

                  <strong>
                    {
                      modal.row
                        .course
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    Referred By
                  </small>

                  <strong>
                    {
                      modal.row
                        .referred_by ||
                      "—"
                    }
                  </strong>
                </div>
              </div>

              <div className="followup-note">
                {
                  modal.row
                    .comments ||
                  "No previous follow-up discussion recorded."
                }
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            EDIT MODAL
        ================================================= */}

        {modal?.type ===
          "edit" && (
          <div
            className="modal-backdrop"
            onClick={() =>
              setModal(null)
            }
          >
            <form
              className="modal edit-modal"
              onSubmit={save}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modal-header">
                <div>
                  <h3>
                    Edit Enquiry
                  </h3>

                  <p>
                    Update candidate
                    and follow-up
                    information
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  X
                </button>
              </div>

              <div className="form-grid">

                {/* CANDIDATE NAME */}

                <div className="form-group">
                  <label>
                    Candidate Name
                  </label>

                  <input
                    type="text"
                    name="candidate_name"
                    value={
                      form.candidate_name ||
                      ""
                    }
                    onChange={
                      change
                    }
                  />
                </div>

                {/* MOBILE */}

                <div className="form-group">
                  <label>
                    Mobile Number
                  </label>

                  <input
                    type="text"
                    name="mobile"
                    value={
                      form.mobile ||
                      ""
                    }
                    onChange={
                      change
                    }
                  />
                </div>

                {/* CITY */}

                <div className="form-group">
                  <label>
                    City / Place
                  </label>

                  <input
                    type="text"
                    name="city"
                    value={
                      form.city ||
                      ""
                    }
                    onChange={
                      change
                    }
                  />
                </div>

                {/* CATEGORY */}

                <div className="form-group">
                  <label>
                    Category
                  </label>

                  <input
                    type="text"
                    name="category"
                    value={
                      form.category ||
                      ""
                    }
                    onChange={
                      change
                    }
                  />
                </div>

                {/* COURSE */}

                <div className="form-group">
                  <label>
                    Course
                  </label>

                  <input
                    type="text"
                    name="course"
                    value={
                      form.course ||
                      ""
                    }
                    onChange={
                      change
                    }
                  />
                </div>

                {/* REFERRED BY */}

                <div className="form-group">
                  <label>
                    Referred By
                  </label>

                  <select
                    name="referred_by"
                    value={
                      form.referred_by ||
                      ""
                    }
                    onChange={
                      change
                    }
                    disabled={
                      referralsLoading
                    }
                  >
                    <option value="">
                      {referralsLoading
                        ? "Loading Referred By..."
                        : "Select Referred By"}
                    </option>

                    {referrals.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.name
                          }
                        >
                          {
                            item.name
                          }
                        </option>
                      )
                    )}

                    {form.referred_by &&
                      !referrals.some(
                        (item) =>
                          item.name ===
                          form.referred_by
                      ) && (
                        <option
                          value={
                            form.referred_by
                          }
                        >
                          {
                            form.referred_by
                          }
                        </option>
                      )}
                  </select>
                </div>

                {/* =================================================
                    TYPE - EDIT FORM

                    IMPORTANT:
                    Uses `editTypes`, NOT `types`.

                    Therefore the Edit form always shows:

                    Students
                    Freshers
                    Experience in Non IT
                    Experience in IT
                    Career Gap
                    Others

                    + custom Types
                ================================================= */}

                <div className="form-group">
                  <label>
                    Type{" "}
                    <span
                      style={{
                        color:
                          "red",
                      }}
                    >
                      *
                    </span>
                  </label>

                  <select
                    name="type"
                    value={normalizeTypeValue(
                      form.type
                    )}
                    onChange={
                      change
                    }
                    required
                  >
                    <option value="">
                      Select Type
                    </option>

                    {editTypes.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {
                            item
                          }
                        </option>
                      )
                    )}
                  </select>

                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        "5px",
                      opacity:
                        0.7,
                    }}
                  >
                    Select from the
                    standard Types or
                    an existing custom
                    Type.
                  </small>
                </div>

                {/* FOLLOW-UP DATE */}

                <div className="form-group">
                  <label>
                    Next Follow-up Date
                  </label>

                  <input
                    type="date"
                    name="next_followup_date"
                    value={normalizeDateForInput(
                      form.next_followup_date
                    )}
                    onChange={
                      change
                    }
                  />

                  {form.next_followup_date && (
                    <small
                      style={{
                        display:
                          "block",
                        marginTop:
                          "6px",
                        opacity:
                          0.7,
                      }}
                    >
                      Selected:{" "}
                      {
                        form.next_followup_date
                      }
                    </small>
                  )}
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
                      "Pending"
                    }
                    onChange={
                      change
                    }
                  >
                    {[
                      "Positive",
                      "Pending",
                      "Low",
                      "Hold",
                      "Negative",
                      "Completed",
                    ].map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {
                            item
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* COMMENTS */}

                <div className="form-group full">
                  <label>
                    Comments / Last
                    Discussion
                  </label>

                  <textarea
                    name="comments"
                    value={
                      form.comments ||
                      ""
                    }
                    onChange={
                      change
                    }
                    rows="4"
                  />
                </div>
              </div>

              {/* SUCCESS */}

              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}

              {/* ERROR */}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {/* ACTIONS */}

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setModal(null)
                  }
                >
                  Close
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Updating..."
                    : "Update Enquiry"}
                </button>
              </div>
            </form>
          </div>
        )}
      </Panel>
    </>
  );
}