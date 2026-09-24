const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "scot-it-academy-secret";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "root";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME || "student_management";
const DB_FILE = path.join(__dirname, "..", "data", "db.json");
const mysqlPool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4"
});
const DEFAULT_OWNER = {
  id: "owner",
  username: "SCOT",
  password: "scotitacademy@2026",
  name: "SCOT IT Academy Owner",
  role: "Owner"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialData() {
  return {
    users: [
      { ...DEFAULT_OWNER }
    ],
    students: [],
    enquiries: [],
    categories: [],
    referrals: [],
    settings: {
      academyName: "SCOT IT ACADEMY",
      ownerName: "SCOT IT Academy Owner",
      defaultLogin: { username: "SCOT", password: "scotitacademy@2026" },
      database: { username: DB_USER, password: DB_PASSWORD }
    }
  };
}

function ensureDataFile() {
  const directory = path.dirname(DB_FILE);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(createInitialData(), null, 2));
  }

  const raw = fs.readFileSync(DB_FILE, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    data = createInitialData();
  }

  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.students)) data.students = [];
  if (!Array.isArray(data.enquiries)) data.enquiries = [];
  if (!Array.isArray(data.categories)) data.categories = [];
  if (!Array.isArray(data.referrals)) data.referrals = [];
  if (!data.settings || typeof data.settings !== "object") {
    data.settings = createInitialData().settings;
  }

  const ownerIndex = data.users.findIndex((user) => {
    const username = String(user.username || "").toLowerCase();
    return user.role === "Owner" || username === "owner" || username === "scot";
  });

  if (ownerIndex >= 0) {
    const owner = {
      ...data.users[ownerIndex],
      id: data.users[ownerIndex].id || DEFAULT_OWNER.id,
      username: DEFAULT_OWNER.username,
      password: DEFAULT_OWNER.password,
      name: DEFAULT_OWNER.name,
      role: DEFAULT_OWNER.role
    };
    data.users = [owner, ...data.users.filter((user, index) => index !== ownerIndex && user.role !== "Owner")];
  } else {
    data.users.unshift({ ...DEFAULT_OWNER });
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  return data;
}

function readDb() {
  return ensureDataFile();
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function sanitizeUser(user) {
  const safeUser = clone(user);
  delete safeUser.password;
  return safeUser;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.replace("Bearer ", "") : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildStudentSummary(student) {
  const paidFee = toNumber(student.paidFee ?? student.paid_fee, 0);
  const balanceFee = toNumber(student.balanceFee ?? student.balance_fee, 0);
  const totalFee = toNumber(student.totalFee ?? student.total_fee, paidFee + balanceFee);

  return {
    ...student,
    paidFee,
    balanceFee,
    totalFee,
    studentId: student.studentId || student.id || `ST-${String(student.id || "").padStart(3, "0")}`
  };
}

function mapMysqlStudent(row) {
  return buildStudentSummary({
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    course: row.course,
    mobile: row.mobile,
    email: row.email,
    city: row.city,
    category: row.category,
    paidFee: row.paid_fee,
    balanceFee: row.balance_fee,
    totalFee: row.total_fee,
    dueDate: row.due_date,
    joinDate: row.join_date,
    status: row.status
  });
}

async function ensureMysqlSchema() {
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
      status VARCHAR(30) NOT NULL DEFAULT 'Joined',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_students_student_id (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function getUniqueNotificationKey(student) {
  return String(student.studentId || student.id || `${student.name || "student"}-${student.mobile || ""}`);
}

function getNotificationsFromStudents(students) {
  const map = new Map();

  students.forEach((student) => {
    const paidFee = toNumber(student.paidFee ?? student.paid_fee, 0);
    const balanceFee = toNumber(student.balanceFee ?? student.balance_fee, 0);
    const dueDate = student.dueDate || student.due_date;

    if (!dueDate || balanceFee <= 0) {
      return;
    }

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return;
    }

    const now = new Date();
    if (due >= now) {
      return;
    }

    const key = getUniqueNotificationKey(student);
    if (!map.has(key)) {
      map.set(key, {
        id: student.id,
        studentId: student.studentId || student.id,
        student_name: student.name || student.candidate_name || "Student",
        name: student.name || student.candidate_name || "Student",
        mobile: student.mobile || "",
        paidFee,
        balanceFee,
        totalFee: paidFee + balanceFee,
        dueDate,
        pending_fee: balanceFee,
        status: "Due"
      });
    }
  });

  return [...map.values()];
}

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "SCOT IT Academy API" });
});

app.post("/api/auth/login", (req, res) => {
  const db = readDb();
  const username = normalizeString(req.body?.username || "");
  const password = normalizeString(req.body?.password || "");

  const matchedUser = db.users.find(
    (user) => String(user.username || "").toLowerCase() === username.toLowerCase() && String(user.password || "") === password
  );

  if (!matchedUser) {
    return res.status(401).json({ message: "Invalid username or password." });
  }

  const safeUser = sanitizeUser(matchedUser);
  return res.json({
    access: generateToken(matchedUser),
    user: safeUser
  });
});

app.post("/api/auth/signup", (req, res) => {
  const db = readDb();
  const ownerName = normalizeString(req.body?.name || "SCOT IT Academy Owner");
  const username = normalizeString(req.body?.username || "");
  const password = normalizeString(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const existingOwner = db.users.find((user) => user.role === "Owner" || String(user.username || "").toLowerCase() === "owner");

  if (existingOwner) {
    existingOwner.username = username;
    existingOwner.password = password;
    existingOwner.name = ownerName || existingOwner.name;
    existingOwner.role = "Owner";
  } else {
    db.users.unshift({
      id: `owner-${Date.now()}`,
      username,
      password,
      name: ownerName,
      role: "Owner"
    });
  }

  writeDb(db);

  const ownerRecord = db.users.find((user) => String(user.username || "").toLowerCase() === username.toLowerCase() && user.role === "Owner");
  const safeUser = sanitizeUser(ownerRecord || { ...DEFAULT_OWNER, username, password, name: ownerName, role: "Owner" });

  return res.json({
    access: generateToken(ownerRecord || { ...DEFAULT_OWNER, username, password, name: ownerName, role: "Owner" }),
    user: safeUser
  });
});

app.get("/api/auth/me", auth, (req, res) => {
  const db = readDb();
  const matchedUser = db.users.find((user) => String(user.username || "").toLowerCase() === String(req.user.username || "").toLowerCase());
  if (!matchedUser) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json(sanitizeUser(matchedUser));
});

app.get("/api/dashboard", auth, (req, res) => {
  const db = readDb();
  const totalStudents = db.students.length;
  const joinedStudents = db.students.filter((row) => String(row.status || "").toLowerCase() === "joined").length;
  const totalFee = db.students.reduce((sum, row) => sum + toNumber(row.totalFee ?? row.total_fee, toNumber(row.paidFee ?? row.paid_fee, 0) + toNumber(row.balanceFee ?? row.balance_fee, 0)), 0);
  const categories = db.categories.map((category) => {
    const count = db.students.filter((row) => row.category === category).length;
    return [category, count, 0];
  });

  const recent = db.enquiries.slice(0, 8).map((row) => [
    row.admin || "Owner",
    row.candidate_name || row.name || "",
    row.mobile || "",
    row.city || "",
    row.category || "",
    row.course || "",
    row.next_followup_date || "",
    row.status || "Pending"
  ]);

  const follow = db.enquiries.slice(0, 8).map((row) => ({
    ...row,
    name: row.candidate_name || row.name || ""
  }));

  return res.json({
    totalStudents,
    joinedStudents,
    totalFee,
    recent,
    follow,
    categories,
    summary: {
      totalStudents,
      joinedStudents,
      totalFee,
      recent,
      follow,
      categories
    }
  });
});

app.get("/api/notifications", auth, (req, res) => {
  const db = readDb();
  return res.json(getNotificationsFromStudents(db.students));
});

app.get("/api/enquiries", auth, (req, res) => {
  const db = readDb();
  return res.json(db.enquiries);
});

app.post("/api/enquiries", auth, (req, res) => {
  const db = readDb();
  const nextId = db.enquiries.length ? Math.max(...db.enquiries.map((item) => Number(item.id) || 0)) + 1 : 1;
  const record = { id: nextId, ...req.body };
  db.enquiries.push(record);
  writeDb(db);
  return res.json(record);
});

app.get("/api/enquiries/:id", auth, (req, res) => {
  const db = readDb();
  const record = db.enquiries.find((row) => String(row.id) === String(req.params.id));
  if (!record) return res.status(404).json({ message: "Enquiry not found." });
  return res.json(record);
});

app.patch("/api/enquiries/:id", auth, (req, res) => {
  const db = readDb();
  const index = db.enquiries.findIndex((row) => String(row.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: "Enquiry not found." });
  db.enquiries[index] = { ...db.enquiries[index], ...req.body };
  writeDb(db);
  return res.json(db.enquiries[index]);
});

app.delete("/api/enquiries/:id", auth, (req, res) => {
  const db = readDb();
  db.enquiries = db.enquiries.filter((row) => String(row.id) !== String(req.params.id));
  writeDb(db);
  return res.json({ deleted: true });
});

app.get("/api/students", auth, async (req, res) => {
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
});

app.get("/api/students/next-id", auth, async (req, res) => {
  const [rows] = await mysqlPool.query(
    "SELECT student_id FROM students WHERE student_id REGEXP '^SCT[0-9]+$' ORDER BY id DESC LIMIT 1"
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const match = String(rows[0].student_id).match(/^SCT(\d+)$/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  const nextId = `SCT${String(nextNum).padStart(3, "0")}`;
  return res.json({ nextId });
});

app.get("/api/students/session", auth, async (req, res) => {
  const { month, year } = req.query;
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
});

app.post("/api/students", auth, async (req, res) => {
  const payload = req.body || {};
  const paidFee = toNumber(payload.paidFee ?? payload.paid_fee, 0);
  const balanceFee = toNumber(payload.balanceFee ?? payload.balance_fee, 0);
  const totalFee = toNumber(payload.totalFee ?? payload.total_fee, paidFee + balanceFee);

  // Auto-generate sequential Student ID (SCT001, SCT002, ...)
  let studentId = String(payload.studentId || payload.student_id || "").trim();
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

  // Check uniqueness
  const [existCheck] = await mysqlPool.execute(
    "SELECT id FROM students WHERE student_id = ?", [studentId]
  );
  if (existCheck.length > 0) {
    return res.status(409).json({ message: "Student ID already exists." });
  }

  const joinDate = payload.joinDate || payload.join_date || new Date().toISOString().slice(0, 10);
  const status = payload.status || "Active";

  const [result] = await mysqlPool.execute(
    `INSERT INTO students
      (student_id, name, course, mobile, email, city, category, paid_fee, balance_fee, total_fee, due_date, join_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?)`,
    [studentId, payload.name || payload.candidate_name || "", payload.course || "", payload.mobile || "", payload.email || "", payload.city || "", payload.category || "", paidFee, balanceFee, totalFee, payload.dueDate || payload.due_date || "", joinDate, status]
  );
  const [rows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ?", [result.insertId]);
  return res.status(201).json(mapMysqlStudent(rows[0]));
});

app.get("/api/students/:id", auth, async (req, res) => {
  const [rows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ? OR student_id = ?", [req.params.id, req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: "Student not found." });
  return res.json(mapMysqlStudent(rows[0]));
});

app.patch("/api/students/:id", auth, async (req, res) => {
  const payload = req.body || {};
  const [existingRows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ? OR student_id = ?", [req.params.id, req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ message: "Student not found." });
  const paidFee = toNumber(payload.paidFee ?? payload.paid_fee ?? existing.paid_fee, 0);
  const balanceFee = toNumber(payload.balanceFee ?? payload.balance_fee ?? existing.balance_fee, 0);
  const totalFee = toNumber(payload.totalFee ?? payload.total_fee, paidFee + balanceFee);
  await mysqlPool.execute(
    `UPDATE students SET student_id=?, name=?, course=?, mobile=?, email=?, city=?, category=?, paid_fee=?, balance_fee=?, total_fee=?, due_date=NULLIF(?, ''), join_date=NULLIF(?, ''), status=? WHERE id=?`,
    [payload.studentId || existing.student_id, payload.name || payload.candidate_name || existing.name, payload.course ?? existing.course, payload.mobile ?? existing.mobile, payload.email ?? existing.email, payload.city ?? existing.city, payload.category ?? existing.category, paidFee, balanceFee, totalFee, (payload.dueDate ?? payload.due_date ?? existing.due_date ?? ""), (payload.joinDate ?? payload.join_date ?? existing.join_date ?? ""), payload.status || existing.status, existing.id]
  );
  const [rows] = await mysqlPool.execute("SELECT * FROM students WHERE id = ?", [existing.id]);
  return res.json(mapMysqlStudent(rows[0]));
});

app.delete("/api/students/:id", auth, async (req, res) => {
  await mysqlPool.execute("DELETE FROM students WHERE id = ? OR student_id = ?", [req.params.id, req.params.id]);
  return res.json({ deleted: true });
});

app.get("/api/follow-ups", auth, (req, res) => {
  const db = readDb();
  const followUps = db.enquiries.filter((row) => String(row.status || "").toLowerCase() !== "joined");
  return res.json(followUps);
});

app.get("/api/categories", auth, (req, res) => {
  const db = readDb();
  return res.json(db.categories.map((name) => ({ id: name, name })));
});

app.post("/api/categories", auth, (req, res) => {
  const db = readDb();
  const name = normalizeString(req.body?.name || req.body?.category || "");
  if (!name) return res.status(400).json({ message: "Category name is required." });
  const exists = db.categories.some((item) => String(item).trim().toLowerCase() === name.toLowerCase());
  if (exists) return res.status(409).json({ message: "This category already exists." });
  db.categories.push(name);
  writeDb(db);
  return res.json({ id: name, name });
});

app.patch("/api/categories/:id", auth, (req, res) => {
  const db = readDb();
  const oldName = req.params.id;
  const newName = normalizeString(req.body?.name || req.body?.category || "");
  if (!newName) return res.status(400).json({ message: "Category name is required." });
  const duplicate = db.categories.some((name) => name.toLowerCase() === newName.toLowerCase() && name !== oldName);
  if (duplicate) return res.status(409).json({ message: "This category already exists." });
  db.categories = db.categories.map((name) => (name === oldName ? newName : name));
  writeDb(db);
  return res.json({ id: newName, name: newName });
});

app.delete("/api/categories/:id", auth, (req, res) => {
  const db = readDb();
  db.categories = db.categories.filter((name) => name !== req.params.id);
  writeDb(db);
  return res.json({ deleted: true });
});

app.get("/api/referrals", auth, (req, res) => {
  const db = readDb();
  return res.json(db.referrals);
});

app.post("/api/referrals", auth, (req, res) => {
  const db = readDb();
  const row = { id: Date.now(), ...req.body };
  db.referrals.push(row);
  writeDb(db);
  return res.json(row);
});

app.patch("/api/referrals/:id", auth, (req, res) => {
  const db = readDb();
  const index = db.referrals.findIndex((row) => String(row.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ message: "Referral not found." });
  db.referrals[index] = { ...db.referrals[index], ...req.body };
  writeDb(db);
  return res.json(db.referrals[index]);
});

app.delete("/api/referrals/:id", auth, (req, res) => {
  const db = readDb();
  db.referrals = db.referrals.filter((row) => String(row.id) !== String(req.params.id));
  writeDb(db);
  return res.json({ deleted: true });
});

app.get("/api/admins", auth, (req, res) => {
  const db = readDb();
  return res.json(
    db.users
      .filter((user) => String(user.role || "").toLowerCase() === "admin")
      .map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        password: user.password,
        role: user.role,
        status: "Active"
      }))
  );
});

app.post("/api/admins", auth, (req, res) => {
  const db = readDb();
  const name = normalizeString(req.body?.name || "");
  const username = normalizeString(req.body?.username || "");
  const password = normalizeString(req.body?.password || "");

  if (!name || !username || !password) {
    return res.status(400).json({ message: "Admin name, username and password are required." });
  }

  const duplicate = db.users.some((user) => String(user.username || "").toLowerCase() === username.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ message: "This admin username already exists." });
  }

  const row = {
    id: `admin-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    username,
    password,
    role: "Admin"
  };

  db.users.push(row);
  writeDb(db);
  return res.json({ ...row, role: "Administrator", status: "Active" });
});

app.patch("/api/admins/:id", auth, (req, res) => {
  const db = readDb();
  const index = db.users.findIndex((user) => String(user.id) === String(req.params.id) && String(user.role || "").toLowerCase() === "admin");
  if (index === -1) return res.status(404).json({ message: "Admin record not found." });

  const username = normalizeString(req.body?.username || db.users[index].username);
  const password = normalizeString(req.body?.password || db.users[index].password);
  const name = normalizeString(req.body?.name || db.users[index].name || username);

  db.users[index] = { ...db.users[index], username, password, name };
  writeDb(db);
  return res.json({ ...db.users[index], role: "Administrator", status: "Active" });
});

app.delete("/api/admins/:id", auth, (req, res) => {
  const db = readDb();
  const currentLength = db.users.length;
  db.users = db.users.filter((user) => !(String(user.id) === String(req.params.id) && String(user.role || "").toLowerCase() === "admin"));
  writeDb(db);
  return res.json({ deleted: db.users.length !== currentLength });
});

app.get("/api/reports", auth, (req, res) => {
  const db = readDb();
  const summary = {
    totalStudents: db.students.length,
    totalEnquiries: db.enquiries.length,
    totalRevenue: db.students.reduce((sum, row) => sum + toNumber(row.totalFee ?? row.total_fee, 0), 0),
    totalDue: db.students.reduce((sum, row) => sum + toNumber(row.balanceFee ?? row.balance_fee, 0), 0),
    categories: db.categories.map((name) => ({
      name,
      students: db.students.filter((student) => student.category === name).length
    }))
  };
  return res.json(summary);
});

app.get("/api/settings", auth, (req, res) => {
  const db = readDb();
  return res.json(db.settings);
});

app.patch("/api/settings", auth, (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  return res.json(db.settings);
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

ensureMysqlSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SCOT IT Academy API running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`Unable to connect to MySQL database '${DB_NAME}':`, error.message);
    process.exitCode = 1;
  });
