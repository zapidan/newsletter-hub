import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../services/supabaseClient';
import { Newsletter, NewsletterSource } from '../types';
import { useNewsletters } from '../hooks/useNewsletters';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useNewsletterRowHandlers } from '../utils/newsletterRowHandlers';
import { Loader2, AlertTriangle, ArrowLeft, X, Check } from 'lucide-react';
import NewsletterRow from '../components/NewsletterRow';

const NewslettersPage: React.FC = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [sourcesWithCounts, setSourcesWithCounts] = useState<NewsletterSource[]>([]);
  
  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    updateSource,
    archiveNewsletterSource,
    isArchivingSource,
    errorArchivingSource,
  } = useNewsletterSources();

  // Update sources with counts when they're loaded
  useEffect(() => {
    if (newsletterSources && newsletterSources.length > 0) {
      setSourcesWithCounts(newsletterSources);
      setIsLoadingCounts(false);
    } else if (!isLoadingSources) {
      setIsLoadingCounts(false);
    }
  }, [newsletterSources, isLoadingSources]);

  const [formData, setFormData] = useState({
    name: '',
    domain: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle editing a source
  const handleEdit = (source: NewsletterSource) => {
    setFormData({
      name: source.name,
      domain: source.domain
    });
    setEditingId(source.id);
    setShowEditModal(true);
    setUpdateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingId) return;
    
    // Client-side validation with null checks
    const name = formData?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      // Pass id and name as separate arguments
      await updateSource(editingId, formData.name);
      toast.success('Source updated successfully');
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating source:', error);
      setUpdateError(error as Error);
      toast.error('Failed to update source');
    } finally {
      setIsUpdating(false);
    }
  };

  // State for selected source
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  
  // Get the bulkArchive function from useNewsletters
  const { bulkArchive } = useNewsletters();
  
  // Handle archive source
  const handleArchiveSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source? This will archive all newsletters from this source.')) {
      return;
    }
    
    try {
      // First, get all newsletter IDs for this source that aren't already archived
      const { data: newsletters, error: fetchError } = await supabase
        .from('newsletters')
        .select('id')
        .eq('newsletter_source_id', sourceId)
        .eq('is_archived', false);
      
      if (fetchError) throw fetchError;
      
      // Archive all newsletters from this source
      if (newsletters && newsletters.length > 0) {
        const newsletterIds = newsletters.map(nl => nl.id);
        await bulkArchive(newsletterIds);
      }
      
      // Then archive the source
      await archiveNewsletterSource(sourceId);
      
      // Show success message
      toast.success('Source and its newsletters have been archived');
      
      // Clear selection if the archived source was selected
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(null);
      }
      
    } catch (error) {
      console.error('Error archiving source:', error);
      toast.error(errorArchivingSource?.message || 'Failed to archive source');
    }
  };

  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [loadingStates, _] = useState<Record<string, string>>({});
  
  const { readingQueue } = useReadingQueue();
  const queryClient = useQueryClient();
  
  // Use the allNewsletters array as the single source of truth
  const { 
    newsletters: allNewsletters = [],
    isLoadingNewsletters,
    isErrorNewsletters,
    errorNewsletters,
    errorTogglingLike
  } = useNewsletters(undefined, selectedSourceId ? 'source' : 'inbox', selectedSourceId || undefined);
  
  const newsletters = allNewsletters;
  const isLoading = isLoadingNewsletters;
  const isError = isErrorNewsletters;

  // Set up shared handlers using useNewsletterRowHandlers
  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleToggleQueue,
    handleUpdateTags,
    handleTagClick
  } = useNewsletterRowHandlers({
    queryClient,
    searchParams: new URLSearchParams(), // Empty for this page
    setSearchParams: () => {}, // No-op for this page
  });

  const toggleTagVisibility = useCallback((newsletterId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisibleTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(newsletterId)) {
        newSet.delete(newsletterId);
      } else {
        newSet.add(newsletterId);
      }
      return newSet;
    });
  }, []);

  // Log any errors
  useEffect(() => {
    if (errorNewsletters) {
      console.error('Error loading newsletters:', errorNewsletters);
    }
  }, [errorNewsletters]);

  return (
    <main className="max-w-4xl w-full mx-auto p-6 bg-neutral-50">
      <button
        onClick={() => window.history.back()}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inbox
      </button>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary-900">Manage Newsletter Sources</h1>
        <p className="text-gray-600 mt-1">
          Define your newsletter sources by name and their primary email domain.
        </p>
      </header>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Newsletter Sources</h1>
      </div>

      {/* Add/Edit Source Modal */}
      <Transition.Root show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowEditModal(false);
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-neutral-200 bg-opacity-90 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-neutral-50 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Edit Newsletter Source
                  </Dialog.Title>
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        id="name"
                        className="w-full rounded-md border border-gray-300 p-2 focus:ring focus:ring-blue-200"
                        value={formData.name}
                        onChange={handleInputChange}
                        name="name"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                      <div className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 p-2 text-sm text-gray-600">
                        {formData.domain}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className={`inline-flex items-center px-4 py-2 font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isUpdating
                            ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300'
                        }`}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Update Source
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
                        onClick={() => {
                          setShowEditModal(false);
                        }}
                        disabled={isUpdating}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </form>
                  {updateError && (
                    <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md mt-4">
                      <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                      <span>Error: {updateError.message}</span>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Existing Sources List */}
      <section>
        {/* Display loading state for the list */}
        {isLoadingSources && (
          <div className="flex items-center justify-center text-gray-500 py-6">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span>Loading sources...</span>
          </div>
        )}
        {/* Display error state for the list */}
        {isErrorSources && errorSources?.message && (
          <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
            <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
            <span>Error loading sources: {errorSources.message}</span>
          </div>
        )}
        {/* Display if no sources and not loading/error */}
        {!isLoadingSources && !isErrorSources && newsletterSources.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No newsletter sources</h3>
          </div>
        )}
        {/* Display the list if data is available */}
        {!isLoadingSources && !isErrorSources && sourcesWithCounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
            {sourcesWithCounts.map((source: NewsletterSource) => (
              <div
                key={source.id}
                className={`group relative rounded-xl border transition-colors shadow-sm p-6 bg-white hover:border-blue-300 hover:shadow-md ${
                  selectedSourceId === source.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <h3 className="truncate font-semibold text-lg text-neutral-900">{source.name}</h3>
                    <p className="text-sm text-neutral-500 truncate">{source.domain}</p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(source);
                      }}
                      className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-blue-600 focus:outline-none"
                      title="Edit source"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleArchiveSource(source.id);
                      }}
                      className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-red-600 focus:outline-none"
                      title="Archive source"
                      disabled={isArchivingSource}
                    >
                      {isArchivingSource ? (
                        <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end items-center mt-4">
                  <div className="flex items-center">
                    {isLoadingCounts ? (
                      <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {source.newsletter_count || 0} {source.newsletter_count === 1 ? 'newsletter' : 'newsletters'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Newsletters for selected source */}
      {selectedSourceId && (
        <section className="mt-12">
          <h3 className="text-lg font-semibold mb-4 text-primary-800">Newsletters from this Source</h3>
          {isLoading ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="animate-spin mr-2" /> Loading newsletters...
            </div>
          ) : isError ? (
            <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
              <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
              <span>Error loading newsletters: {errorNewsletters?.message}</span>
            </div>
          ) : newsletters.length === 0 ? (
            <p className="text-gray-500 italic">No newsletters found for this source.</p>
          ) : (
            <div className="space-y-2">
              {newsletters.map((newsletter: Newsletter) => (
                <NewsletterRow
                  key={newsletter.id}
                  newsletter={newsletter}
                  isSelected={false}
                  onToggleLike={handleToggleLike}
                  onToggleArchive={handleToggleArchive}
                  onToggleRead={handleToggleRead}
                  onTrash={() => {}}
                  onToggleQueue={handleToggleQueue}
                  onToggleTagVisibility={toggleTagVisibility}
                  onUpdateTags={handleUpdateTags}
                  onTagClick={handleTagClick}
                  visibleTags={visibleTags}
                  readingQueue={readingQueue}
                  isDeletingNewsletter={false}
                  loadingStates={loadingStates}
                  errorTogglingLike={errorTogglingLike}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default NewslettersPage;
