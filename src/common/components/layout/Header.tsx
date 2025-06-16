import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, User } from "lucide-react";
import { useAuth } from "@common/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const getPageTitle = () => {
    if (pathname.startsWith("/inbox")) {
      if (pathname === "/inbox") return "Inbox";
      return "Newsletter";
    }
    if (pathname === "/search") return "Search";
    if (pathname === "/trending") return "Trending Topics";
    if (pathname === "/settings") return "Settings";
    return "NewsletterHub";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
      <div className="px-6 py-4 md:px-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">
          {getPageTitle()}
        </h1>

        <div className="flex items-center space-x-4">
          {pathname !== "/search" && (
            <form onSubmit={handleSearch} className="hidden md:block relative">
              <input
                type="text"
                placeholder="Search newsletters..."
                className="input-field pl-10 pr-4 py-2.5 w-64 lg:w-72 bg-slate-50/50 border-slate-200 text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-blue-500/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </form>
          )}

          <button
            className="btn btn-ghost btn-sm relative p-2.5 rounded-full hover:bg-slate-100 transition-all text-slate-600 hover:text-blue-600"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full shadow-sm"></span>
          </button>

          <div className="relative">
            <button
              className="btn btn-ghost flex items-center space-x-2 p-1.5 rounded-full hover:bg-slate-100 transition-all"
              onClick={toggleDropdown}
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-semibold text-sm shadow-sm border border-blue-200/50">
                {user?.email?.charAt(0).toUpperCase() || <User size={16} />}
              </div>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute right-0 mt-3 w-52 py-2 bg-white rounded-xl shadow-xl border border-slate-200/60 z-20 backdrop-blur-sm"
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {user?.email}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Account settings
                      </p>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                      onClick={() => {
                        navigate("/settings");
                        setShowDropdown(false);
                      }}
                    >
                      <User size={16} className="text-slate-400" />
                      Settings
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100 mt-1"
                      onClick={signOut}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sign out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
