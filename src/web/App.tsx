import React from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@common/components/layout";
import { ProtectedRoute } from "@common/components/ProtectedRoute";
import InboxPage from "@web/pages/Inbox";
import NewsletterDetailPage from "@web/pages/NewsletterDetail";
import NewslettersPage from "@web/pages/NewslettersPage";
import TrendingTopicsPage from "@web/pages/TrendingTopics";
import SearchPage from "@web/pages/Search";
import TagsPage from "@web/pages/TagsPage";
import ReadingQueuePage from "@web/pages/ReadingQueuePage";
import SettingsPage from "@web/pages/Settings";
import ProfilePage from "@web/pages/ProfilePage";
import LoginPage from "@web/pages/Login";
import ForgotPasswordPage from "@web/pages/ForgotPassword";
import ResetPasswordPage from "@web/pages/ResetPassword";
import DailySummary from "@web/pages/DailySummary";
import { useAuth } from "@common/contexts/AuthContext";

// A custom hook that builds on useLocation to parse the query string
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery();
  const redirectTo = query.get('redirectTo');

  // Handle redirect after login
  React.useEffect(() => {
    if (user && (location.pathname === '/login' || location.pathname === '/')) {
      navigate(redirectTo || '/inbox', { replace: true });
    }
  }, [user, location, navigate, redirectTo]);

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading component
  }

  return (
    <Layout>
      <Routes>
        {/* Redirect root to login or inbox based on auth status */}
        <Route 
          path="/" 
          element={user ? 
            <Navigate to="/inbox" replace /> : 
            <Navigate to="/login" state={{ from: location }} replace />} 
        />
        
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* Protected routes */}
        <Route 
          path="/inbox" 
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/newsletters" 
          element={
            <ProtectedRoute>
              <NewslettersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/newsletters/:id" 
          element={
            <ProtectedRoute>
              <NewsletterDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/trending" 
          element={
            <ProtectedRoute>
              <TrendingTopicsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/search" 
          element={
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tags" 
          element={
            <ProtectedRoute>
              <TagsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/queue" 
          element={
            <ProtectedRoute>
              <ReadingQueuePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/daily" 
          element={
            <ProtectedRoute>
              <DailySummary />
            </ProtectedRoute>
          } 
        />
        
        {/* 404 route - keep this last */}
        <Route 
          path="*" 
          element={
            <Navigate to={user ? "/inbox" : "/login"} state={{ from: location }} replace />
          } 
        />
      </Routes>
    </Layout>
  );
};

export default App;
