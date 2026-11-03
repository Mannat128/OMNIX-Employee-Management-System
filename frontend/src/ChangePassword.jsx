
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ChangePassword.css";

const API_URL = "http://127.0.0.1:8000";

function ChangePassword() {
  const navigate = useNavigate();

  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      setError("Your session has expired. Please login again.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to update password.");
      }

      setMessage(data.message || "Password changed successfully.");

      // Backend increments session_version, so the old token is invalid.
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <aside className="password-sidebar">
        <div className="password-brand">
          <span className="password-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="password-menu-title">ACCOUNT</p>

        <nav className="password-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/admin/profile">◉ My Profile</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <a href="/login" className="password-logout">↪ Logout</a>
      </aside>

      <main className="password-main">
        <header className="password-header">
          <div>
            <h1>Change Password</h1>
            <p>Update your account password.</p>
          </div>

          <a href="/admin/profile" className="password-back">
            ← Back to Profile
          </a>
        </header>

        <section className="password-card">
          <div className="password-card-heading">
            <h2>Password Security</h2>
            <p>Enter your current and new password below.</p>
          </div>

          <form className="password-form" onSubmit={handleSubmit}>
            <div className="password-form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="password-form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="password-form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <label className="password-show-option">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
              />
              Show passwords
            </label>

            {error && <p style={{ color: "red" }}>{error}</p>}
            {message && <p style={{ color: "green" }}>{message}</p>}

            {message ? (
              <div className="password-actions">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                >
                  Login Again →
                </button>
              </div>
            ) : (
              <div className="password-actions">
                <a href="/admin/profile">Cancel</a>
                <button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Password →"}
                </button>
              </div>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}

export default ChangePassword;
