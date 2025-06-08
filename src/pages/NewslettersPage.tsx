import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
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
  const [editModalSourceId, setEditModalSourceId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
    setEditModalSourceId(source.id);
    setShowEditModal(true);
    setUpdateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const name = formData?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      toast.error('Please enter a valid name');
      return;
    }
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateSource(editingId, formData.name);
      toast.success('Source updated successfully');
      setShowEditModal(false);
      setEditModalSourceId(null);
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
  const { bulkArchive } = useNewsletters();

  // Handle archive source (delete confirmation)
  const handleArchiveSource = async (sourceId: string) => {
    setDeleteConfirmId(sourceId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { data: newsletters, error: fetchError } = await supabase
        .from('newsletters')
        .select('id')
        .eq('newsletter_source_id', deleteConfirmId)
        .eq('is_archived', false);
      if (fetchError) throw fetchError;
      if (newsletters && newsletters.length > 0) {
        const newsletterIds = newsletters.map(nl => nl.id);
        await bulkArchive(newsletterIds);
      }
      await archiveNewsletterSource(deleteConfirmId);
      toast.success('Source and its newsletters have been archived');
      if (selectedSourceId === deleteConfirmId) {
        setSelectedSourceId(null);
      }
    } catch (error) {
      console.error('Error archiving source:', error);
      toast.error(errorArchivingSource?.message || 'Failed to archive source');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => setDeleteConfirmId(null);

  const [visibleTags, setVisibleTags] = useState<Set<string>>(new Set());
  const [loadingStates] = useState<Record<string, string>>({});
  const { readingQueue } = useReadingQueue();
  const queryClient = useQueryClient();

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

  const navigate = useNavigate();

  const {
    handleToggleLike,
    handleToggleArchive,
    handleToggleRead,
    handleToggleQueue,
    handleUpdateTags,
    handleTagClick
  } = useNewsletterRowHandlers({
    queryClient,
    searchParams: new URLSearchParams(),
    setSearchParams: () => {},
    navigateToInboxWithTag: (tagId) => {
      navigate(`/inbox?tag=${encodeURIComponent(tagId)}`);
    },
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

  useEffect(() => {
    if (errorNewsletters) {
      console.error('Error loading newsletters:', errorNewsletters);
    }
  }, [errorNewsletters]);

  return (
    <main className="max-w-6xl w-full mx-auto p-6 bg-neutral-50">
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
        <h2 className="text-xl font-semibold text-gray-800">Newsletter Sources</h2>
      </div>

      {/* Edit Modal */}
      <Transition.Root show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setShowEditModal(false);
          setEditModalSourceId(null);
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
                          setEditModalSourceId(null);
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

      {/* Delete Confirmation Modal */}
      <Transition.Root show={!!deleteConfirmId} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelDelete}>
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
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Delete Newsletter Source
                  </Dialog.Title>
                  <div className="mb-4 text-gray-700">
                    Are you sure you want to delete this source? This will archive all newsletters from this source.
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                      onClick={cancelDelete}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      onClick={confirmDelete}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Responsive Grid for Sources */}
      <section className="relative">
        {/* Gray overlay when editing */}
        {(showEditModal || !!deleteConfirmId) && (
          <div className="fixed inset-0 bg-gray-400 bg-opacity-40 z-40 pointer-events-auto transition-opacity" />
        )}
        {!isLoadingSources && !isErrorSources && sourcesWithCounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-2 relative z-50">
            {sourcesWithCounts.map((source: NewsletterSource) => {
              const isEditing = editModalSourceId === source.id;
              const isDeleting = deleteConfirmId === source.id;
              // Only show buttons if not editing/deleting any card, or if this is the card being edited/deleted
              const showButtons = !(showEditModal || !!deleteConfirmId) || isEditing || isDeleting;
              return (
                <div
                  key={source.id}
                  className={`group relative rounded-xl border transition-colors shadow-sm p-4 bg-white hover:border-blue-300 hover:shadow-md flex flex-col justify-between cursor-pointer ${
                    selectedSourceId === source.id ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50' : 'border-neutral-200'
                  }`}
                  style={{ minHeight: 170 }}
                  onClick={() => setSelectedSourceId(source.id)}
                >
                  {/* Edit/Delete icons on the right, only if allowed */}
                  {showButtons && !(isEditing || isDeleting) && (
                    <div className="absolute top-3 right-3 flex space-x-1 z-10">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleEdit(source);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 focus:outline-none rounded-full bg-white shadow"
                        title="Edit source"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleArchiveSource(source.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 focus:outline-none rounded-full bg-white shadow"
                        title="Delete source"
                        disabled={isArchivingSource}
                      >
                        {isArchivingSource ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col items-center justify-center pt-2 pb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      selectedSourceId === source.id ? 'bg-blue-200' : 'bg-gray-100'
                    }`}>
                      <span className={`text-lg font-bold ${
                        selectedSourceId === source.id ? 'text-blue-800' : 'text-gray-600'
                      }`}>
                        {source.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className={`font-medium text-xs truncate mb-1 max-w-full ${
                      selectedSourceId === source.id ? 'text-blue-900' : 'text-neutral-900'
                    }`} title={source.name}>
                      {source.name}
                    </h3>
                    <p className={`text-xs truncate max-w-full ${
                      selectedSourceId === source.id ? 'text-blue-700' : 'text-neutral-500'
                    }`} title={source.domain}>
                      {source.domain}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    {isLoadingCounts ? (
                      <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {source.newsletter_count || 0} {source.newsletter_count === 1 ? 'newsletter' : 'newsletters'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
