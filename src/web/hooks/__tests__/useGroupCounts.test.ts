/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the optimizedNewsletterService
vi.mock('@common/services/optimizedNewsletterService', () => ({
  optimizedNewsletterService: {
    getAll: vi.fn(),
  },
}));

import { optimizedNewsletterService } from '@common/services/optimizedNewsletterService';
import { useGroupCounts } from '../useGroupCounts';

type GroupLike = { id: string; name: string; sources?: { id: string }[] };

type BaseFilter = {
  search?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
};

function Harness({ groups, base }: { groups: GroupLike[]; base: BaseFilter }) {
  const counts = useGroupCounts(groups, base);
  return React.createElement('div', { 'data-testid': 'out' }, JSON.stringify(counts));
}

const mkGroup = (id: string, sourceIds: string[] = []): GroupLike => ({
  id,
  name: `Group ${id}`,
  sources: sourceIds.map((sid) => ({ id: sid })),
});

describe('useGroupCounts', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns {} and does not fetch when no groups', async () => {
    render(React.createElement(Harness, { groups: [], base: {} }));

    // immediate value should be {}
    expect(screen.getByTestId('out').textContent).toBe('{}');
    // and no calls should be made
    expect(optimizedNewsletterService.getAll).not.toHaveBeenCalled();
  });

  it('queries count per group using sourceIds', async () => {
    const groups = [mkGroup('g1', ['s1', 's2']), mkGroup('g2', ['s3'])];

    vi.mocked(optimizedNewsletterService.getAll)
      .mockResolvedValueOnce({ data: [], count: 7, hasMore: false } as any)
      .mockResolvedValueOnce({ data: [], count: 3, hasMore: false } as any);

    render(React.createElement(Harness, { groups, base: { isRead: false } }));

    await waitFor(() => {
      expect(optimizedNewsletterService.getAll).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('out').textContent).toBe(JSON.stringify({ g1: 7, g2: 3 }));
    });
  });

  it('returns 0 for groups without sources or on failure', async () => {
    const groups = [mkGroup('g1', []), mkGroup('g2', ['s9'])];

    vi.mocked(optimizedNewsletterService.getAll)
      .mockRejectedValueOnce(new Error('boom')) // for g2
      .mockResolvedValue({ data: [], count: 0, hasMore: false } as any);

    render(React.createElement(Harness, { groups, base: {} }));

    await waitFor(() => {
      expect(screen.getByTestId('out').textContent).toBe(JSON.stringify({ g1: 0, g2: 0 }));
    });
  });
});
