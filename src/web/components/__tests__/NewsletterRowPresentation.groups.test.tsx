import { render, screen } from '@testing-library/react';
import NewsletterRowPresentation from '../NewsletterRowPresentation';

const baseNewsletter = {
  id: 'n1',
  title: 'Hello World',
  summary: 'Summary',
  content: 'https://example.com',
  is_read: false,
  is_liked: false,
  is_archived: false,
  estimated_read_time: 5,
  received_at: new Date().toISOString(),
  source: { id: 's1', name: 'Test Source', from: 'from@example.com' },
  tags: [],
};

describe('NewsletterRowPresentation group badges', () => {
  const noopAsync = async () => { };
  const noop = () => { };

  test('renders group badges when activeGroupIds are provided', () => {
    render(
      <NewsletterRowPresentation
        newsletter={baseNewsletter as any}
        onToggleLike={noopAsync}
        onToggleArchive={noopAsync}
        onToggleRead={noopAsync}
        onTrash={noop}
        onToggleQueue={noopAsync}
        onToggleTagVisibility={noop}
        onUpdateTags={noop}
        onTagClick={noop as any}
        isInReadingQueue={false}
        showCheckbox={false}
        visibleTags={new Set<string>()}
        readingQueue={[]}
        isDeletingNewsletter={false}
        loadingStates={{}}
        isUpdatingTags={false}
        activeGroupIds={["g1", "g2"]}
        newsletterGroups={[
          { id: 'g1', name: 'Work', color: '#3B82F6', user_id: 'user-1', created_at: '2023-01-01', updated_at: '2023-01-01' },
          { id: 'g2', name: 'Personal', color: '#10B981', user_id: 'user-1', created_at: '2023-01-01', updated_at: '2023-01-01' }
        ]}
      />
    );

    const badges = screen.getByTestId('row-group-badges');
    expect(badges).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  test('does not render badges when no active groups', () => {
    render(
      <NewsletterRowPresentation
        newsletter={baseNewsletter as any}
        onToggleLike={noopAsync}
        onToggleArchive={noopAsync}
        onToggleRead={noopAsync}
        onTrash={noop}
        onToggleQueue={noopAsync}
        onToggleTagVisibility={noop}
        onUpdateTags={noop}
        onTagClick={noop as any}
        isInReadingQueue={false}
        showCheckbox={false}
        visibleTags={new Set<string>()}
        readingQueue={[]}
        isDeletingNewsletter={false}
        loadingStates={{}}
        isUpdatingTags={false}
      />
    );

    expect(screen.queryByTestId('row-group-badges')).not.toBeInTheDocument();
  });
});
