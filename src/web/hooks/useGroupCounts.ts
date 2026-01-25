import { newsletterService } from '@common/services';
import { useEffect, useMemo, useState } from 'react';

// Minimal shape we need from the caller
type GroupLike = { id: string; name: string; sources?: { id: string }[] };

// Minimal filter shape aligned with NewsletterService params naming used in Inbox
type BaseFilter = {
  search?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export function useGroupCounts(groups: GroupLike[] = [], baseFilter: BaseFilter = {}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Create stable dependencies to prevent infinite re-renders
  const groupsKey = useMemo(() => {
    return JSON.stringify(groups.map(g => ({ id: g.id, sourceCount: g.sources?.length || 0 })));
  }, [groups.length, groups.map(g => g.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterKey = useMemo(() => {
    const sortedTagIds = baseFilter.tagIds ? [...baseFilter.tagIds].sort() : [];
    return JSON.stringify({
      search: baseFilter.search,
      isRead: baseFilter.isRead,
      isArchived: baseFilter.isArchived,
      isLiked: baseFilter.isLiked,
      tagIds: sortedTagIds,
      dateFrom: baseFilter.dateFrom,
      dateTo: baseFilter.dateTo
    });
  }, [
    baseFilter.search,
    baseFilter.isRead,
    baseFilter.isArchived,
    baseFilter.isLiked,
    baseFilter.tagIds ? [...baseFilter.tagIds].sort().join(',') : '',
    baseFilter.dateFrom,
    baseFilter.dateTo
  ]);

  // Stable snapshot of inputs
  const input = useMemo(() => ({ groups, baseFilter }), [groupsKey, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!input.groups || input.groups.length === 0) {
        setCounts({});
        return;
      }

      const baseParams = {
        search: input.baseFilter.search,
        isRead: input.baseFilter.isRead,
        isArchived: input.baseFilter.isArchived,
        isLiked: input.baseFilter.isLiked,
        tagIds: input.baseFilter.tagIds,
        dateFrom: input.baseFilter.dateFrom,
        dateTo: input.baseFilter.dateTo,
        // small page; we only need count
        limit: 1,
      } as const;

      const results = await Promise.all(
        input.groups.map(async (g) => {
          const sourceIds = g.sources?.map((s) => s.id) || [];
          if (sourceIds.length === 0) return [g.id, 0] as const;
          try {
            const res = await newsletterService.getAll({ ...baseParams, sourceIds });
            return [g.id, res.count || 0] as const;
          } catch {
            return [g.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        const next: Record<string, number> = {};
        results.forEach(([id, cnt]) => (next[id] = cnt));
        setCounts(next);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [input]);

  return counts;
}
