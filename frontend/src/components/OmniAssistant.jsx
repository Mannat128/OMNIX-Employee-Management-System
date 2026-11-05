
import { useEffect, useState } from "react";
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

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "employee";
  const isAdmin = role.toLowerCase() === "admin";

  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "Technical",
    priority: "Medium",
    description: "",
  });

  const handleSend = (e) => {
    e.preventDefault();

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

  const openMyTickets = async () => {
    setActiveView("tickets");
    setTicketError("");
    setTicketSuccess("");
    setTicketsLoading(true);

    try {
      const response = await API.get("/tickets/");
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setTicketError(
        err.response?.data?.detail || "Unable to load your tickets."
      );
    } finally {
      setTicketsLoading(false);
    }
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
      setTicketError("Only PDF, JPG, JPEG and PNG files are allowed.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setTicketError("Maximum attachment size is 10 MB.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setTicketError("");
    setSelectedFile(file);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setTicketError("");
      setTicketSuccess("");

      // Create ticket first
      const response = await API.post("/tickets/", {
        subject: ticketForm.subject.trim(),
        category: ticketForm.category,
        priority: ticketForm.priority,
        description: ticketForm.description.trim(),
      });

      const createdTicket = response.data?.ticket || response.data;
      const ticketId = createdTicket?.id || createdTicket?._id;

      // Upload attachment if selected
      if (selectedFile) {
        if (!ticketId) {
          setTicketError(
            "Ticket was created, but its ID was not returned. Attachment could not be uploaded."
          );
          setTicketSuccess("Ticket created successfully.");
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
          setTicketSuccess("Ticket created successfully.");
          setTicketError(
            `Attachment upload failed: ${
              uploadError.response?.data?.detail ||
              "Please try again from the ticket details page."
            }`
          );
          return;
        }
      }

      setTicketForm({
        subject: "",
        category: "Technical",
        priority: "Medium",
        description: "",
      });

      setSelectedFile(null);
      setTicketSuccess("Your support ticket has been created successfully.");
      setActiveView("success");

    } catch (err) {
      setTicketError(
        err.response?.data?.detail || "Unable to create your ticket."
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
                <p>Describe your issue and our Admin team will assist you.</p>

                {ticketError && (
                  <div className="omni-ticket-error">
                    {ticketError}
                  </div>
                )}

                <form
                  className="omni-ticket-form"
                  onSubmit={handleCreateTicket}
                >
                  <label>Subject</label>
                  <input
                    value={ticketForm.subject}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Enter ticket subject"
                    maxLength={150}
                    required
                  />

                  <div className="omni-ticket-grid">
                    <div>
                      <label>Category</label>
                      <select
                        value={ticketForm.category}
                        onChange={(e) =>
                          setTicketForm({
                            ...ticketForm,
                            category: e.target.value,
                          })
                        }
                      >
                        {["Technical", "Documents", "Profile", "Account", "Other"].map(
                          (item) => (
                            <option key={item}>{item}</option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label>Priority</label>
                      <select
                        value={ticketForm.priority}
                        onChange={(e) =>
                          setTicketForm({
                            ...ticketForm,
                            priority: e.target.value,
                          })
                        }
                      >
                        {["Low", "Medium", "High", "Urgent"].map(
                          (item) => (
                            <option key={item}>{item}</option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <label>Description</label>
                  <textarea
                    rows={4}
                    value={ticketForm.description}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe your issue..."
                    maxLength={5000}
                    required
                  />

                  <label className="omni-file-label">
                    <Paperclip size={16} /> Attachment (Optional)
                  </label>

                  <input
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
                        onClick={() => setSelectedFile(null)}
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
                        <LoaderCircle size={17} className="omni-loading-icon" />
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
                  <div className="omni-ticket-error">
                    {ticketError}
                  </div>
                )}

                {ticketsLoading ? (
                  <div className="omni-ticket-empty">
                    <LoaderCircle className="omni-loading-icon" size={24} />
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
                    {tickets.map((ticket) => (
                      <button
                        type="button"
                        className="omni-ticket-item"
                        key={ticket.id || ticket._id || ticket.ticket_number}
                        onClick={() => openTicketDetails(ticket)}
                      >
                        <div className="omni-ticket-item-top">
                          <strong>
                            {ticket.ticket_number || "Support Ticket"}
                          </strong>
                          <span className={`omni-ticket-status ${ticket.status?.toLowerCase().replaceAll(" ", "-")}`}>
                            {ticket.status || "Open"}
                          </span>
                        </div>

                        <h4>{ticket.subject}</h4>

                        <div className="omni-ticket-meta">
                          <span>{ticket.category || "General"}</span>
                          <span>{ticket.priority || "Medium"} Priority</span>
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
                onChange={(e) => setMessage(e.target.value)}
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
            OMNIX EMS · {role.toUpperCase()} WORKSPACE
          </div>

        </section>
      )}
    </div>
  );
}

export default OmniAssistant;
