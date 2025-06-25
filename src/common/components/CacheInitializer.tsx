import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createCacheManager, getCacheManagerSafe } from "../utils/cacheUtils";

type CacheInitializerProps = {
  children?: React.ReactNode;
};

export const CacheInitializer: React.FC<CacheInitializerProps> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  // Initialize cache manager synchronously
  const isInitialized = useMemo(() => {
    // Try to get the cache manager first to avoid re-initialization
    const existingManager = getCacheManagerSafe();
    if (existingManager) {
      return true;
    } else {
      // If not initialized, create a new cache manager
      createCacheManager(queryClient, {
        enableOptimisticUpdates: true,
        enableCrossFeatureSync: true,
        enablePerformanceLogging: process.env.NODE_ENV === "development",
      });
      return true;
    }
  }, [queryClient]);

  // Only render children once the cache manager is initialized
  if (!isInitialized) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
};

