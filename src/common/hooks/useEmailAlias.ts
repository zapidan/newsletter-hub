import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { getUserEmailAlias } from '@common/utils/emailAlias'; // Updated path to match actual file location
import { User } from '@supabase/supabase-js';
import { useLogger } from '@common/utils/logger/useLogger';
import { queryKeyFactory } from '@common/utils/queryKeyFactory';

type AppUser = User | null;

export function useEmailAlias() {
  const log = useLogger('useEmailAlias');
  const [user, setUser] = useState<AppUser>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch the current user when the component mounts
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    fetchUser();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Use React Query to fetch email alias with proper caching
  const {
    data: emailAlias = '',
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeyFactory.user.emailAlias(user?.id),
    queryFn: getUserEmailAlias,
    enabled: !!user, // Only fetch when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - email alias doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      // Don't retry if user is not authenticated
      if (error?.message?.includes('Auth session missing')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),
  });

  // Convert query error to string
  const error = queryError ? 'Failed to load email alias' : null;

  // Copy email alias to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!emailAlias) return false;

    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      log.error(
        'Failed to copy email alias',
        {
          action: 'copy_email_alias',
          metadata: { emailAlias },
        },
        err instanceof Error ? err : new Error(String(err))
      );
      return false;
    }
  }, [emailAlias, log]);

  // Create refresh function that uses React Query's refetch
  const refresh = useCallback(() => {
    if (user) {
      return refetch();
    }
    return Promise.resolve();
  }, [user, refetch]);

  return {
    emailAlias,
    loading,
    error,
    copied,
    copyToClipboard,
    refresh,
  };
}
