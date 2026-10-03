import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { getAccessToken, getCurrentUser } from "./services/api";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddEnquiry from "./pages/AddEnquiry";
import EnquiryList from "./pages/EnquiryList";
import Students from "./pages/Students";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Admins from "./pages/Admins";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";

function Protected() {
  const token = getAccessToken();
  const user = getCurrentUser();

  return token && user ? <Layout user={user} /> : <Navigate to="/login" replace />;
}

function OwnerOnly() {
  const storedUser = localStorage.getItem("scot_it_current_user");
  let user = null;
  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  return user?.role?.toLowerCase() === "owner" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route element={<Protected />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-enquiry" element={<AddEnquiry />} />
          <Route path="/enquiry-list" element={<EnquiryList />} />
          <Route path="/students" element={<Students />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/reports" element={<Reports />} />
          <Route element={<OwnerOnly />}>
            <Route path="/admins" element={<Admins />} />
          </Route>
          <Route path="/categories" element={<Categories />} />
          <Route path="/refer-by" element={<Navigate to="/dashboard" replace />} />
          <Route element={<OwnerOnly />}>
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}