import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authApi,
  getCurrentUser,
  getAccessToken,
} from "../services/api";

export default function Signup() {
  const navigate = useNavigate();

  const currentUser = getCurrentUser();

  // Pre-fill with current username
  const [newUsername, setNewUsername] = useState(
    currentUser?.username || ""
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!getAccessToken() || !getCurrentUser()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  async function submit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanUsername = newUsername.trim();
    const cleanCurrentPassword = currentPassword;
    const cleanNewPassword = newPassword;
    const cleanConfirmPassword = confirmPassword;

    // ── Validation ──────────────────────────────────
    if (!cleanCurrentPassword) {
      setError("Please enter your current password.");
      return;
    }

    const usernameChanged =
      cleanUsername &&
      cleanUsername.toLowerCase() !== (currentUser?.username || "").toLowerCase();

    const passwordChanged = !!cleanNewPassword;

    if (!usernameChanged && !passwordChanged) {
      setError(
        "No changes detected. Enter a new username or a new password to update."
      );
      return;
    }

    if (passwordChanged) {
      if (cleanNewPassword.length < 6) {
        setError("New password must contain at least 6 characters.");
        return;
      }
      if (cleanNewPassword !== cleanConfirmPassword) {
        setError("New password and confirm password do not match.");
        return;
      }
      if (cleanCurrentPassword === cleanNewPassword) {
        setError(
          "New password must be different from your current password."
        );
        return;
      }
    }

    const role = String(currentUser?.role || "").toLowerCase();
    if (role !== "owner" && role !== "administrator") {
      setError("Only the owner can update the owner account.");
      return;
    }

    // ── Submit ───────────────────────────────────────
    setLoading(true);

    try {
      const payload = {
        current_password: cleanCurrentPassword,
      };

      if (usernameChanged) {
        payload.new_username = cleanUsername;
      }

      if (passwordChanged) {
        payload.new_password = cleanNewPassword;
      }

      const res = await authApi.updateCredentials(payload);

      const msg =
        res?.data?.message || "Account updated successfully.";

      setSuccess(msg);

      // Clear sensitive fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Go to login so user logs in with new credentials
      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (err) {
      const status = err?.response?.status;
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "";

      if (status === 401) {
        setError(
          backendMessage ||
            "Current password is incorrect. Please try again."
        );
      } else if (status === 409) {
        setError(
          backendMessage || "This username is already in use."
        );
      } else if (status === 400) {
        setError(
          backendMessage ||
            "Invalid input. Please check the entered details."
        );
      } else {
        setError(
          backendMessage ||
            err?.message ||
            "Update failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">

        {/* LOGO */}
        <div className="login-logo">
          <h2>SCOT</h2>
          <p>IT ACADEMY</p>
        </div>

        {/* TITLE */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 16px",
              borderRadius: "20px",
              background: "#eaf4ff",
              color: "#145a96",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "1px",
              marginBottom: "14px",
            }}
          >
            UPDATE ACCOUNT
          </div>
          <p style={{ margin: 0, color: "#607d9d", fontSize: "14px" }}>
            Change your username and/or password below.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={submit}>

          {/* NEW USERNAME */}
          <div className="login-field">
            <label htmlFor="new-username">New Username</label>
            <input
              id="new-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter new username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          {/* CURRENT PASSWORD */}
          <div className="login-field">
            <label htmlFor="current-password">
              Current Password <span style={{ color: "#e53" }}>*</span>
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          {/* NEW PASSWORD */}
          <div className="login-field">
            <label htmlFor="new-password">
              New Password{" "}
              <span style={{ color: "#607d9d", fontWeight: 400, fontSize: "12px" }}>
                (leave blank to keep current)
              </span>
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          {/* CONFIRM PASSWORD */}
          {newPassword && (
            <div className="login-field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </div>
          )}

          {/* PASSWORD HINT */}
          {newPassword && (
            <div
              style={{
                fontSize: "13px",
                color: "#607d9d",
                marginBottom: "15px",
              }}
            >
              Password must contain at least 6 characters.
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="login-error">{error}</div>
          )}

          {/* SUCCESS */}
          {success && (
            <div
              style={{
                marginBottom: "15px",
                padding: "12px",
                borderRadius: "8px",
                background: "#e9f8ee",
                color: "#20733b",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {success} Redirecting to login…
            </div>
          )}

          {/* SUBMIT */}
          <button
            type="submit"
            className="primary login-btn"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Account"}
          </button>

          {/* BACK */}
          <div className="login-links">
            <Link to="/dashboard">Back to Dashboard</Link>
          </div>

        </form>
      </div>
    </div>
  );
}
