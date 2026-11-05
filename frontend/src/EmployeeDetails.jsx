
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  UserRound,
  Mail,
  Building2,
  BadgeCheck,
  Pencil,
  RefreshCw,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./EmployeeDetails.css";

// Read logged-in user's role
function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return String(user.role || "").toLowerCase();
  } catch {
    return "";
  }
}

// Build profile photo URL
const API_URL = API.defaults.baseURL;

function getPhotoUrl(photo) {
  if (!photo || typeof photo !== "string") return "";

  if (/^https?:\/\//i.test(photo)) {
    return photo;
  }

  return `${API_URL}/${photo.replace(/^\/+/, "")}`;
}

function EmployeeDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUserRole = getCurrentUserRole();
  const isAdmin = currentUserRole === "admin";

  // Handle expired session
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  // Fetch employee details
  const fetchEmployeeDetails = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await API.get(`/employees/${id}`);

      setEmployee(response.data);
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.detail;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        setError(
          message || "You do not have permission to view this employee."
        );
        return;
      }

      if (status === 404) {
        setError(message || "Employee not found.");
        return;
      }

      setError(
        err.code === "ERR_NETWORK"
          ? "Unable to connect to the backend server."
          : message || "Unable to load employee details."
      );
    } finally {
      setLoading(false);
    }
  }, [id, handleUnauthorized]);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [fetchEmployeeDetails]);

  const employeeId =
    employee?.employee_id || employee?.id || employee?._id || "—";

  return (
    <div className="employee-details-page">
      <Sidebar />

      <main className="employee-details-main">
        <Header />

        <div className="employee-details-content">
          {/* Page heading */}
          <div className="employee-details-heading">
            <div>
              <span className="employee-details-eyebrow">
                EMPLOYEE MANAGEMENT
              </span>

              <h1>Employee Details</h1>

              <p>
                View employee information and account details.
              </p>
            </div>

            <button
              type="button"
              className="employee-details-back"
              onClick={() => navigate("/employees")}
            >
              <ArrowLeft size={17} />
              Back to Employees
            </button>
          </div>

          {/* Loading state */}
          {loading ? (
            <section className="employee-details-state">
              <LoaderCircle
                className="employee-details-spinner"
                size={34}
              />

              <h2>Loading employee details...</h2>

              <p>
                Please wait while we fetch the information.
              </p>
            </section>
          ) : error ? (
            /* Error state */
            <section className="employee-details-state">
              <div className="employee-details-state-icon error">
                <AlertCircle size={28} />
              </div>

              <h2>Unable to Load Employee</h2>

              <p>{error}</p>

              <button
                type="button"
                className="employee-details-primary-btn"
                onClick={fetchEmployeeDetails}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </section>
          ) : employee ? (
            <>
              {/* Employee profile card */}
              <section className="employee-details-profile-card">
                <div className="employee-details-avatar">
                  {getPhotoUrl(employee.profile_photo) ? (
                    <img
                      src={getPhotoUrl(employee.profile_photo)}
                      alt={employee.name || "Employee"}
                    />
                  ) : (
                    <UserRound size={36} />
                  )}
                </div>

                <div className="employee-details-profile-info">
                  <span className="employee-details-eyebrow">
                    EMPLOYEE PROFILE
                  </span>

                  <h2>
                    {employee.name || "Unnamed Employee"}
                  </h2>

                  <p>
                    {employee.designation ||
                      employee.department ||
                      "Employee"}
                  </p>
                </div>

                {/* Edit action: Admin only */}
                {isAdmin && (
                  <button
                    type="button"
                    className="employee-details-edit-btn"
                    onClick={() =>
                      navigate(`/employees/edit/${id}`)
                    }
                  >
                    <Pencil size={16} />
                    Edit Employee
                  </button>
                )}
              </section>

              {/* Personal information */}
              <section className="employee-details-info-card">
                <div className="employee-details-section-heading">
                  <div>
                    <h2>Personal Information</h2>

                    <p>
                      Basic information associated with this employee.
                    </p>
                  </div>

                  <UserRound size={21} />
                </div>

                <div className="employee-details-grid">
                  <div className="employee-details-field">
                    <span>
                      <UserRound size={15} />
                      Full Name
                    </span>

                    <p>{employee.name || "—"}</p>
                  </div>

                  <div className="employee-details-field">
                    <span>
                      <Mail size={15} />
                      Email Address
                    </span>

                    <p>{employee.email || "—"}</p>
                  </div>

                  <div className="employee-details-field">
                    <span>
                      <Building2 size={15} />
                      Department
                    </span>

                    <p>{employee.department || "—"}</p>
                  </div>

                  <div className="employee-details-field">
                    <span>
                      <BadgeCheck size={15} />
                      Employee ID
                    </span>

                    <p>{employeeId}</p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            /* Empty state */
            <section className="employee-details-state">
              <div className="employee-details-state-icon">
                <UserRound size={28} />
              </div>

              <h2>No Employee Found</h2>

              <p>
                Employee information is not available.
              </p>

              <button
                type="button"
                className="employee-details-primary-btn"
                onClick={() => navigate("/employees")}
              >
                <ArrowLeft size={16} />
                Go to Employees
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default EmployeeDetails;
