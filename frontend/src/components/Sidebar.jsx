
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileText,
  Settings,
  UserRound,
  LogOut,
  ArrowRightLeft,
} from "lucide-react";

import "./Sidebar.css";

function Sidebar({ role }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Get logged-in user
  let user = {};

  try {
    user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    user = {};
  }

  // Identify current role
  const currentRole = String(
    user.role || role || "employee"
  ).toLowerCase();

  const isAdmin = currentRole === "admin";

  // Admin navigation
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
      label: "Transfer Admin Access",
      path: "/admin/transfer",
      icon: ArrowRightLeft,
    },
    {
      label: "Settings",
      path: "/admin/settings",
      icon: Settings,
    },
  ];

  // Employee navigation
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

  // User information
  const displayName =
    user.name ||
    user.full_name ||
    (isAdmin ? "Admin" : "Employee");

  const initial = displayName.charAt(0).toUpperCase();

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  // Active navigation link
  const isLinkActive = (path) => {
    if (location.pathname === path) {
      return true;
    }

    if (path === "/employees") {
      return location.pathname.startsWith("/employees/");
    }

    return false;
  };

  return (
    <aside className="omnix-sidebar">

      {/* Final OMNIX EMS Logo */}
      <Link
        to={
          isAdmin
            ? "/admin/dashboard"
            : "/employee/dashboard"
        }
        className="omnix-brand"
        aria-label="OMNIX Home"
      >
        <img
          src="/omnix-logo.png"
          alt="OMNIX Employee Management System"
          className="omnix-sidebar-logo"
        />
      </Link>

      {/* User Profile Card */}
      <div className="omnix-user-card">

        <div className="omnix-avatar">
          {initial}
        </div>

        <div className="omnix-user-info">
          <strong>{displayName}</strong>

          <span>
            {isAdmin ? "Admin Account" : "Employee Account"}
          </span>
        </div>

      </div>

      {/* Navigation Label */}
      <div className="omnix-sidebar-label">
        {isAdmin ? "MAIN MENU" : "MY WORKSPACE"}
      </div>

      {/* Role Based Navigation */}
      <nav className="omnix-navigation">

        {links.map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`omnix-nav-link ${
                active ? "active" : ""
              }`}
            >
              <span className="omnix-nav-icon">
                <Icon
                  size={19}
                  strokeWidth={1.8}
                />
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}

      </nav>

      {/* Logout */}
      <button
        type="button"
        className="omnix-logout"
        onClick={handleLogout}
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>

    </aside>
  );
}

export default Sidebar;
