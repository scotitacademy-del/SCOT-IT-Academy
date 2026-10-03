const mysql = require("mysql2/promise");

function getDatabaseConfig() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL;

  if (connectionString) {
    const url = new URL(connectionString);

    const sslRequired =
      url.searchParams.get("ssl-mode") === "REQUIRED" ||
      url.searchParams.get("ssl") === "true";

    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(
        url.pathname.replace(/^\//, "")
      ),
      ssl: sslRequired
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database:
      process.env.DB_NAME || "student_management",
    ssl:
      String(process.env.DB_SSL).toLowerCase() === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

module.exports = function createDatabasePool() {
  return mysql.createPool({
    ...getDatabaseConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    charset: "utf8mb4",
  });
};
