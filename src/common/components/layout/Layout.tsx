import { useAuth } from '@common/contexts/AuthContext';
import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Don't show sidebar on login page or if user is not authenticated
  const showSidebar = user && !loading && !location.pathname.startsWith('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-neutral-950 dark:to-neutral-900/40 dark:bg-neutral-950">
      {/* Sidebar - Always render, but only toggle on mobile */}
      {showSidebar && (
        <>
          {/* Mobile backdrop - darker and more blurred, disables background interaction */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden pointer-events-auto"
                onClick={toggleSidebar}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          {/* Sidebar component */}
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />
        </>
      )}

      {/* Main content area */}
      <div className={`flex flex-col flex-1 overflow-hidden ${isSidebarOpen ? 'pointer-events-none lg:pointer-events-auto' : ''}`}>
        {user && <Header onMenuToggle={toggleSidebar} />}
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.1,
            }}
            className="max-w-7xl mx-auto space-y-4 md:space-y-6"
          >
            {children || <Outlet />}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
