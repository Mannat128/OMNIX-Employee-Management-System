
import { useEffect } from "react";

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
  LifeBuoy,
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
    user.role || role || ""
  ).toLowerCase();

  const isValidRole = ["admin", "employee"].includes(
    currentRole
  );

  const isAdmin = currentRole === "admin";

  // Validate session
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token || !isValidRole) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      navigate("/login", {
        replace: true,
      });
    }
  }, [navigate, isValidRole]);

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

  const links = isAdmin
    ? adminLinks
    : employeeLinks;

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

  // Prevent rendering with invalid session
  if (
    !isValidRole ||
    !localStorage.getItem("access_token")
  ) {
    return null;
  }

  return (
    <aside className="omnix-sidebar">

      {/* OMNIX Logo */}
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
            {isAdmin
              ? "Admin Account"
              : "Employee Account"}
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

      {/* Help and Support Footer */}
      <div className="omnix-sidebar-footer">

        <Link
          to="/tickets"
          className="omnix-help-card"
          style={{
            textDecoration: "none",
            width: "100%",
          }}
        >

          <div className="omnix-help-icon">
            <LifeBuoy size={19} />
          </div>

          <strong>
            {isAdmin
              ? "Support Center"
              : "Need Help?"}
          </strong>

          <span>
            {isAdmin
              ? "Manage employee support tickets and respond to requests."
              : "Contact support or create a ticket for assistance."}
          </span>

        </Link>

        {/* Application Version */}
        <div className="omnix-sidebar-version">
          OMNIX EMS · Version 1.0
        </div>

      </div>

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
