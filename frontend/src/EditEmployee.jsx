
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./EditEmployee.css";

const API_URL = "http://127.0.0.1:8000";

function EditEmployee() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Admin access required. Please login again.");
      }

      if (!response.ok) {
        throw new Error("Unable to load employee details.");
      }

      const data = await response.json();

      setFormData({
        name: data.name || "",
        email: data.email || "",
        department: data.department || "",
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/employees/${id}`, {
        method: "PUT",
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
          result.detail || "Unable to update employee details."
        );
      }

      setSuccess("Employee details updated successfully.");

      setTimeout(() => {
        navigate("/employees");
      }, 1000);
    } catch (err) {
      setError(err.message || "Update operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="edit-employee-page">
      <aside className="edit-employee-sidebar">
        <div className="edit-employee-brand">
          <span className="edit-employee-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="edit-menu-title">MAIN MENU</p>

        <nav className="edit-employee-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees" className="active">♙ Employees</a>
          <a href="/admin/approvals">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="edit-employee-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="edit-employee-main">
        <header className="edit-employee-header">
          <div>
            <h1>Edit Employee</h1>
            <p>Update employee information.</p>
          </div>

          <a href="/employees" className="edit-back-btn">
            ← Back to Employees
          </a>
        </header>

        <section className="edit-employee-card">
          <div className="edit-card-heading">
            <h2>Employee Information</h2>
            <p>Update the required employee details below.</p>
          </div>

          {loading ? (
            <p>Loading employee details...</p>
          ) : (
            <form className="edit-employee-form" onSubmit={handleSubmit}>
              <div className="edit-form-group">
                <label htmlFor="editName">Full Name</label>
                <input
                  id="editName"
                  name="name"
                  type="text"
                  placeholder="Enter employee name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="editEmail">Email Address</label>
                <input
                  id="editEmail"
                  name="email"
                  type="email"
                  placeholder="Enter employee email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="editDepartment">Department</label>
                <input
                  id="editDepartment"
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

              <div className="edit-form-actions">
                <a href="/employees" className="edit-cancel-btn">
                  Cancel
                </a>

                <button
                  type="submit"
                  className="update-employee-btn"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "Update Employee →"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default EditEmployee;
