import { AuthContext } from "@common/contexts/AuthContext";
import { useEmailAlias } from "@common/hooks/useEmailAlias";
import { useUnreadCount } from "@common/hooks/useUnreadCount";
import { useLogger } from "@common/utils/logger/useLogger";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  Check,
  Copy,
  Inbox,
  Mail,
  Newspaper,
  Search,
  Settings,
  Tag,
  TrendingUp,
  UserCircle
} from "lucide-react";
import { useContext, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const SidebarContent: React.FC<{
  navLinks: any[];
  bottomLinks: any[];
  showUnreadBadge: boolean;
  unreadCount: number;
  emailLoading: boolean;
  emailAlias: string | null | undefined;
  copied: boolean;
  copyToClipboard: () => void;
  user: any;
  toggleSidebar: () => void;
  isControlled: boolean;
}> = ({
  navLinks,
  bottomLinks,
  showUnreadBadge,
  unreadCount,
  emailLoading,
  emailAlias,
  copied,
  copyToClipboard,
  user,
  toggleSidebar,
  isControlled,
}) => {
    const location = useLocation();
    return (
      <>
        <div className="p-5 border-b border-slate-200/60 md:border-b-0">
          <div className="flex items-center space-x-3 mb-5">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-sm">
              <Inbox className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Newsletter Hub
            </h2>
          </div>
          {emailLoading ? (
            <div className="text-sm text-slate-500 animate-pulse py-2.5 px-3.5 bg-slate-50 rounded-lg flex items-center">
              <div className="loading-dots"><span></span><span></span><span></span></div>
              <span className="ml-2">Loading email...</span>
            </div>
          ) : emailAlias ? (
            <div className="w-full text-sm bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200/60 rounded-lg p-2.5 flex items-center justify-between transition-all hover:shadow-sm">
              <div className="flex items-center flex-1 min-w-0">
                <Mail className="w-4 h-4 mr-2.5 text-slate-400 flex-shrink-0" />
                <span className="font-mono text-xs break-all text-slate-700">
                  {emailAlias}
                </span>
              </div>
              <button
                onClick={copyToClipboard}
                className="btn btn-ghost btn-xs ml-2 p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0"
                title={copied ? "Copied!" : "Copy email"}
                disabled={copied}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ) : null}
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              data-testid={`sidebar-link-${link.to.replace('/', '')}`}
              end={link.end}
              className={({ isActive }) => {
                // Enhanced logic: highlight Inbox if on a newsletter detail page and navigation state says we came from inbox
                const isNewsletterDetailPage =
                  window.location.pathname.startsWith("/newsletters/") &&
                  link.to === "/inbox" &&
                  (
                    (location.state && (location.state.from === "/inbox" || location.state.fromInbox)) ||
                    (!location.state && window.location.pathname.match(/^\/newsletters\//))
                  );
                return `sidebar-link ${isActive || isNewsletterDetailPage ? "active" : ""}`;
              }}
              onClick={(e) => {
                if (link.to === "/inbox" && window.location.pathname === "/inbox") {
                  e.preventDefault();
                  window.history.replaceState({}, "", "/inbox");
                  window.dispatchEvent(new Event("inbox:clear-filters"));
                  window.dispatchEvent(new Event("inbox:refresh-newsletters"));
                }
                // On mobile, clicking a link should close the sidebar
                if (window.innerWidth < 768 && isControlled) {
                  toggleSidebar();
                }
              }}
            >
              {link.icon}
              <span className="flex-1">{link.label}</span>
              {link.to === "/inbox" && (
                <AnimatePresence>
                  {showUnreadBadge && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200/70 shadow-sm"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200/60">
          {bottomLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              data-testid={`sidebar-link-${link.to.replace('/', '')}`}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => {
                if (window.innerWidth < 768 && isControlled) {
                  toggleSidebar();
                }
              }}
            >
              {link.icon}
              <span className="flex-1">{link.label}</span>
            </NavLink>
          ))}
          <div className="mt-3 pt-3 border-t border-slate-200/60">
            <div className="text-xs text-slate-500 mb-1">
              Signed in as
            </div>
            <div className="font-medium text-slate-700 truncate text-sm">
              {user?.email}
            </div>
          </div>
        </div>
      </>
    );
  };

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const log = useLogger("Sidebar");
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const { emailAlias, loading: emailLoading } = useEmailAlias();

  // Use external state if provided (mobile), otherwise use internal state (desktop)
  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const sidebarIsOpen = isControlled ? isOpen : internalIsOpen;
  const toggleSidebar = isControlled ? onToggle : () => setInternalIsOpen(!internalIsOpen);

  const [copied, setCopied] = useState(false);
  const { unreadCount, isLoading } = useUnreadCount();
  const showUnreadBadge = !isLoading && unreadCount !== undefined && unreadCount > 0;

  const navLinks = [
    { to: "/inbox", icon: <Inbox size={20} />, label: "Inbox" },
    { to: "/queue", icon: <Bookmark size={20} />, label: "Reading Queue" },
    { to: "/daily", icon: <CalendarDays size={20} />, label: "Daily Summary" },
    { to: "/search", icon: <Search size={20} />, label: "Search" },
    { to: "/trending", icon: <TrendingUp size={20} />, label: "Trending Topics" },
    { to: "/tags", icon: <Tag size={20} />, label: "Tags" },
    { to: "/newsletters", icon: <Newspaper size={20} />, label: "Newsletter Groups", end: true },
  ];

  const bottomLinks = [
    { to: "/profile", icon: <UserCircle size={20} />, label: "Profile" },
    { to: "/settings", icon: <Settings size={20} />, label: "Settings" },
  ];

  const copyToClipboard = async () => {
    if (!emailAlias) return;
    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      log.error(
        "Failed to copy email",
        {
          action: "copy_email",
          metadata: { emailAlias },
        },
        err instanceof Error ? err : new Error(String(err)),
      );
      alert("Failed to copy email to clipboard");
    }
  };

  // Mobile sidebar (animated, only rendered if open)
  const mobileSidebar = (
    <AnimatePresence>
      {sidebarIsOpen && (
        <motion.aside
          data-testid="sidebar"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-xs bg-white/95 backdrop-blur-md border-r border-slate-200/60 flex flex-col shadow-xl md:hidden"
          aria-label="Main navigation"
        >
          <div className="h-14 flex items-center px-4 border-b border-slate-200/60 flex-shrink-0">
            {/* Hamburger menu button (if needed) */}
            {/* You may need to add the actual hamburger button here if not present elsewhere */}
          </div>
          <SidebarContent
            navLinks={navLinks}
            bottomLinks={bottomLinks}
            showUnreadBadge={showUnreadBadge}
            unreadCount={unreadCount}
            emailLoading={emailLoading}
            emailAlias={emailAlias}
            copied={copied}
            copyToClipboard={copyToClipboard}
            user={user}
            toggleSidebar={toggleSidebar}
            isControlled={isControlled}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );

  // Desktop sidebar (always visible, no animation)
  const desktopSidebar = (
    <aside
      data-testid="sidebar"
      className="static inset-y-0 left-0 z-40 w-72 bg-white/95 backdrop-blur-md border-r border-slate-200/60 md:border-r-0 flex flex-col shadow-none hidden md:flex"
      aria-label="Main navigation"
    >
      <SidebarContent
        navLinks={navLinks}
        bottomLinks={bottomLinks}
        showUnreadBadge={showUnreadBadge}
        unreadCount={unreadCount}
        emailLoading={emailLoading}
        emailAlias={emailAlias}
        copied={copied}
        copyToClipboard={copyToClipboard}
        user={user}
        toggleSidebar={toggleSidebar}
        isControlled={isControlled}
      />
    </aside>
  );

  return (
    <>
      {mobileSidebar}
      {desktopSidebar}
    </>
  );
};

export default Sidebar;
