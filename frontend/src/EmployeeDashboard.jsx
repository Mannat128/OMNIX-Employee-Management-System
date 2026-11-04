
import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  UserRound,
  FileText,
  ShieldCheck,
  ArrowRight,
  Mail,
  Building2,
  BriefcaseBusiness,
  RefreshCw,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./EmployeeDashboard.css";

const API_URL = "http://127.0.0.1:8000";

function EmployeeDashboard() {
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEmployee = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/employees/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load employee information."
        );
      }

      setEmployee(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  const avatarLetter =
    employee?.name?.charAt(0)?.toUpperCase() || "U";

  const employmentStatus =
    employee?.employment_status || "Not available";

  return (
    <div className="employee-dashboard">
      <Sidebar />

      <main className="employee-main">
        <Header />

        <div className="employee-dashboard-content">
          <div className="employee-dashboard-heading">
            <div>
              <span className="employee-dashboard-eyebrow">
                EMPLOYEE WORKSPACE
              </span>
              <h1>My Dashboard</h1>
              <p>Manage your profile and employee documents.</p>
            </div>
          </div>

          {loading ? (
            <section className="employee-dashboard-state">
              <LoaderCircle
                size={32}
                className="employee-dashboard-spinner"
              />
              <p>Loading your dashboard...</p>
            </section>
          ) : error ? (
            <section className="employee-dashboard-state">
              <div className="employee-dashboard-state-icon error">
                <AlertCircle size={26} />
              </div>
              <h2>Unable to Load Dashboard</h2>
              <p>{error}</p>
              <button
                type="button"
                className="employee-dashboard-retry"
                onClick={fetchEmployee}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </section>
          ) : employee ? (
            <>
              <section className="employee-welcome">
                <div className="employee-welcome-content">
                  <span>WELCOME TO OMNIX</span>
                  <h2>
                    Hello, {employee.name || "Employee"}!
                  </h2>
                  <p>
                    Your employee workspace is ready. Access your
                    information and manage your documents from here.
                  </p>
                </div>

                <div className="employee-welcome-avatar">
                  {employee.profile_photo ? (
                    <img
                      src={
                        employee.profile_photo.startsWith("http")
                          ? employee.profile_photo
                          : `${API_URL}${employee.profile_photo}`
                      }
                      alt={employee.name || "Employee"}
                    />
                  ) : (
                    <span>{avatarLetter}</span>
                  )}
                </div>
              </section>

              <section className="employee-overview">
                <div className="employee-section-heading">
                  <div>
                    <h2>My Overview</h2>
                    <p>Your workspace shortcuts and account information.</p>
                  </div>
                </div>

                <div className="employee-overview-grid">
                  <article className="employee-overview-card">
                    <div className="employee-overview-icon">
                      <UserRound size={22} />
                    </div>
                    <h3>My Profile</h3>
                    <p>
                      View and manage your personal and employment
                      information.
                    </p>
                    <Link to="/employee/profile">
                      View Profile <ArrowRight size={16} />
                    </Link>
                  </article>

                  <article className="employee-overview-card">
                    <div className="employee-overview-icon orange">
                      <FileText size={22} />
                    </div>
                    <h3>My Documents</h3>
                    <p>
                      Upload your resume, ID proof and certificates.
                    </p>
                    <Link to="/documents">
                      View Documents <ArrowRight size={16} />
                    </Link>
                  </article>

                  <article className="employee-overview-card">
                    <div className="employee-overview-icon">
                      <ShieldCheck size={22} />
                    </div>
                    <h3>Account Status</h3>
                    <p>
                      Check the current status of your employee account.
                    </p>
                    <Link to="/employee/profile">
                      View Status <ArrowRight size={16} />
                    </Link>
                  </article>
                </div>
              </section>

              <section className="employee-information">
                <div className="employee-information-heading">
                  <div>
                    <h2>My Account Information</h2>
                    <p>Your details retrieved from your employee account.</p>
                  </div>
                  <UserRound size={22} />
                </div>

                <div className="employee-account-details">
                  <div className="employee-account-field">
                    <span>
                      <UserRound size={15} />
                      Full Name
                    </span>
                    <strong>{employee.name || "Not available"}</strong>
                  </div>

                  <div className="employee-account-field">
                    <span>
                      <Mail size={15} />
                      Email Address
                    </span>
                    <strong>{employee.email || "Not available"}</strong>
                  </div>

                  <div className="employee-account-field">
                    <span>
                      <Building2 size={15} />
                      Department
                    </span>
                    <strong>{employee.department || "Not available"}</strong>
                  </div>

                  <div className="employee-account-field">
                    <span>
                      <BriefcaseBusiness size={15} />
                      Employment Status
                    </span>
                    <strong className="employee-status-value">
                      {employmentStatus}
                    </strong>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="employee-dashboard-state">
              <div className="employee-dashboard-state-icon">
                <UserRound size={26} />
              </div>
              <h2>No Employee Information</h2>
              <p>Your employee profile is not available right now.</p>
              <button
                type="button"
                className="employee-dashboard-retry"
                onClick={() => navigate("/employee/profile")}
              >
                View Profile <ArrowRight size={16} />
              </button>
            </section>
          )}

          <footer className="employee-footer">
            <span>OMNIX Employee Workspace</span>
            <span>© 2026 OMNIX</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
