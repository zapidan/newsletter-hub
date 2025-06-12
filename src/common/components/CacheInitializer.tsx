import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createCacheManager, getCacheManager } from '../utils/cacheUtils';

type CacheInitializerProps = {
  children?: React.ReactNode;
};

export const CacheInitializer: React.FC<CacheInitializerProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      // Try to get the cache manager first to avoid re-initialization
      getCacheManager();
      setIsInitialized(true);
    } catch (error) {
      // If not initialized, create a new cache manager
      createCacheManager(queryClient, {
        enableOptimisticUpdates: true,
        enableCrossFeatureSync: true,
        enablePerformanceLogging: process.env.NODE_ENV === 'development',
      });
      setIsInitialized(true);
    }
  }, [queryClient]);

  // Only render children once the cache manager is initialized
  if (!isInitialized) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
};

// Export a hook to check if cache is initialized
export const useIsCacheInitialized = (): boolean => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      getCacheManager();
      setIsInitialized(true);
    } catch (error) {
      setIsInitialized(false);
    }
  }, []);

  return isInitialized;
};
