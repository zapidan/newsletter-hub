import { NewsletterGroup, NewsletterWithRelations, Tag } from "@common/types";
import React from "react";
import NewsletterRowPresentation from "./NewsletterRowPresentation";

interface NewsletterRowContainerWithGroupsProps {
  newsletter: NewsletterWithRelations;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onTagClick: (tag: Tag, e: React.MouseEvent) => void;
  onRemoveFromQueue?: (e: React.MouseEvent, id: string) => void;
  onNewsletterClick?: (newsletter: NewsletterWithRelations) => void;
  onRowClick?: (
    newsletter: NewsletterWithRelations,
    e: React.MouseEvent,
  ) => void;
  onMouseEnter?: (newsletter: NewsletterWithRelations) => void;
  isInReadingQueue: boolean;
  showCheckbox?: boolean;
  showTags?: boolean;
  visibleTags: Set<string>;
  readingQueue: Array<{ newsletter_id: string }>;
  className?: string;
  onToggleLike: () => Promise<void>;
  onToggleArchive: () => Promise<void>;
  onToggleRead: () => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue: () => Promise<void>;
  onToggleTagVisibility: (e: React.MouseEvent) => void;
  onUpdateTags: (tagIds: string[]) => void;
  isDeletingNewsletter: boolean;
  loadingStates?: Record<string, string>;
  errorTogglingLike?: Error | null;
  isUpdatingTags?: boolean;
  tagUpdateError?: string | null;
  onDismissTagError?: () => void;
  // Group context
  activeGroupIds?: string[];
  newsletterGroups?: NewsletterGroup[];
  onGroupClick?: (groupId: string) => void;
  'data-testid'?: string;
}

const NewsletterRowContainerWithGroups: React.FC<NewsletterRowContainerWithGroupsProps> = (props) => {
  const { newsletter, onToggleSelect, 'data-testid': dataTestId, ...rest } = props;
  const handleToggleSelect = onToggleSelect ? () => onToggleSelect(newsletter.id) : undefined;
  return (
    <div
      data-testid={dataTestId}
      data-props={JSON.stringify({
        newsletter,
        isSelected: props.isSelected,
        showCheckbox: props.showCheckbox,
        showTags: props.showTags,
        visibleTags: props.visibleTags,
        isInReadingQueue: props.isInReadingQueue
      })}
    >
      <NewsletterRowPresentation
        {...rest}
        newsletter={newsletter}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  );
};

export default NewsletterRowContainerWithGroups;
