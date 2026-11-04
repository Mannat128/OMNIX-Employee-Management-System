
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Upload,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  FolderOpen,
  Eye,
  X,
  User,
  Briefcase,
  GraduationCap,
  ScanText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Building2,
  CalendarDays,
  ShieldCheck,
  Mail,
  Phone
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import "./Documents.css";

const API_URL = "http://127.0.0.1:8000";

const DOCUMENT_TYPES = [
  { value: "resume", label: "Resume" },
  { value: "id", label: "ID Proof" },
  { value: "certificate", label: "Certificate" },
  { value: "other", label: "Other" }
];


function Documents() {

  const navigate = useNavigate();

  // --------------------------------
  // AUTHENTICATION
  // --------------------------------

  const token = localStorage.getItem("access_token");

  let currentUser = {};

  try {
    currentUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    currentUser = {};
  }

  const isAdmin = currentUser.role === "admin";

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };


  // --------------------------------
  // UPLOAD STATES
  // --------------------------------

  const [documentType, setDocumentType] = useState("resume");

  const [customDocumentName, setCustomDocumentName] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);

  const [employeeId, setEmployeeId] = useState("");


  // --------------------------------
  // DATA STATES
  // --------------------------------

  const [employees, setEmployees] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [loading, setLoading] = useState(true);


  // --------------------------------
  // ACTION STATES
  // --------------------------------

  const [uploading, setUploading] = useState(false);

  const [downloadingId, setDownloadingId] = useState(null);

  const [retryingId, setRetryingId] = useState(null);

  const [exporting, setExporting] = useState("");


  // --------------------------------
  // MESSAGE STATES
  // --------------------------------

  const [error, setError] = useState("");

  const [fileError, setFileError] = useState("");

  const [success, setSuccess] = useState("");


  // --------------------------------
  // OCR MODAL STATES
  // --------------------------------

  const [showOCRModal, setShowOCRModal] = useState(false);

  const [ocrResult, setOcrResult] = useState(null);

  const [ocrLoading, setOcrLoading] = useState(false);

  const [ocrError, setOcrError] = useState("");

  const [showOriginalText, setShowOriginalText] = useState(false);


  // --------------------------------
  // FETCH DOCUMENTS
  // --------------------------------

  const fetchDocuments = useCallback(async (silent = false) => {

    try {

      if (!silent) {
        setLoading(true);
      }

      const response = await fetch(
        `${API_URL}/documents/`,
        {
          headers: authHeaders
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load documents."
        );
      }

      setDocuments(
        Array.isArray(data) ? data : []
      );

      setError("");

    } catch (err) {

      if (!silent) {
        setError(err.message);
      }

    } finally {

      if (!silent) {
        setLoading(false);
      }

    }

  }, [token]);


  // --------------------------------
  // FETCH EMPLOYEES FOR ADMIN
  // --------------------------------

  const fetchEmployees = useCallback(async () => {

    if (!isAdmin) return;

    try {

      const response = await fetch(
        `${API_URL}/employees/`,
        {
          headers: authHeaders
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load employees."
        );
      }

      setEmployees(
        Array.isArray(data) ? data : []
      );

    } catch (err) {

      setError(err.message);

    }

  }, [token, isAdmin]);


  // --------------------------------
  // INITIAL LOAD
  // --------------------------------

  useEffect(() => {

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    fetchDocuments();
    fetchEmployees();

  }, [
    token,
    navigate,
    fetchDocuments,
    fetchEmployees
  ]);


  // --------------------------------
  // AUTOMATIC OCR STATUS REFRESH
  // --------------------------------

  useEffect(() => {

    const hasActiveOCR = documents.some((doc) => {

      const status = (
        doc.ocr_status || ""
      ).toLowerCase();

      return (
        status === "pending" ||
        status === "processing"
      );

    });

    if (!hasActiveOCR) return;

    const intervalId = setInterval(() => {
      fetchDocuments(true);
    }, 5000);

    return () => clearInterval(intervalId);

  }, [documents, fetchDocuments]);


  // --------------------------------
  // FILE SELECTION
  // --------------------------------

  const handleFileChange = (event) => {

    const file = event.target.files?.[0];

    setFileError("");
    setSuccess("");
    setError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png"
    ];

    if (!allowedTypes.includes(file.type)) {

      setFileError(
        "Only PDF, JPG, JPEG and PNG files are allowed."
      );

      setSelectedFile(null);
      event.target.value = "";

      return;
    }

    if (file.size > 10 * 1024 * 1024) {

      setFileError(
        "Maximum file size is 10 MB."
      );

      setSelectedFile(null);
      event.target.value = "";

      return;
    }

    setSelectedFile(file);

  };


  // --------------------------------
  // DOCUMENT TYPE CHANGE
  // --------------------------------

  const handleDocumentTypeChange = (event) => {

    setDocumentType(event.target.value);

    setCustomDocumentName("");

    setFileError("");
    setSuccess("");
    setError("");

  };


  // --------------------------------
  // UPLOAD DOCUMENT
  // --------------------------------

  const handleUpload = async (event) => {

    event.preventDefault();

    setError("");
    setFileError("");
    setSuccess("");

    if (!selectedFile) {

      setFileError(
        "Please select a document first."
      );

      return;
    }

    if (
      ["id", "other"].includes(documentType) &&
      !customDocumentName.trim()
    ) {

      setFileError(
        "Please enter the document name."
      );

      return;
    }

    if (isAdmin && !employeeId) {

      setFileError(
        "Please select an employee."
      );

      return;
    }

    try {

      setUploading(true);

      const formData = new FormData();

      formData.append(
        "document_type",
        documentType
      );

      formData.append(
        "file",
        selectedFile
      );

      if (["id", "other"].includes(documentType)) {

        formData.append(
          "custom_document_name",
          customDocumentName.trim()
        );

      }

      if (isAdmin) {

        formData.append(
          "employee_id",
          employeeId
        );

      }

      const response = await fetch(
        `${API_URL}/documents/upload`,
        {
          method: "POST",
          headers: authHeaders,
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail || "Document upload failed."
        );

      }

      setSuccess(
        "Document uploaded successfully. OCR processing has been scheduled."
      );

      setSelectedFile(null);

      setCustomDocumentName("");

      setDocumentType("resume");

      setEmployeeId("");

      const fileInput = document.getElementById(
        "document-file"
      );

      if (fileInput) {
        fileInput.value = "";
      }

      await fetchDocuments();

    } catch (err) {

      setError(err.message);

    } finally {

      setUploading(false);

    }

  };


  // --------------------------------
  // DOWNLOAD DOCUMENT
  // --------------------------------

  const handleDownload = async (doc) => {

    try {

      setDownloadingId(doc.id);

      setError("");

      const response = await fetch(
        `${API_URL}/documents/${doc.id}/download`,
        {
          headers: authHeaders
        }
      );

      if (!response.ok) {
        throw new Error("Document download failed.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = doc.file_name || "document";

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {

      setError(err.message);

    } finally {

      setDownloadingId(null);

    }

  };


  // --------------------------------
  // VIEW OCR RESULT
  // --------------------------------

  const handleViewOCR = async (doc) => {

    try {

      setShowOCRModal(true);

      setOcrLoading(true);

      setOcrError("");

      setOcrResult(null);

      setShowOriginalText(false);

      const response = await fetch(
        `${API_URL}/ocr/results/${doc.id}`,
        {
          headers: authHeaders
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail || "Unable to load OCR result."
        );

      }

      setOcrResult(data);

    } catch (err) {

      setOcrError(err.message);

    } finally {

      setOcrLoading(false);

    }

  };


  // --------------------------------
  // CLOSE OCR MODAL
  // --------------------------------

  const closeOCRModal = () => {

    setShowOCRModal(false);

    setOcrResult(null);

    setOcrError("");

    setShowOriginalText(false);

  };


  // --------------------------------
  // RETRY OCR FOR ALL DOCUMENT TYPES
  // --------------------------------

  const handleRetryOCR = async (doc) => {

    try {

      setRetryingId(doc.id);

      setError("");

      setSuccess("");

      const response = await fetch(
        `${API_URL}/ocr/retry/${doc.id}`,
        {
          method: "POST",
          headers: authHeaders
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail || "OCR retry failed."
        );

      }

      setSuccess(
        "OCR retry has been scheduled successfully."
      );

      await fetchDocuments();

    } catch (err) {

      setError(err.message);

    } finally {

      setRetryingId(null);

    }

  };


  // --------------------------------
  // EXPORT OCR DATA
  // --------------------------------

  const handleExport = async (format) => {

    try {

      setExporting(format);

      setError("");

      const response = await fetch(
        `${API_URL}/ocr/export?format=${format}`,
        {
          headers: authHeaders
        }
      );

      if (!response.ok) {

        const data = await response.json();

        throw new Error(
          data.detail || "Export failed."
        );

      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `omnix_ocr_results.${format}`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {

      setError(err.message);

    } finally {

      setExporting("");

    }

  };


  // --------------------------------
  // FORMAT HELPERS
  // --------------------------------

  const formatDate = (date) => {

    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "—";
    }

    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

  };


  const getStatusClass = (status) => {

    const value = (
      status || "not_started"
    ).toLowerCase();

    if (
      value === "completed" ||
      value === "success"
    ) {
      return "status-completed";
    }

    if (
      value === "processing" ||
      value === "pending"
    ) {
      return "status-processing";
    }

    if (
      value === "failed" ||
      value === "error"
    ) {
      return "status-failed";
    }

    return "status-not-started";

  };


  const getDocumentLabel = (doc) => {

    const category = DOCUMENT_TYPES.find(
      (item) => item.value === doc.document_type
    );

    const categoryLabel = category
      ? category.label
      : doc.document_type || "Document";

    if (doc.custom_document_name) {
      return `${categoryLabel} - ${doc.custom_document_name}`;
    }

    return categoryLabel;

  };


  const canViewOCR = (doc) => {

    const status = (
      doc.ocr_status || ""
    ).toLowerCase();

    return (
      status === "completed" ||
      status === "success"
    );

  };


  const canRetryOCR = (doc) => {

    const status = (
      doc.ocr_status || ""
    ).toLowerCase();

    return [
      "failed",
      "error",
      "completed",
      "success"
    ].includes(status);

  };


  // --------------------------------
  // OCR VALUE RENDERING
  // --------------------------------

  const formatFieldLabel = (key) => {

    return key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  };


  const renderValue = (value, fieldKey = "") => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Not available";
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "Not available";
      }

      // Render extracted skills as compact, readable chips.
      if (fieldKey === "skills") {
        return (
          <div className="ocr-skill-tags">
            {value.map((skill, index) => (
              <span className="ocr-skill-tag" key={`${String(skill)}-${index}`}>
                {typeof skill === "object" && skill !== null
                  ? JSON.stringify(skill)
                  : String(skill)}
              </span>
            ))}
          </div>
        );
      }

      return (
        <ul className="ocr-list">
          {value.map((item, index) => (
            <li key={index}>
              {typeof item === "object" && item !== null
                ? JSON.stringify(item)
                : String(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === "object") {
      return (
        <div className="ocr-object">
          {Object.entries(value).map(([key, item]) => (
            <div className="ocr-object-row" key={key}>
              <strong>{formatFieldLabel(key)}</strong>
              <span>
                {typeof item === "object" && item !== null
                  ? JSON.stringify(item)
                  : String(item)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };


  // --------------------------------
  // GENERIC SECTION RENDERER
  // --------------------------------

  const renderSection = (title, icon, fields) => {

    const visibleFields = Object.entries(fields).filter(
      ([, value]) => {

        return (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
        );

      }
    );

    if (visibleFields.length === 0) {
      return null;
    }

    return (

      <section
        className="ocr-section"
        key={title}
      >

        <div className="ocr-section-heading">

          {icon}

          <h3>{title}</h3>

        </div>


        <div className="ocr-fields-grid">

          {visibleFields.map(([key, value]) => (

            <div
              className="ocr-field"
              key={key}
            >

              <span className="ocr-field-label">
                {formatFieldLabel(key)}
              </span>

              <div className="ocr-field-value">
                {renderValue(value, key)}
              </div>

            </div>

          ))}

        </div>

      </section>

    );

  };


  // --------------------------------
  // DYNAMIC OCR RESULT SECTIONS
  // --------------------------------

  const renderOCRSections = () => {

    if (!ocrResult) return null;

    const data = ocrResult.extracted_data || {};

    const genericSections = data.sections || {};

    const reservedKeys = [
      "name",
      "email",
      "phone",
      "skills",
      "education",
      "experience",
      "date_of_birth",
      "gender",
      "address",
      "document_number",
      "document_name",
      "course_or_certificate",
      "institute",
      "issue_date",
      "sections"
    ];

    const additionalFields = Object.fromEntries(
      Object.entries(data).filter(
        ([key]) => !reservedKeys.includes(key)
      )
    );

    return (

      <div className="ocr-result-sections">


        {/* PERSONAL INFORMATION */}

        {renderSection(
          "Personal Information",
          <User size={19} />,
          {
            name: data.name,
            date_of_birth: data.date_of_birth,
            gender: data.gender
          }
        )}


        {/* CONTACT INFORMATION */}

        {renderSection(
          "Contact Information",
          <Mail size={19} />,
          {
            email: data.email,
            phone: data.phone
          }
        )}


        {/* DOCUMENT INFORMATION */}

        {renderSection(
          "Document Information",
          <ShieldCheck size={19} />,
          {
            document_name:
              data.document_name ||
              ocrResult.custom_document_name,

            document_type: ocrResult.document_type,

            document_number: data.document_number,

            document_id: ocrResult.document_id
          }
        )}


        {/* ADDRESS */}

        {renderSection(
          "Address Information",
          <Building2 size={19} />,
          {
            address: data.address
          }
        )}


        {/* RESUME SKILLS */}

        {renderSection(
          "Skills",
          <Briefcase size={19} />,
          {
            skills: data.skills
          }
        )}


        {/* EDUCATION */}

        {renderSection(
          "Education",
          <GraduationCap size={19} />,
          {
            education: data.education
          }
        )}


        {/* EXPERIENCE */}

        {renderSection(
          "Work Experience",
          <Briefcase size={19} />,
          {
            experience: data.experience
          }
        )}


        {/* CERTIFICATE */}

        {renderSection(
          "Certificate Information",
          <FileText size={19} />,
          {
            course_or_certificate: data.course_or_certificate,
            institute: data.institute,
            issue_date: data.issue_date
          }
        )}


        {/* GENERIC SMART SECTIONS */}

        {Object.entries(genericSections).map(([key, value]) => (

          renderSection(
            formatFieldLabel(key),
            <ScanText size={19} />,
            {
              [key]: value
            }
          )

        ))}


        {/* ADDITIONAL FIELDS */}

        {renderSection(
          "Additional Information",
          <ScanText size={19} />,
          additionalFields
        )}


        {/* EMPTY RESULT */}

        {Object.keys(data).length === 0 && (

          <div className="documents-empty">

            <ScanText size={35} />

            <h3>No structured information found</h3>

            <p>
              Original extracted text may still be available below.
            </p>

          </div>

        )}

      </div>

    );

  };


  // --------------------------------
  // MAIN UI
  // --------------------------------

  return (

    <div className="documents-page">

      <Sidebar />

      <main className="documents-main">

        <Header
          title="Documents"
          subtitle="Manage employee documents and OCR results"
        />


        <div className="documents-content">


          {/* PAGE HEADING */}

          <div className="documents-heading">

            <div>

              <h1>Document Management</h1>

              <p>
                Upload, manage and extract information from documents.
              </p>

            </div>

            <div className="documents-heading-icon">
              <FolderOpen size={27} />
            </div>

          </div>


          {/* ERROR MESSAGE */}

          {error && (

            <div className="documents-alert error-alert">

              <AlertCircle size={19} />

              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>

            </div>

          )}


          {/* FILE ERROR */}

          {fileError && (

            <div className="documents-alert error-alert">

              <AlertCircle size={19} />

              <span>{fileError}</span>

              <button
                type="button"
                onClick={() => setFileError("")}
              >
                <X size={17} />
              </button>

            </div>

          )}


          {/* SUCCESS */}

          {success && (

            <div className="documents-alert success-alert">

              <CheckCircle2 size={19} />

              <span>{success}</span>

              <button
                type="button"
                onClick={() => setSuccess("")}
              >
                <X size={17} />
              </button>

            </div>

          )}


          {/* UPLOAD SECTION */}

          <section className="upload-card">

            <div className="section-title">

              <div className="section-icon">
                <Upload size={21} />
              </div>

              <div>

                <h2>Upload New Document</h2>

                <p>
                  Select a category and upload your document.
                </p>

              </div>

            </div>


            <form onSubmit={handleUpload}>

              <div className="upload-form-grid">


                {/* DOCUMENT TYPE */}

                <div className="form-group">

                  <label htmlFor="document-type">
                    Document Type
                  </label>

                  <select
                    id="document-type"
                    value={documentType}
                    onChange={handleDocumentTypeChange}
                    required
                  >

                    {DOCUMENT_TYPES.map((type) => (

                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>

                    ))}

                  </select>

                </div>


                {/* CUSTOM DOCUMENT NAME */}

                {["id", "other"].includes(documentType) && (

                  <div className="form-group">

                    <label htmlFor="custom-document-name">
                      Document Name
                    </label>

                    <input
                      id="custom-document-name"
                      type="text"
                      placeholder={
                        documentType === "id"
                          ? "e.g. Aadhaar Card, PAN Card, Driving Licence"
                          : "e.g. Marksheet, Experience Letter"
                      }
                      value={customDocumentName}
                      onChange={(event) => {
                        setCustomDocumentName(event.target.value);
                      }}
                      maxLength={100}
                      required
                    />

                  </div>

                )}


                {/* EMPLOYEE SELECTION */}

                {isAdmin && (

                  <div className="form-group">

                    <label htmlFor="employee-select">
                      Select Employee
                    </label>

                    <select
                      id="employee-select"
                      value={employeeId}
                      onChange={(event) => {
                        setEmployeeId(event.target.value);
                      }}
                      required
                    >

                      <option value="">
                        Choose employee
                      </option>

                      {employees.map((employee) => {

                        const id = employee.id || employee._id;

                        return (

                          <option
                            key={id}
                            value={id}
                          >

                            {employee.name} - {employee.email}

                          </option>

                        );

                      })}

                    </select>

                  </div>

                )}


                {/* FILE UPLOAD */}

                <div className="form-group file-upload-group">

                  <label htmlFor="document-file">
                    Select Document
                  </label>

                  <div className="file-input-wrapper">

                    <input
                      id="document-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />

                    <div className="file-input-info">

                      <Upload size={20} />

                      <span>
                        {selectedFile
                          ? selectedFile.name
                          : "Choose PDF or image file"}
                      </span>

                    </div>

                  </div>

                  <small>
                    PDF, JPG, JPEG, PNG · Maximum 10 MB
                  </small>

                </div>


              </div>


              {/* UPLOAD BUTTON */}

              <div className="upload-actions">

                <button
                  type="submit"
                  className="upload-submit-btn"
                  disabled={uploading}
                >

                  {uploading ? (

                    <>
                      <LoaderCircle
                        className="spin"
                        size={18}
                      />
                      Uploading...
                    </>

                  ) : (

                    <>
                      <Upload size={18} />
                      Upload Document
                    </>

                  )}

                </button>

              </div>

            </form>

          </section>


          {/* DOCUMENT LIST */}

          <section className="documents-list-card">

            <div className="documents-list-header">

              <div className="section-title">

                <div className="section-icon">
                  <FileText size={21} />
                </div>

                <div>

                  <h2>Uploaded Documents</h2>

                  <p>
                    View documents and check OCR processing status.
                  </p>

                </div>

              </div>


              <div className="documents-header-actions">


                {/* ADMIN EXPORT */}

                {isAdmin && (

                  <>

                    <button
                      className="export-btn"
                      onClick={() => handleExport("xlsx")}
                      disabled={!!exporting}
                      type="button"
                    >

                      <FileSpreadsheet size={16} />

                      {exporting === "xlsx"
                        ? "Exporting..."
                        : "Excel"}

                    </button>


                    <button
                      className="export-btn"
                      onClick={() => handleExport("csv")}
                      disabled={!!exporting}
                      type="button"
                    >

                      {exporting === "csv"
                        ? "Exporting..."
                        : "CSV"}

                    </button>


                    <button
                      className="export-btn"
                      onClick={() => handleExport("json")}
                      disabled={!!exporting}
                      type="button"
                    >

                      {exporting === "json"
                        ? "Exporting..."
                        : "JSON"}

                    </button>

                  </>

                )}


                {/* REFRESH */}

                <button
                  className="refresh-btn"
                  onClick={() => fetchDocuments()}
                  disabled={loading}
                  type="button"
                  title="Refresh documents"
                >

                  <RefreshCw
                    size={17}
                    className={loading ? "spin" : ""}
                  />

                </button>

              </div>

            </div>


            {/* LOADING */}

            {loading ? (

              <div className="documents-loading">

                <LoaderCircle
                  className="spin"
                  size={27}
                />

                <p>Loading documents...</p>

              </div>

            ) : documents.length === 0 ? (

              /* EMPTY STATE */

              <div className="documents-empty">

                <FolderOpen size={42} />

                <h3>No Documents Found</h3>

                <p>
                  Uploaded documents will appear here.
                </p>

              </div>

            ) : (

              /* DOCUMENT TABLE */

              <div className="documents-table-wrapper">

                <table className="documents-table">

                  <thead>

                    <tr>

                      <th>Document</th>

                      {isAdmin && (
                        <th>Employee</th>
                      )}

                      <th>Type</th>

                      <th>Upload Date</th>

                      <th>OCR Status</th>

                      <th>Actions</th>

                    </tr>

                  </thead>


                  <tbody>

                    {documents.map((doc) => {

                      const status = (
                        doc.ocr_status || "not_started"
                      ).toLowerCase();

                      return (

                        <tr key={doc.id}>


                          {/* DOCUMENT */}

                          <td>

                            <div className="document-name-cell">

                              <div className="document-file-icon">
                                <FileText size={19} />
                              </div>

                              <div>

                                <strong>
                                  {doc.file_name}
                                </strong>

                                <small>
                                  {doc.id?.slice(-8)}
                                </small>

                              </div>

                            </div>

                          </td>


                          {/* EMPLOYEE */}

                          {isAdmin && (

                            <td>

                              <div className="employee-cell">

                                <strong>
                                  {doc.employee_name || "—"}
                                </strong>

                                <small>
                                  {doc.employee_email || ""}
                                </small>

                              </div>

                            </td>

                          )}


                          {/* DOCUMENT TYPE */}

                          <td>

                            <span className="document-type-badge">
                              {getDocumentLabel(doc)}
                            </span>

                          </td>


                          {/* DATE */}

                          <td>
                            {formatDate(doc.upload_date)}
                          </td>


                          {/* STATUS */}

                          <td>

                            <span
                              className={`ocr-status-badge ${getStatusClass(status)}`}
                            >

                              {[
                                "completed",
                                "success"
                              ].includes(status) ? (

                                <>
                                  <CheckCircle2 size={14} />
                                  Completed
                                </>

                              ) : status === "processing" ? (

                                <>
                                  <LoaderCircle size={14} />
                                  Processing
                                </>

                              ) : status === "pending" ? (

                                <>
                                  <LoaderCircle size={14} />
                                  Pending
                                </>

                              ) : [
                                "failed",
                                "error"
                              ].includes(status) ? (

                                <>
                                  <AlertCircle size={14} />
                                  Failed
                                </>

                              ) : (

                                <>
                                  <ScanText size={14} />
                                  Not Started
                                </>

                              )}

                            </span>

                          </td>


                          {/* ACTIONS */}

                          <td>

                            <div className="document-action-buttons">


                              {/* DOWNLOAD */}

                              <button
                                className="document-action-btn download-action"
                                onClick={() => handleDownload(doc)}
                                disabled={downloadingId === doc.id}
                                title="Download document"
                                type="button"
                              >

                                {downloadingId === doc.id ? (

                                  <LoaderCircle
                                    size={16}
                                    className="spin"
                                  />

                                ) : (

                                  <Download size={16} />

                                )}

                              </button>


                              {/* VIEW OCR */}

                              <button
                                className="document-action-btn view-action"
                                onClick={() => handleViewOCR(doc)}
                                disabled={!canViewOCR(doc)}
                                title={
                                  canViewOCR(doc)
                                    ? "View OCR result"
                                    : "OCR result not ready"
                                }
                                type="button"
                              >

                                <Eye size={16} />

                              </button>


                              {/* ADMIN RETRY FOR ALL DOCUMENTS */}

                              {isAdmin && canRetryOCR(doc) && (

                                <button
                                  className="document-action-btn retry-action"
                                  onClick={() => handleRetryOCR(doc)}
                                  disabled={retryingId === doc.id}
                                  title="Retry OCR"
                                  type="button"
                                >

                                  {retryingId === doc.id ? (

                                    <LoaderCircle
                                      size={16}
                                      className="spin"
                                    />

                                  ) : (

                                    <RotateCcw size={16} />

                                  )}

                                </button>

                              )}

                            </div>

                          </td>


                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </section>


          {/* =================================
              OCR RESULT MODAL
          ================================= */}

          {showOCRModal && (

            <div
              className="ocr-modal-overlay"
              onClick={closeOCRModal}
            >

              <div
                className="ocr-modal"
                onClick={(event) => event.stopPropagation()}
              >


                {/* MODAL HEADER */}

                <div className="ocr-modal-header">

                  <div className="ocr-modal-title">

                    <div className="ocr-modal-icon">
                      <ScanText size={23} />
                    </div>

                    <div>

                      <h2>OCR Extraction Results</h2>

                      <p>
                        Extracted document information
                      </p>

                    </div>

                  </div>


                  <button
                    className="ocr-modal-close"
                    onClick={closeOCRModal}
                    type="button"
                    aria-label="Close OCR result"
                  >

                    <X size={21} />

                  </button>

                </div>


                {/* MODAL BODY */}

                <div className="ocr-modal-body">


                  {ocrLoading ? (

                    <div className="ocr-loading">

                      <LoaderCircle
                        className="spin"
                        size={32}
                      />

                      <p>
                        Loading OCR results...
                      </p>

                    </div>

                  ) : ocrError ? (

                    <div className="ocr-error">

                      <AlertCircle size={28} />

                      <p>{ocrError}</p>

                    </div>

                  ) : ocrResult ? (

                    <>


                      {/* RESULT SUMMARY */}

                      <div className="ocr-result-summary">

                        <div>

                          <span>Document Type</span>

                          <strong>
                            {getDocumentLabel({
                              document_type: ocrResult.document_type,
                              custom_document_name:
                                ocrResult.custom_document_name
                            })}
                          </strong>

                        </div>


                        <div>

                          <span>OCR Status</span>

                          <strong className="ocr-success-text">

                            <CheckCircle2 size={15} />

                            Completed

                          </strong>

                        </div>


                        <div>

                          <span>Employee</span>

                          <strong>
                            {ocrResult.employee_name || "—"}
                          </strong>

                        </div>

                      </div>


                      {/* STRUCTURED INFORMATION */}

                      {renderOCRSections()}


                      {/* ORIGINAL OCR TEXT */}

                      <div className="ocr-original-section">

                        <button
                          className="ocr-original-toggle"
                          onClick={() => {
                            setShowOriginalText(
                              !showOriginalText
                            );
                          }}
                          type="button"
                        >

                          <span>

                            <FileText size={18} />

                            Original Extracted Text

                          </span>


                          {showOriginalText ? (

                            <ChevronUp size={19} />

                          ) : (

                            <ChevronDown size={19} />

                          )}

                        </button>


                        {showOriginalText && (

                          <pre className="ocr-original-text">

                            {ocrResult.extracted_text ||
                              "No original text available."}

                          </pre>

                        )}

                      </div>


                    </>

                  ) : null}


                </div>

              </div>

            </div>

          )}


        </div>

      </main>

    </div>

  );

}


export default Documents;
