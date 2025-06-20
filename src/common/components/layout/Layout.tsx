import { useAuth } from '@common/contexts/AuthContext';
import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Don't show sidebar on login page or if user is not authenticated
  const showSidebar = user && !loading && !location.pathname.startsWith('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30">
      {showSidebar && <Sidebar />}
      <div className={`flex flex-col ${showSidebar ? 'flex-1' : 'w-full'} overflow-hidden`}>
        <Header />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.1,
            }}
            className="max-w-7xl mx-auto space-y-6"
          >
            {children || <Outlet />}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
