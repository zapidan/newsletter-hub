import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getUserEmailAlias } from '../utils/emailAlias';

type User = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
  };
} | null;

export function useEmailAlias() {
  const [user, setUser] = useState<User>(null);
  const [emailAlias, setEmailAlias] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch the current user when the component mounts
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    fetchUser();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session) => {
      setUser(session?.user || null);
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch email alias when user changes
  const fetchEmailAlias = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const alias = await getUserEmailAlias(user);
      setEmailAlias(alias);
    } catch (err) {
      console.error('Error fetching email alias:', err);
      setError('Failed to load email alias');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Copy email alias to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!emailAlias) return false;
    
    try {
      await navigator.clipboard.writeText(emailAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, [emailAlias]);

  // Initial fetch of email alias
  useEffect(() => {
    fetchEmailAlias();
  }, [fetchEmailAlias]);

  return {
    emailAlias,
    loading,
    error,
    copied,
    copyToClipboard,
    refresh: fetchEmailAlias,
  };
}
