const express = require("express");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "scot-it-academy-secret";

// ======================================================
// MYSQL CONNECTION — supports DATABASE_URL or DB_* vars
// ======================================================

let mysqlPool;

if (process.env.DATABASE_URL) {
  mysqlPool = mysql.createPool(process.env.DATABASE_URL + (process.env.DATABASE_URL.includes("ssl") ? "" : ""));
} else {
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "student_management",
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

// ======================================================
// DEFAULTS
// ======================================================

const DEFAULT_OWNER = {
  username: process.env.OWNER_USERNAME || "SCOT",
  password: process.env.OWNER_PASSWORD || "scotitacademy@2026",
  name: process.env.OWNER_NAME || "SCOT IT Academy Owner",
  role: "Owner",
};

// ======================================================
// HELPERS
// ======================================================

function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

function mapMysqlStudent(row) {
  const paidFee = toNumber(row.paid_fee, 0);
  const balanceFee = toNumber(row.balance_fee, 0);
  const totalFee = toNumber(row.total_fee, paidFee + balanceFee);
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
    dueDate: row.due_date,
    joinDate: row.join_date,
    status: row.status,
  };
}

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function auth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "")
    : null;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ======================================================
// SCHEMA SETUP
// ======================================================

async function ensureSchema() {
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(150) NOT NULL DEFAULT '',
      role ENUM('Owner','Admin') NOT NULL DEFAULT 'Admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      course VARCHAR(150) NOT NULL DEFAULT '',
      mobile VARCHAR(30) NOT NULL DEFAULT '',
      email VARCHAR(150) NOT NULL DEFAULT '',
      city VARCHAR(100) NOT NULL DEFAULT '',
      category VARCHAR(150) NOT NULL DEFAULT '',
      paid_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
      balance_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
      due_date DATE NULL,
      join_date DATE NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_students_student_id (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin VARCHAR(100) NOT NULL DEFAULT 'Owner',
      candidate_name VARCHAR(150) NOT NULL DEFAULT '',
      mobile VARCHAR(30) NOT NULL DEFAULT '',
      email VARCHAR(150) NOT NULL DEFAULT '',
      city VARCHAR(100) NOT NULL DEFAULT '',
      category VARCHAR(150) NOT NULL DEFAULT '',
      course VARCHAR(150) NOT NULL DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      next_followup_date DATE NULL,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_categories_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS types (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_types_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL DEFAULT '',
      mobile VARCHAR(30) NOT NULL DEFAULT '',
      email VARCHAR(150) NOT NULL DEFAULT '',
      referred_by VARCHAR(150) NOT NULL DEFAULT '',
      course VARCHAR(150) NOT NULL DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      key_name VARCHAR(100) NOT NULL,
      value TEXT,
      PRIMARY KEY (id),
      UNIQUE KEY uq_settings_key (key_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed owner account if not exists
  const [ownerRows] = await mysqlPool.query(
    "SELECT id FROM users WHERE role = 'Owner' LIMIT 1"
  );
  if (ownerRows.length === 0) {
    await mysqlPool.execute(
      "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'Owner')",
      [DEFAULT_OWNER.username, DEFAULT_OWNER.password, DEFAULT_OWNER.name]
    );
  }
}

// ======================================================
// NOTIFICATIONS HELPER
// ======================================================

async function getNotifications() {
  const [rows] = await mysqlPool.query(
    "SELECT * FROM students WHERE due_date IS NOT NULL AND due_date < CURDATE() AND balance_fee > 0"
  );
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    student_name: row.name,
    mobile: row.mobile,
    paidFee: toNumber(row.paid_fee),
    balanceFee: toNumber(row.balance_fee),
    totalFee: toNumber(row.total_fee),
    dueDate: row.due_date,
    pending_fee: toNumber(row.balance_fee),
    status: "Due",
  }));
}

// ======================================================
// EXPRESS SETUP
// ======================================================

app.use(cors());
app.use(express.json());

// Tolerate trailing slashes
app.use((req, _res, next) => {
  if (req.path.length > 1 && req.path.endsWith("/")) {
    req.url = req.url.slice(0, -1) || "/";
  }
  next();
});

// ======================================================
// HEALTH
// ======================================================

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "SCOT IT Academy API" });
});

// ======================================================
// AUTH — LOGIN
// ======================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = normalizeString(req.body?.username || "");
    const password = normalizeString(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const [rows] = await mysqlPool.execute(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [username]
    );

    const user = rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    return res.json({ access: generateToken(user), user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// AUTH — SIGNUP (creates/updates owner)
// ======================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const username = normalizeString(req.body?.username || "");
    const password = normalizeString(req.body?.password || "");
    const name = normalizeString(req.body?.name || DEFAULT_OWNER.name);

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const [existing] = await mysqlPool.execute(
      "SELECT id FROM users WHERE role = 'Owner' LIMIT 1"
    );

    if (existing.length > 0) {
      await mysqlPool.execute(
        "UPDATE users SET username = ?, password = ?, name = ? WHERE id = ?",
        [username, password, name, existing[0].id]
      );
    } else {
      await mysqlPool.execute(
        "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'Owner')",
        [username, password, name]
      );
    }

    const [rows] = await mysqlPool.execute(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [username]
    );

    const user = rows[0];
    return res.json({ access: generateToken(user), user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// AUTH — ME
// ======================================================

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [req.user.username]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found." });
    return res.json(sanitizeUser(rows[0]));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// AUTH — UPDATE OWNER USERNAME
// ======================================================

app.put("/api/auth/update-owner", auth, async (req, res) => {
  try {
    const username = normalizeString(req.body?.username || "");
    const currentPassword = normalizeString(req.body?.current_password || "");

    if (!username) return res.status(400).json({ message: "Please enter owner username." });
    if (!currentPassword) return res.status(400).json({ message: "Please enter your current password." });

    const [rows] = await mysqlPool.execute(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = 'Owner' LIMIT 1",
      [req.user.username]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ message: "Owner account not found." });
    if (user.password !== currentPassword) return res.status(401).json({ message: "Current password is incorrect." });

    await mysqlPool.execute("UPDATE users SET username = ? WHERE id = ?", [username, user.id]);

    const [updated] = await mysqlPool.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
    const updatedUser = updated[0];
    return res.json({ access: generateToken(updatedUser), user: sanitizeUser(updatedUser) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// AUTH — UPDATE PASSWORD
// ======================================================

app.put("/api/auth/update-password", auth, async (req, res) => {
  try {
    const currentPassword = normalizeString(req.body?.current_password || "");
    const newPassword = normalizeString(req.body?.new_password || "");

    if (!currentPassword) return res.status(400).json({ message: "Please enter current password." });
    if (!newPassword) return res.status(400).json({ message: "Please enter new password." });
    if (newPassword.length < 6) return res.status(400).json({ message: "New password must contain at least 6 characters." });

    const [rows] = await mysqlPool.execute(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [req.user.username]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.password !== currentPassword) return res.status(401).json({ message: "Current password is incorrect." });

    await mysqlPool.execute("UPDATE users SET password = ? WHERE id = ?", [newPassword, user.id]);

    const [updated] = await mysqlPool.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [user.id]);
    const updatedUser = updated[0];
    return res.json({ access: generateToken(updatedUser), user: sanitizeUser(updatedUser) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// DASHBOARD
// ======================================================

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const [[{ total }]] = await mysqlPool.query("SELECT COUNT(*) AS total FROM students");
    const [[{ joined }]] = await mysqlPool.query("SELECT COUNT(*) AS joined FROM students WHERE LOWER(status) = 'active'");
    const [[{ totalFee }]] = await mysqlPool.query("SELECT COALESCE(SUM(total_fee), 0) AS totalFee FROM students");

    const [catRows] = await mysqlPool.query("SELECT name FROM categories");
    const categories = await Promise.all(
      catRows.map(async (cat) => {
        const [[{ count }]] = await mysqlPool.query(
          "SELECT COUNT(*) AS count FROM students WHERE category = ?",
          [cat.name]
        );
        return [cat.name, count, 0];
      })
    );

    const [enquiryRows] = await mysqlPool.query(
      "SELECT * FROM enquiries ORDER BY id DESC LIMIT 8"
    );

    const recent = enquiryRows.map((row) => [
      row.admin || "Owner",
      row.candidate_name || "",
      row.mobile || "",
      row.city || "",
      row.category || "",
      row.course || "",
      row.next_followup_date || "",
      row.status || "Pending",
    ]);

    const follow = enquiryRows.map((row) => ({
      ...row,
      name: row.candidate_name || "",
    }));

    const totalStudents = Number(total);
    const joinedStudents = Number(joined);

    return res.json({
      totalStudents,
      joinedStudents,
      totalFee: Number(totalFee),
      recent,
      follow,
      categories,
      summary: { totalStudents, joinedStudents, totalFee: Number(totalFee), recent, follow, categories },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// NOTIFICATIONS
// ======================================================

app.get("/api/notifications", auth, async (req, res) => {
  try {
    return res.json(await getNotifications());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// ENQUIRIES
// ======================================================

app.get("/api/enquiries", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query("SELECT * FROM enquiries ORDER BY id DESC");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/enquiries", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const [result] = await mysqlPool.execute(
      `INSERT INTO enquiries (admin, candidate_name, mobile, email, city, category, course, status, next_followup_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?)`,
      [
        body.admin || req.user.username || "Owner",
        body.candidate_name || body.name || "",
        body.mobile || "",
        body.email || "",
        body.city || "",
        body.category || "",
        body.course || "",
        body.status || "Pending",
        body.next_followup_date || "",
        body.notes || null,
      ]
    );
    const [rows] = await mysqlPool.execute("SELECT * FROM enquiries WHERE id = ?", [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/enquiries/:id", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute("SELECT * FROM enquiries WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: "Enquiry not found." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/enquiries/:id", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const [existing] = await mysqlPool.execute("SELECT * FROM enquiries WHERE id = ?", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: "Enquiry not found." });
    const e = existing[0];

    await mysqlPool.execute(
      `UPDATE enquiries SET admin=?, candidate_name=?, mobile=?, email=?, city=?, category=?, course=?, status=?, next_followup_date=NULLIF(?, ''), notes=? WHERE id=?`,
      [
        body.admin ?? e.admin,
        body.candidate_name ?? body.name ?? e.candidate_name,
        body.mobile ?? e.mobile,
        body.email ?? e.email,
        body.city ?? e.city,
        body.category ?? e.category,
        body.course ?? e.course,
        body.status ?? e.status,
        body.next_followup_date ?? e.next_followup_date ?? "",
        body.notes ?? e.notes,
        req.params.id,
      ]
    );

    const [rows] = await mysqlPool.execute("SELECT * FROM enquiries WHERE id = ?", [req.params.id]);
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/enquiries/:id", auth, async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM enquiries WHERE id = ?", [req.params.id]);
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// STUDENTS
// ======================================================

app.get("/api/students/next-id", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query(
      "SELECT student_id FROM students WHERE student_id REGEXP '^SCT[0-9]+$' ORDER BY id DESC LIMIT 1"
    );
    let nextNum = 1;
    if (rows.length > 0) {
      const match = String(rows[0].student_id).match(/^SCT(\d+)$/i);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return res.json({ nextId: `SCT${String(nextNum).padStart(3, "0")}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/students/session", auth, async (req, res) => {
  try {
    const m = parseInt(req.query.month, 10);
    const y = parseInt(req.query.year, 10);
    if (!m || !y || m < 1 || m > 12) {
      return res.status(400).json({ message: "Valid month (1-12) and year are required." });
    }
    const [rows] = await mysqlPool.query(
      "SELECT * FROM students WHERE MONTH(join_date) = ? AND YEAR(join_date) = ? ORDER BY id DESC",
      [m, y]
    );
    return res.json(rows.map(mapMysqlStudent));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/students", auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (!m || !y || m < 1 || m > 12) {
        return res.status(400).json({ message: "Valid month (1-12) and year are required." });
      }
      const [rows] = await mysqlPool.query(
        "SELECT * FROM students WHERE MONTH(join_date) = ? AND YEAR(join_date) = ? ORDER BY id DESC",
        [m, y]
      );
      return res.json(rows.map(mapMysqlStudent));
    }
    const [rows] = await mysqlPool.query("SELECT * FROM students ORDER BY id DESC");
    return res.json(rows.map(mapMysqlStudent));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/students", auth, async (req, res) => {
  try {
    const payload = req.body || {};
    const paidFee = toNumber(payload.paidFee ?? payload.paid_fee, 0);
    const balanceFee = toNumber(payload.balanceFee ?? payload.balance_fee, 0);
    const totalFee = toNumber(payload.totalFee ?? payload.total_fee, paidFee + balanceFee);

    let studentId = normalizeString(payload.studentId || payload.student_id || "");
    if (!studentId) {
      const [idRows] = await mysqlPool.query(
        "SELECT student_id FROM students WHERE student_id REGEXP '^SCT[0-9]+$' ORDER BY id DESC LIMIT 1"
      );
      let nextNum = 1;
      if (idRows.length > 0) {
        const match = String(idRows[0].student_id).match(/^SCT(\d+)$/i);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      studentId = `SCT${String(nextNum).padStart(3, "0")}`;
    }

    const [existCheck] = await mysqlPool.execute(
      "SELECT id FROM students WHERE student_id = ?",
      [studentId]
    );
    if (existCheck.length > 0) {
      return res.status(409).json({ message: "Student ID already exists." });
    }

    const joinDate = payload.joinDate || payload.join_date || new Date().toISOString().slice(0, 10);
    const status = payload.status || "Active";

    const [result] = await mysqlPool.execute(
      `INSERT INTO students (student_id, name, course, mobile, email, city, category, paid_fee, balance_fee, total_fee, due_date, join_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?)`,
      [
        studentId,
        payload.name || payload.candidate_name || "",
        payload.course || "",
        payload.mobile || "",
        payload.email || "",
        payload.city || "",
        payload.category || "",
        paidFee,
        balanceFee,
        totalFee,
        payload.dueDate || payload.due_date || "",
        joinDate,
        status,
      ]
    );
    const [rows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ?", [result.insertId]);
    return res.status(201).json(mapMysqlStudent(rows[0]));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/students/:id", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.execute(
      "SELECT * FROM students WHERE id = ? OR student_id = ?",
      [req.params.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "Student not found." });
    return res.json(mapMysqlStudent(rows[0]));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/students/:id", auth, async (req, res) => {
  try {
    const payload = req.body || {};
    const [existingRows] = await mysqlPool.execute(
      "SELECT * FROM students WHERE id = ? OR student_id = ?",
      [req.params.id, req.params.id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: "Student not found." });

    const paidFee = toNumber(payload.paidFee ?? payload.paid_fee ?? existing.paid_fee, 0);
    const balanceFee = toNumber(payload.balanceFee ?? payload.balance_fee ?? existing.balance_fee, 0);
    const totalFee = toNumber(payload.totalFee ?? payload.total_fee, paidFee + balanceFee);

    await mysqlPool.execute(
      `UPDATE students SET student_id=?, name=?, course=?, mobile=?, email=?, city=?, category=?, paid_fee=?, balance_fee=?, total_fee=?, due_date=NULLIF(?, ''), join_date=NULLIF(?, ''), status=? WHERE id=?`,
      [
        payload.studentId || existing.student_id,
        payload.name || payload.candidate_name || existing.name,
        payload.course ?? existing.course,
        payload.mobile ?? existing.mobile,
        payload.email ?? existing.email,
        payload.city ?? existing.city,
        payload.category ?? existing.category,
        paidFee,
        balanceFee,
        totalFee,
        payload.dueDate ?? payload.due_date ?? existing.due_date ?? "",
        payload.joinDate ?? payload.join_date ?? existing.join_date ?? "",
        payload.status || existing.status,
        existing.id,
      ]
    );

    const [rows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ?", [existing.id]);
    return res.json(mapMysqlStudent(rows[0]));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/students/:id", auth, async (req, res) => {
  try {
    await mysqlPool.execute(
      "DELETE FROM students WHERE id = ? OR student_id = ?",
      [req.params.id, req.params.id]
    );
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// FOLLOW-UPS
// ======================================================

app.get("/api/follow-ups", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query(
      "SELECT * FROM enquiries WHERE LOWER(status) != 'joined' ORDER BY id DESC"
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// CATEGORIES
// ======================================================

app.get("/api/categories", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query("SELECT * FROM categories ORDER BY name");
    return res.json(rows.map((r) => ({ id: r.name, name: r.name })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/categories", auth, async (req, res) => {
  try {
    const name = normalizeString(req.body?.name || req.body?.category || "");
    if (!name) return res.status(400).json({ message: "Category name is required." });

    try {
      await mysqlPool.execute("INSERT INTO categories (name) VALUES (?)", [name]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This category already exists." });
      }
      throw e;
    }
    return res.json({ id: name, name });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/categories/:id", auth, async (req, res) => {
  try {
    const oldName = req.params.id;
    const newName = normalizeString(req.body?.name || req.body?.category || "");
    if (!newName) return res.status(400).json({ message: "Category name is required." });

    try {
      await mysqlPool.execute("UPDATE categories SET name = ? WHERE name = ?", [newName, oldName]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This category already exists." });
      }
      throw e;
    }
    return res.json({ id: newName, name: newName });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/categories/:id", auth, async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM categories WHERE name = ?", [req.params.id]);
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// TYPES
// ======================================================

app.get("/api/types", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query("SELECT * FROM types ORDER BY name");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/types", auth, async (req, res) => {
  try {
    const name = normalizeString(req.body?.name || "");
    if (!name) return res.status(400).json({ message: "Type name is required." });

    try {
      const [result] = await mysqlPool.execute("INSERT INTO types (name) VALUES (?)", [name]);
      const [rows] = await mysqlPool.execute("SELECT * FROM types WHERE id = ?", [result.insertId]);
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This type already exists." });
      }
      throw e;
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/types/:id", auth, async (req, res) => {
  try {
    const name = normalizeString(req.body?.name || "");
    if (!name) return res.status(400).json({ message: "Type name is required." });

    try {
      await mysqlPool.execute("UPDATE types SET name = ? WHERE id = ?", [name, req.params.id]);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This type already exists." });
      }
      throw e;
    }
    const [rows] = await mysqlPool.execute("SELECT * FROM types WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: "Type not found." });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/types/:id", auth, async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM types WHERE id = ?", [req.params.id]);
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// REFERRALS
// ======================================================

app.get("/api/referrals", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query("SELECT * FROM referrals ORDER BY id DESC");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/referrals", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const [result] = await mysqlPool.execute(
      "INSERT INTO referrals (name, mobile, email, referred_by, course, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        body.name || "",
        body.mobile || "",
        body.email || "",
        body.referred_by || body.referredBy || "",
        body.course || "",
        body.status || "Pending",
        body.notes || null,
      ]
    );
    const [rows] = await mysqlPool.execute("SELECT * FROM referrals WHERE id = ?", [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/referrals/:id", auth, async (req, res) => {
  try {
    const body = req.body || {};
    const [existing] = await mysqlPool.execute("SELECT * FROM referrals WHERE id = ?", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: "Referral not found." });
    const e = existing[0];

    await mysqlPool.execute(
      "UPDATE referrals SET name=?, mobile=?, email=?, referred_by=?, course=?, status=?, notes=? WHERE id=?",
      [
        body.name ?? e.name,
        body.mobile ?? e.mobile,
        body.email ?? e.email,
        body.referred_by ?? body.referredBy ?? e.referred_by,
        body.course ?? e.course,
        body.status ?? e.status,
        body.notes ?? e.notes,
        req.params.id,
      ]
    );
    const [rows] = await mysqlPool.execute("SELECT * FROM referrals WHERE id = ?", [req.params.id]);
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/referrals/:id", auth, async (req, res) => {
  try {
    await mysqlPool.execute("DELETE FROM referrals WHERE id = ?", [req.params.id]);
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// ADMINS
// ======================================================

app.get("/api/admins", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query(
      "SELECT id, username, name, password FROM users WHERE role = 'Admin' ORDER BY id"
    );
    return res.json(rows.map((r) => ({ ...r, role: "Administrator", status: "Active" })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/api/admins", auth, async (req, res) => {
  try {
    const name = normalizeString(req.body?.name || "");
    const username = normalizeString(req.body?.username || "");
    const password = normalizeString(req.body?.password || "");

    if (!name || !username || !password) {
      return res.status(400).json({ message: "Admin name, username and password are required." });
    }

    try {
      const [result] = await mysqlPool.execute(
        "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'Admin')",
        [username, password, name]
      );
      const [rows] = await mysqlPool.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
      return res.json({ ...sanitizeUser(rows[0]), password, role: "Administrator", status: "Active" });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This admin username already exists." });
      }
      throw e;
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/admins/:id", auth, async (req, res) => {
  try {
    const [existing] = await mysqlPool.execute(
      "SELECT * FROM users WHERE id = ? AND role = 'Admin'",
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ message: "Admin record not found." });

    const username = normalizeString(req.body?.username || existing[0].username);
    const password = normalizeString(req.body?.password || existing[0].password);
    const name = normalizeString(req.body?.name || existing[0].name || username);

    await mysqlPool.execute(
      "UPDATE users SET username = ?, password = ?, name = ? WHERE id = ?",
      [username, password, name, req.params.id]
    );

    return res.json({ id: existing[0].id, username, name, password, role: "Administrator", status: "Active" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete("/api/admins/:id", auth, async (req, res) => {
  try {
    const [result] = await mysqlPool.execute(
      "DELETE FROM users WHERE id = ? AND role = 'Admin'",
      [req.params.id]
    );
    return res.json({ deleted: result.affectedRows > 0 });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// REPORTS
// ======================================================

app.get("/api/reports", auth, async (req, res) => {
  try {
    const [[{ totalStudents }]] = await mysqlPool.query("SELECT COUNT(*) AS totalStudents FROM students");
    const [[{ totalEnquiries }]] = await mysqlPool.query("SELECT COUNT(*) AS totalEnquiries FROM enquiries");
    const [[{ totalRevenue }]] = await mysqlPool.query("SELECT COALESCE(SUM(total_fee), 0) AS totalRevenue FROM students");
    const [[{ totalDue }]] = await mysqlPool.query("SELECT COALESCE(SUM(balance_fee), 0) AS totalDue FROM students");
    const [catRows] = await mysqlPool.query("SELECT name FROM categories");

    const categories = await Promise.all(
      catRows.map(async (cat) => {
        const [[{ students }]] = await mysqlPool.query(
          "SELECT COUNT(*) AS students FROM students WHERE category = ?",
          [cat.name]
        );
        return { name: cat.name, students: Number(students) };
      })
    );

    return res.json({
      totalStudents: Number(totalStudents),
      totalEnquiries: Number(totalEnquiries),
      totalRevenue: Number(totalRevenue),
      totalDue: Number(totalDue),
      categories,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// SETTINGS
// ======================================================

app.get("/api/settings", auth, async (req, res) => {
  try {
    const [rows] = await mysqlPool.query("SELECT key_name, value FROM settings");
    const settings = {};
    rows.forEach((r) => {
      try { settings[r.key_name] = JSON.parse(r.value); } catch { settings[r.key_name] = r.value; }
    });
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.patch("/api/settings", auth, async (req, res) => {
  try {
    const body = req.body || {};
    for (const [key, value] of Object.entries(body)) {
      const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
      await mysqlPool.execute(
        "INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
        [key, serialized, serialized]
      );
    }
    const [rows] = await mysqlPool.query("SELECT key_name, value FROM settings");
    const settings = {};
    rows.forEach((r) => {
      try { settings[r.key_name] = JSON.parse(r.value); } catch { settings[r.key_name] = r.value; }
    });
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ======================================================
// 404 FALLBACK
// ======================================================

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// ======================================================
// START
// ======================================================

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SCOT IT Academy API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to MySQL database:", err.message);
    process.exitCode = 1;
  });
