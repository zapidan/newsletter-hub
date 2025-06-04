import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import { NewsletterSource } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

// Define the type for the variables passed to the mutation
interface NewsletterSourceVars {
  name: string;
  domain: string;
  id?: string;
}

interface AddNewsletterSourceVars extends Omit<NewsletterSourceVars, 'id'> {}

interface UpdateNewsletterSourceVars extends NewsletterSourceVars {
  id: string;
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
const cleanDomain = (domain: string): string => {
  let cleaned = domain.toLowerCase().trim();
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  return cleaned.replace(/\/$/, '');
};

const addNewsletterSourceFn = async ({ name, domain }: AddNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for adding source');
  }
  const user = userData.user;

  const cleanedDomain = cleanDomain(domain);

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

// Function to update a newsletter source
const updateNewsletterSourceFn = async ({ id, name, domain }: UpdateNewsletterSourceVars): Promise<NewsletterSource> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for updating source');
  }

  const cleanedDomain = cleanDomain(domain);

  if (!name.trim() || !cleanedDomain) {
    throw new Error('Newsletter name and domain cannot be empty.');
  }

  const { data, error } = await supabase
    .from('newsletter_sources')
    .update({ 
      name: name.trim(), 
      domain: cleanedDomain,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating newsletter source:', error);
    throw error;
  }
  if (!data) {
    throw new Error('Failed to update newsletter source, no data returned.');
  }
  return data;
};

// Function to delete a newsletter source
const deleteNewsletterSourceFn = async (id: string): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw userError || new Error('User not found for deleting source');
  }

  const { error } = await supabase
    .from('newsletter_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);

  if (error) {
    console.error('Error deleting newsletter source:', error);
    throw error;
  }
};

export function useNewsletterSources() {
  const queryClient = useQueryClient();

  const { 
    data: newsletterSources,
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: errorSources
  } = useQuery<NewsletterSource[], PostgrestError | Error, NewsletterSource[], string[]>({
    queryKey: ['newsletterSources'],
    queryFn: fetchNewsletterSourcesFn,
  });

  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: ['newsletterSources'] });
  };

  // Add mutation
  const {
    mutate: addNewsletterSource,
    isPending: isAddingSource,
    isError: isErrorAddingSource,
    error: errorAddingSource,
    isSuccess: isSuccessAddingSource,
  } = useMutation<NewsletterSource, PostgrestError | Error, AddNewsletterSourceVars>({
    mutationFn: addNewsletterSourceFn,
    onSuccess: invalidateSources,
  });

  // Update mutation
  const {
    mutate: updateNewsletterSource,
    isPending: isUpdatingSource,
    isError: isErrorUpdatingSource,
    error: errorUpdatingSource,
    isSuccess: isSuccessUpdatingSource,
  } = useMutation<NewsletterSource, PostgrestError | Error, UpdateNewsletterSourceVars>({
    mutationFn: updateNewsletterSourceFn,
    onSuccess: invalidateSources,
  });

  // Delete mutation
  const {
    mutate: deleteNewsletterSource,
    isPending: isDeletingSource,
    isError: isErrorDeletingSource,
    error: errorDeletingSource,
    isSuccess: isSuccessDeletingSource,
  } = useMutation<void, PostgrestError | Error, string>({
    mutationFn: deleteNewsletterSourceFn,
    onSuccess: invalidateSources,
  });

  return {
    // Sources data
    newsletterSources: newsletterSources || [],
    isLoadingSources,
    isErrorSources,
    errorSources,
    
    // Add source
    addNewsletterSource,
    isAddingSource,
    isErrorAddingSource,
    errorAddingSource,
    isSuccessAddingSource,
    
    // Update source
    updateNewsletterSource,
    isUpdatingSource,
    isErrorUpdatingSource,
    errorUpdatingSource,
    isSuccessUpdatingSource,
    
    // Delete source
    deleteNewsletterSource,
    isDeletingSource,
    isErrorDeletingSource,
    errorDeletingSource,
    isSuccessDeletingSource,
  };
}

