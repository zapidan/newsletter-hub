import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Tag as TagIcon, X, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';
import { useTags } from '@common/hooks/useTags';
import type { Tag, TagCreate, TagWithCount, Newsletter } from '@common/types';
import LoadingScreen from '@common/components/common/LoadingScreen';
import { supabase } from '@common/services/supabaseClient';

const TagsPage: React.FC = () => {
  const navigate = useNavigate();
  const { getTags, createTag, updateTag, deleteTag } = useTags();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [tagNewsletters, setTagNewsletters] = useState<Record<string, Newsletter[]>>({});

  // Fetch all tags (cached)
  const { data: tagsData = [], isLoading: loadingTags, error: errorTags } = useQuery({
  queryKey: ['tags'],
  queryFn: getTags,
  staleTime: 5 * 60 * 1000
});

  // Fetch all newsletter_tags join rows (cached)
  const { data: newsletterTagsData = [], isLoading: loadingNewsletterTags, error: errorNewsletterTags } = useQuery({
  queryKey: ['newsletter_tags'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('newsletter_tags')
      .select('newsletter_id, tag_id');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },
  staleTime: 5 * 60 * 1000
});

  // Fetch all newsletters (for tag navigation/filtering)
  const { data: newslettersData = [], isLoading: loadingNewsletters, error: errorNewsletters } = useQuery({
  queryKey: ['newsletters'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('newsletters')
      .select(`
        *,
        newsletter_source_id,
        source:newsletter_sources(
          id,
          name,
          domain,
          user_id,
          created_at
        ),
        newsletter_tags (
          tag:tags (
            id,
            name,
            color
          )
        )
      `);
    if (error) throw error;
    return Array.isArray(data)
      ? data.map((item: any) => ({
          ...item,
          tags: Array.isArray(item.newsletter_tags)
            ? item.newsletter_tags.map((nt: any) => nt.tag)
            : []
        }))
      : [];
  },
  staleTime: 5 * 60 * 1000
});

  // Compute tag usage counts and newsletters-by-tag in-memory
  const { tagsWithCount, newslettersByTag } = useMemo(() => {
    // Map tag_id to count
    const tagCounts: Record<string, number> = {};
    // Map tag_id to array of newsletters
    const newslettersMap: Record<string, Newsletter[]> = {};
    if (Array.isArray(tagsData) && Array.isArray(newsletterTagsData) && Array.isArray(newslettersData)) {
      // Build a lookup of newsletter_id to newsletter
      const newsletterLookup: Record<string, Newsletter> = {};
      newslettersData.forEach((n: Newsletter) => {
        newsletterLookup[n.id] = n;
      });
      // For each tag, find newsletters
      tagsData.forEach((tag: Tag) => {
        const relatedNewsletterIds = newsletterTagsData.filter((nt: any) => nt.tag_id === tag.id).map((nt: any) => nt.newsletter_id);
        newslettersMap[tag.id] = relatedNewsletterIds.map((nid: string) => newsletterLookup[nid]).filter(Boolean);
        tagCounts[tag.id] = newslettersMap[tag.id].length;
      });
    }
    const tagsWithCount = (tagsData || []).map((tag: Tag) => ({ ...tag, newsletter_count: tagCounts[tag.id] || 0 }));
    return { tagsWithCount, newslettersByTag: newslettersMap };
  }, [tagsData, newsletterTagsData, newslettersData]);

  // Update tags and tagNewsletters only when they actually change
  useEffect(() => {
    if (JSON.stringify(tags) !== JSON.stringify(tagsWithCount)) {
      setTags(tagsWithCount);
    }
    if (JSON.stringify(tagNewsletters) !== JSON.stringify(newslettersByTag)) {
      setTagNewsletters(newslettersByTag);
    }
  }, [tagsWithCount, newslettersByTag, tags, tagNewsletters]);

  // Loading and error states
  const loading = loadingTags || loadingNewsletterTags || loadingNewsletters;
  const error = errorTags || errorNewsletterTags || errorNewsletters;

  const [isCreating, setIsCreating] = useState(false);
  const [newTag, setNewTag] = useState<Omit<TagCreate, 'user_id'>>({ 
    name: '', 
    color: '#3b82f6' 
  });
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagData, setEditTagData] = useState<Partial<Tag>>({});

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) return;
    
    try {
      await createTag({
        ...newTag,
        name: newTag.name.trim()
      });
      setNewTag({ name: '', color: '#3b82f6' });
      setIsCreating(false);
      // Optionally, trigger a refetch here if needed
      // queryClient.invalidateQueries(['tags']);
    } catch (err) {
      console.error('Error creating tag:', err);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTagId || !editTagData.name?.trim()) {
      setEditingTagId(null);
      return;
    }

    try {
      await updateTag({
        id: editingTagId,
        ...editTagData,
        name: editTagData.name.trim()
      });
      setEditingTagId(null);
      setEditTagData({});
      // Optionally, trigger a refetch here if needed
      // queryClient.invalidateQueries(['tags']);
    } catch (err) {
      console.error('Error updating tag:', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (window.confirm('Are you sure you want to delete this tag? This will remove it from all newsletters.')) {
      try {
        await deleteTag(tagId);
        // Optionally, trigger a refetch here if needed
        // queryClient.invalidateQueries(['tags']);
      } catch (err) {
        console.error('Error deleting tag:', err);
      }
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <div>Error loading tags: {typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : String(error)}</div>;

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
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editTagData.name || tag.name}
                        onChange={(e) => setEditTagData({ ...editTagData, name: e.target.value })}
                        className="w-full px-3 py-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editTagData.color || tag.color}
                        onChange={(e) => setEditTagData({ ...editTagData, color: e.target.value })}
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
                        <span className="font-medium cursor-pointer text-primary-700 hover:underline" onClick={() => navigate(`/inbox?tag=${tag.id}`)}>{tag.name}</span>
                        <span className="text-sm text-neutral-500">
                          Used in {(tagNewsletters[tag.id] || []).length} {(tagNewsletters[tag.id] || []).length === 1 ? 'newsletter' : 'newsletters'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingTagId(tag.id);
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
