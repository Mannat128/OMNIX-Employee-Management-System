
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const API_URL = "http://127.0.0.1:8000";

function AdminDashboard() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        const [employeeResponse, pendingResponse] = await Promise.all([
          fetch(`${API_URL}/employees/`, { headers }),
          fetch(`${API_URL}/admin/pending-users`, { headers }),
        ]);

        const employeeData = await employeeResponse.json();
        const pendingData = await pendingResponse.json();

        if (employeeResponse.status === 401 ||
            employeeResponse.status === 403 ||
            pendingResponse.status === 401 ||
            pendingResponse.status === 403) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        if (!employeeResponse.ok) {
          throw new Error(
            employeeData.detail || "Unable to load employees."
          );
        }

        if (!pendingResponse.ok) {
          throw new Error(
            pendingData.detail || "Unable to load pending approvals."
          );
        }

        setEmployees(Array.isArray(employeeData) ? employeeData : []);
        setPendingUsers(Array.isArray(pendingData) ? pendingData : []);

      } catch (err) {
        setError(
          err.message === "Failed to fetch"
            ? "Unable to connect to the backend server."
            : err.message
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const departments = [
    ...new Set(
      employees
        .map((employee) => employee.department)
        .filter(Boolean)
    ),
  ];

  const stats = [
    {
      title: "Total Employees",
      value: loading ? "..." : employees.length,
      icon: "♙",
    },
    {
      title: "Pending Approvals",
      value: loading ? "..." : pendingUsers.length,
      icon: "◷",
    },
    {
      title: "Departments",
      value: loading ? "..." : departments.length,
      icon: "▦",
    },
    {
      title: "Documents",
      value: "—",
      icon: "▤",
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-logo">O</span>
          <span>OMNIX</span>
        </div>

        <div className="admin-profile">
          <div className="admin-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <div>
            <strong>{user?.name || "Administrator"}</strong>
            <small>Admin Account</small>
          </div>
        </div>

        <p className="sidebar-heading">MAIN MENU</p>

        <nav className="admin-nav">
          <a href="/admin/dashboard" className="active">▦ Dashboard</a>
          <a href="/employees">♙ Employees</a>
          <a href="/admin/approvals">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="admin-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Dashboard</h1>
            <p>Manage your organization's workforce and activities.</p>
          </div>

          <div className="admin-header-right">
            <div className="admin-header-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <section className="admin-welcome">
          <div>
            <span>ADMIN OVERVIEW</span>
            <h2>Manage your workforce with confidence.</h2>
            <p>Manage employees, approvals and documents from one place.</p>
          </div>
          <div className="welcome-icon">✦</div>
        </section>

        {error && (
          <p role="alert" style={{ color: "#dc2626", margin: "16px 0" }}>
            {error}
          </p>
        )}

        <section className="admin-stats">
          {stats.map((stat) => (
            <article className="admin-stat-card" key={stat.title}>
              <div className="stat-top">
                <span>{stat.title}</span>
                <div className="stat-icon">{stat.icon}</div>
              </div>
              <h2>{stat.value}</h2>
              <small>
                {stat.title === "Documents"
                  ? "Document API not connected"
                  : "Live database information"}
              </small>
            </article>
          ))}
        </section>

        <section className="admin-content-grid">
          <div className="admin-panel employee-panel">
            <div className="panel-heading">
              <div>
                <h3>Recent Employees</h3>
                <p>Employee records from your database</p>
              </div>
              <a href="/employees">View all →</a>
            </div>

            {loading ? (
              <div className="admin-empty-state">
                <p>Loading employee records...</p>
              </div>
            ) : employees.length > 0 ? (
              <div className="admin-employee-list">
                {employees.slice(-5).reverse().map((employee) => (
                  <div key={employee.id} className="admin-employee-row">
                    <div className="admin-avatar">
                      {employee.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <strong>{employee.name}</strong>
                      <small>{employee.email}</small>
                    </div>
                    <span>{employee.department}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-empty-state">
                <div>♙</div>
                <h3>No employee records available</h3>
                <p>Employee records will appear here when available.</p>
              </div>
            )}
          </div>

          <div className="admin-panel quick-panel">
            <div className="panel-heading">
              <div>
                <h3>Quick Actions</h3>
                <p>Administrative sections</p>
              </div>
            </div>

            <a href="/employees" className="quick-action">
              <span className="quick-action-icon">♙</span>
              <span>
                <strong>Manage Employees</strong>
                <small>View employee records</small>
              </span>
              <b>→</b>
            </a>

            <a href="/admin/approvals" className="quick-action">
              <span className="quick-action-icon">✓</span>
              <span>
                <strong>Review Approvals</strong>
                <small>{loading ? "Loading..." : `${pendingUsers.length} pending registrations`}</small>
              </span>
              <b>→</b>
            </a>

            <a href="/documents" className="quick-action">
              <span className="quick-action-icon">▤</span>
              <span>
                <strong>Documents</strong>
                <small>Manage employee documents</small>
              </span>
              <b>→</b>
            </a>
          </div>
        </section>

        <footer className="admin-footer">
          OMNIX Admin Workspace
          <span>© 2026 OMNIX</span>
        </footer>
      </main>
    </div>
  );
}

export default AdminDashboard;
