
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Search from './pages/Search';
import TrendingTopics from './pages/TrendingTopics';
import Settings from './pages/Settings';
import NewsletterDetail from './pages/NewsletterDetail';
import TagsPage from './pages/TagsPage';
import NewslettersPage from './pages/NewslettersPage'; // Added import
import LoadingScreen from './components/common/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {


  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/:id" element={<NewsletterDetail />} />
        <Route path="search" element={<Search />} />
        <Route path="trending" element={<TrendingTopics />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="newsletters" element={<NewslettersPage />} /> {/* Added route */}
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;