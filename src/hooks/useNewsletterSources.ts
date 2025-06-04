import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import { NewsletterSource } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

// Define the type for the variables passed to the mutation
interface AddNewsletterSourceVars {
  name: string;
  domain: string;
}

// Function to fetch newsletter sources
const fetchNewsletterSourcesFn = async (): Promise<NewsletterSource[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for fetching sources');
  }
  const user = userData.user;

  const { data, error } = await supabase
    .from('newsletter_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching newsletter sources:', error);
    throw error;
  }
  return data || [];
};

// Function to add a newsletter source
const addNewsletterSourceFn = async ({ name, domain }: AddNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for adding source');
  }
  const user = userData.user;

  let cleanedDomain = domain.toLowerCase().trim();
  cleanedDomain = cleanedDomain.replace(/^https?:\/\//, '');
  cleanedDomain = cleanedDomain.replace(/^www\./, '');
  cleanedDomain = cleanedDomain.replace(/\/$/, '');

  if (!name.trim() || !cleanedDomain) {
    throw new Error('Newsletter name and domain cannot be empty.');
  }

  const { data, error } = await supabase
    .from('newsletter_sources')
    .insert([{ name: name.trim(), domain: cleanedDomain, user_id: user.id }])
    .select()
    .single();

  if (error) {
    console.error('Error adding newsletter source:', error);
    throw error;
  }
  if (!data) {
    throw new Error('Failed to add newsletter source, no data returned.');
  }
  return data;
};

export function useNewsletterSources() {
  const queryClient = useQueryClient();

  const { 
    data: newsletterSources,
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: errorSources
  } = useQuery<NewsletterSource[], PostgrestError | Error, NewsletterSource[], string[]>({
    queryKey: ['newsletterSources'], // Query key for caching
    queryFn: fetchNewsletterSourcesFn,
  });

  const {
    mutate: addNewsletterSource,
    isPending: isAddingSource, // Corrected from isLoading to isPending for mutations
    isError: isErrorAddingSource,
    error: errorAddingSource,
    isSuccess: isSuccessAddingSource, // Optionally track success state
  } = useMutation<NewsletterSource, PostgrestError | Error, AddNewsletterSourceVars>({
    mutationFn: addNewsletterSourceFn,
    onSuccess: () => {
      // When a new source is added, invalidate the newsletterSources query to refetch
      queryClient.invalidateQueries({ queryKey: ['newsletterSources'] });
    },
    // onError can be handled here or by the component calling addNewsletterSource
  });

  return {
    newsletterSources: newsletterSources || [], // Provide a default empty array
    isLoadingSources,
    isErrorSources,
    errorSources,
    addNewsletterSource, // This is the mutate function
    isAddingSource,
    isErrorAddingSource,
    errorAddingSource,
    isSuccessAddingSource, // Expose success state if needed by UI
  };
}

