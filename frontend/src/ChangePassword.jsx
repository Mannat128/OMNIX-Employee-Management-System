import { useState } from "react";
import "./ChangePassword.css";

function ChangePassword() {
  const [showPasswords, setShowPasswords] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
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

          <form
            className="password-form"
            onSubmit={handleSubmit}
          >
            <div className="password-form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="password-form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Enter new password"
                minLength="8"
                required
              />
            </div>

            <div className="password-form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                placeholder="Confirm new password"
                minLength="8"
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

            <div className="password-actions">
              <a href="/admin/profile">Cancel</a>
              <button type="submit">Update Password →</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ChangePassword;