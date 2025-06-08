import React from 'react';
import { Heart, BookmarkIcon, Tag as TagIcon, Archive, ArchiveX, Trash } from 'lucide-react';
import { Newsletter, Tag } from '../types';
import TagSelector from './TagSelector';

interface NewsletterRowProps {
  newsletter: Newsletter;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleLike: (newsletter: Newsletter) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue: (id: string) => Promise<void>;
  onToggleTagVisibility: (id: string, e: React.MouseEvent) => void;
  onUpdateTags: (id: string, newTags: Tag[]) => Promise<boolean>;
  onTagClick: (tag: Tag, e: React.MouseEvent) => void;
  visibleTags: Set<string>;
  readingQueue: Array<{ newsletter_id: string }>;
  isDeletingNewsletter: boolean;
  loadingStates: Record<string, string>;
  errorTogglingLike?: Error | null;
}

const NewsletterRow: React.FC<NewsletterRowProps> = ({
  newsletter,
  isSelected = false,
  onToggleSelect,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  onToggleTagVisibility,
  onUpdateTags,
  onTagClick,
  visibleTags,
  readingQueue,
  isDeletingNewsletter,
  loadingStates,
  errorTogglingLike,
}) => {
  const handleRowClick = (e: React.MouseEvent) => {
    // Only navigate if the click wasn't on a button or link
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('a')) {
      window.open(`/inbox/${newsletter.id}`, '_blank');
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className={`rounded-lg p-4 flex items-start cursor-pointer transition-all duration-200 ${
        !newsletter.is_read 
          ? 'bg-blue-300 border-l-4 border-blue-800 hover:bg-blue-400 shadow-lg shadow-blue-200' 
          : 'bg-white border border-neutral-200 hover:bg-neutral-50'
      } ${isSelected ? 'ring-2 ring-primary-400' : ''}`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(newsletter.id);
          }}
          className="mr-4 mt-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          onClick={(e) => e.stopPropagation()}
          title="Select newsletter"
        />
      )}
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
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <button
                  type="button"
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                    newsletter.is_read 
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onToggleRead(newsletter.id);
                  }}
                >
                  {newsletter.is_read ? 'Mark as Unread' : 'Mark as Read'}
                </button>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-1">
              {/* Like button */}
              <button
                type="button"
                className={`p-1.5 transition-colors ${
                  newsletter.is_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                } ${errorTogglingLike ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  await onToggleLike(newsletter);
                }}
                disabled={!!errorTogglingLike || loadingStates[newsletter.id] === 'like'}
                title={newsletter.is_liked ? 'Unlike' : 'Like'}
              >
                {loadingStates[newsletter.id] === 'like' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleTagVisibility(newsletter.id, e);
                }}
                title={visibleTags.has(newsletter.id) ? 'Hide tags' : 'Edit tags'}
              >
                <TagIcon
                  size={16}
                  className={`${
                    visibleTags.has(newsletter.id) ? 'text-primary-600' : 'text-gray-500'
                  } hover:text-primary-600`}
                />
              </button>
              {/* Reading queue button */}
              <button
                type="button"
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onToggleQueue(newsletter.id);
                }}
                title={
                  readingQueue.some((item) => item.newsletter_id === newsletter.id)
                    ? 'Remove from reading queue'
                    : 'Add to reading queue'
                }
              >
                <BookmarkIcon
                  className="h-4 w-4"
                  fill={
                    readingQueue.some((item) => item.newsletter_id === newsletter.id) ? '#9CA3AF' : 'none'
                  }
                  stroke="#9CA3AF"
                  strokeWidth={1.5}
                />
              </button>
              {/* Archive/Unarchive button */}
              <button
                type="button"
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onToggleArchive(newsletter.id);
                }}
                title={newsletter.is_archived ? 'Unarchive' : 'Archive'}
              >
                {newsletter.is_archived ? (
                  <ArchiveX className="h-4 w-4 text-green-700" />
                ) : (
                  <Archive className="h-4 w-4 text-amber-700" />
                )}
              </button>
              {/* Trash button for archived newsletters */}
              {newsletter.is_archived && (
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-red-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash(newsletter.id);
                  }}
                  title="Delete permanently"
                  disabled={isDeletingNewsletter}
                >
                  <Trash className="h-4 w-4 text-red-600" />
                </button>
              )}
            </div>
            <div className="text-sm text-gray-700 mb-2 line-clamp-2">{newsletter.summary}</div>
        <div className="flex items-center justify-between mt-2">
          <div className="w-full">
            <div className="flex flex-wrap gap-1">
              {newsletter.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag, e);
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
            {visibleTags.has(newsletter.id) && (
              <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                <TagSelector
                  selectedTags={newsletter.tags || []}
                  onTagsChange={async (newTags) => {
                    const ok = await onUpdateTags(newsletter.id, newTags);
                    if (ok) {
                      // Close the tag selector after successful update
                      const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
                      onToggleTagVisibility(newsletter.id, fakeEvent);
                    }
                  }}
                  onTagClick={onTagClick}
                  onTagDeleted={() => {}}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {new Date(newsletter.received_at).toLocaleDateString()}
          </span>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterRow;
