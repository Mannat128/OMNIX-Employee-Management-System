
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./AdminDashboard.css";

const API_URL = "http://127.0.0.1:8000";

function AdminDashboard() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        if (
          employeeResponse.status === 401 ||
          employeeResponse.status === 403 ||
          pendingResponse.status === 401 ||
          pendingResponse.status === 403
        ) {
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

  const activeEmployees = employees.filter(
    (employee) => employee.employment_status === "Active"
  ).length;

  const stats = [
    {
      title: "Total Employees",
      value: loading ? "..." : employees.length,
      icon: "♙",
      color: "purple",
    },
    {
      title: "Pending Approvals",
      value: loading ? "..." : pendingUsers.length,
      icon: "◷",
      color: "orange",
    },
    {
      title: "Departments",
      value: loading ? "..." : departments.length,
      icon: "▦",
      color: "blue",
    },
    {
      title: "Active Employees",
      value: loading ? "..." : activeEmployees,
      icon: "✓",
      color: "green",
    },
  ];

  return (
    <div className="admin-dashboard">
      <Sidebar role="admin" />

      <main className="admin-main">
        <Header />

        <div className="admin-dashboard-content">
          <section className="admin-welcome">
            <div>
              <span>ADMIN OVERVIEW</span>
              <h2>Manage your workforce with confidence.</h2>
              <p>
                Manage employees, approvals and documents from one place.
              </p>
            </div>

            <div className="welcome-icon">✦</div>
          </section>

          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}

          <section className="admin-stats">
            {stats.map((stat) => (
              <article className="admin-stat-card" key={stat.title}>
                <div className="stat-top">
                  <span>{stat.title}</span>
                  <div className={`stat-icon ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>

                <h2>{stat.value}</h2>

                <small>Live database information</small>
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

                <Link to="/employees">View all →</Link>
              </div>

              {loading ? (
                <div className="admin-empty-state">
                  <p>Loading employee records...</p>
                </div>
              ) : employees.length > 0 ? (
                <div className="admin-employee-list">
                  {employees.slice(0, 5).map((employee) => (
                    <div
                      key={employee.id}
                      className="admin-employee-row"
                    >
                      <div className="admin-avatar">
                        {employee.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>

                      <div>
                        <strong>{employee.name || "—"}</strong>
                        <small>{employee.email || "—"}</small>
                      </div>

                      <span>{employee.department || "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty-state">
                  <div>♙</div>
                  <h3>No employee records available</h3>
                  <p>
                    Employee records will appear here when available.
                  </p>
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

              <Link to="/employees" className="quick-action">
                <span className="quick-action-icon">♙</span>
                <span>
                  <strong>Manage Employees</strong>
                  <small>View employee records</small>
                </span>
                <b>→</b>
              </Link>

              <Link to="/admin/approvals" className="quick-action">
                <span className="quick-action-icon">✓</span>
                <span>
                  <strong>Review Approvals</strong>
                  <small>
                    {loading
                      ? "Loading..."
                      : `${pendingUsers.length} pending registrations`}
                  </small>
                </span>
                <b>→</b>
              </Link>

              <Link to="/documents" className="quick-action">
                <span className="quick-action-icon">▤</span>
                <span>
                  <strong>Documents</strong>
                  <small>Manage employee documents</small>
                </span>
                <b>→</b>
              </Link>
            </div>
          </section>

          <footer className="admin-footer">
            <span>OMNIX Admin Workspace</span>
            <span>© 2026 OMNIX</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
