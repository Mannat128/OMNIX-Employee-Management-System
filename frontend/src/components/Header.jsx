
import { useLocation } from "react-router-dom";
import "./Header.css";

const pageTitles = {
  "/admin/dashboard": "Dashboard",
  "/employees": "Employee Management",
  "/employees/add": "Add Employee",
  "/admin/approvals": "Approvals",
  "/documents": "Documents",
  "/admin/profile": "My Profile",
  "/admin/settings": "Settings",
  "/employee/dashboard": "Dashboard",
  "/employee/profile": "My Profile",
  "/employee/settings": "Settings",
};

function Header() {
  const location = useLocation();

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const title =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith("/employees/edit/")
      ? "Edit Employee"
      : location.pathname.startsWith("/employees/")
        ? "Employee Details"
        : "OMNIX");

  const displayName =
    user.name || user.full_name || "User";

  return (
    <header className="omnix-header">
      <div className="omnix-header-title">
        <h1>{title}</h1>
        <p>Home <span>/</span> {title}</p>
      </div>

      <div className="omnix-header-right">
        <button
          type="button"
          className="omnix-notification-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          ♧
        </button>

        <div className="omnix-header-user">
          <div className="omnix-header-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{displayName}</strong>
            <span>{user.role || "Account"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
