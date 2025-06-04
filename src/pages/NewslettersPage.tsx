import React, { useState, FormEvent, useCallback } from 'react';
import { useNewsletterSources } from '../hooks/useNewsletterSources';
import { NewsletterSource } from '../types';
import { PlusCircle, AlertTriangle, Loader2, ArrowLeft, Trash2, Edit, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

const NewslettersPage: React.FC = () => {
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



  return (
    <div className="max-w-4xl w-full mx-auto p-6">
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

      {/* Add New Source Form */}
      <section className="mb-10 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary-800">Add New Source</h2>
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
              placeholder="e.g., Tech Weekly Digest"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              disabled={isAddingSource || isUpdatingSource}
            />
          </div>
          <div>
            <label htmlFor="emailDomain" className="block text-sm font-medium text-gray-700 mb-1">
              Email Domain
            </label>
            <input
              type="text"
              id="emailDomain"
              name="domain"
              value={formData.domain}
              onChange={handleInputChange}
              placeholder="e.g., example.com (not an email address)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              disabled={isAddingSource || isUpdatingSource}
            />
             <p className="mt-1 text-xs text-gray-500">Enter the main domain, like 'newsletter.com', not 'contact@newsletter.com'.</p>
          </div>
          
          {/* Display error from adding source mutation */}
          {isErrorAddingSource && errorAddingSource && (
            <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md">
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              <span>{errorAddingSource.message}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isAddingSource || isUpdatingSource || isLoadingSources}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {(isAddingSource || isUpdatingSource) ? (
                <Loader2 size={20} className="animate-spin mr-2" />
              ) : editingId ? (
                <Check size={20} className="mr-2" />
              ) : (
                <PlusCircle size={20} className="mr-2" />
              )}
              {editingId ? 'Update Source' : 'Add Source'}
            </button>
            
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <X size={20} className="mr-2" />
                Cancel
              </button>
            )}
          </div>
        </form>
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
          <div className="overflow-hidden bg-white border border-neutral-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {newsletterSources.map((source: NewsletterSource) => (
                  <tr key={source.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      <div className="flex items-center">
                        <span className="truncate max-w-[200px]">{source.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {source.domain}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(source)}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          disabled={isDeletingSource || isUpdatingSource}
                          title="Edit Source"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          disabled={isDeletingSource || isUpdatingSource}
                          title="Delete Source"
                        >
                          {isDeletingSource ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default NewslettersPage;
