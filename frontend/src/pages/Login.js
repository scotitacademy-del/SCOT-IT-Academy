import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../services/api";

export default function Login() {
  // IMPORTANT:
  // Do NOT put default owner credentials here.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();

    setError("");

    const cleanUsername = username.trim();
    const cleanPassword = password;

    if (!cleanUsername) {
      setError("Please enter your username.");
      return;
    }

    if (!cleanPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.login({
        username: cleanUsername,
        password: cleanPassword,
      });

      const user = res.data?.user;

      if (!user) {
        throw new Error("User information was not returned.");
      }

      // Save only the real token returned by backend.
      if (res.data?.access) {
        localStorage.setItem(
          "access_token",
          res.data.access
        );
      }

      // Save logged-in user.
      localStorage.setItem(
        "scot_it_current_user",
        JSON.stringify(user)
      );

      // Clear login form.
      setUsername("");
      setPassword("");

      navigate("/dashboard");
    } catch (error) {
      const status = error?.response?.status;
      const message = status === 401
        ? "Username or password is incorrect. Use your current academy account. If you cannot sign in, ask the owner to reset your access."
        : !error?.response
        ? "Cannot reach the login server. Check your connection and try again."
        : status >= 500
        ? "The login server is unavailable. Please try again shortly."
        : error?.response?.data?.message || "Login failed. Please try again.";

      setError(message);
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

        <form onSubmit={submit}>

          {/* USERNAME */}
          <div className="login-field">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="login-field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {/* ERROR */}
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {/* LOGIN */}
          <button
            type="submit"
            className="primary login-btn"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          {/* OWNER REGISTRATION */}
          {/* <div className="login-links">
            <Link to="/forgot-password">
              Forgot Password?
            </Link>
          </div> */}

        </form>
      </div>
    </div>
  );
}
