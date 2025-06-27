// Mock data for testing
import {
  Newsletter,
  NewsletterSource,
  NewsletterSourceGroup,
  NewsletterWithRelations,
  Tag,
  User
} from "@common/types";

export const mockUsers: User[] = [
  {
    id: "user-1",
    email: "test@example.com",
    email_alias: "test@alias.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    email: "admin@example.com",
    email_alias: "admin@alias.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

export const mockTags: Tag[] = [
  {
    id: "tag-1",
    name: "AI/ML",
    color: "#3B82F6",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-2",
    name: "Web Development",
    color: "#10B981",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-3",
    name: "Startup",
    color: "#F59E0B",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-4",
    name: "Design",
    color: "#EF4444",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const mockSourceGroups: NewsletterSourceGroup[] = [
  {
    id: "group-1",
    name: "Tech News",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    _count: { sources: 5 },
  },
  {
    id: "group-2",
    name: "Business",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    _count: { sources: 3 },
  },
  {
    id: "group-3",
    name: "Design",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    _count: { sources: 2 },
  },
];

export const mockSources: NewsletterSource[] = [
  {
    id: "source-1",
    name: "AI Weekly",
    from: "ai.weekly.com",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "source-2",
    name: "React Newsletter",
    from: "react.newsletter.com",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "source-3",
    name: "Startup Digest",
    from: "startup.com",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "source-4",
    name: "Design Weekly",
    from: "design.weekly.com",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

export const mockNewslettersWithRelations: NewsletterWithRelations[] = [
  {
    id: '1',
    title: 'Test Newsletter 1',
    content: 'This is a test newsletter',
    summary: 'Test summary',
    image_url: 'https://example.com/image.jpg',
    received_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    is_read: false,
    is_liked: false,
    is_archived: false,
    user_id: 'user-1',
    newsletter_source_id: 'source-1',
    source_id: 'source-1',
    source: {
      id: 'source-1',
      name: 'Test Source',
      from: 'test@example.com',
      user_id: 'user-1',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      is_archived: false
    },
    tags: [],
    word_count: 100,
    estimated_read_time: 1
  },
  {
    id: '2',
    title: 'Test Newsletter 2',
    content: 'Another test newsletter',
    summary: 'Test summary',
    image_url: 'https://example.com/image.jpg',
    received_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    is_read: true,
    is_liked: false,
    is_archived: false,
    user_id: 'user-1',
    newsletter_source_id: 'source-2',
    source_id: 'source-2',
    source: {
      id: 'source-2',
      name: 'Test Source 2',
      from: 'test2@example.com',
      user_id: 'user-1',
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      is_archived: false
    },
    tags: [],
    word_count: 100,
    estimated_read_time: 1
  },
];

export const mockNewsletters: Newsletter[] = [
  {
    id: "newsletter-1",
    title: "The Future of AI: What to Expect in 2024",
    content: `
      <div>
        <h1>The Future of AI: What to Expect in 2024</h1>
        <p>Artificial Intelligence continues to evolve at a rapid pace. Here's what we can expect to see in the coming year.</p>
        <h2>Key Trends</h2>
        <ul>
          <li>Generative AI becoming more accessible</li>
          <li>Improved AI safety measures</li>
          <li>Integration with existing tools</li>
        </ul>
        <p>The landscape of AI is changing rapidly, and businesses need to stay ahead of the curve.</p>
      </div>
    `,
    summary:
      "An overview of expected AI developments in 2024, including trends in generative AI, safety measures, and tool integration.",
    image_url: "",
    user_id: "user-1",
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    newsletter_source_id: "source-1",
    source: mockSources[0],
    tags: [mockTags[0]],
    word_count: 150,
    estimated_read_time: 5,
  },
  {
    id: "newsletter-2",
    title: "React 18.3: New Features and Improvements",
    content: `
      <div>
        <h1>React 18.3: New Features and Improvements</h1>
        <p>The latest version of React brings several exciting new features and performance improvements.</p>
        <h2>What's New</h2>
        <ul>
          <li>Improved concurrent rendering</li>
          <li>Better TypeScript support</li>
          <li>New hooks for better state management</li>
        </ul>
        <p>These changes will help developers build more efficient and maintainable applications.</p>
      </div>
    `,
    summary:
      "Overview of React 18.3 new features including concurrent rendering improvements, TypeScript support, and new hooks.",
    image_url: "",
    user_id: "user-1",
    is_read: true,
    is_liked: true,
    is_archived: false,
    received_at: "2024-01-14T09:00:00Z",
    updated_at: "2024-01-14T09:00:00Z",
    newsletter_source_id: "source-2",
    source: mockSources[1],
    tags: [mockTags[1]],
    word_count: 200,
    estimated_read_time: 7,
  },
  {
    id: "newsletter-3",
    title: "Startup Funding Trends: Q1 2024 Report",
    content: `
      <div>
        <h1>Startup Funding Trends: Q1 2024 Report</h1>
        <p>A comprehensive analysis of startup funding patterns in the first quarter of 2024.</p>
        <h2>Key Findings</h2>
        <ul>
          <li>Total funding decreased by 15% compared to Q4 2023</li>
          <li>AI startups continue to attract major investments</li>
          <li>Series A rounds are taking longer to close</li>
        </ul>
        <p>Despite challenges, certain sectors continue to show strong growth potential.</p>
      </div>
    `,
    summary:
      "Analysis of Q1 2024 startup funding trends, showing decreased overall funding but continued AI investment interest.",
    image_url: "",
    user_id: "user-1",
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: "2024-01-13T14:00:00Z",
    updated_at: "2024-01-13T14:00:00Z",
    newsletter_source_id: "source-3",
    source: mockSources[2],
    tags: [mockTags[2]],
    word_count: 250,
    estimated_read_time: 8,
  },
  {
    id: "newsletter-4",
    title: "Design Systems: Building Scalable UI Components",
    content: `
      <div>
        <h1>Design Systems: Building Scalable UI Components</h1>
        <p>Learn how to create and maintain design systems that scale across large organizations.</p>
        <h2>Best Practices</h2>
        <ul>
          <li>Start with design tokens</li>
          <li>Document everything thoroughly</li>
          <li>Implement automated testing</li>
        </ul>
        <p>A well-implemented design system can significantly improve development velocity and consistency.</p>
      </div>
    `,
    summary:
      "Guide to building scalable design systems with focus on design tokens, documentation, and automated testing.",
    image_url: "",
    user_id: "user-1",
    is_read: true,
    is_liked: false,
    is_archived: false,
    received_at: "2024-01-12T11:00:00Z",
    updated_at: "2024-01-12T11:00:00Z",
    newsletter_source_id: "source-4",
    source: mockSources[3],
    tags: [mockTags[3]],
    word_count: 180,
    estimated_read_time: 6,
  },
  {
    id: "newsletter-5",
    title: "TypeScript 5.3: Advanced Type Features",
    content: `
      <div>
        <h1>TypeScript 5.3: Advanced Type Features</h1>
        <p>Explore the new advanced type features introduced in TypeScript 5.3.</p>
        <h2>New Features</h2>
        <ul>
          <li>Improved type inference</li>
          <li>Better error messages</li>
          <li>New utility types</li>
        </ul>
        <p>These improvements make TypeScript even more powerful for large-scale applications.</p>
      </div>
    `,
    summary:
      "Overview of TypeScript 5.3 advanced features including improved type inference and better error messages.",
    image_url: "",
    user_id: "user-1",
    is_read: false,
    is_liked: false,
    is_archived: true,
    received_at: "2024-01-11T08:00:00Z",
    updated_at: "2024-01-11T08:00:00Z",
    newsletter_source_id: "source-2",
    source: mockSources[1],
    tags: [mockTags[1]],
    word_count: 120,
    estimated_read_time: 4,
  },
];

// Additional mock data for edge cases and comprehensive testing
export const mockEmptyNewsletter: Newsletter = {
  id: "newsletter-empty",
  title: "",
  content: "",
  summary: "",
  image_url: "",
  user_id: "user-1",
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  newsletter_source_id: null,
  source: null,
  tags: [],
  word_count: 0,
  estimated_read_time: 0,
};

export const mockLongNewsletter: Newsletter = {
  id: "newsletter-long",
  title:
    "A Very Long Newsletter Title That Exceeds Normal Length Expectations And Tests UI Layout Handling",
  content: "<div>" + "Very long content. ".repeat(1000) + "</div>",
  summary:
    "This is a very long newsletter used for testing UI components with extensive content.",
  image_url: "",
  user_id: "user-1",
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  newsletter_source_id: "source-1",
  source: mockSources[0],
  tags: mockTags,
  word_count: 5000,
  estimated_read_time: 50,
};

// Test data for specific scenarios
export const mockReadNewsletters = mockNewsletters.filter((n) => n.is_read);
export const mockUnreadNewsletters = mockNewsletters.filter((n) => !n.is_read);
export const mockLikedNewsletters = mockNewsletters.filter((n) => n.is_liked);
export const mockArchivedNewsletters = mockNewsletters.filter(
  (n) => n.is_archived,
);

// Pagination test data
export const createMockNewsletters = (count: number): Newsletter[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockNewsletters[0],
    id: `newsletter-${index + 1}`,
    title: `Test Newsletter ${index + 1}`,
    received_at: new Date(
      Date.now() - index * 24 * 60 * 60 * 1000,
    ).toISOString(),
    updated_at: new Date(
      Date.now() - index * 24 * 60 * 60 * 1000,
    ).toISOString(),
  }));
};
