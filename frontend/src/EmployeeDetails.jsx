
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./EmployeeDetails.css";

const API_URL = "http://127.0.0.1:8000";

function EmployeeDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchEmployeeDetails();
  }, [id]);

  const fetchEmployeeDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          data.detail || "Admin access required. Please login again."
        );
      }

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load employee details.");
      }

      setEmployee(data);
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
    <div className="employee-details-page">
      <aside className="details-sidebar">
        <div className="details-brand">
          <span className="details-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="details-menu-title">MAIN MENU</p>

        <nav className="details-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees">♙ Employees</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/approvals">✓ Approvals</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="details-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="details-main">
        <header className="details-header">
          <div>
            <h1>Employee Details</h1>
            <p>View employee information and account details.</p>
          </div>

          <a href="/employees" className="details-back">
            ← Back to Employees
          </a>
        </header>

        {loading ? (
          <section className="details-empty">
            <h2>Loading employee details...</h2>
          </section>
        ) : error ? (
          <section className="details-empty">
            <h2>Unable to Load Employee</h2>
            <p>{error}</p>
            <button type="button" onClick={fetchEmployeeDetails}>
              Try Again
            </button>
          </section>
        ) : employee ? (
          <section className="details-card">
            <div className="details-card-heading">
              <div className="details-empty-icon">♙</div>
              <div>
                <h2>{employee.name || "—"}</h2>
                <p>{employee.department || "—"}</p>
              </div>
            </div>

            <div className="details-information">
              <div>
                <span>Full Name</span>
                <p>{employee.name || "—"}</p>
              </div>

              <div>
                <span>Email Address</span>
                <p>{employee.email || "—"}</p>
              </div>

              <div>
                <span>Department</span>
                <p>{employee.department || "—"}</p>
              </div>

              <div>
                <span>Employee ID</span>
                <p>{employee._id || employee.id || "—"}</p>
              </div>
            </div>

            <div className="details-actions">
              <button
                type="button"
                onClick={() => navigate(`/employees/edit/${id}`)}
              >
                Edit Employee
              </button>
            </div>
          </section>
        ) : (
          <section className="details-empty">
            <div className="details-empty-icon">♙</div>
            <h2>No Employee Found</h2>
            <p>Employee information is not available.</p>
            <a href="/employees">Go to Employees</a>
          </section>
        )}
      </main>
    </div>
  );
}

export default EmployeeDetails;
