
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pencil,
  RefreshCw,
  UserRound,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
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
  const [success, setSuccess] = useState(false);

  const token = localStorage.getItem("access_token");

  const fetchEmployee = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load employee details."
        );
      }

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
  }, [id, token, navigate]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess(false);

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
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map((item) => item.msg).join(", ")
          : result.detail;

        throw new Error(
          detail || "Unable to update employee details."
        );
      }

      setSuccess(true);

      setTimeout(() => {
        navigate("/employees");
      }, 1200);
    } catch (err) {
      setError(err.message || "Update operation failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-employee-page">
      <Sidebar role="admin" />

      <main className="edit-employee-main">
        <Header />

        <div className="edit-employee-content">
          <section className="edit-employee-header">
            <div>
              <span className="edit-employee-eyebrow">
                WORKFORCE MANAGEMENT
              </span>

              <h1>Edit Employee</h1>
              <p>Update and maintain employee information.</p>
            </div>

            <Link to="/employees" className="edit-back-btn">
              <ArrowLeft size={16} />
              Back to Employees
            </Link>
          </section>

          {error && (
            <div className="edit-alert edit-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="edit-alert edit-success" role="status">
              <CheckCircle2 size={17} />
              Employee details updated successfully. Redirecting...
            </div>
          )}

          <section className="edit-employee-card">
            <div className="edit-card-heading">
              <div className="edit-card-icon">
                <Pencil size={20} />
              </div>

              <div>
                <h2>Employee Information</h2>
                <p>
                  Make changes to the employee's basic details below.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="edit-loading">
                <RefreshCw size={19} className="edit-spin" />
                Loading employee details...
              </div>
            ) : (
              <form className="edit-employee-form" onSubmit={handleSubmit}>
                <div className="edit-section-heading">
                  <h3>Basic Information</h3>
                  <p>Update the employee's registered information.</p>
                </div>

                <div className="edit-form-group">
                  <label htmlFor="editName">Full Name *</label>
                  <input
                    id="editName"
                    name="name"
                    type="text"
                    placeholder="Enter employee name"
                    value={formData.name}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="edit-form-group">
                  <label htmlFor="editEmail">Email Address *</label>
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
                  <label htmlFor="editDepartment">Department *</label>
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

                <div className="edit-form-info">
                  <UserRound size={18} />
                  <span>
                    Only the three fields above are editable on this page.
                  </span>
                </div>

                <div className="edit-form-actions">
                  <Link to="/employees" className="edit-cancel-btn">
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    className="update-employee-btn"
                    disabled={saving || success}
                  >
                    {saving ? "Updating..." : "Save Changes"}
                    {!saving && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default EditEmployee;
