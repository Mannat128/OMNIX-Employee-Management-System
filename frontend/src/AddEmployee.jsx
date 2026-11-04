
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Copy, ArrowRight, UserPlus } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./AddEmployee.css";

const API_URL = "http://127.0.0.1:8000";

const initialFormData = {
  name: "",
  email: "",
  department: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  city: "",
  state: "",
  designation: "",
  joining_date: "",
  employment_type: "",
  employment_status: "Active",
};

function AddEmployee() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [copied, setCopied] = useState(false);

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

    if (!/^[0-9]{10}$/.test(formData.phone)) {
      setError("Phone number must contain exactly 10 digits.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setCreatedEmployee(null);

      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        department: formData.department.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        designation: formData.designation.trim(),
      };

      const response = await fetch(`${API_URL}/employees/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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

        throw new Error(detail || "Unable to create employee.");
      }

      setCreatedEmployee(result);
      setCopied(false);
      setFormData(initialFormData);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    const password = createdEmployee?.temporary_password;

    if (!password) return;

    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setError(
        "Unable to copy automatically. Please select and copy the password."
      );
    }
  };

  return (
    <div className="add-employee-page">
      <Sidebar role="admin" />

      <main className="add-employee-main">
        <Header />

        <div className="add-employee-content">
          <section className="add-employee-header">
            <div>
              <span className="add-employee-eyebrow">
                WORKFORCE MANAGEMENT
              </span>

              <h1>Add Employee</h1>
              <p>Create a new employee record and account.</p>
            </div>

            <Link to="/employees" className="back-employees">
              <ArrowRight size={15} className="back-arrow-icon" />
              Back to Employees
            </Link>
          </section>

          {error && (
            <div className="add-employee-error" role="alert">
              {error}
            </div>
          )}

          {createdEmployee ? (
            <section className="credential-card">
              <div className="credential-success-icon">
                <CheckCircle2 size={30} />
              </div>

              <span className="credential-eyebrow">
                ACCOUNT CREATED
              </span>

              <h2>Employee Created Successfully!</h2>

              <p>
                The employee account is ready. Share the temporary
                password securely with the employee.
              </p>

              <div className="credential-details">
                <div>
                  <span>Employee Name</span>
                  <strong>{createdEmployee.employee?.name || "—"}</strong>
                </div>

                <div>
                  <span>Employee ID</span>
                  <strong>
                    {createdEmployee.employee?.employee_id || "—"}
                  </strong>
                </div>

                <div>
                  <span>Email Address</span>
                  <strong>
                    {createdEmployee.employee?.email || "—"}
                  </strong>
                </div>

                <div className="temporary-password">
                  <span>Temporary Password</span>
                  <strong>
                    {createdEmployee.temporary_password || "Not provided"}
                  </strong>
                </div>
              </div>

              <p className="credential-warning">
                The employee must change this password during their first
                login. This password will not be shown again after leaving
                this screen.
              </p>

              <div className="credential-actions">
                <button
                  type="button"
                  className="copy-password-btn"
                  onClick={handleCopyPassword}
                  disabled={!createdEmployee.temporary_password}
                >
                  <Copy size={15} />
                  {copied ? "Copied!" : "Copy Password"}
                </button>

                <button
                  type="button"
                  className="save-employee-btn"
                  onClick={() => navigate("/employees")}
                >
                  Go to Employees
                  <ArrowRight size={15} />
                </button>
              </div>
            </section>
          ) : (
            <section className="add-employee-card">
              <div className="add-card-heading">
                <div className="add-card-heading-icon">
                  <UserPlus size={21} />
                </div>

                <div>
                  <h2>Personal Details</h2>
                  <p>
                    Enter the employee's personal and contact information.
                  </p>
                </div>
              </div>

              <form className="add-employee-form" onSubmit={handleSubmit}>
                <div className="form-section-heading">
                  <h2>Personal Information</h2>
                  <p>Basic details about the employee.</p>
                </div>

                <div className="add-form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="10-digit phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    pattern="[0-9]{10}"
                    maxLength={10}
                    inputMode="numeric"
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="date_of_birth">Date of Birth *</label>
                  <input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="add-form-group">
                  <label htmlFor="city">City *</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="Enter city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="state">State *</label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    placeholder="Enter state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-section-heading">
                  <h2>Job Details</h2>
                  <p>Enter the employee's official job information.</p>
                </div>

                <div className="add-form-group">
                  <label htmlFor="department">Department *</label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    placeholder="Enter department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="designation">Designation *</label>
                  <input
                    id="designation"
                    name="designation"
                    type="text"
                    placeholder="Enter designation"
                    value={formData.designation}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="joining_date">Joining Date *</label>
                  <input
                    id="joining_date"
                    name="joining_date"
                    type="date"
                    value={formData.joining_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="add-form-group">
                  <label htmlFor="employment_type">Employment Type *</label>
                  <select
                    id="employment_type"
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select employment type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>

                <div className="add-form-group">
                  <label htmlFor="employment_status">
                    Employment Status *
                  </label>
                  <select
                    id="employment_status"
                    name="employment_status"
                    value={formData.employment_status}
                    onChange={handleChange}
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-info">
                  <strong>Automatic account setup</strong>
                  <p>
                    Employee ID and temporary password will be generated
                    automatically after creating the employee.
                  </p>
                </div>

                <div className="add-form-actions">
                  <Link to="/employees" className="cancel-employee-btn">
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    className="save-employee-btn"
                    disabled={loading}
                  >
                    {loading ? "Creating Employee..." : "Create Employee"}
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default AddEmployee;
