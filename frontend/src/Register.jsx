
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "./api";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await API.post("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        department: department.trim(),
        password,
      });

      const data = response.data;

      setMessage(
        data.message ||
        "Registration successful. Please wait for admin approval."
      );

      setName("");
      setEmail("");
      setDepartment("");
      setPassword("");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2500);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        (err.code === "ERR_NETWORK"
          ? "Unable to connect to the server."
          : "Registration failed. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      <div className="register-brand">
        <div className="register-logo">O</div>
        <span>OMNIX</span>
      </div>

      <div className="register-container">

        <div className="register-info">
          <span className="register-label">JOIN OMNIX</span>

          <h1>
            Build better teams.
            <br />
            <span>Work smarter.</span>
          </h1>

          <p>
            Create your employee account and bring your
            workplace activities together in one secure platform.
          </p>

          <div className="register-points">
            <p>✓ Easy employee registration</p>
            <p>✓ Centralized employee workspace</p>
            <p>✓ Secure document management</p>
          </div>
        </div>

        <div className="register-card">

          <div className="register-card-heading">
            <h2>Create an account</h2>
            <p>Enter your details to get started.</p>
          </div>

          <form className="register-form" onSubmit={handleRegister}>

            <label htmlFor="registerName">Full Name</label>

            <input
              id="registerName"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />

            <label htmlFor="registerEmail">Email Address</label>

            <input
              id="registerEmail"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="registerDepartment">Department</label>

            <input
              id="registerDepartment"
              type="text"
              placeholder="Enter your department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />

            <label htmlFor="registerPassword">Password</label>

            <div className="register-password">
              <input
                id="registerPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
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
              <p className="register-error" role="alert">
                {error}
              </p>
            )}

            {message && (
              <p className="register-success" role="status">
                {message}
              </p>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account →"}
            </button>

          </form>

          <p className="register-login">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </p>

          <div className="register-note">
            Your registration will be reviewed by the administrator.
            You can sign in after your account is approved.
          </div>

        </div>
      </div>
    </div>
  );
}

export default Register;
