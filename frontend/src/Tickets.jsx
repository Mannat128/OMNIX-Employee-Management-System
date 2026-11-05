
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./Tickets.css";

function Tickets() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    subject: "",
    category: "Technical",
    priority: "Medium",
    description: "",
  });

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/tickets/");
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load tickets."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const resetForm = () => {
    setForm({
      subject: "",
      category: "Technical",
      priority: "Medium",
      description: "",
    });

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeForm = () => {
    if (submitting) return;

    setShowForm(false);
    resetForm();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
    const extension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setError("Only PDF, JPG, JPEG and PNG files are allowed.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Maximum attachment size is 10 MB.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      // Step 1: Create the ticket
      const response = await API.post("/tickets/", {
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
      });

      const createdTicket =
        response.data?.ticket || response.data;

      const ticketId =
        createdTicket?.id || createdTicket?._id;

      // Step 2: Upload attachment to the newly created ticket
      if (selectedFile) {
        if (!ticketId) {
          setShowForm(false);
          resetForm();
          await fetchTickets();

          setError(
            "Ticket was created, but its ID was not returned. Attachment could not be uploaded."
          );
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
          await API.post(
            `/tickets/${ticketId}/attachments`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        } catch (uploadError) {
          const uploadMessage =
            uploadError.response?.data?.detail ||
            "Please try uploading the attachment again.";

          setShowForm(false);
          resetForm();

          await fetchTickets();

          setError(
            `Ticket created successfully, but attachment upload failed: ${uploadMessage}`
          );
          return;
        }
      }

      // Step 3: Reset form and refresh tickets
      resetForm();
      setShowForm(false);

      await fetchTickets();

    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to create ticket."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = [
      ticket.ticket_number,
      ticket.subject,
      ticket.category,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase())
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
                className="ticket-create-btn"
                onClick={() => setShowForm(true)}
              >
                <Plus size={18} /> Create Ticket
              </button>
            )}
          </section>

          {error && (
            <div className="ticket-error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss">
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
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option>All</option>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                </select>

                <button
                  className="ticket-refresh"
                  onClick={fetchTickets}
                  title="Refresh tickets"
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
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.id || ticket._id || ticket.ticket_number}>
                        <td>{ticket.ticket_number || "—"}</td>

                        <td>
                          <Link to={`/tickets/${ticket.id || ticket._id}`}>
                            {ticket.subject}
                          </Link>
                        </td>

                        {isAdmin && (
                          <td>
                            {ticket.employee_name || ticket.created_by_name || "—"}
                          </td>
                        )}

                        <td>{ticket.category}</td>

                        <td>
                          <span className={`ticket-priority ${ticket.priority?.toLowerCase()}`}>
                            {ticket.priority}
                          </span>
                        </td>

                        <td>
                          <span className={`ticket-status ${ticket.status?.toLowerCase().replaceAll(" ", "-")}`}>
                            {ticket.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {showForm && (
        <div className="ticket-modal-backdrop">
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

            <label>Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Enter ticket subject"
              maxLength={150}
              required
            />

            <div className="ticket-form-grid">
              <div>
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {["Technical", "Documents", "Profile", "Account", "Other"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {["Low", "Medium", "High", "Urgent"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            <label>Description</label>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your issue..."
              maxLength={5000}
              required
            />

            <label>Attachment (Optional)</label>

            <div className="ticket-file-upload">
              <label className="ticket-file-select">
                <Paperclip size={18} />
                <span>{selectedFile ? "Change File" : "Choose File"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>

              <small>PDF, JPG, JPEG or PNG · Maximum 10 MB</small>
            </div>

            {selectedFile && (
              <div className="ticket-selected-file">
                <FileText size={19} />

                <div>
                  <strong>{selectedFile.name}</strong>
                  <small>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </small>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={submitting}
                  aria-label="Remove attachment"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Tickets;
