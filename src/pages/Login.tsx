import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { Inbox, Mail, Lock, AlertCircle } from 'lucide-react';

type LocationState = {
  from?: {
    pathname: string;
  };
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, user, loading, error } = useAuth();
  const location = useLocation();
  const locationState = location.state as LocationState;
  const from = locationState?.from?.pathname || '/inbox';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  };


  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - Form */}
      <div className="w-full md:w-1/2 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center mb-8">
            <div className="bg-primary-500 p-2 rounded-lg mr-3">
              <Inbox className="text-white" size={20} />
            </div>
            <h1 className="text-2xl font-bold">NewsletterHub</h1>
          </div>
          
          <h2 className="text-2xl font-bold mb-6">
            {isSignUp ? 'Create an account' : 'Sign in to your account'}
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-error-50 border border-error-500 rounded-md flex items-center text-error-700">
              <AlertCircle size={18} className="mr-2 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field pl-10"
                  placeholder="you@example.com"
                />
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pl-10"
                  placeholder="••••••••"
                  minLength={6}
                />
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </motion.div>
      </div>
      
      {/* Right side - Image and info */}
      <div className="hidden md:flex md:w-1/2 bg-primary-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-900"></div>
        <div className="relative z-10 p-12 flex flex-col h-full justify-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            All your newsletters in one place
          </h2>
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
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                className="flex items-center text-white"
              >
                <div className="mr-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-600 rounded-full -mb-32 -mr-32 opacity-20"></div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary-500 rounded-full -mt-16 -ml-16 opacity-20"></div>
      </div>
    </div>
  );
};

export default Login;