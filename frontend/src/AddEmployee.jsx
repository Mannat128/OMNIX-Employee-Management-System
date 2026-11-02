
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddEmployee.css";

const API_URL = "http://127.0.0.1:8000";

function AddEmployee() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/employees/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          department: formData.department.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          result.detail || "Admin access required. Please login again."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to create employee record."
        );
      }

      setSuccess("Employee record created successfully.");

      setTimeout(() => {
        navigate("/employees");
      }, 1000);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="add-employee-page">
      <aside className="add-employee-sidebar">
        <div className="add-employee-brand">
          <span className="add-employee-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="add-menu-title">MAIN MENU</p>

        <nav className="add-employee-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees" className="active">♙ Employees</a>
          <a href="/admin/approvals">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="add-employee-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="add-employee-main">
        <header className="add-employee-header">
          <div>
            <h1>Add Employee</h1>
            <p>Create a new employee record.</p>
          </div>

          <a href="/employees" className="back-employees">
            ← Back to Employees
          </a>
        </header>

        <section className="add-employee-card">
          <div className="add-card-heading">
            <h2>Employee Information</h2>
            <p>Enter the employee details below.</p>
          </div>

          <form
            className="add-employee-form"
            onSubmit={handleSubmit}
          >
            <div className="add-form-group">
              <label htmlFor="employeeName">Full Name</label>
              <input
                id="employeeName"
                name="name"
                type="text"
                placeholder="Enter employee name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="add-form-group">
              <label htmlFor="employeeEmail">Email Address</label>
              <input
                id="employeeEmail"
                name="email"
                type="email"
                placeholder="Enter employee email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="add-form-group">
              <label htmlFor="employeeDepartment">Department</label>
              <input
                id="employeeDepartment"
                name="department"
                type="text"
                placeholder="Enter department"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>

            {error && (
              <p className="employees-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="add-employee-success" role="status">
                {success}
              </p>
            )}

            <div className="add-form-actions">
              <a href="/employees" className="cancel-employee-btn">
                Cancel
              </a>

              <button
                type="submit"
                className="save-employee-btn"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Employee →"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default AddEmployee;
