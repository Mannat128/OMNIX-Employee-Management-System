
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

function Sidebar({ role = "admin" }) {
  const location = useLocation();
  const navigate = useNavigate();

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const isAdmin = role === "admin";

  const adminLinks = [
    { label: "Dashboard", path: "/admin/dashboard", icon: "▦" },
    { label: "Employees", path: "/employees", icon: "♙" },
    { label: "Approvals", path: "/admin/approvals", icon: "◷" },
    { label: "Documents", path: "/documents", icon: "▤" },
    { label: "Settings", path: "/admin/settings", icon: "⚙" },
  ];

  const employeeLinks = [
    { label: "Dashboard", path: "/employee/dashboard", icon: "▦" },
    { label: "Documents", path: "/documents", icon: "▤" },
    { label: "My Profile", path: "/employee/profile", icon: "◉" },
    { label: "Settings", path: "/employee/settings", icon: "⚙" },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const displayName =
    user.name || user.full_name || (isAdmin ? "Admin" : "Employee");

  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <aside className="omnix-sidebar">
      <Link
        to={isAdmin ? "/admin/dashboard" : "/employee/dashboard"}
        className="omnix-brand"
      >
        <span className="omnix-brand-icon">O</span>
        <span>OMNIX</span>
      </Link>

      {isAdmin && (
        <div className="omnix-user-card">
          <div className="omnix-avatar">{initial}</div>
          <div className="omnix-user-info">
            <strong>{displayName}</strong>
            <span>Admin Account</span>
          </div>
        </div>
      )}

      <div className="omnix-sidebar-label">
        {isAdmin ? "MAIN MENU" : "ACCOUNT"}
      </div>

      <nav className="omnix-navigation">
        {links.map((item) => {
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
              <span className="omnix-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="omnix-logout"
        onClick={handleLogout}
      >
        <span>↪</span>
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;
