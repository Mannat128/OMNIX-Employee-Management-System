
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
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

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const role = user.role?.toLowerCase() || "employee";

  const profilePath =
    role === "admin" ? "/admin/profile" : "/employee/profile";

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    if (newPassword.length > 128) {
      setError("New password cannot exceed 128 characters.");
      return;
    }

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

      const response = await fetch(`${API_URL}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to update password. Please try again."
        );
      }

      setMessage(data.message || "Password changed successfully.");

      // Clear old session after successful password change
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

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
    <div className="change-password-page">

      <Sidebar />

      <main className="password-main">
        <Header />

        <div className="password-content">

          {/* Page Heading */}
          <div className="password-page-heading">
            <div>
              <span className="password-eyebrow">
                ACCOUNT SECURITY
              </span>

              <h1>Change Password</h1>

              <p>
                Keep your OMNIX account safe and secure.
              </p>
            </div>

            {!message && (
              <button
                type="button"
                className="password-back"
                onClick={() => navigate(profilePath)}
              >
                <ArrowLeft size={16} />
                Back to Profile
              </button>
            )}
          </div>

          {/* Password Card */}
          <section className="password-card">

            <div className="password-card-banner">
              <div className="password-card-icon">
                <LockKeyhole size={25} />
              </div>

              <div>
                <h2>Password Security</h2>
                <p>
                  Update your password to protect your account.
                </p>
              </div>
            </div>

            {/* Success State */}
            {message ? (
              <div className="password-success-state">

                <div className="password-success-icon">
                  <CheckCircle2 size={32} />
                </div>

                <h2>Password Updated!</h2>

                <p>{message}</p>

                <p className="password-session-note">
                  For your security, please log in again using your new
                  password.
                </p>

                <button
                  type="button"
                  className="password-submit-btn"
                  onClick={() => navigate("/login", { replace: true })}
                >
                  Login Again
                  <ArrowLeft size={16} />
                </button>

              </div>
            ) : (

              /* Password Form */
              <form
                className="password-form"
                onSubmit={handleSubmit}
              >

                {/* Current Password */}
                <div className="password-form-group">
                  <label htmlFor="currentPassword">
                    Current Password
                  </label>

                  <div className="password-input-wrapper">
                    <LockKeyhole size={17} />

                    <input
                      id="currentPassword"
                      type={showPasswords ? "text" : "password"}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) =>
                        setCurrentPassword(e.target.value)
                      }
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="password-form-group">
                  <label htmlFor="newPassword">
                    New Password
                  </label>

                  <div className="password-input-wrapper">
                    <LockKeyhole size={17} />

                    <input
                      id="newPassword"
                      type={showPasswords ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) =>
                        setNewPassword(e.target.value)
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="password-form-group">
                  <label htmlFor="confirmPassword">
                    Confirm New Password
                  </label>

                  <div className="password-input-wrapper">
                    <LockKeyhole size={17} />

                    <input
                      id="confirmPassword"
                      type={showPasswords ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Show Password */}
                <label className="password-show-option">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) =>
                      setShowPasswords(e.target.checked)
                    }
                  />

                  <span>
                    {showPasswords ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}

                    Show passwords
                  </span>
                </label>

                {/* Security Note */}
                <div className="password-security-note">
                  <ShieldCheck size={19} />

                  <p>
                    Use at least 8 characters. Avoid using a password
                    that you have used before.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div
                    className="password-message error"
                    role="alert"
                  >
                    <AlertCircle size={17} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="password-actions">

                  <button
                    type="button"
                    className="password-cancel-btn"
                    onClick={() => navigate(profilePath)}
                    disabled={loading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="password-submit-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="password-spinner"
                        />
                        Updating...
                      </>
                    ) : (
                      <>
                        Update Password
                        <ArrowLeft
                          className="password-arrow"
                          size={16}
                        />
                      </>
                    )}
                  </button>

                </div>
              </form>
            )}

          </section>
        </div>
      </main>
    </div>
  );
}

export default ChangePassword;
