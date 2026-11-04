
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "./api";
import "./Login.css";

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
      const response = await API.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const data = response.data;

      if (!data.access_token || !data.user) {
        throw new Error("Invalid login response from server.");
      }

      const role = data.user.role?.toLowerCase();

      if (role !== "admin" && role !== "employee") {
        throw new Error("Invalid account role.");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/employee/dashboard", { replace: true });
      }

    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Login failed. Please try again.";

      setError(
        err.code === "ERR_NETWORK"
          ? "Unable to connect to the server. Please try again."
          : message
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
            One Platform.
            <br />
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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p className="login-error" role="alert">
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
            Don't have an account?{" "}
            <Link to="/register">Create account</Link>
          </p>

          <div className="login-security">
            <span>●</span>
            Your account is protected with secure access.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
