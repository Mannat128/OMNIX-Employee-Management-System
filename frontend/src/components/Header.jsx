import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Search,
  Bell,
  ChevronDown,
} from "lucide-react";

import "./Header.css";

const pageTitles = {
  "/admin/dashboard": "Dashboard",
  "/employees": "Employees",
  "/employees/add": "Add Employee",
  "/admin/approvals": "Approvals",
  "/documents": "Documents",
  "/admin/profile": "My Profile",
  "/admin/settings": "Settings",
  "/employee/dashboard": "Dashboard",
  "/employee/profile": "My Profile",
  "/employee/settings": "Settings",
  "/admin/change-password": "Change Password",
  "/employee/change-password": "Change Password",
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";

  return "Good Night";
}

function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [greeting, setGreeting] = useState(getGreeting());
  const [search, setSearch] = useState("");

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const role = (
    user.role ||
    (location.pathname.startsWith("/admin")
      ? "admin"
      : "employee")
  ).toLowerCase();

  const isAdmin = role === "admin";

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getGreeting());
    };

    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, []);

  const pathname = location.pathname;

  const title =
    pageTitles[pathname] ||
    (pathname.startsWith("/employees/edit/")
      ? "Edit Employee"
      : pathname.startsWith("/employees/") &&
        pathname.endsWith("/documents")
        ? "Employee Documents"
        : pathname.startsWith("/employees/")
          ? "Employee Details"
          : "OMNIX");

  const displayName =
    user.name ||
    user.full_name ||
    (isAdmin ? "Admin" : "Employee");

  const initial = displayName.charAt(0).toUpperCase();

  const isDashboard = pathname.includes("dashboard");

  const handleSearch = (event) => {
    event.preventDefault();

    const query = search.trim();

    if (!query || !isAdmin) return;

    navigate(`/employees?search=${encodeURIComponent(query)}`);
  };

  const handleProfileNavigation = () => {
    navigate(
      isAdmin ? "/admin/profile" : "/employee/profile"
    );
  };

  return (
    <header className="omnix-header">
      <div className="omnix-header-title">
        <span className="omnix-header-breadcrumb">
          OMNIX / {role.toUpperCase()}
        </span>

        <h1>
          {isDashboard
            ? `${greeting}, ${displayName}!`
            : title}

          {isDashboard && (
            <span className="omnix-greeting-wave"> 👋</span>
          )}
        </h1>

        <p>
          {isDashboard
            ? "Here's what's happening in your organization today."
            : `Home / ${title}`}
        </p>
      </div>

      <div className="omnix-header-right">
        {isAdmin && (
          <form
            className="omnix-search"
            onSubmit={handleSearch}
          >
            <Search size={18} />

            <input
              type="search"
              placeholder="Search employees..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label="Search employees"
            />
          </form>
        )}

        <div
          className="omnix-notification-btn"
          title="Notifications are not configured yet"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="omnix-notification-dot" />
        </div>

        <button
          type="button"
          className="omnix-header-user"
          onClick={handleProfileNavigation}
          aria-label="Open profile"
        >
          <div className="omnix-header-avatar">
            {initial}
          </div>

          <div className="omnix-header-user-info">
            <strong>{displayName}</strong>

            <span>
              {isAdmin ? "Administrator" : "Employee"}
            </span>
          </div>

          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}

export default Header;