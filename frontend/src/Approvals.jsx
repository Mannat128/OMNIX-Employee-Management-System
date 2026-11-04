
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserRound,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCw,
  AlertCircle,
  LoaderCircle,
  ClipboardCheck,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Approvals.css";

const API_URL = "http://127.0.0.1:8000";

function Approvals() {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const fetchPendingUsers = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/admin/pending-users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load requests.");
      }

      setPendingUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to the backend server."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const handleAction = async (userId, action) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      setActionLoading(`${userId}-${action}`);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/admin/${action}/${userId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Action could not be completed."
        );
      }

      setMessage(
        data.message ||
          `Employee request ${action === "approve" ? "approved" : "rejected"} successfully.`
      );

      await fetchPendingUsers();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="approvals-page">
      <Sidebar />

      <main className="approvals-main">
        <Header />

        <div className="approvals-content">
          <div className="approvals-page-heading">
            <div>
              <span className="approvals-eyebrow">
                ADMINISTRATION
              </span>
              <h1>Employee Approvals</h1>
              <p>
                Review and manage employee registration requests.
              </p>
            </div>

            <button
              type="button"
              className="approvals-refresh-btn"
              onClick={fetchPendingUsers}
              disabled={loading}
              aria-label="Refresh requests"
            >
              <RefreshCw size={17} />
              Refresh
            </button>
          </div>

          <section className="approvals-summary">
            <div className="approvals-summary-card">
              <div className="approvals-summary-icon">
                <Clock3 size={21} />
              </div>
              <div>
                <span>Pending Requests</span>
                <h2>{loading ? "—" : pendingUsers.length}</h2>
              </div>
            </div>

            <div className="approvals-summary-card">
              <div className="approvals-summary-icon orange">
                <ClipboardCheck size={21} />
              </div>
              <div>
                <span>Review Queue</span>
                <h2>{loading ? "—" : pendingUsers.length}</h2>
              </div>
            </div>
          </section>

          {error && (
            <div className="approvals-message error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {message && (
            <div className="approvals-message success" role="status">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          <section className="approvals-table-card">
            <div className="approvals-table-heading">
              <div>
                <h2>Registration Requests</h2>
                <p>
                  Review employee details before approving their account.
                </p>
              </div>

              <span className="pending-label">
                <Clock3 size={14} />
                Pending Review
              </span>
            </div>

            {loading ? (
              <div className="approvals-empty">
                <LoaderCircle
                  size={30}
                  className="approvals-spinner"
                />
                <p>Loading registration requests...</p>
              </div>
            ) : pendingUsers.length > 0 ? (
              <div className="approvals-table-wrapper">
                <table className="approvals-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Email Address</th>
                      <th>Department</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pendingUsers.map((user) => {
                      const userId = user.id || user._id;

                      return (
                        <tr key={userId}>
                          <td>
                            <div className="approval-employee">
                              <div className="approval-avatar">
                                <UserRound size={18} />
                              </div>
                              <strong>{user.name || "Unnamed User"}</strong>
                            </div>
                          </td>

                          <td>
                            <span className="approval-email">
                              <Mail size={14} />
                              {user.email || "—"}
                            </span>
                          </td>

                          <td>
                            <span className="approval-department">
                              <Building2 size={14} />
                              {user.department || "Not available"}
                            </span>
                          </td>

                          <td>
                            <div className="approval-actions">
                              <button
                                type="button"
                                className="approval-approve-btn"
                                disabled={!!actionLoading}
                                onClick={() =>
                                  handleAction(userId, "approve")
                                }
                              >
                                {actionLoading === `${userId}-approve` ? (
                                  <LoaderCircle size={15} />
                                ) : (
                                  <CheckCircle2 size={15} />
                                )}
                                Approve
                              </button>

                              <button
                                type="button"
                                className="approval-reject-btn"
                                disabled={!!actionLoading}
                                onClick={() =>
                                  handleAction(userId, "reject")
                                }
                              >
                                {actionLoading === `${userId}-reject` ? (
                                  <LoaderCircle size={15} />
                                ) : (
                                  <XCircle size={15} />
                                )}
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="approvals-empty">
                <div className="approvals-empty-icon">
                  <ClipboardCheck size={28} />
                </div>
                <h3>No Pending Requests</h3>
                <p>
                  New employee registration requests will appear here.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default Approvals;
