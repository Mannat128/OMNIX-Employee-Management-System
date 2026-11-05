
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

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

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Employees.css";

// Build employee profile photo URL
const API_URL = API.defaults.baseURL;

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
      <div
        className="employee-table-avatar"
        aria-label={name || "Employee"}
      >
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

  // Read search query from Header URL
  const [searchParams] = useSearchParams();

  const urlSearch = searchParams.get("search") || "";

  const [employees, setEmployees] = useState([]);
  const [pendingCount, setPendingCount] = useState(null);

  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [notice, setNotice] = useState("");

  const token = localStorage.getItem("access_token");

  // Synchronize Header search with Employees search
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  // Handle expired session
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

      const response = await API.get("/employees/");

      setEmployees(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.detail;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        setError(
          message ||
            "You do not have permission to view employees."
        );
        return;
      }

      setError(
        err.code === "ERR_NETWORK"
          ? "Unable to connect to the backend server."
          : message || "Unable to load employee records."
      );
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  // Fetch pending registration approvals
  const fetchPendingCount = useCallback(async () => {
    if (!token) return;

    try {
      const response = await API.get("/admin/pending-users");

      const data = response.data;

      setPendingCount(
        Array.isArray(data) ? data.length : null
      );
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      console.error(
        "Unable to load pending approvals:",
        err.response?.data?.detail || err.message
      );
    }
  }, [token, handleUnauthorized]);

  // Initial data loading
  useEffect(() => {
    fetchEmployees();
    fetchPendingCount();
  }, [fetchEmployees, fetchPendingCount]);

  // Employee summary calculations
  const activeCount = employees.filter(
    (employee) =>
      employee.employment_status === "Active"
  ).length;

  const inactiveCount = employees.filter(
    (employee) =>
      employee.employment_status === "Inactive"
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
        String(value || "")
          .toLowerCase()
          .includes(query)
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

    const isActive =
      employee.employment_status === "Active";

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

      await API.patch(
        `/employees/${employeeId}/${action}`
      );

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
      const status = err.response?.status;
      const message = err.response?.data?.detail;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        setError(
          message ||
            "You do not have permission to update this employee."
        );
        return;
      }

      setError(
        message || `Unable to ${action} employee.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Summary cards
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

            <Link
              to="/employees/add"
              className="add-employee-btn"
            >
              <Plus size={18} />
              <span>Add Employee</span>
            </Link>
          </section>

          {/* Error message */}
          {error && (
            <div
              className="employees-alert employees-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Success message */}
          {notice && (
            <div
              className="employees-alert employees-notice"
              role="status"
            >
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

                    <div
                      className={`summary-icon ${card.className}`}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                  </div>

                  <h2>
                    {loading ? "..." : card.value}
                  </h2>

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

                {/* Employee search */}
                <div className="employee-search-box">
                  <Search size={17} />

                  <input
                    type="search"
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    aria-label="Search employees"
                  />
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  aria-label="Filter by employment status"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

              </div>
            </div>

            {/* Employee table */}
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
                      <td
                        colSpan="6"
                        className="employees-empty-cell"
                      >
                        <div className="employees-loading">
                          <span className="employees-loader" />
                          Loading employee records...
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="employees-empty-cell"
                      >
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

                          {/* Employee details */}
                          <td>
                            <div className="employee-name-cell">

                              <EmployeeAvatar
                                name={employee.name}
                                photo={employee.profile_photo}
                              />

                              <div className="employee-name-info">
                                <strong>
                                  {employee.name || "—"}
                                </strong>

                                <small>
                                  <Mail size={12} />
                                  {employee.email || "—"}
                                </small>
                              </div>

                            </div>
                          </td>

                          {/* Employee ID */}
                          <td className="employee-id-cell">
                            {employee.employee_id || "—"}
                          </td>

                          {/* Department */}
                          <td>
                            <span className="employee-detail-cell">
                              <Building2 size={14} />
                              {employee.department || "—"}
                            </span>
                          </td>

                          {/* Designation */}
                          <td>
                            {employee.designation || "—"}
                          </td>

                          {/* Employment status */}
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

                          {/* Actions */}
                          <td>
                            <div className="employee-actions">

                              {/* View */}
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

                              {/* Edit */}
                              <button
                                type="button"
                                className="edit-action"
                                title="Edit employee"
                                onClick={() =>
                                  navigate(
                                    `/employees/edit/${employeeId}`
                                  )
                                }
                                disabled={!employeeId}
                              >
                                <Pencil size={16} />
                              </button>

                              {/* Documents and OCR */}
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

                              {/* Activate / Deactivate */}
                              <button
                                type="button"
                                className={
                                  isActive
                                    ? "deactivate-action"
                                    : "activate-action"
                                }
                                title={
                                  isActive
                                    ? "Deactivate"
                                    : "Activate"
                                }
                                onClick={() =>
                                  handleStatusChange(employee)
                                }
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
                Showing {filteredEmployees.length} of{" "}
                {employees.length} employees
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

          {/* Page footer */}
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
