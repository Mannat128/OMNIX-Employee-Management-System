
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import API from "./api";
import "./Profile.css";

const API_BASE_URL = API.defaults.baseURL;

const emptyProfile = {
  id: "",
  name: "",
  email: "",
  role: "",
  status: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  city: "",
  state: "",
  profile_photo: null,
  employee_id: "",
  department: "",
  designation: "",
  joining_date: "",
  employment_type: "",
  employment_status: "",
};

const personalFields = [
  { name: "name", label: "Full Name", type: "text" },
  { name: "email", label: "Email Address", type: "email" },
  { name: "phone", label: "Phone Number", type: "tel" },
  { name: "date_of_birth", label: "Date of Birth", type: "date" },
  {
    name: "gender",
    label: "Gender",
    type: "select",
    options: ["Male", "Female", "Other", "Prefer not to say"],
  },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
];

// Admin can edit only these professional fields.
const adminEditableProfessionalFields = [
  { name: "department", label: "Department", type: "text" },
  {
    name: "employment_type",
    label: "Employment Type",
    type: "select",
    options: ["Full-time", "Part-time", "Contract", "Intern"],
  },
  {
    name: "employment_status",
    label: "Employment Status",
    type: "select",
    options: ["Active", "Inactive", "On Leave"],
  },
];

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.msg || "Validation error";
      })
      .join(", ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || fallback;
  }

  return error?.message || fallback;
}

function safeText(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "Not provided";
}

function getInitials(name = "") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

function getInputDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getPhotoUrl(photo) {
  if (!photo || typeof photo !== "string") return "";

  if (/^https?:\/\//i.test(photo)) {
    return photo;
  }

  // Profile photos must be served from the static uploads directory.
  const cleanPath = photo.replace(/^\/+/, "");

  return `${API_BASE_URL}/${cleanPath}`;
}

function ProfileField({ field, value, onChange, disabled = false }) {
  return (
    <div className="profile-form-field">
      <label htmlFor={`profile-${field.name}`}>{field.label}</label>

      {field.type === "select" ? (
        <select
          id={`profile-${field.name}`}
          name={field.name}
          value={value || ""}
          onChange={onChange}
          disabled={disabled}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`profile-${field.name}`}
          name={field.name}
          type={field.type}
          value={
            field.type === "date"
              ? getInputDate(value)
              : value || ""
          }
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function Profile() {
  const [profile, setProfile] = useState(emptyProfile);
  const [personalForm, setPersonalForm] = useState({});
  const [professionalForm, setProfessionalForm] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoBroken, setPhotoBroken] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);

  const fileInputRef = useRef(null);

  const isAdmin = profile.role?.toLowerCase() === "admin";

  const changePasswordPath = isAdmin
    ? "/admin/change-password"
    : "/employee/change-password";

  const loadProfile = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      setError("");

      const response = await API.get("/profile/me");
      const data = { ...emptyProfile, ...response.data };

      setProfile(data);
      setPhotoBroken(false);

      setPersonalForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        date_of_birth: getInputDate(data.date_of_birth),
        gender: data.gender || "",
        city: data.city || "",
        state: data.state || "",
      });

      setProfessionalForm({
        department: data.department || "",
        employment_type: data.employment_type || "",
        employment_status: data.employment_status || "",
      });

      try {
        const storedUser = JSON.parse(
          localStorage.getItem("user") || "{}"
        );

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,
            name: data.name,
            email: data.email,
            role: data.role,
          })
        );
      } catch {
        // Profile display does not depend on localStorage user data.
      }
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to load your profile.")
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handlePersonalChange = (event) => {
    const { name, value } = event.target;

    setPersonalForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleProfessionalChange = (event) => {
    const { name, value } = event.target;

    setProfessionalForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePersonalSave = async (event) => {
    event.preventDefault();

    try {
      setSavingPersonal(true);
      setError("");
      setSuccess("");

      await API.patch("/profile/me", personalForm);

      setEditingPersonal(false);
      await loadProfile(false);

      setSuccess("Personal information updated successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to update personal information.")
      );
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleProfessionalSave = async (event) => {
    event.preventDefault();

    if (!isAdmin) return;

    try {
      setSavingProfessional(true);
      setError("");
      setSuccess("");

      // Only the three permitted fields are sent.
      await API.patch("/profile/me/professional", {
        department: professionalForm.department,
        employment_type: professionalForm.employment_type,
        employment_status: professionalForm.employment_status,
      });

      setEditingProfessional(false);
      await loadProfile(false);

      setSuccess("Professional information updated successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to update professional information.")
      );
    } finally {
      setSavingProfessional(false);
    }
  };

  const handlePhotoSelect = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, JPEG or PNG image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      setPhotoLoading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", file);

      await API.post("/profile/me/profile-photo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await loadProfile(false);
      setPhotoVersion(Date.now());
      setSuccess("Profile photo uploaded successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to upload profile photo.")
      );
    } finally {
      setPhotoLoading(false);
      event.target.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to remove your profile photo?"
    );

    if (!confirmed) return;

    try {
      setPhotoLoading(true);
      setError("");
      setSuccess("");

      await API.delete("/profile/me/profile-photo");

      await loadProfile(false);
      setPhotoBroken(false);
      setPhotoVersion(Date.now());

      setSuccess("Profile photo removed successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to remove profile photo.")
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  const cancelPersonalEdit = () => {
    setPersonalForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      date_of_birth: getInputDate(profile.date_of_birth),
      gender: profile.gender || "",
      city: profile.city || "",
      state: profile.state || "",
    });

    setEditingPersonal(false);
  };

  const cancelProfessionalEdit = () => {
    setProfessionalForm({
      department: profile.department || "",
      employment_type: profile.employment_type || "",
      employment_status: profile.employment_status || "",
    });

    setEditingProfessional(false);
  };

  const renderDetail = (label, value) => (
    <div className="profile-detail" key={label}>
      <label>{label}</label>
      <p>{safeText(value)}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="profile-layout">
        <Sidebar />
        <main className="profile-main">
          <Header />
          <div className="profile-loading">
            <div className="profile-spinner" />
            <p>Loading your profile...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error && !profile.role) {
    return (
      <div className="profile-layout">
        <Sidebar />
        <main className="profile-main">
          <Header />
          <div className="profile-content">
            <div className="profile-alert error">{error}</div>
            <button
              type="button"
              className="profile-primary-btn"
              onClick={() => loadProfile()}
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const photoUrl = getPhotoUrl(profile.profile_photo);

  return (
    <div className="profile-layout">
      <Sidebar />

      <main className="profile-main">
        <Header />

        <div className="profile-content">
          <div className="profile-page-heading">
            <div>
              <span className="profile-eyebrow">
                ACCOUNT MANAGEMENT
              </span>
              <h1>My Profile</h1>
              <p>Manage your personal and professional information.</p>
            </div>

            <span className="profile-role-badge">
              {isAdmin ? "Administrator" : "Employee"}
            </span>
          </div>

          {error && (
            <div className="profile-alert error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="profile-alert success" role="status">
              {success}
            </div>
          )}

          {/* PROFILE OVERVIEW */}
          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Profile Overview</h2>
                <p>Your account identity and profile photo.</p>
              </div>
            </div>

            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {photoUrl && !photoBroken ? (
                  <img
                    key={`${photoUrl}-${photoVersion}`}
                    src={photoUrl}
                    alt="Profile"
                    onError={() => setPhotoBroken(true)}
                  />
                ) : (
                  getInitials(profile.name)
                )}
              </div>

              <div className="profile-user-heading">
                <h3>{safeText(profile.name)}</h3>
                <p>{safeText(profile.email)}</p>
                <span className="profile-account-status">
                  {safeText(profile.status)}
                </span>
              </div>

              <div className="profile-photo-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  onChange={handlePhotoSelect}
                  hidden
                />

                <button
                  type="button"
                  className="profile-secondary-btn"
                  disabled={photoLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoLoading
                    ? "Please wait..."
                    : profile.profile_photo
                    ? "Change Photo"
                    : "Upload Photo"}
                </button>

                {profile.profile_photo && (
                  <button
                    type="button"
                    className="profile-remove-btn"
                    disabled={photoLoading}
                    onClick={handlePhotoRemove}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* PERSONAL INFORMATION */}
          <section className="profile-card">
            <div className="profile-card-heading profile-heading-actions">
              <div>
                <h2>Personal Information</h2>
                <p>
                  Manage your registered personal details.
                </p>
              </div>

              {!editingPersonal && (
                <button
                  type="button"
                  className="profile-secondary-btn"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setEditingPersonal(true);
                  }}
                >
                  Edit Details
                </button>
              )}
            </div>

            {editingPersonal ? (
              <form onSubmit={handlePersonalSave}>
                <div className="profile-form-grid">
                  {personalFields.map((field) => (
                    <ProfileField
                      key={field.name}
                      field={field}
                      value={personalForm[field.name]}
                      onChange={handlePersonalChange}
                      disabled={savingPersonal}
                    />
                  ))}
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="profile-cancel-btn"
                    onClick={cancelPersonalEdit}
                    disabled={savingPersonal}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-primary-btn"
                    disabled={savingPersonal}
                  >
                    {savingPersonal ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-details-grid">
                {personalFields.map((field) =>
                  renderDetail(field.label, profile[field.name])
                )}
              </div>
            )}
          </section>

          {/* PROFESSIONAL INFORMATION */}
          <section className="profile-card">
            <div className="profile-card-heading profile-heading-actions">
              <div>
                <h2>Professional Information</h2>
                <p>
                  {isAdmin
                    ? "Some professional details are fixed and cannot be changed."
                    : "Your professional details are managed by the administrator."}
                </p>
              </div>

              {isAdmin && !editingProfessional && (
                <button
                  type="button"
                  className="profile-secondary-btn"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setEditingProfessional(true);
                  }}
                >
                  Edit Details
                </button>
              )}
            </div>

            {/* Fixed fields are always displayed as read-only details. */}
            <div className="profile-details-grid">
              {renderDetail("Employee ID", profile.employee_id)}
              {renderDetail("Designation", profile.designation)}
              {renderDetail("Joining Date", profile.joining_date)}
            </div>

            {editingProfessional && isAdmin ? (
              <form onSubmit={handleProfessionalSave}>
                <div className="profile-form-grid">
                  {adminEditableProfessionalFields.map((field) => (
                    <ProfileField
                      key={field.name}
                      field={field}
                      value={professionalForm[field.name]}
                      onChange={handleProfessionalChange}
                      disabled={savingProfessional}
                    />
                  ))}
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="profile-cancel-btn"
                    onClick={cancelProfessionalEdit}
                    disabled={savingProfessional}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-primary-btn"
                    disabled={savingProfessional}
                  >
                    {savingProfessional ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-details-grid">
                {renderDetail("Department", profile.department)}
                {renderDetail("Employment Type", profile.employment_type)}
                {renderDetail("Employment Status", profile.employment_status)}
              </div>
            )}
          </section>

          {/* ACCOUNT SECURITY */}
          <section className="profile-card profile-security">
            <div className="profile-card-heading">
              <div>
                <h2>Account Security</h2>
                <p>Keep your account secure and protected.</p>
              </div>
            </div>

            <div className="profile-security-option">
              <div className="profile-security-icon">🔒</div>

              <div className="profile-security-info">
                <h3>Password</h3>
                <p>
                  Update your password regularly to protect your account.
                </p>
              </div>

              <Link to={changePasswordPath}>
                Change Password <span>→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Profile;
