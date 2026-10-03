const bcrypt = require("bcryptjs");

// Environment credentials bootstrap an empty database. Existing account changes
// survive restarts; recovery is an explicit operator action via owner:reset.
async function ensureOwner(db, env, { reset = false } = {}) {
  const [owners] = await db.execute(
    "SELECT id, username FROM users WHERE role='Owner' ORDER BY id LIMIT 1"
  );
  const owner = owners[0];
  if (owner && !reset) return owner;

  const username = String(env.OWNER_USERNAME || "").trim();
  const password = String(env.OWNER_PASSWORD || "");
  const name = String(env.OWNER_NAME || "SCOT IT Academy Owner").trim();
  if (!username || !password) {
    throw new Error("Set OWNER_USERNAME and OWNER_PASSWORD to initialize or reset the owner.");
  }
  if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must contain at least 8 characters.");
  }
  if (username.length > 100 || !name || name.length > 150) {
    throw new Error("Owner username must be at most 100 characters and name must be 1–150 characters.");
  }

  const [matches] = await db.execute(
    "SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1",
    [username]
  );
  if (matches[0] && Number(matches[0].id) !== Number(owner?.id)) {
    throw new Error("OWNER_USERNAME is already used by another account. Choose a different username.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  if (owner) {
    await db.execute(
      "UPDATE users SET username=?, password_hash=?, name=? WHERE id=? AND role='Owner'",
      [username, passwordHash, name, owner.id]
    );
    return { id: owner.id, username };
  }

  const [result] = await db.execute(
    "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, 'Owner')",
    [username, passwordHash, name]
  );
  return { id: result.insertId, username };
}

module.exports = { ensureOwner };
