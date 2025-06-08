
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { useContext } from 'react';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Search from './pages/Search';
import TrendingTopics from './pages/TrendingTopics';
import Settings from './pages/Settings';
import NewsletterDetail from './pages/NewsletterDetail';
import TagsPage from './pages/TagsPage';
import NewslettersPage from './pages/NewslettersPage';
import ReadingQueuePage from './pages/ReadingQueuePage';
import LoadingScreen from './components/common/LoadingScreen';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DailySummary from './pages/DailySummary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const location = useLocation();

  if (auth?.loading) {
    return <LoadingScreen />;
  }

  if (!auth?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {


  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="newsletters" element={<NewslettersPage />} />
        <Route path="reading-queue" element={<ReadingQueuePage />} />
        <Route path="reading-queue/:id" element={<NewsletterDetail />} />
        <Route path="daily-summary" element={<DailySummary />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;