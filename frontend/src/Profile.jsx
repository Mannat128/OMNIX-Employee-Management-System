import "./Profile.css";

function Profile() {
  return (
    <div className="profile-page">
      <aside className="profile-sidebar">
        <div className="profile-brand">
          <span className="profile-logo">O</span>
          <span>OMNIX</span>
        </div>

        <p className="profile-menu-title">ACCOUNT</p>

        <nav className="profile-nav">
          <a href="/admin/dashboard">▦ Dashboard</a>
          <a href="/employees">♙ Employees</a>
          <a href="/documents">▤ Documents</a>
          <a href="/admin/profile" className="active">◉ My Profile</a>
          <a href="/admin/settings">⚙ Settings</a>
        </nav>

        <a href="/login" className="profile-logout">↪ Logout</a>
      </aside>

      <main className="profile-main">
        <header className="profile-header">
          <div>
            <h1>My Profile</h1>
            <p>View and manage your account information.</p>
          </div>

          <button className="profile-edit-btn" type="button">
            Edit Profile
          </button>
        </header>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>Personal Information</h2>
            <p>Your personal details will appear here.</p>
          </div>

          <div className="profile-avatar-section">
            <div className="profile-avatar">U</div>
            <div>
              <h3>Account Profile</h3>
              <p>Profile information is not loaded yet.</p>
            </div>
          </div>

          <div className="profile-details-grid">
            <div className="profile-detail">
              <label>Full Name</label>
              <p>Not available</p>
            </div>

            <div className="profile-detail">
              <label>Email Address</label>
              <p>Not available</p>
            </div>

            <div className="profile-detail">
              <label>Department</label>
              <p>Not available</p>
            </div>

            <div className="profile-detail">
              <label>Account Role</label>
              <p>Not available</p>
            </div>
          </div>
        </section>

        <section className="profile-card profile-security">
          <div className="profile-card-heading">
            <h2>Account Security</h2>
            <p>Manage your account security.</p>
          </div>

          <div className="profile-security-option">
            <div>
              <h3>Password</h3>
              <p>Keep your account password secure.</p>
            </div>

            <a href="/admin/change-password">Change Password →</a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Profile;
