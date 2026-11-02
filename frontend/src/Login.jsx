
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL = "http://127.0.0.1:8000";

function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed. Please try again.");
      }

      // Save authentication details
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect according to user role
      if (data.user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (data.user.role === "employee") {
        navigate("/employee/dashboard", { replace: true });
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        setError("Invalid account role.");
      }
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to the server. Please try again."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-logo">O</div>
        <span>OMNIX</span>
      </div>

      <div className="login-container">
        <div className="login-info">
          <span className="login-label">WELCOME TO OMNIX</span>

          <h1>
            One Platform.<br />
            <span>Everything Connected.</span>
          </h1>

          <p>
            Your workspace for managing people, teams
            and everything that keeps your organization moving.
          </p>

          <div className="login-points">
            <p>✓ Secure employee access</p>
            <p>✓ Smart workforce management</p>
            <p>✓ One centralized workspace</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <h2>Welcome back!</h2>
            <p>Sign in to continue to your account.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="loginEmail">Email Address</label>

            <input
              id="loginEmail"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="loginPassword">Password</label>

            <div className="login-password">
              <input
                id="loginPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  color: "#dc2626",
                  fontSize: "13px",
                  margin: "4px 0",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <p className="login-register">
            Don't have an account? <a href="/register">Create account</a>
          </p>

          <div className="login-security">
            <span>●</span> Your account is protected with secure access.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
