import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Send,
  Minus,
  Sparkles,
  MessageCircle,
  Ticket,
  ListChecks,
  ArrowLeft,
  Paperclip,
  FileText,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";

import API from "../api";
import "./OmniAssistant.css";

// Convert FastAPI/Axios errors into a plain string.
// Never pass FastAPI's detail array/object directly into JSX.
const getApiErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  const status = error?.response?.status;

  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === "string") return item;

      const location = Array.isArray(item?.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";

      const message =
        item?.msg || item?.message || "Invalid value";

      return location ? `${location}: ${message}` : String(message);
    });

    return messages.join(" | ") || fallback;
  }

  if (typeof detail === "string") return detail;

  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.msg === "string") return detail.msg;
  }

  if (status === 401) {
    return "Your session has expired. Please log out and sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  return fallback;
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function OmniAssistant() {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [activeView, setActiveView] = useState("home");
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const user = readStoredUser();
  const role = user.role || "employee";
  const isAdmin = String(role).toLowerCase() === "admin";

  // The backend assigns Medium priority automatically.
  // Do not send a priority field in the ticket-create request.
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "Technical",
    description: "",
  });

  const handleSend = (event) => {
    event.preventDefault();

    const text = message.trim();
    if (!text) return;

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        text,
        sender: "user",
      },
    ]);

    setMessage("");
  };

  const resetTicketForm = () => {
    setTicketForm({
      subject: "",
      category: "Technical",
      description: "",
    });
    setSelectedFile(null);

    const fileInput = document.getElementById("omni-ticket-attachment");
    if (fileInput) fileInput.value = "";
  };

  const openMyTickets = async () => {
    setActiveView("tickets");
    setTicketError("");
    setTicketSuccess("");
    setTicketsLoading(true);

    try {
      const response = await API.get("/tickets/");
      const data = response?.data;

      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "OMNI fetch tickets error:",
        error?.response?.data || error
      );

      setTicketError(
        getApiErrorMessage(error, "Unable to load your tickets.")
      );
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) =>
      fileName.endsWith(extension)
    );

    if (!hasAllowedExtension) {
      setTicketError("Only PDF, JPG, JPEG and PNG files are allowed.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setTicketError("The selected file is empty.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setTicketError("Maximum attachment size is 10 MB.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setTicketError("");
    setSelectedFile(file);
  };

  const handleCreateTicket = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const subject = ticketForm.subject.trim();
    const description = ticketForm.description.trim();
    const fileToUpload = selectedFile;

    if (!subject || !description) {
      setTicketError("Please enter both subject and description.");
      return;
    }

    try {
      setSubmitting(true);
      setTicketError("");
      setTicketSuccess("");

      // Keep this payload identical to the working Create Ticket form.
      // TicketCreate accepts subject, category and description only.
      // The backend sets priority to Medium automatically.
      const payload = {
        subject,
        category: ticketForm.category,
        description,
      };

      console.log("OMNI submitting ticket payload:", payload);

      const response = await API.post("/tickets/", payload);

      const responseData = response?.data || {};
      const createdTicket =
        responseData.ticket ||
        responseData.data?.ticket ||
        responseData;

      const ticketId =
        createdTicket?.id ||
        createdTicket?._id ||
        createdTicket?.ticket_id ||
        responseData.ticket_id;

      let successMessage = "Your support ticket has been created successfully.";

      // Upload the optional attachment only after the ticket is created.
      if (fileToUpload) {
        if (!ticketId) {
          successMessage =
            "Your ticket was created successfully, but the server did not return its ID, so the attachment could not be uploaded.";
        } else {
          try {
            const formData = new FormData();
            formData.append("file", fileToUpload);

            await API.post(
              `/tickets/${ticketId}/attachments`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );

            successMessage =
              "Your support ticket and attachment have been submitted successfully.";
          } catch (uploadError) {
            console.error(
              "OMNI attachment upload error:",
              uploadError?.response?.data || uploadError
            );

            const uploadMessage = getApiErrorMessage(
              uploadError,
              "Please try uploading it from the ticket details page."
            );

            successMessage =
              `Your ticket was created successfully, but the attachment could not be uploaded. ${uploadMessage}`;
          }
        }
      }

      resetTicketForm();
      setTicketSuccess(successMessage);
      setTicketError("");
      setActiveView("success");
    } catch (error) {
      console.error(
        "OMNI create ticket error:",
        error?.response?.data || error
      );

      setTicketError(
        getApiErrorMessage(error, "Unable to create your ticket.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openTicketDetails = (ticket) => {
    const ticketId = ticket.id || ticket._id;

    if (!ticketId) {
      setTicketError("Ticket details are unavailable.");
      return;
    }

    setIsOpen(false);
    navigate(`/tickets/${ticketId}`);
  };

  const goToHelpdesk = () => {
    setIsOpen(false);
    navigate("/tickets");
  };

  const startRaiseTicket = () => {
    setTicketError("");
    setTicketSuccess("");
    setSelectedFile(null);
    setActiveView("raise");
  };

  const goHome = () => {
    setActiveView("home");
    setTicketError("");
    setTicketSuccess("");
  };

  return (
    <div className="omni-assistant">
      {/* Floating Robot Launcher */}
      {!isOpen && (
        <button
          type="button"
          className="omni-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open OMNI AI assistant"
        >
          <img src="/omni-robot.png" alt="OMNI AI Robot" />
          <span className="omni-launcher-indicator" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <section className="omni-chat-panel">
          {/* Header */}
          <div className="omni-chat-header">
            <div className="omni-chat-brand">
              <div className="omni-chat-avatar">
                <img src="/omni-robot.png" alt="OMNI Robot" />
              </div>

              <div>
                <h3>OMNI Assistant</h3>
                <span>
                  <i />
                  Your AI Support Buddy
                </span>
              </div>
            </div>

            <div className="omni-chat-header-actions">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize chat"
              >
                <Minus size={19} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="omni-chat-body">
            {/* Home View */}
            {activeView === "home" && (
              <>
                <div className="omni-welcome">
                  <div className="omni-welcome-robot">
                    <img src="/omni-robot.png" alt="OMNI Robot" />
                  </div>

                  <div className="omni-welcome-label">
                    <Sparkles size={14} />
                    OMNIX SMART ASSISTANT
                  </div>

                  <h2>
                    Hey{user.name ? `, ${user.name.split(" ")[0]}` : ""}!
                    <br />
                    How can I help?
                  </h2>

                  <p>
                    I'm OMNI, your support companion.
                    Choose an option below to get started.
                  </p>
                </div>

                <div className="omni-quick-actions">
                  {!isAdmin ? (
                    <>
                      <button
                        type="button"
                        className="omni-action-card"
                        onClick={startRaiseTicket}
                      >
                        <span className="omni-action-icon">
                          <Ticket size={20} />
                        </span>
                        <span>
                          <strong>Raise a Ticket</strong>
                          <small>Report an issue to Admin</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="omni-action-card"
                        onClick={openMyTickets}
                      >
                        <span className="omni-action-icon">
                          <ListChecks size={20} />
                        </span>
                        <span>
                          <strong>My Tickets</strong>
                          <small>Track your support requests</small>
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="omni-action-card"
                      onClick={goToHelpdesk}
                    >
                      <span className="omni-action-icon">
                        <Ticket size={20} />
                      </span>
                      <span>
                        <strong>Manage Tickets</strong>
                        <small>View and respond to support requests</small>
                      </span>
                      <ExternalLink size={16} />
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Raise Ticket View */}
            {activeView === "raise" && (
              <div className="omni-ticket-view">
                <button
                  type="button"
                  className="omni-back-button"
                  onClick={goHome}
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <h3>Raise a Support Ticket</h3>
                <p>
                  Describe your issue and our Admin team will assist you.
                </p>

                {ticketError && (
                  <div className="omni-ticket-error" role="alert">
                    {ticketError}
                  </div>
                )}

                <form
                  className="omni-ticket-form"
                  onSubmit={handleCreateTicket}
                >
                  <label htmlFor="omni-ticket-subject">Subject</label>
                  <input
                    id="omni-ticket-subject"
                    value={ticketForm.subject}
                    onChange={(event) =>
                      setTicketForm((previous) => ({
                        ...previous,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="Enter ticket subject"
                    maxLength={150}
                    required
                    disabled={submitting}
                  />

                  <div className="omni-ticket-grid">
                    <div>
                      <label htmlFor="omni-ticket-category">Category</label>
                      <select
                        id="omni-ticket-category"
                        value={ticketForm.category}
                        onChange={(event) =>
                          setTicketForm((previous) => ({
                            ...previous,
                            category: event.target.value,
                          }))
                        }
                        disabled={submitting}
                      >
                        {[
                          "Technical",
                          "Documents",
                          "Profile",
                          "Account",
                          "Other",
                        ].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="omni-ticket-priority">
                        Priority
                      </label>
                      <input
                        id="omni-ticket-priority"
                        value="Medium (automatic)"
                        readOnly
                        aria-readonly="true"
                      />
                    </div>
                  </div>

                  <label htmlFor="omni-ticket-description">
                    Description
                  </label>
                  <textarea
                    id="omni-ticket-description"
                    rows={4}
                    value={ticketForm.description}
                    onChange={(event) =>
                      setTicketForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe your issue..."
                    maxLength={5000}
                    required
                    disabled={submitting}
                  />

                  <label className="omni-file-label" htmlFor="omni-ticket-attachment">
                    <Paperclip size={16} /> Attachment (Optional)
                  </label>

                  <input
                    id="omni-ticket-attachment"
                    className="omni-file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />

                  {selectedFile && (
                    <div className="omni-selected-file">
                      <FileText size={17} />
                      <span>{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          const fileInput = document.getElementById(
                            "omni-ticket-attachment"
                          );
                          if (fileInput) fileInput.value = "";
                        }}
                        disabled={submitting}
                        aria-label="Remove file"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  <small className="omni-file-hint">
                    PDF, JPG, JPEG or PNG · Maximum 10 MB
                  </small>

                  <button
                    type="submit"
                    className="omni-ticket-submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="omni-loading-icon"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Submit Ticket
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* My Tickets View */}
            {activeView === "tickets" && (
              <div className="omni-ticket-view">
                <button
                  type="button"
                  className="omni-back-button"
                  onClick={goHome}
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <h3>My Support Tickets</h3>
                <p>Track the status of your support requests.</p>

                {ticketError && (
                  <div className="omni-ticket-error" role="alert">
                    {ticketError}
                  </div>
                )}

                {ticketsLoading ? (
                  <div className="omni-ticket-empty">
                    <LoaderCircle
                      className="omni-loading-icon"
                      size={24}
                    />
                    Loading your tickets...
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="omni-ticket-empty">
                    <Ticket size={30} />
                    <strong>No tickets yet</strong>
                    <span>Your support tickets will appear here.</span>
                    <button
                      type="button"
                      onClick={startRaiseTicket}
                    >
                      Raise Your First Ticket
                    </button>
                  </div>
                ) : (
                  <div className="omni-ticket-list">
                    {tickets.map((ticket, index) => (
                      <button
                        type="button"
                        className="omni-ticket-item"
                        key={
                          ticket.id ||
                          ticket._id ||
                          ticket.ticket_number ||
                          index
                        }
                        onClick={() => openTicketDetails(ticket)}
                      >
                        <div className="omni-ticket-item-top">
                          <strong>
                            {ticket.ticket_number || "Support Ticket"}
                          </strong>
                          <span
                            className={`omni-ticket-status ${
                              ticket.status
                                ?.toLowerCase()
                                .replaceAll(" ", "-") || ""
                            }`}
                          >
                            {ticket.status || "Open"}
                          </span>
                        </div>

                        <h4>{ticket.subject || "Untitled ticket"}</h4>

                        <div className="omni-ticket-meta">
                          <span>{ticket.category || "General"}</span>
                          <span>
                            {ticket.priority || "Medium"} Priority
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ticket Creation Success */}
            {activeView === "success" && (
              <div className="omni-ticket-success">
                <div className="omni-success-icon">
                  <Ticket size={28} />
                </div>

                <h3>Ticket Created!</h3>
                <p>{ticketSuccess}</p>

                <button
                  type="button"
                  onClick={openMyTickets}
                >
                  <ListChecks size={16} /> View My Tickets
                </button>

                <button
                  type="button"
                  className="omni-secondary-action"
                  onClick={goHome}
                >
                  Back to Home
                </button>
              </div>
            )}

            {/* User Messages */}
            {activeView === "home" && (
              <div className="omni-messages">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`omni-message ${item.sender}`}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input: Home View Only */}
          {activeView === "home" && (
            <form
              className="omni-chat-input"
              onSubmit={handleSend}
            >
              <input
                type="text"
                placeholder="Message OMNI..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                aria-label="Message OMNI"
              />

              <button
                type="submit"
                disabled={!message.trim()}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          )}

          <div className="omni-chat-footer">
            <MessageCircle size={12} />
            OMNIX EMS · {String(role).toUpperCase()} WORKSPACE
          </div>
        </section>
      )}
    </div>
  );
}

export default OmniAssistant;
