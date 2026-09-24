import React, { useEffect, useState } from "react";
import {
  enquiryApi,
  categoryApi,
  adminApi,
  referralApi,
} from "../services/api";
import { Panel } from "../components/Ui";

// ======================================================
// INITIAL FORM
// ======================================================

const initialForm = {
  admin: "",
  enquiry_date: "",
  candidate_name: "",
  mobile: "",
  city: "",
  type: "",
  category: "",
  course: "",
  comments: "",
  next_followup_date: "",
  status: "Pending",
  referred_by: "",
};

// ======================================================
// DATE ONLY
// HTML DATE INPUT REQUIRES YYYY-MM-DD
// ======================================================

function dateOnly(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return "";
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  // ISO
  // 2026-09-04T18:30:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
    return stringValue.substring(0, 10);
  }

  // MySQL DATETIME
  // 2026-09-04 18:30:00
  if (/^\d{4}-\d{2}-\d{2} /.test(stringValue)) {
    return stringValue.substring(0, 10);
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(stringValue)) {
    const [day, month, year] = stringValue.split("-");

    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(stringValue)) {
    const [day, month, year] = stringValue.split("/");

    return `${year}-${month}-${day}`;
  }

  return "";
}

// ======================================================
// GET API ARRAY
// Supports:
// response.data
// response.data.results
// ======================================================

function getArray(response) {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

// ======================================================
// GET NAME
// ======================================================

function getName(item) {
  if (typeof item === "string") {
    return item.trim();
  }

  if (item && typeof item === "object") {
    return String(
      item.name ||
        item.title ||
        item.category ||
        item.admin ||
        ""
    ).trim();
  }

  return "";
}

// ======================================================
// ADD ENQUIRY
// ======================================================

export default function AddEnquiry() {
  const [form, setForm] = useState({
    ...initialForm,
  });

  const [msg, setMsg] = useState("");
  const [messageType, setMessageType] = useState("");

  const [categories, setCategories] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [saving, setSaving] = useState(false);

  // ====================================================
  // LOAD CATEGORIES
  // ====================================================

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        const response = await categoryApi.list();

        if (!mounted) {
          return;
        }

        const values = getArray(response)
          .map(getName)
          .filter(Boolean);

        setCategories(values);
      } catch (error) {
        console.error(
          "Category loading error:",
          error
        );

        if (mounted) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  // ====================================================
  // LOAD ADMINS
  // ====================================================

  useEffect(() => {
    let mounted = true;

    async function loadAdmins() {
      try {
        const response = await adminApi.list();

        if (!mounted) {
          return;
        }

        const values = getArray(response)
          .map(getName)
          .filter(Boolean);

        setAdmins(values);
      } catch (error) {
        console.error(
          "Admin loading error:",
          error
        );

        if (mounted) {
          setAdmins([]);
        }
      }
    }

    loadAdmins();

    return () => {
      mounted = false;
    };
  }, []);

  // ====================================================
  // LOAD REFERRALS
  // ====================================================

  useEffect(() => {
    let mounted = true;

    async function loadReferrals() {
      try {
        const response = await referralApi.list();

        if (!mounted) {
          return;
        }

        const values = getArray(response)
          .map(getName)
          .filter(Boolean);

        setReferrals(values);
      } catch (error) {
        console.error(
          "Referral loading error:",
          error
        );

        if (mounted) {
          setReferrals([]);
        }
      }
    }

    loadReferrals();

    return () => {
      mounted = false;
    };
  }, []);

  // ====================================================
  // FORM CHANGE
  // ====================================================

  function change(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    // Clear old message
    if (msg) {
      setMsg("");
      setMessageType("");
    }
  }

  // ====================================================
  // SUBMIT
  // ====================================================

  async function submit(event) {
    event.preventDefault();

    setMsg("");
    setMessageType("");
    setSaving(true);

    try {
      // ----------------------------------------------
      // VALIDATE MOBILE
      // ----------------------------------------------

      const mobile = String(
        form.mobile || ""
      ).trim();

      if (!/^\d{10}$/.test(mobile)) {
        setMsg(
          "Please enter a valid 10 digit mobile number."
        );

        setMessageType("error");
        setSaving(false);

        return;
      }

      // ----------------------------------------------
      // CREATE PAYLOAD
      // ----------------------------------------------

      const payload = {
        ...form,

        admin: String(
          form.admin || ""
        ).trim(),

        enquiry_date: dateOnly(
          form.enquiry_date
        ),

        candidate_name: String(
          form.candidate_name || ""
        ).trim(),

        mobile,

        city: String(
          form.city || ""
        ).trim(),

        type: String(
          form.type || ""
        ).trim(),

        category: String(
          form.category || ""
        ).trim(),

        course: String(
          form.course || ""
        ).trim(),

        // IMPORTANT
        // Comments are sent as a normal string
        comments: String(
          form.comments || ""
        ).trim(),

        next_followup_date: dateOnly(
          form.next_followup_date
        ),

        status: String(
          form.status || "Pending"
        ).trim(),

        referred_by: String(
          form.referred_by || ""
        ).trim(),
      };

      // ----------------------------------------------
      // API CREATE
      // ----------------------------------------------

      const result =
        await enquiryApi.create(payload);

      // Cache type in localStorage so it
      // shows in EnquiryList even before
      // backend is redeployed with type column

      const newId =
        result?.data?.id ||
        result?.data?.insertId;

      if (newId && payload.type) {
        try {
          const cache = JSON.parse(
            localStorage.getItem(
              "scot_it_enquiry_types"
            ) || "{}"
          );

          cache[String(newId)] =
            String(payload.type).trim();

          localStorage.setItem(
            "scot_it_enquiry_types",
            JSON.stringify(cache)
          );
        } catch {
          // ignore cache error
        }
      }

      // ----------------------------------------------
      // SUCCESS
      // ----------------------------------------------

      setMsg(
        "Enquiry saved successfully!"
      );

      setMessageType("success");

      // Reset form
      setForm({
        ...initialForm,
      });
    } catch (error) {
      console.error(
        "Save enquiry error:",
        error
      );

      console.error(
        "API response:",
        error?.response?.data
      );

      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.message ||
        "Unable to save enquiry. Please check the API connection.";

      setMsg(apiMessage);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // CLEAR FORM
  // ====================================================

  function clearForm() {
    setForm({
      ...initialForm,
    });

    setMsg("");
    setMessageType("");
  }

  // ====================================================
  // JSX
  // ====================================================

  return (
    <Panel
      title="New Candidate Enquiry"
      subtitle="Enter candidate information and follow-up details"
    >
      <form
        onSubmit={submit}
        data-grammarly="false"
      >
        {/* ==================================================
            CANDIDATE INFORMATION
        ================================================== */}

        <h4>
          Candidate Information
        </h4>

        <div className="form-grid">

          {/* ADMIN */}

          {/* <Select
            name="admin"
            label="Admin"
            value={form.admin}
            onChange={change}
            options={admins}
          /> */}

          {/* ENQUIRY DATE */}

          <Input
            name="enquiry_date"
            label="Enquiry Date *"
            type="date"
            value={dateOnly(
              form.enquiry_date
            )}
            onChange={change}
          />

          {/* CANDIDATE NAME */}

          <Input
            name="candidate_name"
            label="Candidate Name *"
            value={form.candidate_name}
            onChange={change}
            placeholder="Enter candidate name"
          />

          {/* MOBILE */}

          <Input
            name="mobile"
            label="Mobile Number *"
            value={form.mobile}
            onChange={change}
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]{10}"
            placeholder="10 digit mobile number"
          />

          {/* CITY */}

          <Input
            name="city"
            label="City / Place"
            value={form.city}
            onChange={change}
            placeholder="Enter city / place"
          />

          {/* TYPE */}

          <Select
            name="type"
            label="Type *"
            value={form.type}
            onChange={change}
            options={[
              "Students",
              "Freshers",
              "Experience in Non IT",
              "Experience in IT",
              "Career Gap",
              "Others",
            ]}
          />
        </div>

        {/* ==================================================
            ENQUIRY INFORMATION
        ================================================== */}

        <h4>
          Enquiry Information
        </h4>

        <div className="form-grid">

          {/* CATEGORY */}

          <Select
            name="category"
            label="Category *"
            value={form.category}
            onChange={change}
            options={categories}
          />

          {/* COURSE */}

          <Input
            name="course"
            label="Course"
            value={form.course}
            onChange={change}
            placeholder="Python Full Stack"
          />

          {/* ==================================================
              COMMENTS / LAST DISCUSSION
          ================================================== */}

          <div className="form-group full">
            <label>
              Comments / Last Discussion
            </label>

            <textarea
              name="comments"
              value={form.comments || ""}
              onChange={change}
              placeholder="Enter last discussion details..."
              rows={5}

              /* Grammarly protection */
              data-grammarly="false"
              data-gr-ext-disabled="true"
              data-enable-grammarly="false"

              /* Prevent browser spell checking */
              spellCheck={false}

              autoComplete="off"
            />
          </div>
        </div>

        {/* ==================================================
            FOLLOW-UP INFORMATION
        ================================================== */}

        <h4>
          Follow-up Information
        </h4>

        <div className="form-grid">

          {/* NEXT FOLLOW-UP DATE */}

          <Input
            name="next_followup_date"
            label="Next Follow-up Date *"
            type="date"
            value={dateOnly(
              form.next_followup_date
            )}
            onChange={change}
          />

          {/* STATUS */}

          <Select
            name="status"
            label="Final Status *"
            value={form.status}
            onChange={change}
            options={[
              "Positive",
              "Pending",
              "Low",
              "Hold",
              "Negative",
              "Completed",
            ]}
          />

          {/* REFERRED BY */}

          <Select
            name="referred_by"
            label="Referred By"
            value={form.referred_by}
            onChange={change}
            options={referrals}
          />
        </div>

        {/* ==================================================
            MESSAGE
        ================================================== */}

        {msg && (
          <div
            className={
              messageType === "error"
                ? "error-message"
                : "success-message"
            }
          >
            {msg}
          </div>
        )}

        {/* ==================================================
            ACTION BUTTONS
        ================================================== */}

        <div className="form-actions">

          <button
            type="button"
            className="secondary"
            onClick={clearForm}
            disabled={saving}
          >
            Clear
          </button>

          <button
            type="submit"
            className="primary"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Enquiry"}
          </button>

        </div>
      </form>
    </Panel>
  );
}

// ======================================================
// INPUT COMPONENT
// ======================================================

function Input({
  name,
  label,
  value,
  onChange,
  ...props
}) {
  const required = label.includes("*");

  return (
    <div className="form-group">
      <label htmlFor={name}>
        {label}
      </label>

      <input
        id={name}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        {...props}
      />
    </div>
  );
}

// ======================================================
// SELECT COMPONENT
// ======================================================

function Select({
  name,
  label,
  value,
  onChange,
  options = [],
}) {
  const cleanOptions = [
    ...new Set(
      options
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    ),
  ];

  const required = label.includes("*");

  return (
    <div className="form-group">
      <label htmlFor={name}>
        {label}
      </label>

      <select
        id={name}
        name={name}
        required={required}
        value={value ?? ""}
        onChange={onChange}
      >
        <option value="">
          Select {label.replace(" *", "")}
        </option>

        {cleanOptions.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}