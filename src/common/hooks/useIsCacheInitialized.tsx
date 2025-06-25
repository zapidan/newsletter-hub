import { useState, useEffect } from "react";
import { getCacheManagerSafe } from "../utils/cacheUtils";

// Export a hook to check if cache is initialized
export const useIsCacheInitialized = (): boolean => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const manager = getCacheManagerSafe();
    setIsInitialized(!!manager);
  }, []);

  return isInitialized;
};
