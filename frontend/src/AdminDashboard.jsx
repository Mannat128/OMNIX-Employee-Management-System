
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  Clock3,
  Building2,
  ArrowUpRight,
  Plus,
  FileText,
  ClipboardCheck,
  BriefcaseBusiness,
} from "lucide-react";

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
          [401, 403].includes(employeeResponse.status) ||
          [401, 403].includes(pendingResponse.status)
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
        .map((employee) => employee.department?.trim())
        .filter(Boolean)
    ),
  ];

  const activeEmployees = employees.filter(
    (employee) => employee.employment_status === "Active"
  ).length;

  const stats = [
    {
      title: "Total Employees",
      value: employees.length,
      icon: Users,
      className: "workforce-stat-orange",
      note: "Registered employees",
    },
    {
      title: "Pending Approvals",
      value: pendingUsers.length,
      icon: Clock3,
      className: "workforce-stat-white",
      note: pendingUsers.length ? "Require your attention" : "All clear",
    },
    {
      title: "Departments",
      value: departments.length,
      icon: Building2,
      className: "workforce-stat-teal",
      note: "Across your organization",
    },
    {
      title: "Active Employees",
      value: activeEmployees,
      icon: UserCheck,
      className: "workforce-stat-white",
      note: "Currently active",
    },
  ];

  return (
    <div className="admin-dashboard">
      <Sidebar role="admin" />

      <main className="admin-main">
        <Header />

        <div className="admin-dashboard-content">
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}

          {/* Workforce overview */}
          <section className="workforce-overview">
            <div className="workforce-intro">
              <span className="workforce-eyebrow">
                YOUR WORKFORCE
              </span>

              <div className="workforce-message">
                <strong>{loading ? "—" : employees.length}</strong>
                <h2>
                  people,
                  <br />
                  one team.
                </h2>
              </div>

              <div className="workforce-avatars" aria-label="Employee team">
                {employees.slice(0, 3).map((employee, index) => (
                  <span key={employee.id || employee.email || index}>
                    {employee.name?.charAt(0)?.toUpperCase() || "E"}
                  </span>
                ))}

                {employees.length > 3 && (
                  <span>+{employees.length - 3}</span>
                )}

                {employees.length === 0 && !loading && (
                  <span>0</span>
                )}
              </div>
            </div>

            <div className="workforce-decoration" aria-hidden="true">
              <div className="workforce-circle circle-one" />
              <div className="workforce-circle circle-two" />
              <div className="workforce-office-icon">
                <BriefcaseBusiness size={48} strokeWidth={1.4} />
              </div>
              <div className="workforce-decoration-caption">
                PEOPLE · DOCUMENTS · TEAMWORK
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="admin-stats">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article
                  className={`admin-stat-card ${stat.className}`}
                  key={stat.title}
                >
                  <div className="stat-top">
                    <span>{stat.title}</span>
                    <Icon size={21} strokeWidth={1.8} />
                  </div>

                  <h2>{loading ? "—" : stat.value}</h2>

                  <small>
                    {loading ? "Loading information..." : stat.note}
                  </small>
                </article>
              );
            })}
          </section>

          {/* Recent employees and quick actions */}
          <section className="admin-content-grid">
            <div className="admin-panel employee-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Employees</h3>
                  <p>Your organization's employee records</p>
                </div>

                <Link to="/employees" className="view-all-link">
                  View all <ArrowUpRight size={15} />
                </Link>
              </div>

              {loading ? (
                <div className="admin-empty-state">
                  Loading employee records...
                </div>
              ) : employees.length > 0 ? (
                <div className="admin-employee-list">
                  {employees.slice(0, 5).map((employee, index) => (
                    <div
                      key={employee.id || employee.email || index}
                      className="admin-employee-row"
                    >
                      <div className="admin-avatar">
                        {employee.name?.charAt(0)?.toUpperCase() || "E"}
                      </div>

                      <div className="employee-row-info">
                        <strong>{employee.name || "Unnamed employee"}</strong>
                        <small>
                          {employee.department || "Department not specified"}
                        </small>
                      </div>

                      <span
                        className={`employee-status ${
                          employee.employment_status === "Active"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {employee.employment_status || "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty-state">
                  <Users size={28} />
                  <h3>No employees yet</h3>
                  <p>Add your first employee to get started.</p>
                  <Link to="/employees/add" className="empty-add-link">
                    <Plus size={16} /> Add employee
                  </Link>
                </div>
              )}
            </div>

            <div className="admin-panel quick-panel">
              <div className="panel-heading">
                <div>
                  <h3>Quick Actions</h3>
                  <p>Manage your workplace</p>
                </div>
              </div>

              <Link to="/employees/add" className="quick-action quick-orange">
                <span>
                  <Plus size={18} />
                </span>
                <strong>Add employee</strong>
                <ArrowUpRight size={17} />
              </Link>

              <Link
                to="/admin/approvals"
                className="quick-action quick-teal"
              >
                <span>
                  <ClipboardCheck size={18} />
                </span>
                <strong>Review approvals</strong>
                <ArrowUpRight size={17} />
              </Link>

              <Link to="/documents" className="quick-action quick-blue">
                <span>
                  <FileText size={18} />
                </span>
                <strong>Manage documents</strong>
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>

          <footer className="admin-footer">
            <span>OMNIX · Employee Management System</span>
            <span>© 2026 OMNIX</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
