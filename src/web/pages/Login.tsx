import { useState, useMemo } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@common/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Inbox, Mail, Lock, AlertCircle, ArrowRight, Check, X } from 'lucide-react';

type LocationState = {
  from?: {
    pathname: string;
  };
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, user, loading, error, checkPasswordStrength } = useAuth();
  const location = useLocation();
  const locationState = location.state as LocationState;
  const from = locationState?.from?.pathname || '/inbox';

  // Check password strength and show requirements
  const passwordRequirements = useMemo(
    () => checkPasswordStrength(password),
    [password, checkPasswordStrength]
  );

  const isPasswordStrong = useMemo(
    () => passwordRequirements.every(req => req.satisfied),
    [passwordRequirements]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (!isPasswordStrong) {
        return; // Don't proceed if password doesn't meet requirements
      }
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Left side - Form */}
      <div className="w-full md:w-1/2 min-h-screen flex items-center justify-center p-6 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center justify-center mb-8">
            <div className="bg-primary-500 p-2 rounded-lg mr-3">
              <Inbox className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">NewsletterHub</h1>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h2>
          <p className="text-center text-gray-600 mb-8">
            {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                {!isSignUp && (
                  <Link 
                    to="/forgot-password" 
                    className="text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder={isSignUp ? 'Create a password' : '••••••••'}
                  minLength={8}
                />
              </div>
              
              {/* Password strength indicator */}
              {isSignUp && password && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">Password must contain:</p>
                  <ul className="space-y-1">
                    {passwordRequirements.map((req, i) => (
                      <li key={i} className="flex items-center">
                        {req.satisfied ? (
                          <Check className="h-3.5 w-3.5 text-green-500 mr-2" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-gray-400 mr-2" />
                        )}
                        <span className={`text-xs ${req.satisfied ? 'text-green-600' : 'text-gray-500'}`}>
                          {req.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading || (isSignUp && !isPasswordStrong)}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  loading || (isSignUp && !isPasswordStrong)
                    ? 'bg-primary-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                }`}
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="flex items-center">
                    {isSignUp ? 'Create account' : 'Sign in'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                }}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {isSignUp ? 'Sign in to existing account' : 'Create a new account'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Right side - Decorative */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNNTQuMDAxIDU0Ljk5OUw1LjAwMSA1NC45OTlMNS4wMDEgNS4wMDFMNTQuMDAxIDUuMDAxTDU0LjAwMSA1NC45OTlaIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWRhc2hhcnJheT0iMTAiIC8+Cjwvc3ZnPg==')] bg-repeat"></div>
        </div>
        
        <div className="relative z-10 p-12 flex flex-col h-full justify-center text-white">
          <div className="max-w-md">
            <h2 className="text-3xl font-bold mb-6">All your newsletters in one place</h2>
            <ul className="space-y-4">
              {[
                'Subscribe with unique email addresses',
                'Get AI-powered summaries',
                'Search all your content semantically',
                'Listen to newsletters via text-to-speech',
                'Discover related topics across newsletters'
              ].map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index, duration: 0.3 }}
                  className="flex items-start"
                >
                  <svg className="h-5 w-5 text-primary-200 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-primary-100">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-500 rounded-full -mb-32 -mr-32 opacity-20"></div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary-400 rounded-full -mt-16 -ml-16 opacity-30"></div>
      </div>
    </div>
  );
};

export default Login;