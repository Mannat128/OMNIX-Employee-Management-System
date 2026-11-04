
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  ClipboardCheck,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Pencil,
  Power,
  BriefcaseBusiness,
  Mail,
  Building2,
  FileText,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Employees.css";

const API_URL = "http://127.0.0.1:8000";

// Build employee profile photo URL
function getPhotoUrl(photo) {
  if (!photo || typeof photo !== "string") return "";

  if (/^https?:\/\//i.test(photo)) {
    return photo;
  }

  return `${API_URL}/${photo.replace(/^\/+/, "")}`;
}

// Generate initials when profile photo is unavailable
function getInitials(name = "") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

// Employee photo with automatic initials fallback
function EmployeeAvatar({ name, photo }) {
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [photo]);

  const photoUrl = getPhotoUrl(photo);

  if (!photoUrl || imageBroken) {
    return (
      <div className="employee-table-avatar" aria-label={name || "Employee"}>
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      className="employee-photo"
      src={photoUrl}
      alt={`${name || "Employee"} profile`}
      onError={() => setImageBroken(true)}
    />
  );
}

function Employees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [pendingCount, setPendingCount] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [notice, setNotice] = useState("");

  const token = localStorage.getItem("access_token");

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Fetch all employee records
  const fetchEmployees = useCallback(async () => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => []);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load employee records."
        );
      }

      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to the backend server."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  // Fetch pending registration approvals
  const fetchPendingCount = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/admin/pending-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setPendingCount(Array.isArray(data) ? data.length : null);
      }
    } catch (err) {
      console.error("Unable to load pending approvals:", err);
    }
  }, [token, handleUnauthorized]);

  useEffect(() => {
    fetchEmployees();
    fetchPendingCount();
  }, [fetchEmployees, fetchPendingCount]);

  // Employee summary calculations
  const activeCount = employees.filter(
    (employee) => employee.employment_status === "Active"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => employee.employment_status === "Inactive"
  ).length;

  const departmentsCount = new Set(
    employees
      .map((employee) => employee.department)
      .filter(Boolean)
  ).size;

  // Search and status filtering
  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase().trim();

    return employees.filter((employee) => {
      const matchesSearch = [
        employee.name,
        employee.email,
        employee.employee_id,
        employee.department,
        employee.designation,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      const matchesStatus =
        statusFilter === "All" ||
        employee.employment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  // Activate or deactivate an employee
  const handleStatusChange = async (employee) => {
    const employeeId = employee.id;
    const isActive = employee.employment_status === "Active";

    if (!employeeId) {
      setError("Employee record ID is missing.");
      return;
    }

    const action = isActive ? "deactivate" : "activate";
    const nextStatus = isActive ? "Inactive" : "Active";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${employee.name}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(employeeId);
      setError("");
      setNotice("");

      const response = await fetch(
        `${API_URL}/employees/${employeeId}/${action}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : `Unable to ${action} employee.`
        );
      }

      setEmployees((previous) =>
        previous.map((item) =>
          item.id === employeeId
            ? { ...item, employment_status: nextStatus }
            : item
        )
      );

      setNotice(
        `${employee.name} has been ${action}d successfully.`
      );
    } catch (err) {
      setError(err.message || "Status update failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const summaryCards = [
    {
      title: "Total Employees",
      value: employees.length,
      subtitle: "All employee records",
      icon: Users,
      className: "total",
    },
    {
      title: "Active Employees",
      value: activeCount,
      subtitle: "Currently active",
      icon: UserCheck,
      className: "active",
    },
    {
      title: "Inactive Employees",
      value: inactiveCount,
      subtitle: "Currently inactive",
      icon: UserX,
      className: "inactive",
    },
    {
      title: "Pending Approvals",
      value: pendingCount === null ? "—" : pendingCount,
      subtitle: "Awaiting admin approval",
      icon: ClipboardCheck,
      className: "pending",
    },
  ];

  return (
    <div className="employees-page">
      <Sidebar role="admin" />

      <main className="employees-main">
        <Header />

        <div className="employees-content">
          {/* Page heading */}
          <section className="employees-page-heading">
            <div>
              <span className="employees-eyebrow">
                WORKFORCE MANAGEMENT
              </span>

              <h2>Employees</h2>

              <p>
                Manage your team, employee records and work information.
              </p>
            </div>

            <Link to="/employees/add" className="add-employee-btn">
              <Plus size={18} />
              <span>Add Employee</span>
            </Link>
          </section>

          {/* Error and success messages */}
          {error && (
            <div className="employees-alert employees-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="employees-alert employees-notice" role="status">
              {notice}
            </div>
          )}

          {/* Summary cards */}
          <section className="employees-summary">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  className="employee-summary-card"
                  key={card.title}
                >
                  <div className="employee-summary-top">
                    <span>{card.title}</span>

                    <div className={`summary-icon ${card.className}`}>
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                  </div>

                  <h2>{loading ? "..." : card.value}</h2>

                  <small>{card.subtitle}</small>
                </article>
              );
            })}
          </section>

          {/* Employee records */}
          <section className="employees-table-section">
            <div className="employees-table-heading">
              <div>
                <span className="employees-section-label">
                  TEAM DIRECTORY
                </span>

                <h2>All Employees</h2>

                <p>
                  {loading
                    ? "Loading employee records..."
                    : `${filteredEmployees.length} employee record(s) found`}
                </p>
              </div>

              <div className="employees-controls">
                <div className="employee-search-box">
                  <Search size={17} />

                  <input
                    type="search"
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search employees"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by employment status"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="employees-table-wrapper">
              <table className="employees-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="employees-empty-cell">
                        <div className="employees-loading">
                          <span className="employees-loader" />
                          Loading employee records...
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="employees-empty-cell">
                        <div className="employees-empty">
                          <div className="employees-empty-icon">
                            <BriefcaseBusiness size={27} />
                          </div>

                          <h3>No employees found</h3>

                          <p>
                            {search || statusFilter !== "All"
                              ? "Try changing your search or status filter."
                              : "Employee records will appear here when available."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const employeeId = employee.id;
                      const isActive =
                        employee.employment_status === "Active";

                      return (
                        <tr key={employeeId}>
                          <td>
                            <div className="employee-name-cell">
                              <EmployeeAvatar
                                name={employee.name}
                                photo={employee.profile_photo}
                              />

                              <div className="employee-name-info">
                                <strong>{employee.name || "—"}</strong>

                                <small>
                                  <Mail size={12} />
                                  {employee.email || "—"}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td className="employee-id-cell">
                            {employee.employee_id || "—"}
                          </td>

                          <td>
                            <span className="employee-detail-cell">
                              <Building2 size={14} />
                              {employee.department || "—"}
                            </span>
                          </td>

                          <td>{employee.designation || "—"}</td>

                          <td>
                            <span
                              className={`employee-status ${
                                isActive
                                  ? "status-active"
                                  : "status-inactive"
                              }`}
                            >
                              <span className="status-dot" />
                              {employee.employment_status || "Unknown"}
                            </span>
                          </td>

                          <td>
                            <div className="employee-actions">
                              <button
                                type="button"
                                className="view-action"
                                title="View employee"
                                onClick={() =>
                                  navigate(`/employees/${employeeId}`)
                                }
                                disabled={!employeeId}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="edit-action"
                                title="Edit employee"
                                onClick={() =>
                                  navigate(`/employees/edit/${employeeId}`)
                                }
                                disabled={!employeeId}
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                type="button"
                                className="documents-action"
                                title="View employee documents and OCR"
                                onClick={() =>
                                  navigate(
                                    `/employees/${employeeId}/documents`
                                  )
                                }
                                disabled={!employeeId}
                              >
                                <FileText size={16} />
                              </button>

                              <button
                                type="button"
                                className={
                                  isActive
                                    ? "deactivate-action"
                                    : "activate-action"
                                }
                                title={isActive ? "Deactivate" : "Activate"}
                                onClick={() => handleStatusChange(employee)}
                                disabled={
                                  !employeeId ||
                                  actionLoading === employeeId
                                }
                              >
                                {actionLoading === employeeId ? (
                                  <RefreshCw
                                    size={16}
                                    className="spin-icon"
                                  />
                                ) : (
                                  <Power size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="employees-table-footer">
              <span>
                Showing {filteredEmployees.length} of {employees.length} employees
              </span>

              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  fetchEmployees();
                  fetchPendingCount();
                }}
                disabled={loading}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </section>

          <div className="employees-page-footer">
            <span>OMNIX EMS</span>
            <span>Employee Management</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Employees;
