
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Employees.css";

const API_URL = "http://127.0.0.1:8000";

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
          data.detail || "Unable to load employee records."
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

  const activeCount = employees.filter(
    (employee) => employee.employment_status === "Active"
  ).length;

  const inactiveCount = employees.filter(
    (employee) => employee.employment_status === "Inactive"
  ).length;

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
          result.detail || `Unable to ${action} employee.`
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

  const getPhotoUrl = (photo) => {
    if (!photo) return null;

    if (photo.startsWith("http://") || photo.startsWith("https://")) {
      return photo;
    }

    return `${API_URL}${photo.startsWith("/") ? "" : "/"}${photo}`;
  };

  return (
    <div className="employees-page">
      <Sidebar role="admin" />

      <main className="employees-main">
        <Header />

        <div className="employees-content">
          <section className="employees-page-heading">
            <div>
              <h2>Manage Your Team</h2>
              <p>
                View, organize and manage all employee records in one place.
              </p>
            </div>

            <Link to="/employees/add" className="add-employee-btn">
              <span>+</span> Add Employee
            </Link>
          </section>

          {error && (
            <p className="employees-error" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="employees-notice" role="status">
              {notice}
            </p>
          )}

          <section className="employees-summary">
            <article className="employee-summary-card">
              <div className="employee-summary-top">
                <span>Total Employees</span>
                <div className="summary-icon purple">♙</div>
              </div>
              <h2>{loading ? "..." : employees.length}</h2>
              <small>All employee records</small>
            </article>

            <article className="employee-summary-card">
              <div className="employee-summary-top">
                <span>Active Employees</span>
                <div className="summary-icon green">✓</div>
              </div>
              <h2>{loading ? "..." : activeCount}</h2>
              <small>Currently active</small>
            </article>

            <article className="employee-summary-card">
              <div className="employee-summary-top">
                <span>Inactive Employees</span>
                <div className="summary-icon orange">◷</div>
              </div>
              <h2>{loading ? "..." : inactiveCount}</h2>
              <small>Currently inactive</small>
            </article>

            <article className="employee-summary-card">
              <div className="employee-summary-top">
                <span>Pending Approvals</span>
                <div className="summary-icon blue">♧</div>
              </div>
              <h2>{pendingCount === null ? "—" : pendingCount}</h2>
              <small>Awaiting admin approval</small>
            </article>
          </section>

          <section className="employees-table-section">
            <div className="employees-table-heading">
              <div>
                <h2>All Employees</h2>
                <p>
                  {loading
                    ? "Loading employee records..."
                    : `${filteredEmployees.length} employee record(s) found`}
                </p>
              </div>

              <div className="employees-controls">
                <input
                  type="search"
                  placeholder="Search name, ID, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search employees"
                />

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
                        Loading employee records...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="employees-empty-cell">
                        <div className="employees-empty">
                          <span>♙</span>
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
                              {employee.profile_photo ? (
                                <img
                                  className="employee-photo"
                                  src={getPhotoUrl(employee.profile_photo)}
                                  alt=""
                                />
                              ) : (
                                <div className="employee-table-avatar">
                                  {employee.name?.charAt(0)?.toUpperCase() || "U"}
                                </div>
                              )}

                              <div>
                                <strong>{employee.name || "—"}</strong>
                                <small>{employee.email || "—"}</small>
                              </div>
                            </div>
                          </td>

                          <td>{employee.employee_id || "—"}</td>
                          <td>{employee.department || "—"}</td>
                          <td>{employee.designation || "—"}</td>

                          <td>
                            <span
                              className={`employee-status ${
                                isActive ? "status-active" : "status-inactive"
                              }`}
                            >
                              {employee.employment_status || "Unknown"}
                            </span>
                          </td>

                          <td>
                            <div className="employee-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/employees/${employeeId}`)
                                }
                                disabled={!employeeId}
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/employees/edit/${employeeId}`)
                                }
                                disabled={!employeeId}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className={
                                  isActive ? "deactivate-btn" : "activate-btn"
                                }
                                onClick={() => handleStatusChange(employee)}
                                disabled={
                                  !employeeId || actionLoading === employeeId
                                }
                              >
                                {actionLoading === employeeId
                                  ? "Updating..."
                                  : isActive
                                    ? "Deactivate"
                                    : "Activate"}
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

            <div className="employees-table-footer">
              <span>
                Showing {filteredEmployees.length} of {employees.length} employees
              </span>

              <button
                type="button"
                onClick={() => {
                  fetchEmployees();
                  fetchPendingCount();
                }}
                disabled={loading}
              >
                ↻ Refresh
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Employees;
