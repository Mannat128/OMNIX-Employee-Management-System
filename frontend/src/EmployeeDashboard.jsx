
import { useEffect, useState } from "react";
import "./EmployeeDashboard.css";

const API_URL = "http://127.0.0.1:8000";

function EmployeeDashboard() {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployee = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setError("Please login to access your dashboard.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/employees/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Unable to load employee information."
          );
        }

        setEmployee(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const avatarLetter = employee?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <div className="employee-brand">
          <span className="employee-logo">O</span>
          <span>OMNIX</span>
        </div>

        <div className="employee-profile">
          <div className="employee-avatar">{avatarLetter}</div>
          <div>
            <strong>{employee?.name || "My Account"}</strong>
            <small>Employee Workspace</small>
          </div>
        </div>

        <p className="employee-sidebar-heading">WORKSPACE</p>

        <nav className="employee-nav">
          <a href="/employee/dashboard" className="active">
            ▦ Dashboard
          </a>
          <a href="/employee/profile">♙ My Profile</a>
          <a href="/documents">▤ My Documents</a>
          <a href="/employee/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="employee-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <h1>My Dashboard</h1>
            <p>Welcome to your OMNIX employee workspace.</p>
          </div>

          <div className="employee-header-avatar">{avatarLetter}</div>
        </header>

        <section className="employee-welcome">
          <span>EMPLOYEE WORKSPACE</span>
          <h2>
            {employee?.name
              ? `Welcome, ${employee.name}.`
              : "Your work, all in one place."}
          </h2>
          <p>
            Access your profile, manage your documents
            and keep your employee information organized.
          </p>
        </section>

        <section className="employee-overview">
          <h2>My Overview</h2>

          <div className="employee-overview-grid">
            <article className="employee-overview-card">
              <div className="employee-overview-icon">♙</div>
              <h3>My Profile</h3>
              <p>View your personal and employment information.</p>
              <a href="/employee/profile">View Profile →</a>
            </article>

            <article className="employee-overview-card">
              <div className="employee-overview-icon">▤</div>
              <h3>My Documents</h3>
              <p>Upload and access your documents.</p>
              <a href="/documents">View Documents →</a>
            </article>

            <article className="employee-overview-card">
              <div className="employee-overview-icon">✓</div>
              <h3>Account Status</h3>
              <p>View your account information.</p>
              <a href="/employee/profile">View Status →</a>
            </article>
          </div>
        </section>

        <section className="employee-information">
          <div>
            <h3>My Account Information</h3>
            <p>Your details retrieved from your employee account.</p>
          </div>

          {loading ? (
            <div className="employee-empty-state">
              <p>Loading your information...</p>
            </div>
          ) : error ? (
            <div className="employee-empty-state">
              <h3>Unable to load information</h3>
              <p>{error}</p>
            </div>
          ) : employee ? (
            <div className="employee-account-details">
              <div>
                <span>Full Name</span>
                <strong>{employee.name || "Not available"}</strong>
              </div>

              <div>
                <span>Email Address</span>
                <strong>{employee.email || "Not available"}</strong>
              </div>

              <div>
                <span>Department</span>
                <strong>{employee.department || "Not available"}</strong>
              </div>
            </div>
          ) : (
            <div className="employee-empty-state">
              <h3>No information available</h3>
              <p>Your employee profile is not available.</p>
            </div>
          )}
        </section>

        <footer className="employee-footer">
          OMNIX Employee Workspace
          <span>© 2026 OMNIX</span>
        </footer>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
