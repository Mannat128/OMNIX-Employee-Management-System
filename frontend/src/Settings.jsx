
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Bell,
  Palette,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { useTheme } from "./ThemeContext";
import "./Settings.css";

function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [notifications, setNotifications] = useState(() => {
    try {
      return localStorage.getItem("notifications_enabled") !== "false";
    } catch {
      return true;
    }
  });

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const role = user.role?.toLowerCase() || "employee";

  const profilePath =
    role === "admin" ? "/admin/profile" : "/employee/profile";

  const passwordPath =
    role === "admin"
      ? "/admin/change-password"
      : "/employee/change-password";

  const handleNotifications = () => {
    const newValue = !notifications;

    setNotifications(newValue);

    try {
      localStorage.setItem(
        "notifications_enabled",
        String(newValue)
      );
    } catch {
      // Preference remains active for this session.
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="settings-layout">
      <Sidebar />

      <main className="settings-main">
        <Header />

        <div className="settings-content">

          {/* Page Heading */}
          <div className="settings-heading">
            <div>
              <span className="settings-eyebrow">
                PREFERENCES
              </span>

              <h1>Settings</h1>

              <p>
                Manage your account preferences and application settings.
              </p>
            </div>
          </div>

          {/* Account Settings */}
          <section className="settings-section">
            <div className="settings-section-heading">
              <div className="settings-section-icon">
                <User size={20} />
              </div>

              <div>
                <h2>Account</h2>
                <p>Manage your personal account information.</p>
              </div>
            </div>

            <div className="settings-options">

              <Link to={profilePath} className="settings-option">
                <div className="settings-option-icon">
                  <User size={19} />
                </div>

                <div className="settings-option-info">
                  <h3>Profile Information</h3>
                  <p>View your name, email and account details.</p>
                </div>

                <ChevronRight size={20} className="settings-arrow" />
              </Link>

              <Link to={passwordPath} className="settings-option">
                <div className="settings-option-icon">
                  <Lock size={19} />
                </div>

                <div className="settings-option-info">
                  <h3>Change Password</h3>
                  <p>Update your password to keep your account secure.</p>
                </div>

                <ChevronRight size={20} className="settings-arrow" />
              </Link>

            </div>
          </section>

          {/* Preferences */}
          <section className="settings-section">
            <div className="settings-section-heading">
              <div className="settings-section-icon">
                <Palette size={20} />
              </div>

              <div>
                <h2>Preferences</h2>
                <p>Customize your OMNIX experience.</p>
              </div>
            </div>

            <div className="settings-options">

              {/* Theme Toggle */}
              <div className="settings-option">
                <div className="settings-option-icon">
                  {theme === "dark" ? (
                    <Moon size={19} />
                  ) : (
                    <Sun size={19} />
                  )}
                </div>

                <div className="settings-option-info">
                  <h3>Appearance</h3>
                  <p>
                    Current theme: {theme === "dark" ? "Dark" : "Light"}
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${
                    theme === "dark" ? "active" : ""
                  }`}
                  onClick={toggleTheme}
                  aria-label="Toggle dark mode"
                  aria-pressed={theme === "dark"}
                >
                  <span />
                </button>
              </div>

              {/* Notifications Preference */}
              <div className="settings-option">
                <div className="settings-option-icon">
                  <Bell size={19} />
                </div>

                <div className="settings-option-info">
                  <h3>Notifications Preference</h3>
                  <p>
                    Save your notification preference on this device.
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${
                    notifications ? "active" : ""
                  }`}
                  onClick={handleNotifications}
                  aria-label="Toggle notification preference"
                  aria-pressed={notifications}
                >
                  <span />
                </button>
              </div>

            </div>
          </section>

          {/* Security */}
          <section className="settings-section">
            <div className="settings-section-heading">
              <div className="settings-section-icon">
                <ShieldCheck size={20} />
              </div>

              <div>
                <h2>Security</h2>
                <p>Keep your account protected.</p>
              </div>
            </div>

            <div className="settings-security-note">
              <ShieldCheck size={23} />

              <div>
                <h3>Your account security matters</h3>
                <p>
                  Use a strong password and never share your login
                  credentials with anyone.
                </p>
              </div>
            </div>
          </section>

          {/* Help and Support */}
          <section className="settings-section">
            <div className="settings-section-heading">
              <div className="settings-section-icon">
                <HelpCircle size={20} />
              </div>

              <div>
                <h2>Help & Support</h2>
                <p>Information about your workspace.</p>
              </div>
            </div>

            <div className="settings-options">
              <div className="settings-option">
                <div className="settings-option-icon">
                  <HelpCircle size={19} />
                </div>

                <div className="settings-option-info">
                  <h3>Support Center</h3>
                  <p>
                    Contact your organization administrator for assistance.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Logout */}
          <section className="settings-logout-section">
            <div>
              <h3>Sign out of your account</h3>
              <p>
                You will need to log in again to access your workspace.
              </p>
            </div>

            <button
              type="button"
              className="settings-logout-btn"
              onClick={handleLogout}
            >
              <LogOut size={17} />
              Sign Out
            </button>
          </section>

          {/* Footer */}
          <footer className="settings-footer">
            <span>OMNIX</span>
            <p>Employee Management System</p>
          </footer>

        </div>
      </main>
    </div>
  );
}

export default Settings;
