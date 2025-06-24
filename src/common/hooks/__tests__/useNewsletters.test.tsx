// src/common/hooks/__tests__/useNewsletters.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ─────────── 1. GLOBAL MOCKS ─────────── */

// In-memory cache-manager stub
const mockCacheManager: any = {
  updateNewsletterInCache: vi.fn(),
  batchUpdateNewsletters: vi.fn(),
  optimisticUpdate: vi.fn(),
  optimisticUpdateWithRollback: vi.fn(),
  invalidateRelatedQueries: vi.fn(),
  clearNewsletterCache: vi.fn(),
  clearReadingQueueCache: vi.fn(),
  warmCache: vi.fn(),
  queryClient: undefined as unknown as QueryClient,
}

// Stub for cacheUtils
vi.mock('@common/utils/cacheUtils', () => {
  let liveClient: QueryClient
  return {
    __setClient: (c: QueryClient) => (liveClient = c),
    getCacheManager: vi.fn(() => mockCacheManager),
    getQueryData: vi.fn((key: any) => liveClient.getQueryData(key)),
    setQueryData: vi.fn((key: any, data: any) => liveClient.setQueryData(key, data)),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    newsletters: {
      list: (p: any = {}) => ['newsletters', 'list', p],
      detail: (id: string) => ['newsletters', 'detail', id],
      all: () => ['newsletters'],
    },
    queue: { list: (uid: string) => ['readingQueue', 'list', uid] },
  },
}))

vi.mock('@common/utils/optimizedCacheInvalidation', () => ({
  invalidateForOperation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@common/utils/tagUtils', () => ({
  updateNewsletterTags: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('@common/services', async () => {
  const real = await vi.importActual<typeof import('@common/services')>('@common/services')
  return {
    ...real,
    newsletterService: {
      getAll: vi.fn(),
      getById: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      bulkUpdate: vi.fn(),
      toggleLike: vi.fn(),
      toggleArchive: vi.fn(),
      bulkArchive: vi.fn(),
      bulkUnarchive: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateTags: vi.fn(),
    },
    readingQueueService: {
      isInQueue: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
  }
})

/* ─────────── 2. REAL IMPORTS ─────────── */
import { newsletterService, readingQueueService } from '@common/services'
import type { NewsletterWithRelations, ReadingQueueItem } from '@common/types'
import * as cacheUtils from '@common/utils/cacheUtils'
import * as optimizedInvalidation from '@common/utils/optimizedCacheInvalidation'
import { queryKeyFactory } from '@common/utils/queryKeyFactory'
import { useNewsletters } from '../useNewsletters'

/* ─────────── 3. FIXTURES ─────────── */
const nl: NewsletterWithRelations = {
  id: 'nl-1',
  title: 'Mock NL',
  content: '',
  summary: '',
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_id: 'u-1',
  newsletter_source_id: 'src-1',
  tags: [],
  source: {
    id: 'src-1',
    name: 'Source',
    user_id: 'u-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    from: 'source@example.com',
  },
  word_count: 100,
  estimated_read_time: 1,
  image_url: '',
}

const paginated = (items: NewsletterWithRelations[]) => ({
  data: items,
  count: items.length,
  hasMore: false,
  nextPage: null,
  prevPage: null,
})

const ns = vi.mocked(newsletterService)
const qs = vi.mocked(readingQueueService)

/* ─────────── 4. PER-TEST SETUP ─────────── */
let qc: QueryClient
let wrapper: React.FC<{ children: React.ReactNode }>

beforeEach(async () => {
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnMount: false },
      mutations: { retry: false },
    },
  })
  qc.clear()
  vi.clearAllMocks()

    ; (cacheUtils as any).__setClient(qc)
  mockCacheManager.queryClient = qc

  // wire cache-manager writes to qc
  const write = (id: string, updates: any) => {
    qc.getQueryCache().findAll().forEach(({ queryKey }) => {
      const d = qc.getQueryData<any>(queryKey)
      if (!d) return
      const patch = (x: any) => (x.id === id ? { ...x, ...updates } : x)
      if (Array.isArray(d)) qc.setQueryData(queryKey, d.map(patch))
      else if (d.data) qc.setQueryData(queryKey, { ...d, data: d.data.map(patch) })
      else if (d.id === id) qc.setQueryData(queryKey, { ...d, ...updates })
    })
  }

  mockCacheManager.updateNewsletterInCache.mockImplementation(({ id, updates }) =>
    write(id, updates),
  )
  mockCacheManager.batchUpdateNewsletters.mockImplementation((batch: any[]) =>
    batch.forEach(({ id, updates }) => write(id, updates)),
  )
  mockCacheManager.optimisticUpdateWithRollback.mockImplementation(
    async (key: any, updater: any) => {
      const cur = qc.getQueryData(key)
      const next = updater(cur)
      qc.setQueryData(key, next)
      return { rollback: () => qc.setQueryData(key, cur) }
    },
  )

  const Auth = await import('../../contexts/AuthContext')
  vi.mocked(Auth.useAuth).mockReturnValue({
    user: { id: 'u-1', email: 'test@example.com' } as any,
    session: null,
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    checkPasswordStrength: vi.fn(),
  })

  ns.getAll.mockResolvedValue(paginated([nl]))
  wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
})

const mount = async (filters = {}, opts = {}) => {
  const h = renderHook(() => useNewsletters(filters, opts), { wrapper })
  await waitFor(() => expect(h.result.current.isLoadingNewsletters).toBe(false))
  return h
}
const useHook = mount

/* ─────────── 5. TESTS ─────────── */
describe('useNewsletters (hook)', () => {
  describe('initial fetch', () => {
    it('calls newsletterService.getAll once on mount', async () => {
      await useHook()
      expect(ns.getAll).toHaveBeenCalledTimes(1)
    })

    it('passes filters through', async () => {
      await useHook({ search: 'test' })
      expect(ns.getAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'test' }))
    })

    it('skips fetch when disabled', async () => {
      await useHook({}, { enabled: false })
      expect(ns.getAll).not.toHaveBeenCalled()
    })

    it('shows empty list when service rejects', async () => {
      ns.getAll.mockRejectedValue(new Error('boom'))
      const { result } = renderHook(() => useNewsletters(), { wrapper })
      await waitFor(() => expect(result.current.newsletters).toEqual([]))
    })
  })

  describe('getNewsletter', () => {
    it('delegates to service', async () => {
      ns.getById.mockResolvedValueOnce({ ...nl, id: 'x' })
      const { result } = await useHook()
      await result.current.getNewsletter('x')
      expect(ns.getById).toHaveBeenCalledWith('x')
    })

    it('returns null for empty id', async () => {
      const { result } = await useHook()
      // @ts-expect-error deliberate misuse
      expect(await result.current.getNewsletter('')).toBeNull()
    })
  })

  describe('markAsRead / markAsUnread', () => {
    const listKey = queryKeyFactory.newsletters.list({})

    it('optimistically sets is_read = true', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_read: false }]))
      ns.markAsRead.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.markAsRead('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_read).toBe(true)
    })

    it('markAsUnread reverts flag', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_read: true }]))
      ns.markAsUnread.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.markAsUnread('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_read).toBe(false)
    })
  })

  describe('toggleLike', () => {
    const listKey = queryKeyFactory.newsletters.list({})
    it('flips is_liked', async () => {
      qc.setQueryData(listKey, paginated([{ ...nl, is_liked: false }]))
      ns.toggleLike.mockResolvedValueOnce(true)
      const { result } = await useHook()
      await act(async () => { await result.current.toggleLike('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data.find((x: any) => x.id === 'nl-1')
      expect(cached.is_liked).toBe(true)
    })
  })

  describe('toggleArchive', () => {
    it('removes item from non-archived view when archiving', async () => {
      const filters = { isArchived: false }
      const listKey = queryKeyFactory.newsletters.list(filters)
      qc.setQueryData(listKey, paginated([nl]))
      ns.toggleArchive.mockResolvedValueOnce(true)
      const { result } = await useHook(filters)
      await act(async () => { await result.current.toggleArchive('nl-1') })
      const cached = (qc.getQueryData(listKey) as any).data
      expect(cached.find((x: any) => x.id === 'nl-1')).toBeUndefined()
    })
  })

  describe('toggleInQueue', () => {
    const queueKey = queryKeyFactory.queue.list('u-1')

    it('removes the item from the cached queue when present', async () => {
      // Seed cache with one queue-item
      const seeded = [{ id: 'q1', newsletter_id: 'nl-1' }] as ReadingQueueItem[]
      qc.setQueryData(queueKey, seeded)

      // `isInQueue` resolves truthy so the hook performs a “remove” branch
      qs.isInQueue.mockResolvedValueOnce(true)
      qs.remove.mockResolvedValueOnce(true)

      const { result } = await useHook()
      await act(async () => {
        await result.current.toggleInQueue('nl-1')
      })

      const after = (qc.getQueryData(queueKey) as ReadingQueueItem[]) ?? []
      expect(after.find((i) => i.newsletter_id === 'nl-1')).toBeUndefined()
    })
  })

  describe('delete operations', () => {
    it('deleteNewsletter invalidates queries', async () => {
      ns.delete.mockResolvedValueOnce(true)
      const spy = vi.spyOn(optimizedInvalidation, 'invalidateForOperation')
      const { result } = await useHook()
      await act(async () => { await result.current.deleteNewsletter('nl-1') })
      expect(ns.delete).toHaveBeenCalledWith('nl-1')
      expect(spy).toHaveBeenCalledWith(qc, 'delete', ['nl-1'])
    })

    it('exposes error on delete failure', async () => {
      ns.delete.mockRejectedValueOnce(new Error('boom'))
      const { result } = await useHook()
      await expect(result.current.deleteNewsletter('nl-1')).rejects.toThrow('boom')
    })

    it('bulk delete deletes each id then invalidates', async () => {
      const ids = ['nl-1', 'nl-2', 'nl-3']
      ns.delete.mockResolvedValue(true)
      const spy = vi.spyOn(optimizedInvalidation, 'invalidateForOperation')
      const { result } = await useHook()
      await act(async () => { await result.current.bulkDeleteNewsletters(ids) })
      expect(ns.delete).toHaveBeenCalledTimes(ids.length)
      ids.forEach((id) => expect(ns.delete).toHaveBeenCalledWith(id))
      expect(spy).toHaveBeenCalledWith(qc, 'bulk-delete', ids)
    })

    it('bulk delete surfaces first error', async () => {
      ns.delete.mockImplementation(async (id: string) => {
        if (id === 'nl-1') throw new Error('fail')
        return true
      })
      const { result } = await useHook()
      await expect(result.current.bulkDeleteNewsletters(['nl-1', 'nl-2'])).rejects.toThrow('fail')
    })
  })
})
