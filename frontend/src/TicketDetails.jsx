
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Clock3,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Download,
} from "lucide-react";

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./TicketDetails.css";

function TicketDetails() {
  const { id } = useParams();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin";

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [updating, setUpdating] = useState(false);
  const [file, setFile] = useState(null);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(`/tickets/${id}`);
      setTicket(response.data);
      setStatus(response.data.status || "Open");
      setPriority(response.data.priority || "Medium");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load ticket details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const handleReply = async (e) => {
    e.preventDefault();

    if (!reply.trim() && !file) return;

    try {
      setSending(true);
      setError("");

      if (reply.trim()) {
        await API.post(`/tickets/${id}/replies`, {
          message: reply.trim(),
        });
      }

      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        await API.post(`/tickets/${id}/attachments`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setReply("");
      setFile(null);
      await fetchTicket();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to send reply."
      );
    } finally {
      setSending(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      setError("");

      await API.patch(`/tickets/${id}`, {
        status,
        priority,
      });

      await fetchTicket();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update ticket."
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await API.get(
        `/tickets/${id}/attachments/${attachment.attachment_id}`,
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = attachment.file_name || "attachment";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to download attachment."
      );
    }
  };

  const getInitial = (name) =>
    name?.charAt(0)?.toUpperCase() || "U";

  if (loading) {
    return (
      <div className="ticket-details-page">
        <Sidebar role={user.role} />
        <main className="ticket-details-main">
          <Header />
          <div className="ticket-details-loading">
            <RefreshCw className="ticket-spin" size={28} />
            <p>Loading ticket details...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ticket-details-page">
      <Sidebar role={user.role} />

      <main className="ticket-details-main">
        <Header />

        <div className="ticket-details-content">
          <Link to="/tickets" className="ticket-back-link">
            <ArrowLeft size={17} />
            Back to Tickets
          </Link>

          {error && (
            <div className="ticket-detail-error" role="alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}

          {!ticket ? (
            <section className="ticket-details-not-found">
              <AlertCircle size={35} />
              <h2>Ticket not found</h2>
              <p>This ticket may have been removed or is unavailable.</p>
              <Link to="/tickets">Return to Tickets</Link>
            </section>
          ) : (
            <>
              <section className="ticket-detail-banner">
                <div>
                  <span className="ticket-detail-eyebrow">
                    OMNI HELPDESK / TICKET DETAILS
                  </span>
                  <h1>{ticket.subject}</h1>
                  <p>
                    Ticket #{ticket.ticket_number || ticket.id || id}
                  </p>
                </div>

                <span
                  className={`ticket-status ${ticket.status?.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {ticket.status}
                </span>
              </section>

              <div className="ticket-detail-layout">
                <section className="ticket-detail-main-card">
                  <div className="ticket-description">
                    <h2>Issue Description</h2>
                    <p>{ticket.description}</p>
                  </div>

                  <div className="ticket-conversation">
                    <div className="ticket-conversation-heading">
                      <div>
                        <MessageSquare size={19} />
                        <h2>Conversation</h2>
                      </div>
                    </div>

                    {ticket.replies?.length ? (
                      <div className="ticket-replies">
                        {ticket.replies.map((item, index) => (
                          <article
                            className="ticket-reply"
                            key={item.id || item._id || index}
                          >
                            <div className="ticket-reply-avatar">
                              {getInitial(item.sender_name || item.name)}
                            </div>

                            <div className="ticket-reply-content">
                              <div className="ticket-reply-meta">
                                <strong>
                                  {item.sender_name || item.name || "User"}
                                </strong>
                                <span>{item.role || ""}</span>
                              </div>
                              <p>{item.message}</p>
                              {item.created_at && (
                                <small>
                                  {new Date(item.created_at).toLocaleString()}
                                </small>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="ticket-no-replies">
                        <MessageSquare size={25} />
                        <p>No replies yet. Start the conversation.</p>
                      </div>
                    )}

                    <form
                      className="ticket-reply-form"
                      onSubmit={handleReply}
                    >
                      <textarea
                        rows={3}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Write your reply..."
                      />

                      <div className="ticket-reply-actions">
                        <label className="ticket-attachment-button">
                          <Paperclip size={17} />
                          Attach file
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) =>
                              setFile(e.target.files?.[0] || null)
                            }
                          />
                        </label>

                        {file && <span>{file.name}</span>}

                        <button type="submit" disabled={sending}>
                          <Send size={16} />
                          {sending ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    </form>
                  </div>
                </section>

                <aside className="ticket-detail-sidebar">
                  <section className="ticket-detail-info-card">
                    <h2>Ticket Information</h2>

                    <div className="ticket-info-item">
                      <span>Category</span>
                      <strong>{ticket.category || "—"}</strong>
                    </div>

                    <div className="ticket-info-item">
                      <span>Priority</span>
                      <strong>{ticket.priority || "—"}</strong>
                    </div>

                    <div className="ticket-info-item">
                      <span>Status</span>
                      <strong>{ticket.status || "—"}</strong>
                    </div>

                    <div className="ticket-info-item">
                      <span>Created</span>
                      <strong>
                        {ticket.created_at
                          ? new Date(ticket.created_at).toLocaleDateString()
                          : "—"}
                      </strong>
                    </div>

                    {isAdmin && (
                      <>
                        <div className="ticket-admin-controls">
                          <h3>Manage Ticket</h3>

                          <label>Status</label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            {["Open", "In Progress", "Resolved", "Closed"].map(
                              (item) => (
                                <option key={item}>{item}</option>
                              )
                            )}
                          </select>

                          <label>Priority</label>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                          >
                            {["Low", "Medium", "High", "Urgent"].map(
                              (item) => (
                                <option key={item}>{item}</option>
                              )
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={updating}
                          >
                            {updating ? "Updating..." : "Save Changes"}
                          </button>
                        </div>
                      </>
                    )}
                  </section>

                  {ticket.attachments?.length > 0 && (
                    <section className="ticket-detail-info-card">
                      <h2>Attachments</h2>

                      {ticket.attachments.map((attachment, index) => (
                        <button
                          type="button"
                          className="ticket-attachment-item"
                          key={attachment.attachment_id || index}
                          onClick={() => handleDownload(attachment)}
                        >
                          <Paperclip size={17} />
                          <span>{attachment.file_name}</span>
                          <Download size={16} />
                        </button>
                      ))}
                    </section>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default TicketDetails;
