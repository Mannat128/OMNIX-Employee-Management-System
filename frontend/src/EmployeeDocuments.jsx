
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  Clock3,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  UserRound,
  CalendarDays,
  FolderOpen,
  ScanText,
  ShieldAlert,
  LoaderCircle,
} from "lucide-react";

import API from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import "./EmployeeDocuments.css";

const API_URL = API.defaults.baseURL;

// Helpers
function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(status) {
  return String(status || "pending").toLowerCase();
}

function getDocumentType(documentItem) {
  if (documentItem.custom_document_name) {
    return documentItem.custom_document_name;
  }

  return String(documentItem.document_type || "Other")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPhotoUrl(photo) {
  if (!photo || typeof photo !== "string") return "";

  if (/^https?:\/\//i.test(photo)) return photo;

  return `${API_URL}/${photo.replace(/^\/+/, "")}`;
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

// Download helper
function saveBlob(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "document";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(objectUrl);
}

// Recursive OCR value renderer
function OCRValue({ value }) {
  if (value === null || value === undefined || value === "") {
    return (
      <span className="ocr-empty-value">
        Not available
      </span>
    );
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return (
        <span className="ocr-empty-value">
          No data
        </span>
      );
    }

    return (
      <div className="ocr-value-list">
        {value.map((item, index) => (
          <span className="ocr-value-chip" key={index}>
            {typeof item === "object" && item !== null
              ? JSON.stringify(item)
              : String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="ocr-nested-object">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div className="ocr-nested-row" key={key}>
            <span className="ocr-field-label">
              {key.replaceAll("_", " ")}
            </span>

            <div className="ocr-field-value">
              <OCRValue value={nestedValue} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function EmployeeDocuments() {
  const { id } = useParams();
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const currentUser = getStoredUser();

  const isAdmin =
    String(currentUser.role || "").toLowerCase() === "admin";

  const [employee, setEmployee] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Handle expired login session
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  }, [navigate]);

  // Handle API errors consistently
  const handleApiError = useCallback(
    (err, fallbackMessage) => {
      const status = err.response?.status;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        throw new Error(
          err.response?.data?.detail ||
          "You do not have permission to access this resource."
        );
      }

      throw new Error(
        err.response?.data?.detail ||
        (err.code === "ERR_NETWORK"
          ? "Unable to connect to the backend server."
          : fallbackMessage)
      );
    },
    [handleUnauthorized]
  );

  // Fetch employee and document information
  const fetchPageData = useCallback(
    async (showLoader = true) => {
      if (!token) {
        handleUnauthorized();
        return;
      }

      if (!isAdmin) {
        setLoading(false);
        return;
      }

      try {
        if (showLoader) setLoading(true);

        setError("");

        const [employeeResponse, documentsResponse] =
          await Promise.all([
            API.get(`/employees/${id}`),
            API.get("/documents/"),
          ]);

        const employeeData = employeeResponse.data;

        const documentsData = documentsResponse.data;

        setEmployee(employeeData);

        const allDocuments = Array.isArray(documentsData)
          ? documentsData
          : documentsData.documents || [];

        // Backend employee_id is the employee MongoDB ObjectId.
        const employeeIds = [
          id,
          employeeData.id,
          employeeData._id,
        ]
          .filter(Boolean)
          .map(String);

        const employeeDocuments = allDocuments.filter((item) =>
          employeeIds.includes(String(item.employee_id || ""))
        );

        setDocuments(employeeDocuments);
      } catch (err) {
        try {
          handleApiError(
            err,
            "Unable to load employee documents."
          );
        } catch (handledError) {
          setError(handledError.message);
        }
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [id, token, isAdmin, handleUnauthorized, handleApiError]
  );

  useEffect(() => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    fetchPageData();
  }, [token, isAdmin, fetchPageData, handleUnauthorized]);

  // Automatically refresh while OCR is processing
  const hasProcessingDocuments = documents.some((item) =>
    ["pending", "processing"].includes(
      normalizeStatus(item.ocr_status)
    )
  );

  useEffect(() => {
    if (!isAdmin || !hasProcessingDocuments) return;

    const interval = window.setInterval(() => {
      fetchPageData(false);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isAdmin, hasProcessingDocuments, fetchPageData]);

  // View OCR result
  const handleViewOCR = async (documentItem) => {
    try {
      setSelectedDocument(documentItem);
      setOcrResult(null);
      setOcrLoading(true);
      setError("");
      setNotice("");

      const response = await API.get(
        `/ocr/results/${documentItem.id}`
      );

      setOcrResult(response.data);
    } catch (err) {
      try {
        handleApiError(err, "Unable to load OCR result.");
      } catch (handledError) {
        setError(handledError.message);
      }
    } finally {
      setOcrLoading(false);
    }
  };

  // Retry OCR
  const handleRetryOCR = async (documentItem) => {
    if (!documentItem?.id) return;

    try {
      setRetryLoading(true);
      setError("");
      setNotice("");

      const response = await API.post(
        `/ocr/retry/${documentItem.id}`
      );

      setNotice(
        response.data?.message ||
        "OCR processing has been queued successfully."
      );

      setOcrResult(null);

      setSelectedDocument((previous) =>
        previous?.id === documentItem.id
          ? { ...previous, ocr_status: "pending" }
          : previous
      );

      await fetchPageData(false);
    } catch (err) {
      try {
        handleApiError(err, "Unable to retry OCR processing.");
      } catch (handledError) {
        setError(handledError.message);
      }
    } finally {
      setRetryLoading(false);
    }
  };

  // Download original document
  const handleDownload = async (documentItem) => {
    try {
      setDownloadLoading(documentItem.id);
      setError("");

      const response = await API.get(
        `/documents/${documentItem.id}/download`,
        { responseType: "blob" }
      );

      saveBlob(
        response.data,
        documentItem.file_name || "document"
      );

      setNotice("Document downloaded successfully.");
    } catch (err) {
      try {
        handleApiError(err, "Unable to download the document.");
      } catch (handledError) {
        setError(handledError.message);
      }
    } finally {
      setDownloadLoading(null);
    }
  };

  // Export employee OCR results to Excel
  const handleExport = async () => {
    try {
      setExportLoading(true);
      setError("");
      setNotice("");

      const response = await API.get(
        `/ocr/export?format=xlsx&employee_id=${encodeURIComponent(id)}`,
        { responseType: "blob" }
      );

      saveBlob(
        response.data,
        `employee_${id}_ocr_results.xlsx`
      );

      setNotice("Excel report exported successfully.");
    } catch (err) {
      try {
        handleApiError(err, "Unable to export OCR results.");
      } catch (handledError) {
        setError(handledError.message);
      }
    } finally {
      setExportLoading(false);
    }
  };

  // Search and status filtering
  const filteredDocuments = useMemo(() => {
    const query = search.toLowerCase().trim();

    return documents.filter((item) => {
      const matchesSearch = [
        item.file_name,
        item.document_type,
        item.custom_document_name,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      const status = normalizeStatus(item.ocr_status);

      const matchesStatus =
        statusFilter === "All" ||
        status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [documents, search, statusFilter]);

  const completedCount = documents.filter(
    (item) =>
      normalizeStatus(item.ocr_status) === "completed"
  ).length;

  const processingCount = documents.filter((item) =>
    ["pending", "processing"].includes(
      normalizeStatus(item.ocr_status)
    )
  ).length;

  const failedCount = documents.filter(
    (item) =>
      normalizeStatus(item.ocr_status) === "failed"
  ).length;

  const closeOCRModal = () => {
    setSelectedDocument(null);
    setOcrResult(null);
    setOcrLoading(false);
  };

  const employeeName = employee?.name || "Employee";

  // Frontend Admin-only restriction
  if (!token) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="employee-documents-page">
        <main className="employee-documents-main">
          <section className="employee-details-state">
            <div className="employee-details-state-icon error">
              <ShieldAlert size={30} />
            </div>

            <h2>Access Restricted</h2>

            <p>
              This page is available only to Admin accounts.
            </p>

            <button
              type="button"
              className="employee-details-primary-btn"
              onClick={() =>
                navigate("/employee/dashboard", { replace: true })
              }
            >
              Go to Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="employee-documents-page">
      <Sidebar role="admin" />

      <main className="employee-documents-main">
        <Header />

        <div className="employee-documents-content">
          <button
            type="button"
            className="employee-documents-back"
            onClick={() => navigate("/employees")}
          >
            <ArrowLeft size={17} />
            Back to Employees
          </button>

          <section className="employee-documents-heading">
            <div>
              <span className="employee-documents-eyebrow">
                WORKFORCE / DOCUMENT MANAGEMENT
              </span>

              <h1>Employee Documents</h1>

              <p>
                Manage uploaded documents and review OCR extraction
                results for this employee.
              </p>
            </div>

            <button
              type="button"
              className="employee-export-btn"
              onClick={handleExport}
              disabled={exportLoading || documents.length === 0}
            >
              {exportLoading ? (
                <RefreshCw size={17} className="employee-spin" />
              ) : (
                <FileSpreadsheet size={17} />
              )}

              {exportLoading ? "Exporting..." : "Export Excel"}
            </button>
          </section>

          {error && (
            <div className="employee-doc-alert employee-doc-error">
              <AlertCircle size={17} />
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Close error"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div className="employee-doc-alert employee-doc-success">
              <CheckCircle2 size={17} />
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Close message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section className="employee-profile-card">
            <div className="employee-profile-avatar">
              {employee?.profile_photo ? (
                <img
                  src={getPhotoUrl(employee.profile_photo)}
                  alt={employee.name || "Employee"}
                />
              ) : (
                <UserRound size={28} />
              )}
            </div>

            <div className="employee-profile-info">
              <span>EMPLOYEE PROFILE</span>
              <h2>{loading ? "Loading..." : employeeName}</h2>
              <p>{employee?.email || "—"}</p>
            </div>

            <div className="employee-profile-meta">
              <div>
                <small>Employee ID</small>
                <strong>
                  {employee?.employee_id || id}
                </strong>
              </div>

              <div>
                <small>Department</small>
                <strong>{employee?.department || "—"}</strong>
              </div>

              <div>
                <small>Designation</small>
                <strong>{employee?.designation || "—"}</strong>
              </div>
            </div>
          </section>

          <section className="employee-doc-stats">
            <article className="employee-doc-stat">
              <div className="employee-doc-stat-icon total">
                <FolderOpen size={21} />
              </div>
              <div>
                <span>Total Documents</span>
                <h3>{loading ? "..." : documents.length}</h3>
              </div>
            </article>

            <article className="employee-doc-stat">
              <div className="employee-doc-stat-icon completed">
                <CheckCircle2 size={21} />
              </div>
              <div>
                <span>OCR Completed</span>
                <h3>{completedCount}</h3>
              </div>
            </article>

            <article className="employee-doc-stat">
              <div className="employee-doc-stat-icon processing">
                <Clock3 size={21} />
              </div>
              <div>
                <span>Processing</span>
                <h3>{processingCount}</h3>
              </div>
            </article>

            <article className="employee-doc-stat">
              <div className="employee-doc-stat-icon failed">
                <AlertCircle size={21} />
              </div>
              <div>
                <span>OCR Failed</span>
                <h3>{failedCount}</h3>
              </div>
            </article>
          </section>

          <section className="employee-documents-card">
            <div className="employee-documents-card-heading">
              <div>
                <span className="employee-documents-section-label">
                  DOCUMENT LIBRARY
                </span>

                <h2>Uploaded Documents</h2>

                <p>
                  View files, download originals and inspect extracted data.
                </p>
              </div>

              <button
                type="button"
                className="employee-doc-refresh"
                onClick={() => fetchPageData()}
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "employee-spin" : ""}
                />
                Refresh
              </button>
            </div>

            <div className="employee-documents-toolbar">
              <div className="employee-doc-search">
                <Search size={17} />

                <input
                  type="search"
                  placeholder="Search documents..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="All">All OCR Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="employee-documents-table-wrapper">
              <table className="employee-documents-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Upload Date</th>
                    <th>OCR Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="employee-doc-empty">
                        <LoaderCircle
                          size={22}
                          className="employee-spin"
                        />
                        Loading documents...
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="employee-doc-empty">
                        <div className="employee-doc-empty-state">
                          <FileText size={30} />
                          <h3>No documents found</h3>
                          <p>
                            No uploaded documents match this search.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((item) => {
                      const status = normalizeStatus(item.ocr_status);

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="employee-doc-file">
                              <div className="employee-doc-file-icon">
                                <FileText size={19} />
                              </div>

                              <div>
                                <strong>
                                  {item.file_name || "Unnamed file"}
                                </strong>

                                <small>
                                  {item.employee_name || employeeName}
                                </small>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="employee-doc-type">
                              {getDocumentType(item)}
                            </span>
                          </td>

                          <td>
                            <span className="employee-doc-date">
                              <CalendarDays size={14} />
                              {formatDate(item.upload_date)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`employee-ocr-status status-${status}`}
                            >
                              <span />
                              {status}
                            </span>
                          </td>

                          <td>
                            <div className="employee-doc-actions">
                              <button
                                type="button"
                                title="View OCR result"
                                onClick={() => handleViewOCR(item)}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Download original document"
                                onClick={() => handleDownload(item)}
                                disabled={downloadLoading === item.id}
                              >
                                {downloadLoading === item.id ? (
                                  <RefreshCw
                                    size={16}
                                    className="employee-spin"
                                  />
                                ) : (
                                  <Download size={16} />
                                )}
                              </button>

                              {status === "failed" && (
                                <button
                                  type="button"
                                  title="Retry OCR"
                                  onClick={() => handleRetryOCR(item)}
                                  disabled={retryLoading}
                                >
                                  <RefreshCw size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="employee-documents-footer">
              Showing {filteredDocuments.length} of {documents.length} documents
            </div>
          </section>
        </div>
      </main>

      {/* OCR result modal */}
      {selectedDocument && (
        <div
          className="employee-ocr-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOCRModal();
            }
          }}
        >
          <section
            className="employee-ocr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-ocr-title"
          >
            <div className="employee-ocr-modal-header">
              <div className="employee-ocr-modal-title">
                <div className="employee-ocr-modal-icon">
                  <ScanText size={22} />
                </div>

                <div>
                  <span>OCR EXTRACTION REPORT</span>
                  <h2 id="employee-ocr-title">
                    {selectedDocument.file_name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="employee-ocr-close"
                onClick={closeOCRModal}
                aria-label="Close OCR report"
              >
                <X size={20} />
              </button>
            </div>

            <div className="employee-ocr-modal-body">
              <div className="employee-ocr-document-info">
                <div>
                  <span>Employee</span>
                  <strong>{employeeName}</strong>
                </div>

                <div>
                  <span>Document Type</span>
                  <strong>
                    {getDocumentType(selectedDocument)}
                  </strong>
                </div>

                <div>
                  <span>Upload Date</span>
                  <strong>
                    {formatDate(selectedDocument.upload_date)}
                  </strong>
                </div>
              </div>

              {ocrLoading ? (
                <div className="employee-ocr-loading">
                  <RefreshCw
                    size={25}
                    className="employee-spin"
                  />
                  <p>Loading OCR extraction results...</p>
                </div>
              ) : ocrResult ? (
                <>
                  <div className="employee-ocr-result-heading">
                    <div>
                      <h3>Extracted Information</h3>
                      <p>
                        Information extracted from the uploaded document.
                      </p>
                    </div>

                    <span
                      className={`employee-ocr-status status-${normalizeStatus(
                        ocrResult.status
                      )}`}
                    >
                      <span />
                      {ocrResult.status || "Unknown"}
                    </span>
                  </div>

                  {ocrResult.error && (
                    <div className="employee-ocr-error">
                      <AlertCircle size={17} />
                      {ocrResult.error}
                    </div>
                  )}

                  {ocrResult.extracted_data &&
                  Object.keys(ocrResult.extracted_data).length > 0 ? (
                    <div className="employee-ocr-data">
                      <OCRValue value={ocrResult.extracted_data} />
                    </div>
                  ) : (
                    <div className="employee-ocr-no-data">
                      <FileText size={28} />
                      <h3>No extracted information</h3>
                      <p>
                        OCR has not returned structured information
                        for this document yet.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="employee-ocr-no-data">
                  <AlertCircle size={28} />
                  <h3>OCR result unavailable</h3>
                  <p>
                    The extraction result could not be loaded.
                  </p>
                </div>
              )}
            </div>

            <div className="employee-ocr-modal-footer">
              <button
                type="button"
                className="employee-ocr-secondary-btn"
                onClick={() => handleDownload(selectedDocument)}
                disabled={downloadLoading === selectedDocument.id}
              >
                <Download size={16} />
                Download Original
              </button>

              <button
                type="button"
                className="employee-ocr-secondary-btn"
                onClick={() => window.print()}
                disabled={ocrLoading || !ocrResult}
              >
                <Printer size={16} />
                Print / Save PDF
              </button>

              {normalizeStatus(selectedDocument.ocr_status) === "failed" && (
                <button
                  type="button"
                  className="employee-ocr-retry-btn"
                  onClick={() => handleRetryOCR(selectedDocument)}
                  disabled={retryLoading}
                >
                  <RefreshCw
                    size={16}
                    className={retryLoading ? "employee-spin" : ""}
                  />
                  Retry OCR
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default EmployeeDocuments;
