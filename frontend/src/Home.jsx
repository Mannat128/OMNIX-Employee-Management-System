
import "./Home.css";

function Home() {
  return (
    <div className="home-page">

      {/* Navbar */}
      <nav className="home-navbar">
        <a href="/home" className="home-logo">
          <span className="logo-symbol">O</span>
          OMNIX
        </a>

        <div className="nav-links">
          <a href="/home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </div>

        <div className="nav-actions">
          <a href="/login" className="login-link">Login</a>
          <a href="/register" className="get-started">
            Get Started →
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">

        <div className="hero-content">
          <span className="hero-label">
            EMPLOYEE MANAGEMENT SYSTEM
          </span>

          <h1>
            One Platform.
            <span> Everything Connected.</span>
          </h1>

          <p>
            Manage your people, teams, employee records
            and documents through one simple and intelligent
            workforce management platform.
          </p>

          <div className="hero-buttons">
            <a href="/register" className="primary-cta">
              Get Started →
            </a>

            <a href="#features" className="secondary-cta">
              Explore Features
            </a>
          </div>

          <div className="hero-note">
            ✓ Simple management &nbsp; ✓ Secure access
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="hero-visual">
          <div className="preview-card">
            <div className="preview-header">
              <strong>OMNIX Dashboard</strong>
              <span className="online-dot">● Online</span>
            </div>

            <div className="preview-body">
              <aside className="preview-sidebar">
                <span>⌂</span>
                <span>♙</span>
                <span>▤</span>
                <span>⚙</span>
              </aside>

              <div className="preview-main">
                <h3>Welcome back, Admin!</h3>

                <div className="preview-stats">
                  <div>
                    <strong>124</strong>
                    <small>Employees</small>
                  </div>
                  <div>
                    <strong>08</strong>
                    <small>Pending</small>
                  </div>
                </div>

                <div className="preview-table">
                  <div>Recent Employees</div>
                  <p>● Aman Verma <span>Active</span></p>
                  <p>● Neha Sharma <span>Active</span></p>
                  <p>● Rohit Mehta <span>Active</span></p>
                </div>
              </div>
            </div>
          </div>
          <div className="visual-decoration"></div>
        </div>

      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="section-heading">
          <span>WHAT OMNIX OFFERS</span>
          <h2>Everything your team needs.</h2>
          <p>Manage your entire workforce from one place.</p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon">♙</div>
            <h3>Employee Management</h3>
            <p>Manage employee records, profiles and departments.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">▤</div>
            <h3>Document Management</h3>
            <p>Keep important employee documents organized.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">✧</div>
            <h3>AI-Powered OCR</h3>
            <p>Extract useful information from uploaded resumes.</p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">✓</div>
            <h3>Admin Approval</h3>
            <p>Review and approve employee registrations.</p>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer" id="contact">
        <strong>OMNIX</strong>
        <span>One Platform. Everything Connected.</span>
        <span>© 2026 OMNIX. All rights reserved.</span>
      </footer>

    </div>
  );
}

export default Home;
