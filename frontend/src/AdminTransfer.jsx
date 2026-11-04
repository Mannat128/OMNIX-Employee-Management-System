
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRightLeft,
  UserRound,
  LockKeyhole,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./AdminTransfer.css";

const API_URL = "http://127.0.0.1:8000";

const initialDetails = {
  department: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  city: "",
  state: "",
  designation: "",
  joining_date: "",
  employment_type: "",
};

function AdminTransfer() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [details, setDetails] = useState(initialDetails);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(`${API_URL}/employees/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const data = await response.json().catch(() => []);

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(data.detail || "Unable to load employees.");
        }

        setEmployees(
          Array.isArray(data)
            ? data.filter(
                (employee) =>
                  employee.employment_status === "Active" &&
                  employee.id &&
                  employee.user_id
              )
            : []
        );
      } catch (err) {
        setError(err.message || "Unable to load employees.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchEmployees();
    } else {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  const handleDetailsChange = (event) => {
    const { name, value } = event.target;

    setDetails((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedEmployee) {
      setError("Please select an active employee.");
      return;
    }

    if (!adminPassword) {
      setError("Please enter your current Admin password.");
      return;
    }

    const selected = employees.find(
      (employee) => employee.id === selectedEmployee
    );

    if (!selected) {
      setError("Selected employee could not be found.");
      return;
    }

    const confirmed = window.confirm(
      `Transfer Admin access to ${selected.name}?\n\n` +
      "You will become an Employee. Both users must log in again."
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_URL}/admin/transfer-access`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            target_employee_id: selectedEmployee,
            admin_password: adminPassword,
            old_admin_action: "employee",
            old_admin_details: {
              ...details,
            },
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          result.detail || "Authentication failed. Please log in again."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.detail || "Admin transfer could not be completed."
        );
      }

      setSuccess("Admin access transferred successfully!");

      // Both existing sessions are invalidated by the backend.
      // Clear the current Admin session and require a fresh login.
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      setError(err.message || "Admin transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-transfer-page">
      <Sidebar role="admin" />

      <main className="admin-transfer-main">
        <Header />

        <div className="admin-transfer-content">
          <section className="transfer-heading">
            <span className="transfer-eyebrow">
              ADMINISTRATION
            </span>

            <h1>Transfer Admin Access</h1>

            <p>
              Safely transfer administrative responsibility to
              another active employee.
            </p>
          </section>

          <div className="transfer-warning">
            <AlertTriangle size={22} />

            <div>
              <strong>Important security notice</strong>
              <p>
                After transfer, you will become an Employee.
                Your existing password will remain unchanged.
                Both users will need to log in again.
              </p>
            </div>
          </div>

          {error && (
            <div className="transfer-alert transfer-error">
              {error}
            </div>
          )}

          {success && (
            <div className="transfer-alert transfer-success">
              <CheckCircle2 size={18} />
              {success} Redirecting to login...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <section className="transfer-card">
              <div className="transfer-card-heading">
                <div className="transfer-icon">
                  <UserRound size={21} />
                </div>

                <div>
                  <h2>Select New Admin</h2>
                  <p>
                    Only active employees with login accounts
                    are eligible.
                  </p>
                </div>
              </div>

              <label htmlFor="targetEmployee">
                Select Employee
              </label>

              <select
                id="targetEmployee"
                value={selectedEmployee}
                onChange={(event) =>
                  setSelectedEmployee(event.target.value)
                }
                required
                disabled={loading || submitting}
              >
                <option value="">
                  {loading
                    ? "Loading employees..."
                    : "Choose an active employee"}
                </option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} — {employee.employee_id || "No ID"}
                  </option>
                ))}
              </select>

              {!loading && employees.length === 0 && (
                <small>
                  No eligible active employees with login accounts found.
                </small>
              )}
            </section>

            <section className="transfer-card">
              <div className="transfer-card-heading">
                <div className="transfer-icon">
                  <UserRound size={21} />
                </div>

                <div>
                  <h2>Your Employee Profile</h2>
                  <p>
                    These details will create your Employee profile
                    after transfer.
                  </p>
                </div>
              </div>

              <div className="transfer-form-grid">
                <div>
                  <label>Department</label>
                  <input
                    name="department"
                    value={details.department}
                    onChange={handleDetailsChange}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>

                <div>
                  <label>Phone Number</label>
                  <input
                    name="phone"
                    value={details.phone}
                    onChange={handleDetailsChange}
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>

                <div>
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={details.date_of_birth}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div>
                  <label>Gender</label>
                  <select
                    name="gender"
                    value={details.gender}
                    onChange={handleDetailsChange}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label>City</label>
                  <input
                    name="city"
                    value={details.city}
                    onChange={handleDetailsChange}
                    required
                    minLength={2}
                  />
                </div>

                <div>
                  <label>State</label>
                  <input
                    name="state"
                    value={details.state}
                    onChange={handleDetailsChange}
                    required
                    minLength={2}
                  />
                </div>

                <div>
                  <label>Designation</label>
                  <input
                    name="designation"
                    value={details.designation}
                    onChange={handleDetailsChange}
                    required
                    minLength={2}
                  />
                </div>

                <div>
                  <label>Joining Date</label>
                  <input
                    type="date"
                    name="joining_date"
                    value={details.joining_date}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div>
                  <label>Employment Type</label>
                  <select
                    name="employment_type"
                    value={details.employment_type}
                    onChange={handleDetailsChange}
                    required
                  >
                    <option value="">Select type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="transfer-card">
              <div className="transfer-card-heading">
                <div className="transfer-icon">
                  <LockKeyhole size={21} />
                </div>

                <div>
                  <h2>Security Verification</h2>
                  <p>
                    Confirm your current Admin password.
                  </p>
                </div>
              </div>

              <label htmlFor="adminPassword">
                Current Admin Password
              </label>

              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(event) =>
                  setAdminPassword(event.target.value)
                }
                required
                minLength={1}
                maxLength={128}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </section>

            <div className="transfer-submit-area">
              <button
                type="submit"
                disabled={
                  submitting ||
                  loading ||
                  employees.length === 0 ||
                  Boolean(success)
                }
              >
                {submitting ? (
                  "Transferring..."
                ) : (
                  <>
                    <ArrowRightLeft size={18} />
                    Transfer Admin Access
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AdminTransfer;
