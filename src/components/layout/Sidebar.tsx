import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  Newspaper // Added Newspaper icon
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEmailAlias } from '../../hooks/useEmailAlias';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { emailAlias, loading: emailLoading } = useEmailAlias();
  
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!emailAlias) return;
    
    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
      alert('Failed to copy email to clipboard');
    }
  };

  const navLinks = [
    { to: '/inbox', icon: <Inbox size={20} />, label: 'Inbox' },
    { to: '/search', icon: <Search size={20} />, label: 'Search' },
    { to: '/trending', icon: <TrendingUp size={20} />, label: 'Trending Topics' },
    { to: '/tags', icon: <Tag size={20} />, label: 'Tags' },
    { to: '/newsletters', icon: <Newspaper size={20} />, label: 'Newsletter Sources' }, // Added new link
    { to: '/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Mobile menu button - only visible on mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-white shadow-md text-neutral-700"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - visible on all screen sizes */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen || window.innerWidth >= 768 ? 0 : -280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-neutral-200 flex flex-col`}
      >
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-500 rounded-md p-1.5">
              <Inbox className="text-white" size={18} />
            </div>
            <div className="p-6 pt-4">
              <h2 className="text-xl font-bold text-neutral-800 mb-2">Newsletter Hub</h2>
              {emailLoading ? (
                <div className="text-sm text-gray-500 animate-pulse">Loading your email...</div>
              ) : emailAlias ? (
                <div className="mt-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md p-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                    <span className="font-mono text-xs break-all">{emailAlias}</span>
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
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
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => 
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setIsOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
              {link.to === '/inbox' && (
                <span className="ml-auto bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  12
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-neutral-200">
          <div className="text-xs text-neutral-500">
            Connected as
            <div className="font-medium text-neutral-700 truncate">
              {user?.email}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;