import React, { useState, FormEvent, useCallback } from 'react';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { NewsletterSource } from '../types';
import { PlusCircle, AlertTriangle, Loader2, ArrowLeft, Trash2, Edit, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import NewsletterCard from '../components/NewsletterCard';

const NewslettersPage: React.FC = () => {
  const [showAddSource, setShowAddSource] = useState<boolean>(true);
  const {
    newsletterSources,
    isLoadingSources,
    isErrorSources,
    errorSources,
    addNewsletterSource,
    deleteNewsletterSource,
    isDeletingSource,
    updateNewsletterSource,
    isUpdatingSource,
    isSuccessUpdatingSource,
    isAddingSource,
    isErrorAddingSource,
    errorAddingSource,
    isSuccessAddingSource,
  } = useNewsletterSources();

  React.useEffect(() => {
    if (newsletterSources) {
      if (newsletterSources.length > 0) setShowAddSource(false);
      if (newsletterSources.length === 0) setShowAddSource(true);
    }
  }, [newsletterSources]);

  const [formData, setFormData] = useState({
    name: '',
    domain: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear form
  const resetForm = useCallback(() => {
    setFormData({ name: '', domain: '' });
    setEditingId(null);
  }, []);

  // Handle edit
  const handleEdit = (source: NewsletterSource) => {
    setFormData({
      name: source.name,
      domain: source.domain
    });
    setEditingId(source.id);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    resetForm();
  };

  // Handle delete with confirmation
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this source? This action cannot be undone.')) {
      try {
        await deleteNewsletterSource(id);
        toast.success('Source deleted successfully');
      } catch (error) {
        toast.error('Failed to delete source');
      }
    }
  };

  // Reset form on successful add/update
  React.useEffect(() => {
    if (isSuccessAddingSource || isSuccessUpdatingSource) {
      resetForm();
      const message = isSuccessAddingSource ? 'Source added successfully' : 'Source updated successfully';
      toast.success(message);
    }
  }, [isSuccessAddingSource, isSuccessUpdatingSource, resetForm]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.name.trim() || !formData.domain.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      if (editingId) {
        await updateNewsletterSource({ 
          id: editingId, 
          name: formData.name, 
          domain: formData.domain 
        });
      } else {
        await addNewsletterSource({ 
          name: formData.name, 
          domain: formData.domain 
        });
      }
    } catch (error) {
      // Error handling is done by the mutation

    }
  };

  // State for selected source
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Fetch newsletters for the selected source
  const {
    data: newslettersForSource = [],
    isLoading: isLoadingNewslettersForSource,
    isError: isErrorNewslettersForSource,
    error: errorNewslettersForSource,
  } = useQuery<{ id: string }[]>({
    queryKey: ['newslettersBySource', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId) return [];
      const { data, error } = await supabase
        .from('newsletters')
        .select(`*, newsletter_tags ( tag:tags (id, name, color) ), newsletter_source_id`)
        .eq('newsletter_source_id', selectedSourceId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      // Transform tags to match NewsletterCard expectations
      return (data || []).map((item: any) => ({
        ...item,
        tags: (item.newsletter_tags || []).map((nt: any) => nt.tag)
      }));
    },
    enabled: !!selectedSourceId
  });

  return (
    <main className="max-w-4xl w-full mx-auto p-6">
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

      {/* Add New Source Form (Collapsible) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-primary-800">Add New Source</h2>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800 focus:outline-none flex items-center gap-1"
            onClick={() => setShowAddSource(s => !s)}
            aria-expanded={showAddSource}
          >
            {showAddSource ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
            <span className="font-medium text-sm">{showAddSource ? 'Hide' : 'Show'}</span>
          </button>
        </div>
        {showAddSource && (
          <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm mt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newsletterName" className="block text-sm font-medium text-gray-700 mb-1">
                  Newsletter Name
                </label>
                <input
                  type="text"
                  id="newsletterName"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                  disabled={isAddingSource || isUpdatingSource}
                />
              </div>
              <div>
                <label htmlFor="newsletterDomain" className="block text-sm font-medium text-gray-700 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  id="newsletterDomain"
                  name="domain"
                  value={formData.domain}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                  disabled={isAddingSource || isUpdatingSource}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  disabled={isAddingSource || isUpdatingSource}
                >
                  {editingId ? <Check className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingId ? 'Update Source' : 'Add Source'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    onClick={handleCancelEdit}
                    disabled={isAddingSource || isUpdatingSource}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {/* Error State */}
            {isErrorAddingSource && errorAddingSource && (
              <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-md mt-4">
                <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                <span>Error: {errorAddingSource.message}</span>
              </div>
            )}
          </div>
        )}
      </section>

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
        {isErrorSources && errorSources && (
          <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-md">
            <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
            <span>Error loading sources: {errorSources.message}</span>
          </div>
        )}
        {/* Display if no sources and not loading/error */}
        {!isLoadingSources && !isErrorSources && newsletterSources.length === 0 && (
          <p className="text-gray-500 italic">No newsletter sources defined yet. Add one above!</p>
        )}
        {/* Display the list if data is available */}
        {!isLoadingSources && !isErrorSources && newsletterSources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {newsletterSources.map((source: NewsletterSource) => (
              <div
                key={source.id}
                className={`group relative cursor-pointer rounded-xl border transition-colors shadow-sm px-5 py-5 bg-white hover:border-blue-300 hover:shadow-md ${selectedSourceId === source.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-neutral-200'}`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="truncate font-semibold text-lg text-neutral-900 max-w-[160px]">{source.name}</span>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); handleEdit(source); }}
                      className="p-1 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      disabled={isDeletingSource || isUpdatingSource}
                      title="Edit Source"
                    >
                      <Edit size={17} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(source.id); }}
                      className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-50"
                      disabled={isDeletingSource || isUpdatingSource}
                      title="Delete Source"
                    >
                      {isDeletingSource ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  </div>
                </div>
                <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium rounded-full px-3 py-1 mb-2">{source.domain}</span>
                <div className="text-xs text-neutral-500">Added {new Date(source.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Newsletters for selected source */}
      {selectedSourceId && (
        <section className="mt-10">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {newslettersForSource.map((newsletter: any) => (
                <NewsletterCard key={newsletter.id} newsletter={newsletter} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default NewslettersPage;