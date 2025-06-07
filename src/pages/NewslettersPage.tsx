import React, { useState, useEffect, useCallback, Fragment, FormEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { useNewsletters } from '../hooks/useNewsletters';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X, Check, AlertTriangle, Heart, Archive, ArchiveX, ArrowLeft, Tag as TagIcon, Plus, Bookmark } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { useTags } from '../hooks/useTags';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Newsletter, NewsletterSource } from '../types';


const NewslettersPage: React.FC = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [sourcesWithCounts, setSourcesWithCounts] = useState<NewsletterSource[]>([]);
  
  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    updateSource,
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

  const handleSubmit = async (e: FormEvent) => {
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
  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<Record<string, 'archive' | 'unarchive' | 'like' | 'tags' | null>>({});
  
  const { toggleInQueue, readingQueue } = useReadingQueue();
  const { updateNewsletterTags } = useTags();
  const { 
    archiveNewsletter, 
    unarchiveNewsletter,
    toggleLike,
    errorTogglingLike
  } = useNewsletters(undefined, selectedSourceId ? 'all' : 'inbox');
  
  const queryClient = useQueryClient();

  // Handle like toggle
  const handleLikeToggle = useCallback(async (newsletter: Newsletter) => {
    setLoadingStates(prev => ({ ...prev, [newsletter.id]: 'like' }));
    
    try {
      await toggleLike(newsletter.id);
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ 
          queryKey: ['newslettersBySource', selectedSourceId],
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({ 
          queryKey: ['newsletters'],
          refetchType: 'active',
        })
      ]);
    } catch (error) {
      toast.error('Failed to update like status');
      console.error('Like error:', error);
    } finally {
      setLoadingStates(prev => {
        const newStates = { ...prev };
        delete newStates[newsletter.id];
        return newStates;
      });
    }
  }, [toggleLike, queryClient, selectedSourceId]);

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

  // Fetch newsletters for the selected source
  const {
    data: newslettersForSource = [],
    isLoading: isLoadingNewslettersForSource,
    isError: isErrorNewslettersForSource,
    error: errorNewslettersForSource,
  } = useQuery<Newsletter[]>({
    queryKey: ['newslettersBySource', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId) return [];
      const { data, error } = await supabase
        .from('newsletters')
        .select(`*, 
          newsletter_tags ( tag:tags (id, name, color) ), 
          newsletter_source_id,
          newsletter_sources (id, name, domain)
        `)
        .eq('newsletter_source_id', selectedSourceId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      // Transform tags to match NewsletterCard expectations
      return (data || []).map((item: any) => ({
        ...item,
        source: item.newsletter_sources,
        tags: (item.newsletter_tags || []).map((nt: any) => nt.tag)
      }));
    },
    enabled: !!selectedSourceId
  });

  // Handle archive/unarchive
  const handleArchiveToggle = useCallback(async (newsletter: Newsletter, currentFilter: 'all' | 'inbox' | 'archived' = 'inbox') => {
    const action = newsletter.is_archived ? 'unarchive' : 'archive';
    setLoadingStates(prev => ({ ...prev, [newsletter.id]: action }));
    
    try {
      if (newsletter.is_archived) {
        await unarchiveNewsletter(newsletter.id);
        toast.success('Newsletter unarchived');
      } else {
        await archiveNewsletter(newsletter.id);
        toast.success('Newsletter archived');
      }
      
      // Invalidate all relevant queries
      await Promise.all([
        // Invalidate the source-specific query if we're viewing a source
        selectedSourceId && queryClient.invalidateQueries({ 
          queryKey: ['newslettersBySource', selectedSourceId],
          refetchType: 'active',
          exact: true
        }),
        // Invalidate the main newsletters query
        queryClient.invalidateQueries({ 
          queryKey: ['newsletters'],
          refetchType: 'active',
          exact: true
        }),
        // Invalidate filtered queries
        queryClient.invalidateQueries({ 
          queryKey: ['newsletters', 'inbox'],
          refetchType: 'active',
          exact: true
        }),
        queryClient.invalidateQueries({ 
          queryKey: ['newsletters', 'archived'],
          refetchType: 'active',
          exact: true
        })
      ].filter(Boolean));
      
      // Force a refetch of the current view
      await queryClient.refetchQueries({
        queryKey: selectedSourceId 
          ? ['newslettersBySource', selectedSourceId]
          : ['newsletters', currentFilter === 'archived' ? 'archived' : 'inbox'],
        type: 'active',
        exact: true
      });
    } catch (error) {
      toast.error(`Failed to ${newsletter.is_archived ? 'unarchive' : 'archive'} newsletter`);
      console.error('Archive error:', error);
      // Force a hard refresh of the current query
      await queryClient.refetchQueries({
        queryKey: ['newslettersBySource', selectedSourceId],
        type: 'active',
      });
    } finally {
      setLoadingStates(prev => {
        const newStates = { ...prev };
        delete newStates[newsletter.id];
        return newStates;
      });
    }
  }, [archiveNewsletter, unarchiveNewsletter, queryClient, selectedSourceId]);

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

      {/* Edit functionality is now handled by the main modal */}

      {/* Existing Sources List */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-primary-800">Existing Sources</h2>
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(source);
                    }}
                    className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title="Edit source"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
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
          {isLoadingNewslettersForSource ? (
            <div className="flex items-center text-gray-500">
              <Loader2 className="animate-spin mr-2" /> Loading newsletters...
            </div>
          ) : isErrorNewslettersForSource ? (
            <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
              <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
              <span>Error loading newsletters: {errorNewslettersForSource?.message}</span>
            </div>
          ) : newslettersForSource.length === 0 ? (
            <p className="text-gray-500 italic">No newsletters found for this source.</p>
          ) : (
            <div className="space-y-2">
              {newslettersForSource.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className={`rounded-lg p-4 flex items-start cursor-pointer transition-all duration-200 ${
                    !newsletter.is_read 
                      ? 'bg-blue-300 border-l-4 border-blue-800 hover:bg-blue-400 shadow-lg shadow-blue-200' 
                      : 'bg-white border border-neutral-200 hover:bg-neutral-50'
                  }`}
                  onClick={() => navigate(`/inbox/${newsletter.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-1">
                      <img
                        src={newsletter.image_url || '/newsletter-icon.svg'}
                        alt={newsletter.title}
                        className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0 mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-base truncate">{newsletter.title || 'No subject'}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {newsletter.source?.name || 'Unknown Source'}
                              {newsletter.source?.domain && (
                                <span className="text-gray-400 ml-2">• {newsletter.source.domain}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 mt-1">
                          {/* Like button */}
                          <button
                            type="button"
                            className={`p-1.5 transition-colors ${newsletter.is_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} ${errorTogglingLike ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleLikeToggle(newsletter);
                            }}
                            disabled={!!errorTogglingLike || loadingStates[newsletter.id] === 'like'}
                            title={newsletter.is_liked ? 'Unlike' : 'Like'}
                          >
                            {loadingStates[newsletter.id] === 'like' ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            ) : (
                              <Heart 
                                className="h-4 w-4"
                                fill={newsletter.is_liked ? '#EF4444' : 'none'}
                                stroke={newsletter.is_liked ? '#EF4444' : '#9CA3AF'}
                                strokeWidth={1.5}
                              />
                            )}
                          </button>
                          {/* Tag visibility toggle */}
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-200"
                            onClick={(e) => toggleTagVisibility(newsletter.id, e)}
                            title={visibleTags.has(newsletter.id) ? 'Hide tags' : 'Edit tags'}
                          >
                            <TagIcon 
                              size={16} 
                              className={`${visibleTags.has(newsletter.id) ? 'text-primary-600' : 'text-gray-500'} hover:text-primary-600`}
                            />
                          </button>
                          {/* Reading queue button */}
                          <button
                            type="button"
                            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const isInQueue = readingQueue.some(item => item.newsletter_id === newsletter.id);
                                await toggleInQueue(newsletter.id);
                                // Invalidate relevant queries
                                await Promise.all([
                                  queryClient.invalidateQueries({ queryKey: ['newslettersBySource', selectedSourceId] }),
                                  queryClient.invalidateQueries({ queryKey: ['readingQueue'] })
                                ]);
                                toast.success(isInQueue ? 'Removed from reading queue' : 'Added to reading queue');
                              } catch (error) {
                                toast.error('Failed to update reading queue');
                                console.error('Reading queue error:', error);
                              }
                            }}
                            title={readingQueue.some(item => item.newsletter_id === newsletter.id) ? 'Remove from reading queue' : 'Add to reading queue'}
                          >
                            <Bookmark 
                              className="h-4 w-4"
                              fill={readingQueue.some(item => item.newsletter_id === newsletter.id) ? '#9CA3AF' : 'none'}
                              stroke="#9CA3AF"
                              strokeWidth={1.5}
                            />
                          </button>
                          {/* Archive/Unarchive button */}
                          <button
                            type="button"
                            className={`p-1 rounded-full hover:bg-gray-200 transition-colors ${loadingStates[newsletter.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Use 'archived' if viewing archived items, otherwise 'inbox'
                              const currentFilter = selectedSourceId ? 'all' : (newsletter.is_archived ? 'archived' : 'inbox');
                              await handleArchiveToggle(newsletter, currentFilter);
                            }}
                            disabled={!!loadingStates[newsletter.id]}
                            title={newsletter.is_archived ? 'Unarchive' : 'Archive'}
                          >
                            {loadingStates[newsletter.id] === 'archive' || loadingStates[newsletter.id] === 'unarchive' ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            ) : newsletter.is_archived ? (
                              <ArchiveX className="h-4 w-4 text-green-700" />
                            ) : (
                              <Archive className="h-4 w-4 text-gray-400 hover:text-amber-700" />
                            )}
                          </button>
                        </div>
                        {/* Newsletter summary */}
                        <div className="text-sm text-gray-700 mb-2 line-clamp-2">{newsletter.summary}</div>
                        
                        {/* Tags */}
                        {visibleTags.has(newsletter.id) && (
                          <div className="w-full mt-2" onClick={e => e.stopPropagation()}>
                            <TagSelector
                              selectedTags={newsletter.tags || []}
                              onTagsChange={async (newTags) => {
                                setLoadingStates(prev => ({ ...prev, [newsletter.id]: 'tags' }));
                                try {
                                  const ok = await updateNewsletterTags(newsletter.id, newTags);
                                  if (ok) {
                                    // Invalidate relevant queries to refresh the UI
                                    await Promise.all([
                                      queryClient.invalidateQueries({ 
                                        queryKey: ['newslettersBySource', selectedSourceId],
                                        refetchType: 'active',
                                      }),
                                      queryClient.invalidateQueries({ 
                                        queryKey: ['newsletters'],
                                        refetchType: 'active',
                                      })
                                    ]);
                                    
                                    // Close the tag editor
                                    setVisibleTags(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(newsletter.id);
                                      return newSet;
                                    });
                                    
                                    toast.success('Tags updated successfully');
                                  } else {
                                    throw new Error('Failed to update tags');
                                  }
                                } catch (error) {
                                  console.error('Error updating tags:', error);
                                  toast.error('Failed to update tags');
                                } finally {
                                  setLoadingStates(prev => ({ ...prev, [newsletter.id]: null }));
                                }
                              }}
                              className="mt-1"
                              disabled={loadingStates[newsletter.id] === 'tags'}
                            />
                          </div>
                        )}
                        
                        {/* Date */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex flex-wrap gap-1">
                            {newsletter.tags?.map((tag: any) => (
                              <span 
                                key={tag.id}
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  color: tag.color,
                                  border: `1px solid ${tag.color}40`
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(newsletter.received_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default NewslettersPage;
