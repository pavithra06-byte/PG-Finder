import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

import Landing from "./pages/Landing.jsx";
import FindPG from "./pages/FindPG.jsx";
import PGDetail from "./pages/PGDetail.jsx";
import { LoginPage, RegisterPage } from "./pages/Auth.jsx";
import {
  HowItWorks, ForOwners, About, Contact, PrivacyPolicy, TermsAndConditions, LocationsPage, AmenitiesPage, ComparePage,
} from "./pages/Static.jsx";

import {
  TenantDashboard, FavoritesPage, TenantBookings, TenantVisits, TenantEnquiries,
  TenantReviews, ProfilePage, SettingsPage, MessagesPage,
} from "./pages/tenant/TenantPages.jsx";

import {
  OwnerDashboard, OwnerPGList, PGFormPage, RoomsPage, OwnerBookings, OwnerVisits,
  OwnerEnquiries, OwnerReviews, OwnerAnalytics,
} from "./pages/owner/OwnerPages.jsx";

import {
  AdminDashboard, AdminUsers, AdminListings, AdminBookings, AdminReviews, AdminReports,
  AdminAnnounce, AdminAnalytics, AdminCatalog,
} from "./pages/admin/AdminPages.jsx";

function NotFound() {
  return (
    <div className="page page-tight container empty">
      <h1 style={{ fontSize: 42, fontWeight: 800 }}>404</h1>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn btn-primary mt-16">Go Home</a>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isDashPage = /^\/(tenant|owner|admin)(\/|$)/.test(location.pathname);

  return (
    <>
      <div className="aurora-mesh" aria-hidden="true" />
      <ScrollToTop />
      {!isAuthPage && !isDashPage && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/find" element={<FindPG />} />
        <Route path="/pg/:id" element={<PGDetail />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/for-owners" element={<ForOwners />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/amenities" element={<AmenitiesPage />} />

        {}
        <Route path="/tenant" element={<ProtectedRoute roles={["tenant"]}><DashboardLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<TenantDashboard />} />
          <Route path="pg/:id" element={<PGDetail />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="bookings" element={<TenantBookings />} />
          <Route path="visits" element={<TenantVisits />} />
          <Route path="enquiries" element={<TenantEnquiries />} />
          <Route path="reviews" element={<TenantReviews />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="messages" element={<MessagesPage role="tenant" />} />
          <Route path="nearby" element={<FindPG />} />
        </Route>

        {}
        <Route path="/owner" element={<ProtectedRoute roles={["owner"]}><DashboardLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<OwnerDashboard />} />
          <Route path="pgs" element={<OwnerPGList />} />
          <Route path="pg/:id" element={<PGDetail />} />
          <Route path="pgs/new" element={<PGFormPage />} />
          <Route path="pgs/:pgId/edit" element={<EditPGWrapper />} />
          <Route path="pgs/:pgId/rooms" element={<RoomsPage />} />
          <Route path="bookings" element={<OwnerBookings />} />
          <Route path="visits" element={<OwnerVisits />} />
          <Route path="enquiries" element={<OwnerEnquiries />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="analytics" element={<OwnerAnalytics />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="messages" element={<MessagesPage role="owner" />} />
        </Route>

        {}
        <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><DashboardLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="owners" element={<AdminUsers verifyOnly />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="pg/:id" element={<PGDetail />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="announce" element={<AdminAnnounce />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isAuthPage && !isDashPage && <Footer />}
    </>
  );
}

import { useParams } from "react-router-dom";

function EditPGWrapper() {
  const { pgId } = useParams();
  return <PGFormPage editId={pgId} />;
}
