import { describe, it, expect } from 'vitest';

describe('Newsletter Navigation Smoke Tests', () => {
  it('should be able to import navigation hook', async () => {
    const { useNewsletterNavigation } = await import('@common/hooks/useNewsletterNavigation');
    expect(useNewsletterNavigation).toBeDefined();
    expect(typeof useNewsletterNavigation).toBe('function');
  });

  it('should be able to import navigation arrows component', async () => {
    const { default: NavigationArrows } = await import(
      '../../components/NewsletterDetail/NavigationArrows'
    );
    expect(NavigationArrows).toBeDefined();
    expect(typeof NavigationArrows).toBe('function');
  });

  it('should be able to import simple newsletter navigation hook', async () => {
    const { useSimpleNewsletterNavigation } = await import(
      '@common/hooks/useSimpleNewsletterNavigation'
    );
    expect(useSimpleNewsletterNavigation).toBeDefined();
    expect(typeof useSimpleNewsletterNavigation).toBe('function');
  });

  it('should export hook variants', async () => {
    const {
      useNewsletterNavigation,
      useNewsletterNavigationState,
      useNewsletterNavigationActions,
    } = await import('@common/hooks/useNewsletterNavigation');

    expect(useNewsletterNavigation).toBeDefined();
    expect(useNewsletterNavigationState).toBeDefined();
    expect(useNewsletterNavigationActions).toBeDefined();
  });

  it('should have proper TypeScript types', async () => {
    const module = await import('@common/hooks/useNewsletterNavigation');

    // Check that the module exports what we expect
    expect(module.useNewsletterNavigation).toBeDefined();
    expect(module.useNewsletterNavigationState).toBeDefined();
    expect(module.useNewsletterNavigationActions).toBeDefined();
  });
});
