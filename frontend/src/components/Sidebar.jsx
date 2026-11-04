
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileText,
  Settings,
  UserRound,
  LogOut,
  BriefcaseBusiness,
} from "lucide-react";
import "./Sidebar.css";

function Sidebar({ role }) {
  const location = useLocation();
  const navigate = useNavigate();

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  // Automatically identify the logged-in user's role
  const currentRole = (
    role ||
    user.role ||
    (location.pathname.startsWith("/admin") ? "admin" : "employee")
  ).toLowerCase();

  const isAdmin = currentRole === "admin";

  const adminLinks = [
    {
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Employees",
      path: "/employees",
      icon: Users,
    },
    {
      label: "Approvals",
      path: "/admin/approvals",
      icon: ClipboardCheck,
    },
    {
      label: "Documents",
      path: "/documents",
      icon: FileText,
    },
    {
      label: "Settings",
      path: "/admin/settings",
      icon: Settings,
    },
  ];

  const employeeLinks = [
    {
      label: "Dashboard",
      path: "/employee/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Documents",
      path: "/documents",
      icon: FileText,
    },
    {
      label: "My Profile",
      path: "/employee/profile",
      icon: UserRound,
    },
    {
      label: "Settings",
      path: "/employee/settings",
      icon: Settings,
    },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const displayName =
    user.name ||
    user.full_name ||
    (isAdmin ? "Admin" : "Employee");

  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };

  return (
    <aside className="omnix-sidebar">
      {/* Brand */}
      <Link
        to={isAdmin ? "/admin/dashboard" : "/employee/dashboard"}
        className="omnix-brand"
      >
        <div className="omnix-brand-symbol">
          <BriefcaseBusiness size={25} strokeWidth={2.2} />
          <span className="omnix-brand-dot" />
        </div>

        <div className="omnix-brand-text">
          <strong>
            OMNI<span>X</span>
          </strong>
          <small>EMPLOYEE MANAGEMENT</small>
        </div>
      </Link>

      {/* User profile */}
      <div className="omnix-user-card">
        <div className="omnix-avatar">{initial}</div>

        <div className="omnix-user-info">
          <strong>{displayName}</strong>
          <span>
            {isAdmin ? "Administrator" : "Employee Account"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="omnix-sidebar-label">
        WORKSPACE
      </div>

      <nav className="omnix-navigation" aria-label="Main navigation">
        {links.map((item) => {
          const Icon = item.icon;

          const isActive =
            location.pathname === item.path ||
            (item.path === "/employees" &&
              location.pathname.startsWith("/employees/"));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`omnix-nav-link ${isActive ? "active" : ""}`}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="omnix-sidebar-footer">
        <div className="omnix-help-card">
          <div className="omnix-help-icon">
            <BriefcaseBusiness size={19} />
          </div>

          <strong>OMNIX EMS</strong>
          <span>Your workplace, organized.</span>
        </div>

        <button
          type="button"
          className="omnix-logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>

        <p className="omnix-sidebar-version">
          OMNIX EMS · v1.0
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
