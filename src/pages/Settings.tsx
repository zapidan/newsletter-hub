import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEmailAlias } from '../hooks/useEmailAlias';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Bell, 
  Volume2, 
  Trash2, 
  UserCircle, 
  Lock, 
  LogOut,
  Clipboard, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { emailAlias, loading: emailLoading, error: emailError } = useEmailAlias();
  const [activeTab, setActiveTab] = useState('account');
  const [notificationEmail, setNotificationEmail] = useState(true);
  const [notificationBrowser, setNotificationBrowser] = useState(false);
  const [voiceType, setVoiceType] = useState('neutral');
  const [voiceSpeed, setVoiceSpeed] = useState('1.0');
  const [copied, setCopied] = useState(false);
  
  const handleCopyEmailAlias = async () => {
    if (!emailAlias) return;
    
    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  // Generate new email alias functionality moved to ProfilePage

  const tabs = [
    { id: 'account', label: 'Account', icon: <UserCircle size={18} /> },
    { id: 'newsletters', label: 'Newsletters', icon: <Mail size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'tts', label: 'Text-to-Speech', icon: <Volume2 size={18} /> },
    { id: 'security', label: 'Security', icon: <Lock size={18} /> },
  ];

  // Handle tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Link 
          to="/profile" 
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
        >
          View Profile <ChevronRight size={16} className="ml-1" />
        </Link>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <nav className="flex flex-col">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 text-left ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 font-medium border-l-4 border-primary-500'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
              
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 text-left text-error-600 hover:bg-error-50 mt-2 border-t border-neutral-200"
              >
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </nav>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            {activeTab === 'account' && (
              <div>
                <h3 className="text-xl font-semibold mb-6">Account Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      readOnly
                      className="input-field bg-neutral-50"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      This is your account email used for login and account notifications.
                    </p>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <div className="mb-4">
                      <h4 className="font-medium">Your Newsletter Email Alias</h4>
                      <p className="text-sm text-neutral-600 mt-1 mb-4">
                        Use this email to subscribe to newsletters. All emails sent to this address will be delivered to your inbox.
                      </p>
                      
                      {emailLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-neutral-100 p-3 rounded-md">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Loading your email address...</span>
                        </div>
                      ) : emailError ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                          <p>Error loading email address. Please refresh the page.</p>
                        </div>
                      ) : emailAlias ? (
                        <div className="bg-neutral-100 p-3 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                              <span className="font-mono text-sm overflow-auto break-all pr-2">
                                {emailAlias}
                              </span>
                            </div>
                            <button
                              onClick={handleCopyEmailAlias}
                              className="p-1 text-neutral-600 hover:text-neutral-800 rounded-md ml-2 flex-shrink-0"
                              title={copied ? 'Copied!' : 'Copy to clipboard'}
                              disabled={copied}
                            >
                              {copied ? (
                                <CheckCircle size={16} className="text-green-500" />
                              ) : (
                                <Clipboard size={16} />
                              )}
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-neutral-500">
                            This is automatically generated from your email address and cannot be changed.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">Delete Account</h4>
                    <p className="text-sm text-neutral-600 mb-4">
                      Permanently delete your account and all your data. This action cannot be undone.
                    </p>
                    <button className="flex items-center px-4 py-2 rounded-md border border-error-500 text-error-600 hover:bg-error-50 transition-colors">
                      <Trash2 size={16} className="mr-2" />
                      <span>Delete Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'newsletters' && (
              <div>
                <h3 className="text-xl font-semibold mb-6">Newsletter Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Connected Newsletters</h4>
                    
                    <div className="space-y-3">
                      {[
                        { name: 'Tech Insider Weekly', status: 'active' },
                        { name: 'Business Morning Brew', status: 'active' },
                        { name: 'Science Daily', status: 'active' },
                        { name: 'Marketing Trends', status: 'inactive' }
                      ].map((newsletter, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-neutral-200 rounded-md bg-white">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-3 ${
                              newsletter.status === 'active' ? 'bg-success-500' : 'bg-neutral-300'
                            }`}></div>
                            <span>{newsletter.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                              {newsletter.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                            <button className="p-1 text-neutral-500 hover:text-error-600">
                              <XCircle size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">AI Summary Settings</h4>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label htmlFor="auto-summarize" className="text-sm text-neutral-700">
                          Automatically generate AI summaries
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="auto-summarize"
                            className="sr-only"
                            defaultChecked={true}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="extract-topics" className="text-sm text-neutral-700">
                          Extract and link topics
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="extract-topics"
                            className="sr-only"
                            defaultChecked={true}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="content-warnings" className="text-sm text-neutral-700">
                          Flag potentially sensitive content
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="content-warnings"
                            className="sr-only"
                            defaultChecked={false}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-0"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-xl font-semibold mb-6">Notification Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Notification Channels</h4>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label htmlFor="notification-email" className="text-sm font-medium text-neutral-700">
                            Email Notifications
                          </label>
                          <p className="text-xs text-neutral-500 mt-1">
                            Receive notifications about new newsletters via email
                          </p>
                        </div>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="notification-email"
                            className="sr-only"
                            checked={notificationEmail}
                            onChange={() => setNotificationEmail(!notificationEmail)}
                          />
                          <span className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                            notificationEmail ? 'translate-x-5' : 'translate-x-0'
                          }`}></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <label htmlFor="notification-browser" className="text-sm font-medium text-neutral-700">
                            Browser Notifications
                          </label>
                          <p className="text-xs text-neutral-500 mt-1">
                            Show desktop notifications when new newsletters arrive
                          </p>
                        </div>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="notification-browser"
                            className="sr-only"
                            checked={notificationBrowser}
                            onChange={() => setNotificationBrowser(!notificationBrowser)}
                          />
                          <span className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                            notificationBrowser ? 'translate-x-5' : 'translate-x-0'
                          }`}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">Notification Preferences</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Email Digest Frequency
                        </label>
                        <select className="input-field">
                          <option>Immediately</option>
                          <option>Daily digest</option>
                          <option>Weekly digest</option>
                          <option>Never</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="notify-summaries" className="text-sm text-neutral-700">
                          Notify when AI summaries are ready
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="notify-summaries"
                            className="sr-only"
                            defaultChecked={true}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="notify-trending" className="text-sm text-neutral-700">
                          Weekly trending topics report
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="notify-trending"
                            className="sr-only"
                            defaultChecked={true}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'tts' && (
              <div>
                <h3 className="text-xl font-semibold mb-6">Text-to-Speech Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Voice Type
                    </label>
                    <select 
                      className="input-field"
                      value={voiceType}
                      onChange={(e) => setVoiceType(e.target.value)}
                    >
                      <option value="neutral">Neutral</option>
                      <option value="friendly">Friendly</option>
                      <option value="professional">Professional</option>
                      <option value="news">News Anchor</option>
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">
                      Select the voice style for newsletter narration
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Speaking Speed
                    </label>
                    <select 
                      className="input-field"
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(e.target.value)}
                    >
                      <option value="0.75">Slow (0.75x)</option>
                      <option value="1.0">Normal (1.0x)</option>
                      <option value="1.25">Fast (1.25x)</option>
                      <option value="1.5">Very Fast (1.5x)</option>
                    </select>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">Additional Options</h4>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label htmlFor="skip-metadata" className="text-sm text-neutral-700">
                          Skip headers and metadata
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="skip-metadata"
                            className="sr-only"
                            defaultChecked={true}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-5"></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="read-summaries" className="text-sm text-neutral-700">
                          Prefer AI summaries over full content
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="read-summaries"
                            className="sr-only"
                            defaultChecked={false}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-0"></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label htmlFor="auto-play" className="text-sm text-neutral-700">
                          Auto-play when opening newsletter
                        </label>
                        <div className="relative inline-block w-10 h-5 rounded-full bg-neutral-300">
                          <input 
                            type="checkbox"
                            id="auto-play"
                            className="sr-only"
                            defaultChecked={false}
                          />
                          <span className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform translate-x-0"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div>
                <h3 className="text-xl font-semibold mb-6">Security Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-4">Change Password</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <button className="btn-primary">
                        Update Password
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">Security Options</h4>
                    
                    <div className="p-4 bg-warning-50 border border-warning-500 rounded-md mb-4 flex items-start">
                      <AlertTriangle size={20} className="text-warning-500 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-warning-700 font-medium">Two-factor authentication is not enabled</p>
                        <p className="text-xs text-warning-600 mt-1">
                          We strongly recommend enabling two-factor authentication to secure your account.
                        </p>
                      </div>
                    </div>
                    
                    <button className="btn-secondary flex items-center">
                      <span>Enable two-factor authentication</span>
                    </button>
                  </div>
                  
                  <div className="border-t border-neutral-200 pt-6">
                    <h4 className="font-medium mb-4">Sessions</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                        <div>
                          <p className="text-sm font-medium">Current session</p>
                          <p className="text-xs text-neutral-500">Started 45 minutes ago • Chrome on macOS</p>
                        </div>
                        <span className="px-2 py-0.5 bg-success-100 text-success-700 text-xs rounded-full">
                          Active
                        </span>
                      </div>
                      
                      <button className="text-sm text-error-600 hover:text-error-800 font-medium">
                        Sign out of all other sessions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;