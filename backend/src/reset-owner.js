require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const createDatabasePool = require("./database");
const { ensureOwner } = require("./owner-account");

async function main() {
  const db = createDatabasePool();
  try {
    await ensureOwner(db, process.env, { reset: true });
    console.log("Owner credentials reset using OWNER_USERNAME and OWNER_PASSWORD. Existing academy records were preserved.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("Owner reset failed:", error.code || error.message);
  process.exitCode = 1;
});
