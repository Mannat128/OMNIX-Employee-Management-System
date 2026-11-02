import { useState } from "react";
import "./Settings.css";

function Settings() {
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <span className="settings-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="settings-menu-title">MAIN MENU</p>

        <nav className="settings-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees">♙ Employees</a>
          <a href="/admin/approvals">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings" className="active">⚙ Settings</a>
        </nav>

        <a href="/login" className="settings-logout">↪ Logout</a>
      </aside>

      <main className="settings-main">
        <header className="settings-header">
          <h1>Settings</h1>
          <p>Manage your account and application preferences.</p>
        </header>

        <section className="settings-card">
          <div className="settings-card-heading">
            <h2>Account Settings</h2>
            <p>Manage your account information and security.</p>
          </div>

          <div className="settings-option">
            <div>
              <h3>Profile Information</h3>
              <p>View and update your account details.</p>
            </div>
            <a href="/admin/profile">Manage →</a>
          </div>

          <div className="settings-option">
            <div>
              <h3>Change Password</h3>
              <p>Update your account password.</p>
            </div>
            <a href="/admin/change-password">Change →</a>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <h2>Application Preferences</h2>
            <p>Customize your OMNIX experience.</p>
          </div>

          <div className="settings-option">
            <div>
              <h3>Notifications</h3>
              <p>Enable or disable application notifications.</p>
            </div>

            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
              <span></span>
            </label>
          </div>

          <div className="settings-option">
            <div>
              <h3>Appearance</h3>
              <p>Choose between light and dark mode.</p>
            </div>
            <span className="settings-coming-soon">Coming next</span>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <h2>System Information</h2>
            <p>Application information and support.</p>
          </div>

          <div className="settings-option">
            <div>
              <h3>About OMNIX</h3>
              <p>One Platform. Everything Connected.</p>
            </div>
          </div>

          <div className="settings-option">
            <div>
              <h3>Help & Support</h3>
              <p>Get assistance with the application.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Settings;