import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ToastProvider } from "@common/contexts/ToastContext";
import { FilterProvider } from "@common/contexts/FilterContext";
import { Layout } from "@common/components/layout";
import { ProtectedRoute } from "@common/components/ProtectedRoute";
import { CacheInitializer } from "@common/components/CacheInitializer";
import ErrorBoundary from "@web/components/ErrorBoundary";
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
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
  const redirectTo = query.get("redirectTo");

  // Handle redirect after login
  React.useEffect(() => {
    if (user && (location.pathname === "/login" || location.pathname === "/")) {
      navigate(redirectTo || "/inbox", { replace: true });
    }
  }, [user, location, navigate, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Custom error fallback component
  const errorFallback = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">
          Oops! Something went wrong
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          We're having trouble loading the application. Please try refreshing
          the page.
        </p>
        <div className="mt-6">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <ToastProvider>
        <FilterProvider>
          <CacheInitializer>
            <div className="min-h-screen bg-gray-50">
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 5000,
                  style: {
                    background: "#fff",
                    color: "#1f2937",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    fontSize: "0.875rem",
                  },
                  success: {
                    iconTheme: {
                      primary: "#10B981",
                      secondary: "#fff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#EF4444",
                      secondary: "#fff",
                    },
                  },
                }}
              />
              <Layout>
                <Routes>
                  {/* Redirect root to login or inbox based on auth status */}
                  <Route
                    path="/"
                    element={
                      user ? (
                        <Navigate to="/inbox" replace />
                      ) : (
                        <Navigate
                          to="/login"
                          state={{ from: location }}
                          replace
                        />
                      )
                    }
                  />

                  {/* Public routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />

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
                      <Navigate
                        to={user ? "/inbox" : "/login"}
                        state={{ from: location }}
                        replace
                      />
                    }
                  />
                </Routes>
              </Layout>
            </div>
          </CacheInitializer>
        </FilterProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
