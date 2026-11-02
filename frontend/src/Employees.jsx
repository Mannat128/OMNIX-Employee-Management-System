
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Employees.css";

const API_URL = "http://127.0.0.1:8000";

function Employees() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState([]);
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchEmployees();
    fetchPendingCount();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load employee records.");
      }

      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/pending-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingCount(Array.isArray(data) ? data.length : null);
      }
    } catch (err) {
      console.error("Unable to load pending employees:", err);
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return employees;

    return employees.filter((employee) => {
      const name = employee.name || "";
      const email = employee.email || "";
      const department = employee.department || "";

      return (
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        department.toLowerCase().includes(query)
      );
    });
  }, [employees, search]);

  const handleDelete = async (employee) => {
    const employeeId = employee._id || employee.id;

    if (!employeeId) {
      setError("Employee ID is missing. Cannot delete this record.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.name || "this employee"}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(employeeId);
      setError("");

      const response = await fetch(
        `${API_URL}/employees/${employeeId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Unable to delete employee.");
      }

      setEmployees((previous) =>
        previous.filter(
          (item) => (item._id || item.id) !== employeeId
        )
      );
    } catch (err) {
      setError(err.message || "Delete operation failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="employees-page">
      <aside className="employees-sidebar">
        <div className="employees-brand">
          <span className="employees-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="employees-menu-title">MAIN MENU</p>

        <nav className="employees-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees" className="active">♙ Employees</a>
          <a href="/admin/approvals">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="employees-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="employees-main">
        <header className="employees-header">
          <div>
            <h1>Employee Management</h1>
            <p>Manage and organize employee records.</p>
          </div>

          <a href="/employees/add" className="add-employee-btn">
            + Add Employee
          </a>
        </header>

        <section className="employees-summary">
          <div>
            <span>Total Employees</span>
            <h2>{loading ? "—" : employees.length}</h2>
          </div>

          <div>
            <span>Active Employees</span>
            <h2>—</h2>
          </div>

          <div>
            <span>Pending Employees</span>
            <h2>{pendingCount === null ? "—" : pendingCount}</h2>
          </div>
        </section>

        <section className="employees-table-section">
          <div className="employees-table-heading">
            <div>
              <h2>All Employees</h2>
              <p>View and manage employee information.</p>
            </div>

            <input
              type="search"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error && (
            <p className="employees-error" role="alert">
              {error}
            </p>
          )}

          <div className="employees-table-wrapper">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Email Address</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="employees-empty-cell">
                      Loading employee records...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="employees-empty-cell">
                      <div className="employees-empty">
                        <span>♙</span>
                        <h3>No employees found</h3>
                        <p>
                          {search
                            ? "Try another search term."
                            : "Employee records will appear here when available."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const employeeId = employee._id || employee.id;

                    return (
                      <tr key={employeeId || employee.email}>
                        <td>{employee.name || "—"}</td>
                        <td>{employee.email || "—"}</td>
                        <td>{employee.department || "—"}</td>
                        <td>{employee.status || "—"}</td>
                        <td>
                          <div className="approval-actions">
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
                              className="delete-btn"
                              onClick={() => handleDelete(employee)}
                              disabled={
                                !employeeId || deletingId === employeeId
                              }
                            >
                              {deletingId === employeeId
                                ? "Deleting..."
                                : "Delete"}
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
        </section>
      </main>
    </div>
  );
}

export default Employees;
