
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Documents.css";

const API_URL = "http://127.0.0.1:8000";

function Documents() {
  const navigate = useNavigate();

  const [documentType, setDocumentType] = useState("resume");
  const [selectedFile, setSelectedFile] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("access_token");

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchDocuments();

    if (isAdmin) {
      fetchEmployees();
    }
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/documents/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);

      if (response.status === 401 || response.status === 403) {
        throw new Error("Please login again to access documents.");
      }

      if (!response.ok) {
        throw new Error("Unable to load documents.");
      }

      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/employees/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Unable to load employees:", err);
    }
  };

  // Validate selected file
  const handleFileChange = (e) => {
    const file = e.target.files[0];

    setSelectedFile(null);
    setFileError("");
    setError("");
    setSuccess("");

    if (!file) return;

    const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];
    const extension = file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setFileError(
        "Invalid file type! Please upload PDF, JPG, JPEG or PNG."
      );
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError("File size must not exceed 10 MB.");
      e.target.value = "";
      return;
    }

    if (file.size === 0) {
      setFileError("Empty files cannot be uploaded.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (fileError) return;

    if (!selectedFile) {
      setFileError("Please select a valid document.");
      return;
    }

    if (isAdmin && !employeeId) {
      setError("Please select an employee.");
      return;
    }

    const formData = new FormData();

    formData.append("document_type", documentType);
    formData.append("file", selectedFile);

    if (isAdmin) {
      formData.append("employee_id", employeeId);
    }

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        throw new Error(result.detail || "You are not authorized.");
      }

      if (!response.ok) {
        throw new Error(result.detail || "Document upload failed.");
      }

      setSuccess("Document uploaded successfully!");
      setSelectedFile(null);
      setDocumentType("resume");
      setEmployeeId("");

      const fileInput = document.getElementById("documentFile");

      if (fileInput) {
        fileInput.value = "";
      }

      await fetchDocuments();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  // Download document
  const handleDownload = async (doc) => {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/documents/${doc.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Unable to download document.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");

      link.href = url;
      link.download = doc.file_name;
      window.document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Download failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="documents-page">
      <aside className="documents-sidebar">
        <div className="documents-brand">
          <span className="documents-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="documents-menu-title">MAIN MENU</p>

        <nav className="documents-nav">
          <a href={isAdmin ? "/admin/dashboard" : "/employee/dashboard"}>
            ▦ Dashboard
          </a>

          {isAdmin && <a href="/employees">♙ Employees</a>}

          {isAdmin && <a href="/admin/approvals">◷ Approvals</a>}

          <a href="/documents" className="active">▤ Documents</a>

          <a href={isAdmin ? "/admin/settings" : "/employee/settings"}>
            ⚙ Settings
          </a>
        </nav>

        <button
          type="button"
          className="documents-logout"
          onClick={handleLogout}
        >
          ↪ Logout
        </button>
      </aside>

      <main className="documents-main">
        <header className="documents-header">
          <div>
            <h1>Document Management</h1>
            <p>Upload and manage employee documents securely.</p>
          </div>
        </header>

        <section className="documents-upload-card">
          <div className="documents-card-heading">
            <h2>Upload Document</h2>
            <p>Select a document type and choose a file to upload.</p>
          </div>

          <form className="documents-form" onSubmit={handleSubmit}>
            {isAdmin && (
              <div className="documents-form-group">
                <label htmlFor="employeeSelect">Select Employee</label>

                <select
                  id="employeeSelect"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Select an employee</option>

                  {employees.map((employee) => (
                    <option
                      key={employee._id || employee.id}
                      value={employee._id || employee.id}
                    >
                      {employee.name} ({employee.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="documents-form-group">
              <label htmlFor="documentType">Document Type</label>

              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="resume">Resume</option>
                <option value="id">ID Proof</option>
                <option value="certificate">Certificate</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="documents-form-group">
              <label htmlFor="documentFile">Choose Document</label>

              <input
                id="documentFile"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                required
              />

              <small>
                Supported formats: PDF, JPG and PNG. Maximum size: 10 MB.
              </small>

              {fileError && (
                <p className="documents-error" role="alert">
                  {fileError}
                </p>
              )}
            </div>

            {selectedFile && (
              <div className="selected-document">
                <span>▤</span>

                <div>
                  <strong>{selectedFile.name}</strong>

                  <small>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </small>
                </div>
              </div>
            )}

            {error && (
              <p className="documents-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="documents-success" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="documents-upload-btn"
              disabled={uploading || !selectedFile || !!fileError}
            >
              {uploading ? "Uploading..." : "Upload Document →"}
            </button>
          </form>
        </section>

        <section className="documents-list-card">
          <div className="documents-list-heading">
            <div>
              <h2>Uploaded Documents</h2>
              <p>View and download available documents.</p>
            </div>
          </div>

          {loading ? (
            <div className="documents-empty-state">
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="documents-empty-state">
              <div>▤</div>
              <h3>No documents available</h3>
              <p>Uploaded documents will appear here.</p>
            </div>
          ) : (
            <div className="documents-table-wrapper">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    {isAdmin && <th>Employee</th>}
                    <th>Document Type</th>
                    <th>Upload Date</th>
                    <th>OCR Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.file_name}</td>

                      {isAdmin && (
                        <td>
                          {doc.employee_name || doc.employee_email || "—"}
                        </td>
                      )}

                      <td>{doc.document_type}</td>

                      <td>
                        {doc.upload_date
                          ? new Date(doc.upload_date).toLocaleDateString()
                          : "—"}
                      </td>

                      <td>{doc.ocr_status || "—"}</td>

                      <td>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Documents;
