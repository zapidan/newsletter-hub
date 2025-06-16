import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Inbox,
  Search,
  TrendingUp,
  Settings,
  Menu,
  X,
  Mail,
  Copy,
  Check,
  Tag,
  Newspaper,
  Bookmark,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { useContext } from "react";
import { AuthContext } from "@common/contexts/AuthContext";
import { useEmailAlias } from "@common/hooks/useEmailAlias";
import { useUnreadCount } from "@common/hooks/useUnreadCount";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const { emailAlias, loading: emailLoading } = useEmailAlias();

  const [copied, setCopied] = useState(false);
  // Use the optimized unread count hook
  const { unreadCount, isLoading } = useUnreadCount();
  // Only show the badge after initial load and when count > 0
  const showUnreadBadge =
    !isLoading && unreadCount !== undefined && unreadCount > 0;

  const copyToClipboard = async () => {
    if (!emailAlias) return;

    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email:", err);
      alert("Failed to copy email to clipboard");
    }
  };

  const navLinks = [
    { to: "/inbox", icon: <Inbox size={20} />, label: "Inbox" },
    { to: "/queue", icon: <Bookmark size={20} />, label: "Reading Queue" },
    { to: "/daily", icon: <CalendarDays size={20} />, label: "Daily Summary" },
    { to: "/search", icon: <Search size={20} />, label: "Search" },
    {
      to: "/trending",
      icon: <TrendingUp size={20} />,
      label: "Trending Topics",
    },
    { to: "/tags", icon: <Tag size={20} />, label: "Tags" },
    {
      to: "/newsletters",
      icon: <Newspaper size={20} />,
      label: "Newsletter Sources",
    },
    { to: "/settings", icon: <Settings size={20} />, label: "Settings" },
  ];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Mobile menu button - only visible on mobile */}
      <button
        className="md:hidden fixed top-6 left-6 z-30 btn btn-secondary p-2.5 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200/60 text-slate-700"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - visible on all screen sizes */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen || window.innerWidth >= 768 ? 0 : -280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed md:static inset-y-0 left-0 z-20 w-72 bg-white/95 backdrop-blur-sm border-r border-slate-200/60 flex flex-col shadow-xl md:shadow-none`}
      >
        <div className="p-6 border-b border-slate-200/60">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-2 shadow-sm">
              <Inbox className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Newsletter Hub
            </h2>
          </div>

          {emailLoading ? (
            <div className="text-sm text-slate-500 animate-pulse py-3 px-4 bg-slate-50 rounded-lg">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="ml-2">Loading your email...</span>
            </div>
          ) : emailAlias ? (
            <div className="w-full text-sm bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between transition-all hover:shadow-sm">
              <div className="flex items-center flex-1 min-w-0">
                <Mail className="w-4 h-4 mr-3 text-slate-400 flex-shrink-0" />
                <span className="font-mono text-xs break-all text-slate-700">
                  {emailAlias}
                </span>
              </div>
              <button
                onClick={copyToClipboard}
                className="btn btn-ghost btn-xs ml-2 p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0"
                title={copied ? "Copied!" : "Copy to clipboard"}
                disabled={copied}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 p-6 space-y-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => {
                const isNewsletterDetailPage =
                  window.location.pathname.startsWith("/newsletters/");
                // For Inbox link, check if we're on inbox or newsletter detail page
                if (link.to === "/inbox") {
                  return `sidebar-link ${isActive || isNewsletterDetailPage ? "active" : ""}`;
                }
                // For all other links, only use default isActive behavior if not on a newsletter detail page
                return `sidebar-link ${!isNewsletterDetailPage && isActive ? "active" : ""}`;
              }}
              onClick={(e) => {
                setIsOpen(false);
                // If already on inbox, clear filters and refresh
                if (
                  link.to === "/inbox" &&
                  window.location.pathname === "/inbox"
                ) {
                  e.preventDefault();
                  // Clear URL params
                  window.history.replaceState({}, "", "/inbox");
                  // Dispatch events to clear filters and refresh
                  window.dispatchEvent(new Event("inbox:clear-filters"));
                  window.dispatchEvent(new Event("inbox:refresh-newsletters"));
                }
              }}
            >
              {link.icon}
              <span className="flex-1">{link.label}</span>
              {link.to === "/inbox" && (
                <span
                  className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full transition-all duration-200 shadow-sm ${
                    showUnreadBadge
                      ? "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border border-blue-200/50"
                      : "opacity-0 w-0 px-0 overflow-hidden"
                  }`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {showUnreadBadge ? unreadCount : ""}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-transparent">
          <div className="text-xs text-slate-500">
            Connected as
            <div className="font-medium text-slate-700 truncate mt-1 text-sm">
              {user?.email}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
