import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { ThemeProvider } from "./ThemeContext";
import "./Theme.css";

// Main pages
import Home from "./Home";
import Login from "./Login";
import Register from "./Register";

// Dashboard pages
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

// Read saved authentication details
function getAuthData() {
  try {
    const token = localStorage.getItem("access_token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!token || !user || !user.role) {
      return null;
    }

    return {
      token,
      user,
      role: user.role.toLowerCase(),
    };
  } catch {
    return null;
  }
}

// Redirect according to role
function getDashboardPath(role) {
  return role === "admin"
    ? "/admin/dashboard"
    : "/employee/dashboard";
}

// Protected routes
function ProtectedRoute({ allowedRoles }) {
  const auth = getAuthData();

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(auth.role)) {
    return (
      <Navigate
        to={getDashboardPath(auth.role)}
        replace
      />
    );
  }

  return <Outlet />;
}

// Public-only routes
function PublicOnlyRoute() {
  const auth = getAuthData();

  if (auth) {
    return (
      <Navigate
        to={getDashboardPath(auth.role)}
        replace
      />
    );
  }

  return <Outlet />;
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

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Admin Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>

            <Route
              path="/admin/dashboard"
              element={<AdminDashboard />}
            />

            <Route path="/admin/profile" element={<Profile />} />
            <Route path="/admin/settings" element={<Settings />} />

            <Route
              path="/admin/change-password"
              element={<ChangePassword />}
            />

            <Route path="/admin/approvals" element={<Approvals />} />

            <Route path="/employees" element={<Employees />} />

            <Route
              path="/employees/add"
              element={<AddEmployee />}
            />

            <Route
              path="/employees/edit/:id"
              element={<EditEmployee />}
            />

            {/* Employee-specific documents and OCR */}
            <Route
              path="/employees/:id/documents"
              element={<EmployeeDocuments />}
            />

            <Route
              path="/employees/:id"
              element={<EmployeeDetails />}
            />

          </Route>

          {/* Employee Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>

            <Route
              path="/employee/dashboard"
              element={<EmployeeDashboard />}
            />

            <Route path="/employee/profile" element={<Profile />} />
            <Route path="/employee/settings" element={<Settings />} />

            <Route
              path="/employee/change-password"
              element={<ChangePassword />}
            />

          </Route>

          {/* Both Admin and Employee */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["admin", "employee"]} />
            }
          >
            <Route path="/documents" element={<Documents />} />
          </Route>

          {/* Unknown Routes */}
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