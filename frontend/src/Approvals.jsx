
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Approvals.css";

const API_URL = "http://127.0.0.1:8000";

function Approvals() {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchPendingUsers = useCallback(async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login", { replace: true });
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

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
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
  }, [navigate]);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const handleAction = async (userId, action) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setActionLoading(userId);
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

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || "Action could not be completed.");
      }

      setMessage(data.message);
      await fetchPendingUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="approvals-page">
      <aside className="approvals-sidebar">
        <div className="approvals-brand">
          <span className="approvals-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="approvals-menu-title">MAIN MENU</p>

        <nav className="approvals-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees">♙ Employees</a>
          <a href="/admin/approvals" className="active">◷ Approvals</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <button
          type="button"
          className="approvals-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="approvals-main">
        <header className="approvals-header">
          <div>
            <h1>Employee Approvals</h1>
            <p>Review and manage employee registration requests.</p>
          </div>
        </header>

        <section className="approvals-summary">
          <div>
            <span>Pending Requests</span>
            <h2>{loading ? "..." : pendingUsers.length}</h2>
          </div>

          <div>
            <span>Approved Requests</span>
            <h2>—</h2>
          </div>

          <div>
            <span>Rejected Requests</span>
            <h2>—</h2>
          </div>
        </section>

        {error && (
          <p role="alert" style={{ color: "#dc2626", margin: "15px 0" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#15803d", margin: "15px 0" }}>
            {message}
          </p>
        )}

        <section className="approvals-table-card">
          <div className="approvals-table-heading">
            <div>
              <h2>Registration Requests</h2>
              <p>Review employee account registration requests.</p>
            </div>

            <span className="pending-label">Pending Review</span>
          </div>

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
                {loading ? (
                  <tr>
                    <td colSpan="4">
                      <div className="approvals-empty">
                        <p>Loading registration requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : pendingUsers.length > 0 ? (
                  pendingUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.department || "Not available"}</td>
                      <td>
                        <div className="approval-actions">
                          <button
                            type="button"
                            disabled={actionLoading === user.id}
                            onClick={() => handleAction(user.id, "approve")}
                          >
                            {actionLoading === user.id
                              ? "Processing..."
                              : "Approve"}
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading === user.id}
                            onClick={() => handleAction(user.id, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="approvals-empty">
                        <span>◷</span>
                        <h3>No pending requests</h3>
                        <p>
                          New employee registration requests will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Approvals;
