import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewsletterCard from "../NewsletterCard";
import { mockNewsletters } from "../../../__tests__/mocks/data";

// Mock date-fns format function
vi.mock("date-fns", () => ({
  format: vi.fn(() => "Jan 15, 2024"),
}));

describe("NewsletterCard", () => {
  const mockNewsletter = mockNewsletters[0];
  const defaultProps = {
    newsletter: mockNewsletter,
    showQueueButton: true,
    isInQueue: false,
    onToggleQueue: vi.fn(),
    onToggleArchive: vi.fn(),
    showArchiveButton: true,
    showSource: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders newsletter title", () => {
    render(<NewsletterCard {...defaultProps} />);
    expect(screen.getByText(mockNewsletter.title)).toBeInTheDocument();
  });

  it("renders newsletter source information", () => {
    const newsletterWithSource = {
      ...mockNewsletter,
      source: {
        id: "source-1",
        name: "Tech Weekly",
        domain: "techweekly.com",
        email: "tech@weekly.com",
        description: "Weekly tech newsletter",
        user_id: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    };

    render(
      <NewsletterCard {...defaultProps} newsletter={newsletterWithSource} />,
    );
    expect(screen.getByText("Tech Weekly")).toBeInTheDocument();
    expect(screen.getByText("• techweekly.com")).toBeInTheDocument();
  });

  it('renders "Unknown Source" when source is missing', () => {
    const newsletterWithoutSource = {
      ...mockNewsletter,
      source: null,
    };

    render(
      <NewsletterCard {...defaultProps} newsletter={newsletterWithoutSource} />,
    );
    expect(screen.getByText("Unknown Source")).toBeInTheDocument();
  });

  it("renders formatted date", () => {
    render(<NewsletterCard {...defaultProps} />);
    expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
  });

  it("renders newsletter image when provided", () => {
    const newsletterWithImage = {
      ...mockNewsletter,
      image_url: "https://example.com/image.jpg",
    };

    render(
      <NewsletterCard {...defaultProps} newsletter={newsletterWithImage} />,
    );
    const image = screen.getByAltText(mockNewsletter.title);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
  });

  it("does not render image container when no image URL", () => {
    render(<NewsletterCard {...defaultProps} />);
    const image = screen.queryByAltText(mockNewsletter.title);
    expect(image).not.toBeInTheDocument();
  });

  describe("Queue functionality", () => {
    it("renders queue button when showQueueButton is true", () => {
      render(<NewsletterCard {...defaultProps} showQueueButton={true} />);
      const queueButton = screen.getByTitle("Add to queue");
      expect(queueButton).toBeInTheDocument();
    });

    it("does not render queue button when showQueueButton is false", () => {
      render(<NewsletterCard {...defaultProps} showQueueButton={false} />);
      const queueButton = screen.queryByTitle("Add to queue");
      expect(queueButton).not.toBeInTheDocument();
    });

    it('shows "Remove from queue" title when isInQueue is true', () => {
      render(<NewsletterCard {...defaultProps} isInQueue={true} />);
      const queueButton = screen.getByTitle("Remove from queue");
      expect(queueButton).toBeInTheDocument();
    });

    it('shows "Add to queue" title when isInQueue is false', () => {
      render(<NewsletterCard {...defaultProps} isInQueue={false} />);
      const queueButton = screen.getByTitle("Add to queue");
      expect(queueButton).toBeInTheDocument();
    });

    it("calls onToggleQueue with correct parameters when queue button is clicked", () => {
      const mockOnToggleQueue = vi.fn();
      render(
        <NewsletterCard
          {...defaultProps}
          onToggleQueue={mockOnToggleQueue}
          isInQueue={false}
        />,
      );

      const queueButton = screen.getByTitle("Add to queue");
      fireEvent.click(queueButton);

      expect(mockOnToggleQueue).toHaveBeenCalledWith(mockNewsletter.id, true);
    });

    it("calls onToggleQueue to remove from queue when already in queue", () => {
      const mockOnToggleQueue = vi.fn();
      render(
        <NewsletterCard
          {...defaultProps}
          onToggleQueue={mockOnToggleQueue}
          isInQueue={true}
        />,
      );

      const queueButton = screen.getByTitle("Remove from queue");
      fireEvent.click(queueButton);

      expect(mockOnToggleQueue).toHaveBeenCalledWith(mockNewsletter.id, false);
    });

    it("prevents event propagation when queue button is clicked", () => {
      const mockOnToggleQueue = vi.fn();
      const mockCardClick = vi.fn();

      render(
        <div onClick={mockCardClick}>
          <NewsletterCard {...defaultProps} onToggleQueue={mockOnToggleQueue} />
        </div>,
      );

      const queueButton = screen.getByTitle("Add to queue");
      fireEvent.click(queueButton);

      expect(mockOnToggleQueue).toHaveBeenCalled();
      expect(mockCardClick).not.toHaveBeenCalled();
    });
  });

  describe("Archive functionality", () => {
    it("renders archive button when showArchiveButton is true", () => {
      render(<NewsletterCard {...defaultProps} showArchiveButton={true} />);
      const archiveButton = screen.getByTitle("Archive");
      expect(archiveButton).toBeInTheDocument();
    });

    it("does not render archive button when showArchiveButton is false", () => {
      render(<NewsletterCard {...defaultProps} showArchiveButton={false} />);
      const archiveButton = screen.queryByTitle("Archive");
      expect(archiveButton).not.toBeInTheDocument();
    });

    it('shows "Unarchive" title when newsletter is archived', () => {
      const archivedNewsletter = {
        ...mockNewsletter,
        is_archived: true,
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={archivedNewsletter} />,
      );

      const archiveButton = screen.getByTitle("Unarchive");
      expect(archiveButton).toBeInTheDocument();
    });

    it('shows "Archive" title when newsletter is not archived', () => {
      const unarchivedNewsletter = {
        ...mockNewsletter,
        is_archived: false,
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={unarchivedNewsletter} />,
      );

      const archiveButton = screen.getByTitle("Archive");
      expect(archiveButton).toBeInTheDocument();
    });

    it("calls onToggleArchive with correct parameters when archive button is clicked", () => {
      const mockOnToggleArchive = vi.fn();
      render(
        <NewsletterCard
          {...defaultProps}
          onToggleArchive={mockOnToggleArchive}
        />,
      );

      const archiveButton = screen.getByTitle("Archive");
      fireEvent.click(archiveButton);

      expect(mockOnToggleArchive).toHaveBeenCalledWith(mockNewsletter.id, true);
    });

    it("calls onToggleArchive to unarchive when already archived", () => {
      const mockOnToggleArchive = vi.fn();
      const archivedNewsletter = {
        ...mockNewsletter,
        is_archived: true,
      };

      render(
        <NewsletterCard
          {...defaultProps}
          newsletter={archivedNewsletter}
          onToggleArchive={mockOnToggleArchive}
        />,
      );

      const archiveButton = screen.getByTitle("Unarchive");
      fireEvent.click(archiveButton);

      expect(mockOnToggleArchive).toHaveBeenCalledWith(
        mockNewsletter.id,
        false,
      );
    });

    it("prevents event propagation when archive button is clicked", () => {
      const mockOnToggleArchive = vi.fn();
      const mockCardClick = vi.fn();

      render(
        <div onClick={mockCardClick}>
          <NewsletterCard
            {...defaultProps}
            onToggleArchive={mockOnToggleArchive}
          />
        </div>,
      );

      const archiveButton = screen.getByTitle("Archive");
      fireEvent.click(archiveButton);

      expect(mockOnToggleArchive).toHaveBeenCalled();
      expect(mockCardClick).not.toHaveBeenCalled();
    });
  });

  describe("Tags functionality", () => {
    it("renders tags when newsletter has tags", () => {
      const newsletterWithTags = {
        ...mockNewsletter,
        tags: [
          {
            id: "tag-1",
            name: "AI/ML",
            color: "#3B82F6",
            user_id: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          },
          {
            id: "tag-2",
            name: "Tech",
            color: "#10B981",
            user_id: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={newsletterWithTags} />,
      );

      expect(screen.getByText("AI/ML")).toBeInTheDocument();
      expect(screen.getByText("Tech")).toBeInTheDocument();
    });

    it("does not render tags section when newsletter has no tags", () => {
      const newsletterWithoutTags = {
        ...mockNewsletter,
        tags: [],
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={newsletterWithoutTags} />,
      );

      // Check that no tag elements are rendered
      const tagElements = screen.queryAllByText(/^(AI\/ML|Tech|Design)$/);
      expect(tagElements).toHaveLength(0);
    });

    it("applies correct tag styling with color", () => {
      const newsletterWithTags = {
        ...mockNewsletter,
        tags: [
          {
            id: "tag-1",
            name: "AI/ML",
            color: "#3B82F6",
            user_id: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={newsletterWithTags} />,
      );

      const tagElement = screen.getByText("AI/ML");
      expect(tagElement).toHaveStyle({
        backgroundColor: "#3B82F620",
        color: "#3B82F6",
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper button labels for screen readers", () => {
      render(<NewsletterCard {...defaultProps} />);

      const queueButton = screen.getByTitle("Add to queue");
      const archiveButton = screen.getByTitle("Archive");

      expect(queueButton).toHaveAttribute("title", "Add to queue");
      expect(archiveButton).toHaveAttribute("title", "Archive");
    });

    it("has alt text for newsletter image", () => {
      const newsletterWithImage = {
        ...mockNewsletter,
        image_url: "https://example.com/image.jpg",
      };

      render(
        <NewsletterCard {...defaultProps} newsletter={newsletterWithImage} />,
      );

      const image = screen.getByAltText(mockNewsletter.title);
      expect(image).toBeInTheDocument();
    });
  });

  describe("Layout and styling", () => {
    it("applies hover effects to the card", () => {
      const { container } = render(<NewsletterCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;

      expect(card).toHaveClass("hover:shadow-lg");
      expect(card).toHaveClass("transition-shadow");
    });

    it("handles long titles with line clamp", () => {
      const newsletterWithLongTitle = {
        ...mockNewsletter,
        title:
          "This is a very long newsletter title that should be clamped to prevent layout issues and maintain consistent card heights across the grid",
      };

      render(
        <NewsletterCard
          {...defaultProps}
          newsletter={newsletterWithLongTitle}
        />,
      );

      const titleElement = screen.getByText(newsletterWithLongTitle.title);
      expect(titleElement).toHaveClass("line-clamp-2");
    });

    it("uses flexbox layout for proper card structure", () => {
      const { container } = render(<NewsletterCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      const contentDiv = card.querySelector(".p-4");

      expect(card).toHaveClass("flex", "flex-col");
      expect(contentDiv).toHaveClass("flex-1", "flex", "flex-col");
    });
  });
});
