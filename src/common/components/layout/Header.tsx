import ThemeToggle from "@common/components/ThemeToggle";
import { useAuth } from "@common/contexts/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, User } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
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
    if (pathname === "/queue") return "Reading Queue";
    if (pathname === "/daily") return "Daily Summary";
    if (pathname === "/tags") return "Tags";
    if (pathname === "/newsletters") return "Sources";
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm w-full px-0 sm:px-0 border-b border-slate-200/60 dark:border-neutral-800 shadow-sm md:border-b-0 md:shadow-none">
      <div className="px-0 py-3 flex items-center justify-between w-full">
        {/* Left side - Hamburger menu and title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            data-testid="hamburger-menu-button"
            className="block lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-800"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right side - Search and user menu */}
        <div className="flex items-center gap-2">
          {pathname !== "/search" && (
            <form onSubmit={handleSearch} className="hidden lg:block">
              <div className="flex items-center gap-2">
                <Search size={20} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="input-field pl-0 pr-3 text-sm placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          )}

          <ThemeToggle />

          <div className="relative">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              onClick={toggleDropdown}
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30 flex items-center justify-center text-blue-700 dark:text-blue-200 font-semibold text-sm shadow-sm border border-blue-200/50 dark:border-blue-800/50">
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
                    className="absolute right-0 mt-2 w-52 py-2 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-slate-200/60 dark:border-neutral-800 z-20 backdrop-blur-sm"
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {user?.email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Account settings
                      </p>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-2"
                      onClick={() => {
                        navigate("/settings");
                        setShowDropdown(false);
                      }}
                    >
                      <User size={16} className="text-slate-400 dark:text-slate-300" />
                      Settings
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-neutral-800 mt-1"
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
