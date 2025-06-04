import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useEmailAlias } from '../hooks/useEmailAlias';

interface EmailAliasDisplayProps {
  showRefresh?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export const EmailAliasDisplay: React.FC<EmailAliasDisplayProps> = ({ 
  showRefresh = false,
  className = '',
  size = 'md'
}) => {
  const { emailAlias, loading, error, copyToClipboard, refresh } = useEmailAlias();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleCopy = async () => {
    if (!emailAlias) return;
    await copyToClipboard();
  };

  const handleRefresh = async () => {
    if (!showRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 text-gray-500 ${sizeClasses[size]} ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading email alias...</span>
      </div>
    );
  }

  if (error || !emailAlias) {
    return (
      <div className={`text-red-500 ${sizeClasses[size]} ${className}`}>
        {error || 'Failed to load email alias'}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${sizeClasses[size]} ${className}`}>
      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded break-all">
        {emailAlias}
      </code>
      
      <button
        onClick={handleCopy}
        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Copy to clipboard"
      >
        <Copy className="w-4 h-4" />
      </button>
      
      {showRefresh && (
        <button
          onClick={handleRefresh}
          className={`p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          title="Generate new alias"
          disabled={isRefreshing}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
