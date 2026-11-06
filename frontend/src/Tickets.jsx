import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Ticket,
  Clock3,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  X,
  Paperclip,
  FileText,
  CheckCircle,
} from "lucide-react";

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Tickets.css";

// Safely turn FastAPI/Axios errors into text.
// This prevents validation objects from being rendered directly by React.
const getApiErrorMessage = (err, fallback = "Something went wrong.") => {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === "string") return item;

      const location = Array.isArray(item?.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";

      const message =
        item?.msg || item?.message || item?.type || "Invalid value";

      return location ? `${location}: ${message}` : String(message);
    });

    return messages.join(" | ") || fallback;
  }

  if (typeof detail === "string") return detail;

  if (detail && typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
    if (typeof detail.message === "string") return detail.message;

    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  if (typeof err?.message === "string" && err.message) {
    return err.message;
  }

  return fallback;
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

const safeReadUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

function Tickets() {
  const user = safeReadUser();
  const isAdmin = user.role?.toLowerCase() === "admin";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");

  const [form, setForm] = useState({
    subject: "",
    category: "Technical",
    description: "",
  });

  // Fetch tickets without changing the current route.
  const fetchTickets = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);

      const response = await API.get("/tickets/");
      const responseData = response?.data;

      setTickets(Array.isArray(responseData) ? responseData : []);
      setError("");
    } catch (err) {
      console.error("Fetch tickets error:", err?.response?.data || err);
      setError(
        getApiErrorMessage(err, "Unable to load tickets. Please try again.")
      );
      // Keep the existing page and any already loaded tickets visible.
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setFileError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    const extension = ALLOWED_EXTENSIONS.find((item) =>
      fileName.endsWith(item)
    );

    if (!extension) {
      setSelectedFile(null);
      setFileError("Only PDF, JPG, JPEG and PNG files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setFileError("The selected file is empty.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setSelectedFile(null);
      setFileError("Maximum attachment size is 10 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const resetForm = () => {
    setForm({
      subject: "",
      category: "Technical",
      description: "",
    });
    setSelectedFile(null);
    setFileError("");

    const input = document.getElementById("ticket-attachment");
    if (input) input.value = "";
  };

  // First create the ticket, then upload its optional attachment.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isAdmin) return;

    const subject = form.subject.trim();
    const description = form.description.trim();

    if (!subject || !description) {
      setError("Please enter both subject and description.");
      return;
    }

    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      // TicketCreate does not accept priority.
      // The backend sets the default priority to Medium.
      const createResponse = await API.post("/tickets/", {
        subject,
        category: form.category,
        description,
      });

      // Current backend returns { message, ticket: { id, ... } }.
      const responseData = createResponse?.data || {};
      const createdTicket =
        responseData.ticket || responseData.data?.ticket || responseData;

      const ticketId =
        createdTicket.id ||
        createdTicket._id ||
        createdTicket.ticket_id ||
        responseData.ticket_id;

      if (!ticketId) {
        // Ticket response did not contain an ID, so do not make an
        // attachment request to an undefined URL.
        setShowForm(false);
        resetForm();
        setSuccess(
          "Ticket was created, but the response did not include its ID. Refresh the list to verify it."
        );
        await fetchTickets({ showLoader: false });
        return;
      }

      let attachmentUploaded = false;
      let attachmentUploadMessage = "";

      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);

          await API.post(
            `/tickets/${ticketId}/attachments`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );

          attachmentUploaded = true;
        } catch (uploadError) {
          console.error(
            "Ticket attachment upload error:",
            uploadError?.response?.data || uploadError
          );

          attachmentUploadMessage = getApiErrorMessage(
            uploadError,
            "The ticket was created, but its attachment could not be uploaded."
          );
        }
      }

      // Keep the user on the Tickets page. Do not navigate to an
      // undefined ticket route after a successful submission.
      setShowForm(false);
      resetForm();

      if (selectedFile && !attachmentUploaded) {
        setSuccess(
          `Ticket created successfully. Attachment upload failed: ${attachmentUploadMessage}`
        );
      } else if (attachmentUploaded) {
        setSuccess("Ticket and attachment submitted successfully.");
      } else {
        setSuccess("Support ticket submitted successfully.");
      }

      await fetchTickets({ showLoader: false });
    } catch (err) {
      console.error("Create ticket error:", err?.response?.data || err);

      setError(
        getApiErrorMessage(
          err,
          "Unable to submit the support ticket. Please try again."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setFileError("");
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = [
      ticket.ticket_number,
      ticket.subject,
      ticket.category,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase().trim())
      );

    const matchesStatus =
      statusFilter === "All" || ticket.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const count = (status) =>
    tickets.filter((ticket) => ticket.status === status).length;

  return (
    <div className="tickets-page">
      <Sidebar role={user.role} />

      <main className="tickets-main">
        <Header />

        <div className="tickets-content">
          <section className="tickets-heading">
            <div>
              <span className="tickets-eyebrow">OMNI HELPDESK</span>
              <h1>{isAdmin ? "Helpdesk Management" : "My Support Tickets"}</h1>
              <p>
                {isAdmin
                  ? "Manage and resolve employee support requests."
                  : "Create and track your support requests."}
              </p>
            </div>

            {!isAdmin && (
              <button
                type="button"
                className="ticket-create-btn"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowForm(true);
                }}
              >
                <Plus size={18} />
                Create Ticket
              </button>
            )}
          </section>

          {error && (
            <div className="ticket-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="ticket-success" role="status">
              <CheckCircle size={18} />
              <span>{success}</span>
              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Dismiss success message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section className="ticket-stats">
            <article>
              <Ticket />
              <span>Total Tickets</span>
              <strong>{tickets.length}</strong>
            </article>

            <article>
              <Clock3 />
              <span>Open</span>
              <strong>{count("Open")}</strong>
            </article>

            <article>
              <AlertCircle />
              <span>In Progress</span>
              <strong>{count("In Progress")}</strong>
            </article>

            <article>
              <CheckCircle2 />
              <span>Resolved</span>
              <strong>{count("Resolved")}</strong>
            </article>
          </section>

          <section className="tickets-panel">
            <div className="tickets-toolbar">
              <div>
                <h2>{isAdmin ? "All Tickets" : "Your Tickets"}</h2>
                <p>View and track support requests</p>
              </div>

              <div className="tickets-filters">
                <div className="ticket-search">
                  <Search size={17} />
                  <input
                    placeholder="Search tickets..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>

                <button
                  type="button"
                  className="ticket-refresh"
                  onClick={() => fetchTickets()}
                  title="Refresh tickets"
                  disabled={loading}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="tickets-empty">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="tickets-empty">
                <MessageSquare size={35} />
                <h3>No tickets found</h3>
                <p>
                  {tickets.length === 0
                    ? "There are no support tickets yet."
                    : "Try changing your search or filter."}
                </p>
              </div>
            ) : (
              <div className="tickets-table-wrap">
                <table className="tickets-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Subject</th>
                      {isAdmin && <th>Employee</th>}
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTickets.map((ticket, index) => {
                      const ticketId = ticket.id || ticket._id;
                      const ticketNumber = ticket.ticket_number || "—";
                      const ticketSubject = ticket.subject || "Untitled ticket";

                      return (
                        <tr
                          key={ticketId || ticket.ticket_number || index}
                        >
                          <td>{ticketNumber}</td>
                          <td>
                            {ticketId ? (
                              <Link to={`/tickets/${ticketId}`}>
                                {ticketSubject}
                              </Link>
                            ) : (
                              <span>{ticketSubject}</span>
                            )}
                          </td>

                          {isAdmin && (
                            <td>
                              {ticket.employee_name ||
                                ticket.created_by_name ||
                                "—"}
                            </td>
                          )}

                          <td>{ticket.category || "—"}</td>
                          <td>
                            <span
                              className={`ticket-priority ${
                                ticket.priority?.toLowerCase() || ""
                              }`}
                            >
                              {ticket.priority || "Medium"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`ticket-status ${
                                ticket.status
                                  ?.toLowerCase()
                                  .replaceAll(" ", "-") || ""
                              }`}
                            >
                              {ticket.status || "Open"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {showForm && (
        <div
          className="ticket-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form className="ticket-modal" onSubmit={handleSubmit}>
            <div className="ticket-modal-heading">
              <div>
                <span>OMNI HELPDESK</span>
                <h2>Create Support Ticket</h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                disabled={submitting}
              >
                <X />
              </button>
            </div>

            <label htmlFor="ticket-subject">Subject</label>
            <input
              id="ticket-subject"
              type="text"
              value={form.subject}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  subject: event.target.value,
                }))
              }
              placeholder="Enter ticket subject"
              maxLength={150}
              required
              disabled={submitting}
            />

            <label htmlFor="ticket-category">Category</label>
            <select
              id="ticket-category"
              value={form.category}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  category: event.target.value,
                }))
              }
              disabled={submitting}
            >
              {["Technical", "Documents", "Profile", "Account", "Other"].map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                )
              )}
            </select>

            <div className="ticket-priority-note">
              Priority is automatically set to Medium.
            </div>

            <label htmlFor="ticket-description">Description</label>
            <textarea
              id="ticket-description"
              rows={5}
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="Describe your issue..."
              maxLength={5000}
              required
              disabled={submitting}
            />

            <div className="ticket-upload-field">
              <label htmlFor="ticket-attachment">Attachment (optional)</label>

              <div className="ticket-upload-control">
                <label
                  htmlFor="ticket-attachment"
                  className="ticket-attachment-button"
                >
                  <Paperclip size={17} />
                  <span>Choose file</span>
                </label>

                <input
                  id="ticket-attachment"
                  className="ticket-hidden-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={submitting}
                />

                <span className="ticket-file-name">
                  {selectedFile ? selectedFile.name : "No file selected"}
                </span>

                {selectedFile && (
                  <button
                    type="button"
                    className="ticket-remove-file"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileError("");
                      const input = document.getElementById("ticket-attachment");
                      if (input) input.value = "";
                    }}
                    disabled={submitting}
                    aria-label="Remove selected file"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <small>PDF, JPG, JPEG or PNG • Maximum file size 10 MB</small>

              {selectedFile && (
                <div className="ticket-selected-file">
                  <FileText size={15} />
                  <span>{selectedFile.name}</span>
                  <span>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              )}

              {fileError && (
                <p className="ticket-file-error" role="alert">
                  {fileError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="ticket-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Submitting ticket..." : "Submit Ticket"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Tickets;
