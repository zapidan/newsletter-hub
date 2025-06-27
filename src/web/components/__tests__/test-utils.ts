import { NewsletterWithRelations } from '@common/types';

export const createMockNewsletter = (id: string, overrides: Partial<NewsletterWithRelations> = {}): NewsletterWithRelations => ({
  id,
  title: `Test Newsletter ${id}`,
  content: `Content for newsletter ${id}`,
  summary: `Summary for newsletter ${id}`,
  received_at: new Date(Date.now() - (parseInt(id) * 24 * 60 * 60 * 1000)).toISOString(),
  updated_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'user-1',
  newsletter_source_id: `source-${id}`,
  source_id: `source-${id}`,
  source: {
    id: `source-${id}`,
    name: `Test Source ${id}`,
    from: `test${id}@example.com`,
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_archived: false,
  },
  tags: [],
  word_count: 100,
  estimated_read_time: 1,
  ...overrides,
});

export const setupIntersectionObserverMock = () => {
  const mockUnobserve = vi.fn();
  const mockDisconnect = vi.fn();
  const mockObserve = vi.fn();

  const IntersectionObserverMock = vi.fn((callback) => ({
    observe: mockObserve.mockImplementation((element) => {
      if (element?.dataset?.testid === 'loading-sentinel') {
        // Simulate intersection
        callback([{ isIntersecting: true, target: element }], { disconnect: mockDisconnect });
      }
    }),
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  }));

  global.IntersectionObserver = IntersectionObserverMock;

  return {
    mockObserve,
    mockUnobserve,
    mockDisconnect,
    IntersectionObserverMock,
  };
};
