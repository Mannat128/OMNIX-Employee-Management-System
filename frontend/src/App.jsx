import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
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

// Other pages
import Documents from "./Documents";
import Approvals from "./Approvals";
import Settings from "./Settings";
import Profile from "./Profile";
import ChangePassword from "./ChangePassword";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Routes */}
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

          {/* Employee Management Routes */}
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/add" element={<AddEmployee />} />
          <Route
            path="/employees/edit/:id"
            element={<EditEmployee />}
          />
          <Route
            path="/employees/:id"
            element={<EmployeeDetails />}
          />

          {/* Document Routes */}
          <Route path="/documents" element={<Documents />} />

          {/* Employee Routes */}
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

          {/* Unknown Routes */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;