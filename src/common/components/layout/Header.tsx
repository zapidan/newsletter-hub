import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User } from 'lucide-react';
import { useAuth } from '@common/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const getPageTitle = () => {
    if (pathname.startsWith('/inbox')) {
      if (pathname === '/inbox') return 'Inbox';
      return 'Newsletter';
    }
    if (pathname === '/search') return 'Search';
    if (pathname === '/trending') return 'Trending Topics';
    if (pathname === '/settings') return 'Settings';
    return 'NewsletterHub';
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
    <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm">
      <div className="px-4 py-3 md:px-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
        
        <div className="flex items-center space-x-3">
          {pathname !== '/search' && (
            <form onSubmit={handleSearch} className="hidden md:block relative">
              <input
                type="text"
                placeholder="Search newsletters..."
                className="pl-9 pr-3 py-1.5 w-56 lg:w-64 bg-neutral-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            </form>
          )}
          
          <button 
            className="relative p-2 rounded-full hover:bg-neutral-100 transition-colors text-neutral-700"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
          </button>
          
          <div className="relative">
            <button 
              className="flex items-center space-x-2"
              onClick={toggleDropdown}
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
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
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 py-2 bg-white rounded-md shadow-lg border border-neutral-200 z-20"
                  >
                    <div className="px-4 py-2 border-b border-neutral-200">
                      <p className="text-sm font-medium text-neutral-900 truncate">{user?.email}</p>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                      onClick={() => {
                        navigate('/settings');
                        setShowDropdown(false);
                      }}
                    >
                      Settings
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                      onClick={signOut}
                    >
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