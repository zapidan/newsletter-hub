import { useNavigate } from 'react-router-dom';
import { Plus, Tag as TagIcon, X, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';
import { handleTagClickWithNavigation } from '@common/utils/tagUtils';
import { useTagsPage } from '@common/hooks/ui/useTagsPage';
import type { Tag } from '@common/types';
import LoadingScreen from '@common/components/common/LoadingScreen';

const TagsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    // Data
    tags,
    tagNewsletters,

    // Loading states
    isLoading,
    error,

    // Form state
    isCreating,
    newTag,
    editingTagId,
    editTagData,

    // Actions
    setIsCreating,
    setNewTag,
    setEditingTagId,
    setEditTagData,
    handleCreateTag,
    handleUpdateTag,
    handleDeleteTag,
  } = useTagsPage({
    showToasts: true,
  });

  if (isLoading) return <LoadingScreen />;
  if (error)
    return (
      <div>
        Error loading tags:{' '}
        {typeof error === 'object' && error !== null && 'message' in error
          ? (error as Error).message
          : String(error)}
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-neutral-500">Manage your newsletter tags</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </button>
      </div>

      {/* Create New Tag */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 mb-8">
        <h2 className="text-lg font-medium mb-4">Create New Tag</h2>
        {isCreating ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Tag name"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newTag.color}
                onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                className="w-10 h-10 p-1 border border-neutral-300 rounded-md cursor-pointer"
              />
              <button
                onClick={handleCreateTag}
                className="p-2 text-white bg-primary-500 rounded-md hover:bg-primary-600"
                title="Create tag"
              >
                <Check size={18} />
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <Plus size={18} />
            <span>Add New Tag</span>
          </button>
        )}
      </div>

      {/* Tags List */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-200">
          <h2 className="text-lg font-medium">Your Tags</h2>
        </div>

        {tags.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <TagIcon className="mx-auto h-12 w-12 text-neutral-300 mb-2" />
            <p>You haven't created any tags yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {tags?.map((tag: Tag) => (
              <li key={tag.id} className="p-4 hover:bg-neutral-50">
                {editingTagId === tag.id ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagClickWithNavigation(tag, navigate, '/inbox', e);
                      }}
                    >
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium">{tag.name}</span>
                        <span className="text-xs bg-neutral-100 px-2 py-0.5 rounded-full">
                          {tag.newsletter_count}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editTagData.name || tag.name}
                        onChange={(e) =>
                          setEditTagData({
                            ...editTagData,
                            name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editTagData.color || tag.color}
                        onChange={(e) =>
                          setEditTagData({
                            ...editTagData,
                            color: e.target.value,
                          })
                        }
                        className="w-8 h-8 p-1 border border-neutral-300 rounded-md cursor-pointer"
                      />
                      <button
                        onClick={handleUpdateTag}
                        className="p-1.5 text-white bg-primary-500 rounded-md hover:bg-primary-600"
                        title="Save changes"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTagId(null);
                          setEditTagData({});
                        }}
                        className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-md"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span
                          className="font-medium cursor-pointer text-primary-700 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTagClickWithNavigation(tag, navigate, '/inbox', e);
                          }}
                        >
                          {tag.name}
                        </span>
                        <span className="text-sm text-neutral-500">
                          {(() => {
                            const count = tagNewsletters[tag.id]?.length ?? tag.newsletter_count;
                            return `Used in ${count} ${count === 1 ? 'newsletter' : 'newsletters'}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingTagId(tag.id);
                            setEditTagData({ name: tag.name, color: tag.color });
                          }}
                          className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-md"
                          title="Edit tag"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                          title="Delete tag"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TagsPage;
