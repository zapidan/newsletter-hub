export { LoadingSentinel } from './LoadingSentinel';
export { InfiniteNewsletterList } from './InfiniteNewsletterList';
export type { LoadingSentinelProps } from './LoadingSentinel';
export type { InfiniteNewsletterListProps } from './InfiniteNewsletterList';

// Re-export infinite scroll hooks for convenience
export { useInfiniteScroll } from '../../../common/hooks/infiniteScroll/useInfiniteScroll';
export { useInfiniteNewsletters } from '../../../common/hooks/infiniteScroll/useInfiniteNewsletters';
export type {
  InfiniteScrollOptions,
  InfiniteScrollReturn
} from '../../../common/hooks/infiniteScroll/useInfiniteScroll';
export type {
  UseInfiniteNewslettersOptions,
  UseInfiniteNewslettersReturn
} from '../../../common/hooks/infiniteScroll/useInfiniteNewsletters';
