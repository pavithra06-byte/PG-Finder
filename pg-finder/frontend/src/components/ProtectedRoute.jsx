import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page page-tight" style={{ display: "flex", justifyContent: "center", paddingTop: 160 }}>
        <div className="skel" style={{ width: 320, height: 180, borderRadius: 16 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === "tenant" ? "/tenant/dashboard" : user.role === "owner" ? "/owner/dashboard" : "/admin/dashboard";
    return <Navigate to={fallback} replace />;
  }
  return children;
}
