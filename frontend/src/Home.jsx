
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  Users,
  FileText,
  ScanText,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      {/* Navbar */}
      <nav className="home-navbar">
        <Link to="/home" className="home-logo">
          <span className="logo-symbol">
            <BriefcaseBusiness size={23} />
          </span>
          OMNI<span className="logo-accent">X</span>
        </Link>

        <div className="nav-links">
          <Link to="/home">Home</Link>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </div>

        <div className="nav-actions">
          <Link to="/login" className="login-link">
            Login
          </Link>

          <Link to="/register" className="get-started">
            Get Started <ArrowRight size={16} />
          </Link>
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
            Manage your people, teams, employee records and
            documents through one simple and intelligent
            workforce management platform.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="primary-cta">
              Get Started <ArrowRight size={17} />
            </Link>

            <a href="#features" className="secondary-cta">
              Explore Features
            </a>
          </div>

          <div className="hero-note">
            <span><ShieldCheck size={16} /> Secure access</span>
            <span><Users size={16} /> Simple management</span>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="hero-visual">
          <div className="visual-decoration" />

          <div className="preview-card">
            <div className="preview-header">
              <div className="preview-brand">
                <LayoutDashboard size={19} />
                <strong>OMNIX Dashboard</strong>
              </div>

              <span className="preview-status">
                <i /> Sample Preview
              </span>
            </div>

            <div className="preview-body">
              <aside className="preview-sidebar">
                <LayoutDashboard size={19} />
                <Users size={19} />
                <FileText size={19} />
                <BriefcaseBusiness size={19} />
              </aside>

              <div className="preview-main">
                <span className="preview-greeting">
                  ADMIN WORKSPACE
                </span>

                <h3>Welcome to OMNIX!</h3>

                <div className="preview-stats">
                  <div>
                    <Users size={19} />
                    <strong>Employees</strong>
                    <small>Employee records</small>
                  </div>

                  <div>
                    <ClipboardPreview />
                    <strong>Approvals</strong>
                    <small>Registration requests</small>
                  </div>
                </div>

                <div className="preview-table">
                  <strong>Platform Features</strong>

                  <p>
                    <Users size={15} />
                    Employee Management
                    <span>Available</span>
                  </p>

                  <p>
                    <FileText size={15} />
                    Document Management
                    <span>Available</span>
                  </p>

                  <p>
                    <ScanText size={15} />
                    OCR Processing
                    <span>Available</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section" id="about">
        <div className="about-content">
          <span className="section-label">ABOUT OMNIX</span>

          <h2>
            A smarter way to manage your workforce.
          </h2>

          <p>
            OMNIX is an employee management platform designed
            to simplify employee records, document handling
            and registration approvals through a centralized
            workspace.
          </p>
        </div>

        <div className="about-highlight">
          <BriefcaseBusiness size={35} />
          <h3>One organized workspace</h3>
          <p>
            Bring employee information and important documents
            together in one accessible platform.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="section-heading">
          <span className="section-label">WHAT OMNIX OFFERS</span>

          <h2>Everything your team needs.</h2>

          <p>
            Manage your workforce through one connected platform.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon">
              <Users size={24} />
            </div>

            <h3>Employee Management</h3>

            <p>
              Manage employee records, profiles and departments
              from one place.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <FileText size={24} />
            </div>

            <h3>Document Management</h3>

            <p>
              Upload, organize and access important employee
              documents securely.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <ScanText size={24} />
            </div>

            <h3>AI-Powered OCR</h3>

            <p>
              Extract useful information from uploaded resumes
              and documents.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <ShieldCheck size={24} />
            </div>

            <h3>Admin Approval</h3>

            <p>
              Review and approve employee registration requests
              with role-based access.
            </p>
          </article>
        </div>
      </section>

      {/* Contact / Footer */}
      <footer className="home-footer" id="contact">
        <div>
          <strong>OMNIX</strong>
          <p>One Platform. Everything Connected.</p>
        </div>

        <span>© 2026 OMNIX. All rights reserved.</span>

        <Link to="/login">Access Workspace <ArrowRight size={15} /></Link>
      </footer>
    </div>
  );
}

function ClipboardPreview() {
  return <ShieldCheck size={19} />;
}

export default Home;
