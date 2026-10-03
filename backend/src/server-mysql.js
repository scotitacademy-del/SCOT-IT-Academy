// ============================================================
// SCOT IT ACADEMY - BACKEND SERVER
// Node.js + Express + MySQL
// Render + Aiven MySQL Ready
// ============================================================

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config({ path: require("path").join(__dirname, "../.env") });

const app = express();

// ============================================================
// SERVER CONFIG
// ============================================================

const PORT = Number(process.env.PORT || 10000);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured before starting the API.");
}

// ============================================================
// DATABASE CONFIG
// ============================================================

const db = require("./database")();
const { ensureOwner } = require("./owner-account");
const { studentFees } = require("./student-fees");

// ============================================================
// HELPERS
// ============================================================

function text(value) {
  return String(value ?? "").trim();
}

function amount(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function dateOnly(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }

  const valueString = String(value).trim();

  if (!valueString) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valueString)) {
    return valueString;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(valueString)) {
    return valueString.substring(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2} /.test(valueString)) {
    return valueString.substring(0, 10);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(valueString)) {
    const [day, month, year] =
      valueString.split("-");

    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valueString)) {
    const [day, month, year] =
      valueString.split("/");

    return `${year}-${month}-${day}`;
  }

  return null;
}

async function first(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows[0];
}

// ============================================================
// USER RESPONSE
// ============================================================

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

// ============================================================
// JWT
// ============================================================

function issueToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  let claims;
  try {
    claims = jwt.verify(header.startsWith("Bearer ") ? header.slice(7) : "", JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }
  try {
    const user = await first("SELECT id, username, name, role FROM users WHERE id=?", [claims.id]);
    if (!user) return res.status(401).json({ message: "Account no longer exists. Please log in again." });
    req.user = user;
    next();
  } catch (error) { next(error); }
}

// ============================================================
// OWNER ONLY
// ============================================================

function ownerOnly(req, res, next) {
  if (req.user?.role !== "Owner") {
    return res.status(403).json({
      message: "Owner access required.",
    });
  }

  next();
}

// ============================================================
// MAP STUDENT
// ============================================================

function mapStudent(row) {
  if (!row) {
    return null;
  }

  const paidFee =
    amount(row.paid_fee);

  const balanceFee =
    amount(row.balance_fee);

  const totalFee =
    amount(
      row.total_fee,
      paidFee + balanceFee
    );

  const nextFollowUpDate =
    dateOnly(
      row.next_followup_date
    );

  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    course: row.course,
    mobile: row.mobile,
    email: row.email,
    city: row.city,
    category: row.category,

    paidFee,
    balanceFee,
    totalFee,

    dueDate:
      dateOnly(row.due_date),

    joinDate:
      dateOnly(row.join_date),

    nextFollowUpDate,

    next_followup_date:
      nextFollowUpDate,

    status: row.status,
  };
}

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ============================================================
// BODY PARSER
// ============================================================

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ============================================================
// HEALTH
// ============================================================

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1 AS ok");

    res.json({
      status: "ok",
      service: "SCOT IT Academy API",
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "SCOT IT Academy API",
      database: "disconnected",
      message: error.message,
    });
  }
});

// ============================================================
// AUTH - LOGIN
// ============================================================

app.post(
  "/api/auth/login",
  async (req, res, next) => {
    try {
      const username =
        text(req.body?.username);

      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || !password) {
        return res.status(400).json({
          message:
            "Username and password are required.",
        });
      }

      const user =
        await first(
          `
          SELECT
            id,
            username,
            password_hash,
            name,
            role
          FROM users
          WHERE LOWER(username)=LOWER(?)
          LIMIT 1
          `,
          [username]
        );

      if (!user) {
        return res.status(401).json({
          message:
            "Invalid username or password.",
        });
      }

      const validPassword =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!validPassword) {
        return res.status(401).json({
          message:
            "Invalid username or password.",
        });
      }

      const access =
        issueToken(user);

      return res.json({
        access,
        user: publicUser(user),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      next(error);
    }
  }
);

// ============================================================
// AUTH - SIGNUP / OWNER SETUP
// ============================================================

app.post("/api/auth/signup", (req, res) => {
  res.status(403).json({ message: "Owner setup requires server access. Contact the academy owner." });
});

// ============================================================
// AUTH - UPDATE OWNER USERNAME
// ============================================================

app.put(
  "/api/auth/update-owner",
  auth,
  ownerOnly,
  async (req, res, next) => {
    try {
      const username =
        text(req.body?.username);

      const currentPassword =
        req.body?.current_password || "";

      if (!username) {
        return res.status(400).json({
          message:
            "Please enter owner username.",
        });
      }

      if (!currentPassword) {
        return res.status(400).json({
          message:
            "Please enter your current password.",
        });
      }

      const owner =
        await first(
          `
          SELECT
            id,
            username,
            password_hash,
            name,
            role
          FROM users
          WHERE id=?
            AND role='Owner'
          LIMIT 1
          `,
          [req.user.id]
        );

      if (!owner) {
        return res.status(404).json({
          message:
            "Owner account not found.",
        });
      }

      const validPassword =
        await bcrypt.compare(
          currentPassword,
          owner.password_hash
        );

      if (!validPassword) {
        return res.status(401).json({
          message:
            "Current password is incorrect. Owner username was not changed.",
        });
      }

      const existingUser =
        await first(
          `
          SELECT id, username, role
          FROM users
          WHERE LOWER(username)=LOWER(?)
          LIMIT 1
          `,
          [username]
        );

      if (
        existingUser &&
        Number(existingUser.id) !==
          Number(owner.id)
      ) {
        return res.status(409).json({
          message:
            "This username is already in use.",
        });
      }

      await db.execute(
        `
        UPDATE users
        SET username=?
        WHERE id=?
          AND role='Owner'
        `,
        [
          username,
          owner.id,
        ]
      );

      const updatedOwner =
        await first(
          `
          SELECT
            id,
            username,
            name,
            role
          FROM users
          WHERE id=?
            AND role='Owner'
          LIMIT 1
          `,
          [owner.id]
        );

      const access =
        issueToken(updatedOwner);

      return res.json({
        message:
          "Owner username updated successfully.",
        access,
        user:
          publicUser(updatedOwner),
      });
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "This username is already in use.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// AUTH - UPDATE OWNER PASSWORD
// ============================================================

app.put(
  "/api/auth/update-password",
  auth,
  ownerOnly,
  async (req, res, next) => {
    try {
      const currentPassword =
        req.body?.current_password || "";

      const newPassword =
        req.body?.new_password || "";

      if (!currentPassword) {
        return res.status(400).json({
          message:
            "Please enter your current password.",
        });
      }

      if (!newPassword) {
        return res.status(400).json({
          message:
            "Please enter your new password.",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message:
            "New password must contain at least 6 characters.",
        });
      }

      if (
        currentPassword === newPassword
      ) {
        return res.status(400).json({
          message:
            "New password must be different from your current password.",
        });
      }

      const owner =
        await first(
          `
          SELECT
            id,
            username,
            password_hash,
            name,
            role
          FROM users
          WHERE id=?
            AND role='Owner'
          LIMIT 1
          `,
          [req.user.id]
        );

      if (!owner) {
        return res.status(404).json({
          message:
            "Owner account not found.",
        });
      }

      const validPassword =
        await bcrypt.compare(
          currentPassword,
          owner.password_hash
        );

      if (!validPassword) {
        return res.status(401).json({
          message:
            "Current password is incorrect. Password was not changed.",
        });
      }

      const newPasswordHash =
        await bcrypt.hash(
          newPassword,
          12
        );

      await db.execute(
        `
        UPDATE users
        SET password_hash=?
        WHERE id=?
          AND role='Owner'
        `,
        [
          newPasswordHash,
          owner.id,
        ]
      );

      const updatedOwner =
        await first(
          `
          SELECT
            id,
            username,
            name,
            role
          FROM users
          WHERE id=?
            AND role='Owner'
          LIMIT 1
          `,
          [owner.id]
        );

      const access =
        issueToken(updatedOwner);

      return res.json({
        message:
          "Password updated successfully.",
        access,
        user:
          publicUser(updatedOwner),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// AUTH - ME
// ============================================================

app.get(
  "/api/auth/me",
  auth,
  async (req, res, next) => {
    try {
      const user =
        await first(
          `
          SELECT
            id,
            username,
            name,
            role
          FROM users
          WHERE id=?
          LIMIT 1
          `,
          [req.user.id]
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found.",
        });
      }

      return res.json(
        publicUser(user)
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// STUDENTS - GET ALL
// ============================================================

app.get(
  "/api/students",
  auth,
  async (req, res, next) => {
    try {
      // Fix any non-standard student_id (ensuring SCOT-001, SCOT-002, etc.) in DB on the fly
      try {
        const [allStudents] = await db.query(
          "SELECT id, student_id FROM students ORDER BY id ASC"
        );
        const needsMigration = allStudents.some(
          (s, index) => s.student_id !== `SCOT-${String(index + 1).padStart(3, "0")}`
        );
        if (needsMigration && allStudents.length > 0) {
          for (const s of allStudents) {
            await db.query("UPDATE students SET student_id=? WHERE id=?", [
              `TMP_${s.id}`,
              s.id,
            ]);
          }
          for (let i = 0; i < allStudents.length; i++) {
            const finalId = `SCOT-${String(i + 1).padStart(3, "0")}`;
            await db.query("UPDATE students SET student_id=? WHERE id=?", [
              finalId,
              allStudents[i].id,
            ]);
          }
        }
      } catch (normErr) {
        console.warn("Student ID check notice:", normErr.message);
      }

      const [rows] =
        await db.query(
          `
          SELECT *
          FROM students
          ORDER BY id DESC
          `
        );

      return res.json(
        rows.map(mapStudent)
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// STUDENT - GET ONE
// ============================================================

app.get(
  "/api/students/:id",
  auth,
  async (req, res, next) => {
    try {
      const row =
        await first(
          `
          SELECT *
          FROM students
          WHERE id=?
             OR student_id=?
          LIMIT 1
          `,
          [
            req.params.id,
            req.params.id,
          ]
        );

      if (!row) {
        return res.status(404).json({
          message:
            "Student not found.",
        });
      }

      return res.json(
        mapStudent(row)
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// STUDENT - CREATE
// ============================================================

app.post(
  "/api/students",
  auth,
  async (req, res, next) => {
    try {
      const b =
        req.body || {};

      const { paid, balance, total } = studentFees(b);

      let studentId = text(b.studentId ?? b.student_id);
      if (!studentId) {
        const [existing] = await db.query(
          "SELECT student_id FROM students"
        );
        let maxNum = 0;
        for (const s of existing) {
          const numMatch = String(s.student_id || "").match(/\d+/);
          if (numMatch) {
            const val = parseInt(numMatch[0], 10);
            if (val > maxNum) maxNum = val;
          }
        }
        studentId = `SCOT-${String(maxNum + 1).padStart(3, "0")}`;
      }

      const dueDate =
        dateOnly(
          b.dueDate ??
            b.due_date
        );

      const joinDate =
        dateOnly(
          b.joinDate ??
            b.join_date
        ) ||
        new Date()
          .toISOString()
          .slice(0, 10);

      const nextFollowUpDate =
        dateOnly(
          b.nextFollowUpDate ??
            b.next_followup_date ??
            b.next_follow_up_date
        );

      const status =
        text(b.status) ||
        "Joined";

      const name =
        text(
          b.name ??
            b.candidate_name
        );

      const mobile =
        text(
          b.mobile ??
            b.mobile_no
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Student name is required.",
        });
      }

      const [result] =
        await db.execute(
          `
          INSERT INTO students
          (
            student_id,
            name,
            course,
            mobile,
            email,
            city,
            category,
            paid_fee,
            balance_fee,
            total_fee,
            due_date,
            join_date,
            next_followup_date,
            status
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            studentId,
            name,
            text(b.course),
            mobile,
            text(b.email),
            text(b.city),
            text(b.category),
            paid,
            balance,
            total,
            dueDate,
            joinDate,
            nextFollowUpDate,
            status,
          ]
        );

      const saved =
        await first(
          `
          SELECT *
          FROM students
          WHERE id=?
          `,
          [result.insertId]
        );

      return res.status(201).json(
        mapStudent(saved)
      );
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "Student ID already exists.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// STUDENT - UPDATE
// ============================================================

app.patch(
  "/api/students/:id",
  auth,
  async (req, res, next) => {
    try {
      const current =
        await first(
          `
          SELECT *
          FROM students
          WHERE id=?
             OR student_id=?
          LIMIT 1
          `,
          [
            req.params.id,
            req.params.id,
          ]
        );

      if (!current) {
        return res.status(404).json({
          message:
            "Student not found.",
        });
      }

      const b =
        req.body || {};

      const { paid, balance, total } = studentFees(b, current);

      const studentId =
        text(
          b.studentId ??
            b.student_id ??
            current.student_id
        );

      const name =
        text(
          b.name ??
            b.candidate_name ??
            current.name
        );

      const course =
        text(
          b.course ??
            current.course
        );

      const mobile =
        text(
          b.mobile ??
            b.mobile_no ??
            current.mobile
        );

      const email =
        text(
          b.email ??
            current.email
        );

      const city =
        text(
          b.city ??
            current.city
        );

      const category =
        text(
          b.category ??
            current.category
        );

      const dueDate =
        b.dueDate !== undefined ||
        b.due_date !== undefined
          ? dateOnly(
              b.dueDate ??
                b.due_date
            )
          : dateOnly(
              current.due_date
            );

      const joinDate =
        b.joinDate !== undefined ||
        b.join_date !== undefined
          ? dateOnly(
              b.joinDate ??
                b.join_date
            )
          : dateOnly(
              current.join_date
            );

      const nextFollowUpDate =
        b.nextFollowUpDate !== undefined ||
        b.next_followup_date !== undefined ||
        b.next_follow_up_date !== undefined
          ? dateOnly(
              b.nextFollowUpDate ??
                b.next_followup_date ??
                b.next_follow_up_date
            )
          : dateOnly(
              current.next_followup_date
            );

      const status =
        text(
          b.status ??
            current.status
        ) || "Joined";

      if (!studentId || !name) {
        return res.status(400).json({ message: "Student ID and name are required." });
      }

      await db.execute(
        `
        UPDATE students
        SET
          student_id=?,
          name=?,
          course=?,
          mobile=?,
          email=?,
          city=?,
          category=?,
          paid_fee=?,
          balance_fee=?,
          total_fee=?,
          due_date=?,
          join_date=?,
          next_followup_date=?,
          status=?
        WHERE id=?
        `,
        [
          studentId,
          name,
          course,
          mobile,
          email,
          city,
          category,
          paid,
          balance,
          total,
          dueDate,
          joinDate,
          nextFollowUpDate,
          status,
          current.id,
        ]
      );

      const updated =
        await first(
          `
          SELECT *
          FROM students
          WHERE id=?
          `,
          [current.id]
        );

      return res.json(
        mapStudent(updated)
      );
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "Student ID already exists.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// STUDENT - DELETE
// ============================================================

app.delete(
  "/api/students/:id",
  auth,
  async (req, res, next) => {
    try {
      const [result] =
        await db.execute(
          `
          DELETE FROM students
          WHERE id=?
             OR student_id=?
          `,
          [
            req.params.id,
            req.params.id,
          ]
        );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message:
            "Student not found.",
        });
      }

      return res.json({
        deleted: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

async function validateEnquiry(candidateName, mobile, excludeId = 0) {
  if (!candidateName || !mobile) {
    const error = new Error("Candidate name and mobile number are required.");
    error.status = 400;
    throw error;
  }
  const preference = await first("SELECT setting_value FROM settings WHERE setting_key='duplicateMobileCheck'");
  if (preference?.setting_value !== false && preference?.setting_value !== "false") {
    const duplicate = await first("SELECT id FROM enquiries WHERE mobile=? AND id<>? LIMIT 1", [mobile, excludeId]);
    if (duplicate) {
      const error = new Error("An enquiry with this mobile number already exists.");
      error.status = 400;
      throw error;
    }
  }
}

// ============================================================
// ENQUIRIES - GET ALL
// ============================================================

app.get(
  "/api/enquiries",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT *
          FROM enquiries
          ORDER BY id ASC
          `
        );

      return res.json(
        rows.map((row) => ({
          ...row,

          enquiry_date:
            dateOnly(
              row.enquiry_date
            ),

          next_followup_date:
            dateOnly(
              row.next_followup_date
            ),
        }))
      );
    } catch (error) {
      console.error(
        "GET /api/enquiries error:",
        error
      );

      next(error);
    }
  }
);

// ============================================================
// ENQUIRY - GET ONE
// ============================================================

app.get(
  "/api/enquiries/:id",
  auth,
  async (req, res, next) => {
    try {
      const row =
        await first(
          `
          SELECT *
          FROM enquiries
          WHERE id=?
          LIMIT 1
          `,
          [req.params.id]
        );

      if (!row) {
        return res.status(404).json({
          message:
            "Enquiry not found.",
        });
      }

      row.enquiry_date =
        dateOnly(
          row.enquiry_date
        );

      row.next_followup_date =
        dateOnly(
          row.next_followup_date
        );

      return res.json(row);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ENQUIRY - CREATE
// ============================================================

app.post(
  "/api/enquiries",
  auth,
  async (req, res, next) => {
    try {
      const b =
        req.body || {};

      const branch =
        text(b.branch);

      const admin =
        text(b.admin);

      const enquiryDate =
        dateOnly(
          b.enquiry_date ??
            b.enquiryDate
        ) ||
        new Date()
          .toISOString()
          .slice(0, 10);

      const candidateName =
        text(
          b.candidate_name ??
            b.candidateName
        );

      const mobile =
        text(
          b.mobile ??
            b.mobile_no
        );

      const city =
        text(b.city);

      const type =
        text(
          b.type ??
            b.education ??
            b.degree
        );

      const category =
        text(b.category);

      const course =
        text(b.course);

      const comments =
        text(b.comments);

      const followUpDate =
        dateOnly(
          b.next_followup_date ??
            b.nextFollowupDate ??
            b.next_follow_up_date
        );

      const status =
        text(b.status) ||
        "Pending";

      const referredBy =
        text(
          b.referred_by ??
            b.referredBy
        );

      if (!candidateName) {
        return res.status(400).json({
          message:
            "Candidate name is required.",
        });
      }

      if (!mobile) {
        return res.status(400).json({
          message:
            "Mobile number is required.",
        });
      }

      await validateEnquiry(candidateName, mobile);

      const [result] =
        await db.execute(
          `
          INSERT INTO enquiries
          (
            branch,
            admin,
            enquiry_date,
            candidate_name,
            mobile,
            city,
            type,
            category,
            course,
            comments,
            next_followup_date,
            status,
            referred_by
          )
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            branch,
            admin,
            enquiryDate,
            candidateName,
            mobile,
            city,
            type,
            category,
            course,
            comments,
            followUpDate,
            status,
            referredBy,
          ]
        );

      const row =
        await first(
          `
          SELECT *
          FROM enquiries
          WHERE id=?
          LIMIT 1
          `,
          [result.insertId]
        );

      row.enquiry_date =
        dateOnly(
          row.enquiry_date
        );

      row.next_followup_date =
        dateOnly(
          row.next_followup_date
        );

      return res.status(201).json(
        row
      );
    } catch (error) {
      console.error(
        "POST /api/enquiries error:",
        error
      );

      next(error);
    }
  }
);

// ============================================================
// ENQUIRY - UPDATE
// ============================================================

app.patch(
  "/api/enquiries/:id",
  auth,
  async (req, res, next) => {
    try {
      const id =
        req.params.id;

      const old =
        await first(
          `
          SELECT *
          FROM enquiries
          WHERE id=?
          LIMIT 1
          `,
          [id]
        );

      if (!old) {
        return res.status(404).json({
          message:
            "Enquiry not found.",
        });
      }

      const b =
        req.body || {};

      const branch =
        text(
          b.branch ??
            old.branch
        );

      const admin =
        text(
          b.admin ??
            old.admin
        );

      const enquiryDate =
        b.enquiry_date !== undefined
          ? dateOnly(
              b.enquiry_date
            )
          : b.enquiryDate !== undefined
          ? dateOnly(
              b.enquiryDate
            )
          : dateOnly(
              old.enquiry_date
            );

      const candidateName =
        text(
          b.candidate_name ??
            b.candidateName ??
            old.candidate_name
        );

      const mobile =
        text(
          b.mobile ??
            old.mobile
        );

      const city =
        text(
          b.city ??
            old.city
        );

      const type =
        text(
          b.type ??
            b.education ??
            b.degree ??
            old.type
        );

      const category =
        text(
          b.category ??
            old.category
        );

      const course =
        text(
          b.course ??
            old.course
        );

      const comments =
        text(
          b.comments ??
            old.comments
        );

      const followUpDate =
        b.next_followup_date !== undefined
          ? dateOnly(
              b.next_followup_date
            )
          : b.nextFollowupDate !== undefined
          ? dateOnly(
              b.nextFollowupDate
            )
          : b.next_follow_up_date !== undefined
          ? dateOnly(
              b.next_follow_up_date
            )
          : dateOnly(
              old.next_followup_date
            );

      const status =
        text(
          b.status ??
            old.status
        ) || "Pending";

      const referredBy =
        text(
          b.referred_by ??
            b.referredBy ??
            old.referred_by
        );

      await validateEnquiry(candidateName, mobile, old.id);

      await db.execute(
        `
        UPDATE enquiries
        SET
          branch=?,
          admin=?,
          enquiry_date=?,
          candidate_name=?,
          mobile=?,
          city=?,
          type=?,
          category=?,
          course=?,
          comments=?,
          next_followup_date=?,
          status=?,
          referred_by=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        `,
        [
          branch,
          admin,
          enquiryDate,
          candidateName,
          mobile,
          city,
          type,
          category,
          course,
          comments,
          followUpDate,
          status,
          referredBy,
          id,
        ]
      );

      const updated =
        await first(
          `
          SELECT *
          FROM enquiries
          WHERE id=?
          LIMIT 1
          `,
          [id]
        );

      updated.enquiry_date =
        dateOnly(
          updated.enquiry_date
        );

      updated.next_followup_date =
        dateOnly(
          updated.next_followup_date
        );

      return res.json(
        updated
      );
    } catch (error) {
      console.error(
        "PATCH /api/enquiries/:id error:",
        error
      );

      next(error);
    }
  }
);

// ============================================================
// ENQUIRY - DELETE
// ============================================================

app.delete(
  "/api/enquiries/:id",
  auth,
  async (req, res, next) => {
    try {
      const [result] =
        await db.execute(
          `
          DELETE FROM enquiries
          WHERE id=?
          `,
          [req.params.id]
        );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message:
            "Enquiry not found.",
        });
      }

      return res.json({
        deleted: true,
        id: Number(
          req.params.id
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// FOLLOW UPS
// ============================================================

app.get(
  "/api/follow-ups",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT *
          FROM enquiries
          WHERE LOWER(status)<>'joined'
          ORDER BY
            next_followup_date IS NULL,
            next_followup_date,
            id DESC
          `
        );

      return res.json(
        rows.map((row) => ({
          ...row,

          enquiry_date:
            dateOnly(
              row.enquiry_date
            ),

          next_followup_date:
            dateOnly(
              row.next_followup_date
            ),
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

// ======================================================
// TYPE API
// ======================================================

app.get(
  ["/api/types", "/api/types/"],
  auth,
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          id,
          name,
          created_at
        FROM types
        ORDER BY id ASC
      `);

      return res.json(rows);
    } catch (error) {
      console.error(
        "GET /api/types error:",
        error
      );

      return res.status(500).json({
        message: "Failed to load types.",
        error: error.message,
      });
    }
  }
);

app.get(
  "/api/types/:id",
  auth,
  async (req, res) => {
    try {
      const [rows] =
        await db.execute(
          `
          SELECT
            id,
            name,
            created_at
          FROM types
          WHERE id = ?
          LIMIT 1
          `,
          [req.params.id]
        );

      if (!rows.length) {
        return res.status(404).json({
          message: "Type not found.",
        });
      }

      return res.json(rows[0]);
    } catch (error) {
      console.error(
        "GET /api/types/:id error:",
        error
      );

      return res.status(500).json({
        message: "Failed to load type.",
        error: error.message,
      });
    }
  }
);

app.post(
  ["/api/types", "/api/types/"],
  auth,
  async (req, res) => {
    try {
      const name = String(
        req.body?.name ??
        req.body?.type ??
        req.body?.title ??
        ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          message:
            "Type name is required.",
        });
      }

      const [existingRows] =
        await db.execute(
          `
          SELECT
            id,
            name
          FROM types
          WHERE LOWER(name) = LOWER(?)
          LIMIT 1
          `,
          [name]
        );

      if (existingRows.length) {
        return res.status(409).json({
          message:
            "This type already exists.",
        });
      }

      const [result] =
        await db.execute(
          `
          INSERT INTO types (name)
          VALUES (?)
          `,
          [name]
        );

      const [rows] =
        await db.execute(
          `
          SELECT
            id,
            name,
            created_at
          FROM types
          WHERE id = ?
          LIMIT 1
          `,
          [result.insertId]
        );

      return res.status(201).json(
        rows[0]
      );
    } catch (error) {
      console.error(
        "POST /api/types error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create type.",
        error: error.message,
      });
    }
  }
);

app.patch(
  ["/api/types/:id", "/api/types/:id/"],
  auth,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const newName = String(
        req.body?.name ??
        req.body?.type ??
        req.body?.title ??
        ""
      ).trim();

      if (!newName) {
        return res.status(400).json({
          message:
            "Type name is required.",
        });
      }

      const [oldRows] =
        await db.execute(
          `
          SELECT
            id,
            name
          FROM types
          WHERE id = ?
          LIMIT 1
          `,
          [id]
        );

      if (!oldRows.length) {
        return res.status(404).json({
          message:
            "Type not found.",
        });
      }

      const oldName =
        oldRows[0].name;

      const [duplicateRows] =
        await db.execute(
          `
          SELECT
            id,
            name
          FROM types
          WHERE LOWER(name) = LOWER(?)
            AND id != ?
          LIMIT 1
          `,
          [
            newName,
            id,
          ]
        );

      if (duplicateRows.length) {
        return res.status(409).json({
          message:
            "This type already exists.",
        });
      }

      await db.execute(
        `
        UPDATE types
        SET name = ?
        WHERE id = ?
        `,
        [
          newName,
          id,
        ]
      );

      /*
       * Update existing enquiry records
       * because enquiries store type as text.
       */

      await db.execute(
        `
        UPDATE enquiries
        SET type = ?
        WHERE type = ?
        `,
        [
          newName,
          oldName,
        ]
      );

      const [updatedRows] =
        await db.execute(
          `
          SELECT
            id,
            name,
            created_at
          FROM types
          WHERE id = ?
          LIMIT 1
          `,
          [id]
        );

      return res.json(
        updatedRows[0]
      );
    } catch (error) {
      console.error(
        "PATCH /api/types/:id error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update type.",
        error: error.message,
      });
    }
  }
);

app.delete(
  ["/api/types/:id", "/api/types/:id/"],
  auth,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const [typeRows] =
        await db.execute(
          `
          SELECT
            id,
            name
          FROM types
          WHERE id = ?
          LIMIT 1
          `,
          [id]
        );

      if (!typeRows.length) {
        return res.status(404).json({
          message:
            "Type not found.",
        });
      }

      const typeName =
        typeRows[0].name;

      const [usageRows] =
        await db.execute(
          `
          SELECT
            COUNT(*) AS total
          FROM enquiries
          WHERE type = ?
          `,
          [typeName]
        );

      const usedCount =
        Number(
          usageRows[0]?.total || 0
        );

      if (usedCount > 0) {
        return res.status(409).json({
          message:
            `This type is used by ${usedCount} enquiry record(s). Please rename it instead of deleting it.`,
          usedCount,
        });
      }

      await db.execute(
        `
        DELETE FROM types
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        deleted: true,
        id,
      });
    } catch (error) {
      console.error(
        "DELETE /api/types/:id error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete type.",
        error: error.message,
      });
    }
  }
);

// ============================================================
// CATEGORIES - GET
// ============================================================

app.get(
  "/api/categories",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT
            id,
            name
          FROM categories
          ORDER BY name
          `
        );

      return res.json(rows);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// CATEGORIES - CREATE
// ============================================================

app.post(
  "/api/categories",
  auth,
  async (req, res, next) => {
    try {
      const name =
        text(
          req.body?.name ||
            req.body?.category
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Category name is required.",
        });
      }

      const existing =
        await first(
          `
          SELECT id
          FROM categories
          WHERE LOWER(name)=LOWER(?)
          LIMIT 1
          `,
          [name]
        );

      if (existing) {
        return res.status(409).json({
          message:
            "This category already exists.",
        });
      }

      const [result] =
        await db.execute(
          `
          INSERT INTO categories(name)
          VALUES(?)
          `,
          [name]
        );

      const row =
        await first(
          `
          SELECT
            id,
            name
          FROM categories
          WHERE id=?
          LIMIT 1
          `,
          [result.insertId]
        );

      return res.status(201).json(
        row
      );
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "This category already exists.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// CATEGORIES - UPDATE
// ============================================================

app.patch(
  "/api/categories/:id",
  auth,
  async (req, res, next) => {
    try {
      const name =
        text(
          req.body?.name ||
            req.body?.category
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Category name is required.",
        });
      }

      const old =
        await first(
          `
          SELECT id, name
          FROM categories
          WHERE id=?
          LIMIT 1
          `,
          [req.params.id]
        );

      if (!old) {
        return res.status(404).json({
          message:
            "Category not found.",
        });
      }

      const duplicate =
        await first(
          `
          SELECT id
          FROM categories
          WHERE LOWER(name)=LOWER(?)
            AND id != ?
          LIMIT 1
          `,
          [
            name,
            old.id,
          ]
        );

      if (duplicate) {
        return res.status(409).json({
          message:
            "This category already exists.",
        });
      }

      await db.execute(
        `
        UPDATE categories
        SET name=?
        WHERE id=?
        `,
        [
          name,
          old.id,
        ]
      );

      return res.json({
        id: old.id,
        name,
      });
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "This category already exists.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// CATEGORIES - DELETE
// ============================================================

app.delete(
  "/api/categories/:id",
  auth,
  async (req, res, next) => {
    try {
      const [result] =
        await db.execute(
          `
          DELETE FROM categories
          WHERE id=?
          `,
          [req.params.id]
        );

      return res.json({
        deleted:
          result.affectedRows > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// REFERRALS - GET
// ============================================================

app.get(
  "/api/referrals",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT
            id,
            name
          FROM referrals
          ORDER BY id DESC
          `
        );

      return res.json(rows);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// REFERRALS - CREATE
// ============================================================

app.post(
  "/api/referrals",
  auth,
  async (req, res, next) => {
    try {
      const name =
        text(req.body?.name);

      if (!name) {
        return res.status(400).json({
          message:
            "Referral name is required.",
        });
      }

      const [result] =
        await db.execute(
          `
          INSERT INTO referrals(name)
          VALUES(?)
          `,
          [name]
        );

      return res.status(201).json({
        id:
          result.insertId,
        name,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// REFERRALS - UPDATE
// ============================================================

app.patch(
  "/api/referrals/:id",
  auth,
  async (req, res, next) => {
    try {
      const name =
        text(req.body?.name);

      if (!name) {
        return res.status(400).json({
          message:
            "Referral name is required.",
        });
      }

      const [result] =
        await db.execute(
          `
          UPDATE referrals
          SET name=?
          WHERE id=?
          `,
          [
            name,
            req.params.id,
          ]
        );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message:
            "Referral not found.",
        });
      }

      const row =
        await first(
          `
          SELECT
            id,
            name
          FROM referrals
          WHERE id=?
          `,
          [req.params.id]
        );

      return res.json(row);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// REFERRALS - DELETE
// ============================================================

app.delete(
  "/api/referrals/:id",
  auth,
  async (req, res, next) => {
    try {
      const [result] =
        await db.execute(
          `
          DELETE FROM referrals
          WHERE id=?
          `,
          [req.params.id]
        );

      return res.json({
        deleted:
          result.affectedRows > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ADMINS - GET
// ============================================================

app.get(
  "/api/admins",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT
            id,
            name,
            username,
            role
          FROM users
          WHERE role='Admin'
          ORDER BY id DESC
          `
        );

      return res.json(
        rows.map((row) => ({
          ...row,
          role: "Administrator",
          status: "Active",
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// ADMINS - CREATE
// ============================================================

app.post(
  "/api/admins",
  auth,
  ownerOnly,
  async (req, res, next) => {
    try {
      const name =
        text(req.body?.name);

      const username =
        text(req.body?.username);

      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (
        !name ||
        !username ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Admin name, username and password are required.",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message:
            "Password must contain at least 6 characters.",
        });
      }

      const exists =
        await first(
          `
          SELECT id
          FROM users
          WHERE LOWER(username)=LOWER(?)
          LIMIT 1
          `,
          [username]
        );

      if (exists) {
        return res.status(409).json({
          message:
            "This admin username already exists.",
        });
      }

      const hash =
        await bcrypt.hash(
          password,
          12
        );

      const [result] =
        await db.execute(
          `
          INSERT INTO users
          (
            name,
            username,
            password_hash,
            role
          )
          VALUES (?, ?, ?, 'Admin')
          `,
          [
            name,
            username,
            hash,
          ]
        );

      return res.status(201).json({
        id:
          result.insertId,
        name,
        username,
        role:
          "Administrator",
        status:
          "Active",
      });
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "This username is already in use.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// ADMINS - UPDATE
// ============================================================

app.patch(
  "/api/admins/:id",
  auth,
  ownerOnly,
  async (req, res, next) => {
    try {
      const old =
        await first(
          `
          SELECT *
          FROM users
          WHERE id=?
            AND role='Admin'
          LIMIT 1
          `,
          [req.params.id]
        );

      if (!old) {
        return res.status(404).json({
          message:
            "Admin record not found.",
        });
      }

      const name =
        text(req.body?.name) ||
        old.name;

      const username =
        text(req.body?.username) ||
        old.username;

      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (password && password.length < 6) {
        return res.status(400).json({ message: "Password must contain at least 6 characters." });
      }

      if (password) {
        await db.execute(
          `
          UPDATE users
          SET
            name=?,
            username=?,
            password_hash=?
          WHERE id=?
            AND role='Admin'
          `,
          [
            name,
            username,
            await bcrypt.hash(
              password,
              12
            ),
            old.id,
          ]
        );
      } else {
        await db.execute(
          `
          UPDATE users
          SET
            name=?,
            username=?
          WHERE id=?
            AND role='Admin'
          `,
          [
            name,
            username,
            old.id,
          ]
        );
      }

      return res.json({
        id:
          old.id,
        name,
        username,
        role:
          "Administrator",
        status:
          "Active",
      });
    } catch (error) {
      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return res.status(409).json({
          message:
            "This username is already in use.",
        });
      }

      next(error);
    }
  }
);

// ============================================================
// ADMINS - DELETE
// ============================================================

app.delete(
  "/api/admins/:id",
  auth,
  ownerOnly,
  async (req, res, next) => {
    try {
      const [result] =
        await db.execute(
          `
          DELETE FROM users
          WHERE id=?
            AND role='Admin'
          `,
          [req.params.id]
        );

      return res.json({
        deleted:
          result.affectedRows > 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// DASHBOARD
// ============================================================

app.get(
  "/api/dashboard",
  auth,
  async (req, res, next) => {
    try {
      const totals =
        await first(
          `
          SELECT
            COUNT(*) AS totalStudents,

            COALESCE(
              SUM(
                LOWER(status) IN ('joined', 'active', 'inactive', 'closed', 'placed')
              ),
              0
            ) AS joinedStudents,

            COALESCE(
              SUM(total_fee),
              0
            ) AS totalFee

          FROM students
          `
        );

      const [recentRows] =
        await db.query(
          `
          SELECT
            admin,
            candidate_name,
            mobile,
            city,
            category,
            course,
            next_followup_date,
            status
          FROM enquiries
          ORDER BY id DESC
          LIMIT 8
          `
        );

      const [follow] =
        await db.query(
          `
          SELECT
            *,
            candidate_name AS name
          FROM enquiries
          ORDER BY id DESC
          LIMIT 8
          `
        );

      const [categories] =
        await db.query(
          `
          SELECT
            c.name,
            COUNT(s.id) AS students
          FROM categories c
          LEFT JOIN students s
            ON s.category=c.name
          GROUP BY
            c.id,
            c.name
          ORDER BY c.name
          `
        );

      const recent =
        recentRows.map(
          (row) => [
            row.admin || "Owner",
            row.candidate_name || "",
            row.mobile || "",
            row.city || "",
            row.category || "",
            row.course || "",
            dateOnly(
              row.next_followup_date
            ) || "",
            row.status || "Pending",
          ]
        );

      const cleanFollow =
        follow.map(
          (row) => ({
            ...row,

            enquiry_date:
              dateOnly(
                row.enquiry_date
              ),

            next_followup_date:
              dateOnly(
                row.next_followup_date
              ),
          })
        );

      const data = {
        totalStudents:
          Number(
            totals.totalStudents
          ),

        joinedStudents:
          Number(
            totals.joinedStudents
          ),

        totalFee:
          amount(
            totals.totalFee
          ),

        recent,

        follow:
          cleanFollow,

        categories:
          categories.map(
            (row) => [
              row.name,
              Number(
                row.students
              ),
              0,
            ]
          ),
      };

      return res.json({
        ...data,
        summary: data,
      });
    } catch (error) {
      console.error(
        "GET /api/dashboard error:",
        error
      );

      next(error);
    }
  }
);

// ============================================================
// REPORTS
// ============================================================

app.get(
  "/api/reports",
  auth,
  async (req, res, next) => {
    try {
      const totals =
        await first(
          `
          SELECT
            COUNT(*) AS totalStudents,

            COALESCE(
              SUM(paid_fee),
              0
            ) AS totalRevenue,

            COALESCE(
              SUM(balance_fee),
              0
            ) AS totalDue

          FROM students
          `
        );

      const enquiries =
        await first(
          `
          SELECT
            COUNT(*) AS totalEnquiries
          FROM enquiries
          `
        );

      const [categories] =
        await db.query(
          `
          SELECT
            c.name,
            COUNT(s.id) AS students
          FROM categories c
          LEFT JOIN students s
            ON s.category=c.name
          GROUP BY
            c.id,
            c.name
          ORDER BY c.name
          `
        );

      return res.json({
        totalStudents:
          Number(
            totals.totalStudents
          ),

        totalEnquiries:
          Number(
            enquiries.totalEnquiries
          ),

        totalRevenue:
          amount(
            totals.totalRevenue
          ),

        totalDue:
          amount(
            totals.totalDue
          ),

        categories:
          categories.map(
            (row) => ({
              name: row.name,
              students:
                Number(
                  row.students
                ),
            })
          ),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// NOTIFICATIONS
// ============================================================

app.get(
  "/api/notifications",
  auth,
  async (req, res, next) => {
    try {
      const preference = await first("SELECT setting_value FROM settings WHERE setting_key='followUpReminder'");
      if ((preference?.setting_value === false || preference?.setting_value === "false")) return res.json([]);

      const [rows] =
        await db.query(
          `
          SELECT
            id,
            student_id,
            student_id AS studentId,
            name,
            mobile,
            paid_fee AS paidFee,
            balance_fee AS balanceFee,
            total_fee AS totalFee,
            due_date AS dueDate,
            balance_fee AS pending_fee,
            status
          FROM students
          WHERE due_date<CURDATE()
            AND balance_fee>0
            AND LOWER(TRIM(COALESCE(status, ''))) IN ('active', 'joined', '')
          ORDER BY due_date
          `
        );

      return res.json(
        rows.map(
          (row) => ({
            ...row,

            dueDate:
              dateOnly(
                row.dueDate
              ),

            student_name:
              row.name,
          })
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// SETTINGS - GET
// ============================================================

app.get(
  "/api/settings",
  auth,
  async (req, res, next) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT
            setting_key,
            setting_value
          FROM settings
          WHERE setting_key IN ('academyName', 'email', 'branch', 'followUpReminder', 'duplicateMobileCheck')
          `
        );

      const result = {};

      rows.forEach(
        (row) => {
          try {
            if (
              typeof row.setting_value ===
              "string"
            ) {
              result[
                row.setting_key
              ] =
                JSON.parse(
                  row.setting_value
                );
            } else {
              result[
                row.setting_key
              ] =
                row.setting_value;
            }
          } catch {
            result[
              row.setting_key
            ] =
              row.setting_value;
          }
        }
      );

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Only supported institute preferences may be changed, atomically, by an owner.
app.patch("/api/settings", auth, ownerOnly, async (req, res, next) => {
  let connection;
  try {
    const values = req.body;
    const fields = { academyName: "string", email: "string", branch: "string", followUpReminder: "boolean", duplicateMobileCheck: "boolean" };
    if (!values || Array.isArray(values) || typeof values !== "object" ||
        Object.entries(values).some(([key, value]) => !Object.hasOwn(fields, key) || typeof value !== fields[key] ||
          (typeof value === "string" && value.length > 150)) ||
        (values.academyName !== undefined && !values.academyName.trim())) {
      return res.status(400).json({ message: "Invalid settings. Check the institute details and preferences." });
    }
    connection = await db.getConnection();
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(values)) {
      await connection.execute(
        "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
        [key, JSON.stringify(value)]
      );
    }
    await connection.commit();
    res.json(values);
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { if (connection) connection.release(); }
});

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

async function initializeSchema() {
  console.log(
    "Checking database connection..."
  );

  try {
    await db.query(
      "SELECT 1"
    );
  } catch (error) {
    if (
      error.code ===
      "ENOTFOUND"
    ) {
      throw new Error(
        "Database host could not be resolved. " +
          "Update DATABASE_URL (or DB_HOST) in Render with the current MySQL endpoint.",
        {
          cause: error,
        }
      );
    }

    throw error;
  }

  console.log(
    "Database connection successful."
  );

  // ==========================================================
  // USERS
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,

      username VARCHAR(100)
        NOT NULL,

      password_hash VARCHAR(255)
        NOT NULL,

      name VARCHAR(150)
        NOT NULL,

      role ENUM('Owner','Admin')
        NOT NULL DEFAULT 'Admin',

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY(id),

      UNIQUE KEY
        uq_users_username(username)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // STUDENTS
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS students (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      student_id VARCHAR(50)
        NOT NULL,

      name VARCHAR(150)
        NOT NULL,

      course VARCHAR(150)
        NOT NULL DEFAULT '',

      mobile VARCHAR(30)
        NOT NULL DEFAULT '',

      email VARCHAR(150)
        NOT NULL DEFAULT '',

      city VARCHAR(100)
        NOT NULL DEFAULT '',

      category VARCHAR(150)
        NOT NULL DEFAULT '',

      paid_fee DECIMAL(12,2)
        NOT NULL DEFAULT 0,

      balance_fee DECIMAL(12,2)
        NOT NULL DEFAULT 0,

      total_fee DECIMAL(12,2)
        NOT NULL DEFAULT 0,

      due_date DATE NULL,

      join_date DATE NULL,

      next_followup_date DATE NULL,

      status VARCHAR(30)
        NOT NULL DEFAULT 'Joined',

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY(id),

      UNIQUE KEY
        uq_student_id(student_id)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // STUDENTS MIGRATION
  // ==========================================================

  const [
    studentColumns,
  ] =
    await db.query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='students'
        AND COLUMN_NAME='next_followup_date'
      `
    );

  if (
    studentColumns.length === 0
  ) {
    console.log(
      "Adding next_followup_date to students..."
    );

    await db.query(`
      ALTER TABLE students
      ADD COLUMN next_followup_date
      DATE NULL
      AFTER join_date
    `);

    console.log(
      "next_followup_date added."
    );
  }

  // ==========================================================
  // ENQUIRIES
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS enquiries (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      branch VARCHAR(100)
        NOT NULL DEFAULT '',

      admin VARCHAR(150)
        NOT NULL DEFAULT '',

      enquiry_date DATE NULL,

      candidate_name VARCHAR(150)
        NOT NULL DEFAULT '',

      mobile VARCHAR(30)
        NOT NULL DEFAULT '',

      city VARCHAR(100)
        NOT NULL DEFAULT '',

      type VARCHAR(100)
        NOT NULL DEFAULT '',

      category VARCHAR(150)
        NOT NULL DEFAULT '',

      course VARCHAR(150)
        NOT NULL DEFAULT '',

      comments TEXT,

      next_followup_date DATE NULL,

      status VARCHAR(30)
        NOT NULL DEFAULT 'Pending',

      referred_by VARCHAR(150)
        NOT NULL DEFAULT '',

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY(id)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // ENQUIRIES TYPE MIGRATION
  // ==========================================================

  try {
    const [cols] =
      await db.query(
        `
        SHOW COLUMNS
        FROM enquiries
        LIKE 'type'
        `
      );

    if (cols.length === 0) {
      await db.query(
        `
        ALTER TABLE enquiries
        ADD COLUMN type VARCHAR(100)
        NOT NULL DEFAULT ''
        AFTER city
        `
      );

      console.log(
        "enquiries.type column added."
      );
    }
  } catch (error) {
    console.warn(
      "Could not add enquiries.type:",
      error.message
    );
  }

  // ==========================================================
  // TYPES
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS types (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      name VARCHAR(150)
        NOT NULL,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY(id),

      UNIQUE KEY
        uq_type_name(name)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // DEFAULT TYPES
  // ==========================================================

  const defaultTypes = [
    "Students",
    "Freshers",
    "Experience in Non IT",
    "Experience in IT",
    "Career Gap",
    "Others",
  ];

  for (
    const typeName of defaultTypes
  ) {
    try {
      await db.execute(
        `
        INSERT INTO types(name)
        SELECT ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM types
          WHERE LOWER(name)=LOWER(?)
        )
        `,
        [
          typeName,
          typeName,
        ]
      );
    } catch (error) {
      console.warn(
        `Could not insert default type "${typeName}":`,
        error.message
      );
    }
  }

  console.log(
    "Type master table is ready."
  );

  // ==========================================================
  // CATEGORIES
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      name VARCHAR(150)
        NOT NULL,

      PRIMARY KEY(id),

      UNIQUE KEY
        uq_category_name(name)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // REFERRALS
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS referrals (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      name VARCHAR(150)
        NOT NULL,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY(id)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // SETTINGS
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (

      setting_key VARCHAR(100)
        NOT NULL,

      setting_value JSON
        NOT NULL,

      updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY(setting_key)

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (

      id INT UNSIGNED
        NOT NULL AUTO_INCREMENT,

      student_id INT UNSIGNED NULL,

      type VARCHAR(50)
        NOT NULL,

      message TEXT
        NOT NULL,

      is_read BOOLEAN
        NOT NULL DEFAULT FALSE,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY(id),

      FOREIGN KEY(student_id)
        REFERENCES students(id)
        ON DELETE CASCADE

    )
    ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
  `);

  // ==========================================================
  // NORMALIZE EXISTING STUDENT IDs TO CONTINUOUS SCOT-xxx FORMAT
  // ==========================================================
  try {
    const [allStudents] = await db.query(
      "SELECT id, student_id FROM students ORDER BY id ASC"
    );
    const needsMigration = allStudents.some(
      (s, index) => s.student_id !== `SCOT-${String(index + 1).padStart(3, "0")}`
    );
    if (needsMigration && allStudents.length > 0) {
      for (const s of allStudents) {
        await db.query("UPDATE students SET student_id=? WHERE id=?", [
          `TMP_${s.id}`,
          s.id,
        ]);
      }
      for (let i = 0; i < allStudents.length; i++) {
        const finalId = `SCOT-${String(i + 1).padStart(3, "0")}`;
        await db.query("UPDATE students SET student_id=? WHERE id=?", [
          finalId,
          allStudents[i].id,
        ]);
        console.log(`Normalized student ID for id ${allStudents[i].id} to ${finalId}`);
      }
    }
  } catch (migErr) {
    console.warn("Student ID startup migration notice:", migErr.message);
  }

  console.log(
    "All database tables checked successfully."
  );
}

// ============================================================
// DEFAULT OWNER
// ============================================================

async function ensureDefaultOwner() {
  // reset:true ensures OWNER_USERNAME/OWNER_PASSWORD env vars are always applied
  // on every startup, so credential changes in Render take effect without a shell.
  await ensureOwner(db, process.env, { reset: true });
}

// ============================================================
// 404 HANDLER
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      message: "Not found",
      path: req.originalUrl,
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:"
    );

    console.error(error);

    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        message:
          "Duplicate value already exists.",
      });
    }

    if (
      error?.code ===
      "ER_NO_SUCH_TABLE"
    ) {
      return res.status(500).json({
        message:
          "Required database table does not exist.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }

    return res.status(500).json({
      message:
        "Internal server error",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "SCOT IT Academy API - Starting..."
    );
    console.log(
      "======================================"
    );

    // STEP 1
    await initializeSchema();

    console.log("");
    console.log(
      "Database schema is ready."
    );

    // STEP 2
    await ensureDefaultOwner();

    console.log("");
    console.log(
      "Owner account is ready."
    );

    // STEP 3
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "======================================"
        );
        console.log(
          "SCOT IT Academy API"
        );
        console.log(
          `Server running on port ${PORT}`
        );
        console.log(
          "Health: /health"
        );
        console.log(
          "Students: /api/students"
        );
        console.log(
          "Enquiries: /api/enquiries"
        );
        console.log(
          "Types: /api/types"
        );
        console.log(
          "Categories: /api/categories"
        );
        console.log(
          "Referrals: /api/referrals"
        );
        console.log(
          "Dashboard: /api/dashboard"
        );
        console.log(
          "======================================"
        );
        console.log("");
      }
    );
  } catch (error) {
    console.error("");
    console.error(
      "SERVER STARTUP FAILED"
    );
    console.error(
      "======================================"
    );
    console.error(error);
    console.error(
      "======================================"
    );

    process.exit(1);
  }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {
  console.log(
    `${signal} received. Closing server...`
  );

  try {
    await db.end();

    console.log(
      "Database pool closed."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Error while closing database:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

// ============================================================
// START
// ============================================================

startServer();
