
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { ThemeProvider } from "./ThemeContext";
import "./Theme.css";

// OMNI AI Assistant
import OmniAssistant from "./components/OmniAssistant";

// Public pages
import Home from "./Home";
import Login from "./Login";
import Register from "./Register";

// Dashboards
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

// Employee management
import Employees from "./Employees";
import AddEmployee from "./AddEmployee";
import EditEmployee from "./EditEmployee";
import EmployeeDetails from "./EmployeeDetails";
import EmployeeDocuments from "./EmployeeDocuments";

// Other pages
import Documents from "./Documents";
import Approvals from "./Approvals";
import Settings from "./Settings";
import Profile from "./Profile";
import ChangePassword from "./ChangePassword";
import AdminTransfer from "./AdminTransfer";

// Helpdesk
import Tickets from "./Tickets";
import TicketDetails from "./TicketDetails";

// Read login session
function getSession() {
  const token = localStorage.getItem("access_token");

  let user = {};

  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const role = String(user.role || "").toLowerCase();

  return {
    token,
    role,
    isAuthenticated:
      Boolean(token) && ["admin", "employee"].includes(role),
  };
}

// Login required for both roles
function ProtectedRoute({ children }) {
  const { isAuthenticated } = getSession();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {children}
      <OmniAssistant />
    </>
  );
}

// Admin-only routes
function AdminRoute({ children }) {
  const { isAuthenticated, role } = getSession();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "admin") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return (
    <>
      {children}
      <OmniAssistant />
    </>
  );
}

// Employee-only routes
function EmployeeRoute({ children }) {
  const { isAuthenticated, role } = getSession();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "employee") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <>
      {children}
      <OmniAssistant />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>

          {/* Public Routes */}
          <Route
            path="/"
            element={<Navigate to="/home" replace />}
          />

          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Employee Dashboard */}
          <Route
            path="/employee/dashboard"
            element={
              <EmployeeRoute>
                <EmployeeDashboard />
              </EmployeeRoute>
            }
          />

          {/* Admin Profile and Settings */}
          <Route
            path="/admin/profile"
            element={
              <AdminRoute>
                <Profile />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <Settings />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/change-password"
            element={
              <AdminRoute>
                <ChangePassword />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/approvals"
            element={
              <AdminRoute>
                <Approvals />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/transfer"
            element={
              <AdminRoute>
                <AdminTransfer />
              </AdminRoute>
            }
          />

          {/* Admin Employee Management */}
          <Route
            path="/employees"
            element={
              <AdminRoute>
                <Employees />
              </AdminRoute>
            }
          />

          <Route
            path="/employees/add"
            element={
              <AdminRoute>
                <AddEmployee />
              </AdminRoute>
            }
          />

          <Route
            path="/employees/edit/:id"
            element={
              <AdminRoute>
                <EditEmployee />
              </AdminRoute>
            }
          />

          <Route
            path="/employees/:id"
            element={
              <AdminRoute>
                <EmployeeDetails />
              </AdminRoute>
            }
          />

          <Route
            path="/employees/:id/documents"
            element={
              <AdminRoute>
                <EmployeeDocuments />
              </AdminRoute>
            }
          />

          {/* General Documents */}
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Documents />
              </ProtectedRoute>
            }
          />

          {/* Employee Profile and Settings */}
          <Route
            path="/employee/profile"
            element={
              <EmployeeRoute>
                <Profile />
              </EmployeeRoute>
            }
          />

          <Route
            path="/employee/settings"
            element={
              <EmployeeRoute>
                <Settings />
              </EmployeeRoute>
            }
          />

          <Route
            path="/employee/change-password"
            element={
              <EmployeeRoute>
                <ChangePassword />
              </EmployeeRoute>
            }
          />

          {/* Helpdesk Tickets: Both Admin and Employee */}
          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <Tickets />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tickets/:id"
            element={
              <ProtectedRoute>
                <TicketDetails />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={<Navigate to="/home" replace />}
          />

        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
