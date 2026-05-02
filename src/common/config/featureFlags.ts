// newsletterHub/src/common/config/featureFlags.ts
// Phase 3 gating utilities for feature flags and helper to determine activation

// Lightweight, environment-driven gating for Phase 3
// - DEV: VITE_PHASE3_DEV_ENABLED enables Phase 3 in development (localhost)
// - PROD: VITE_PHASE3_PROD_ENABLED enables Phase 3 globally in production
// - isPhase3Active(): true when Phase 3 should be active for the current runtime

type FlagSource = boolean;

/**
 * Read a boolean flag from the environment safely across environments (Vite/browser and Node).
 * Priority: import.meta.env (Vite) > process.env (Node/test) > defaultValue
 */
function readFlagFromEnv(flagName: string, defaultValue: FlagSource): boolean {
  // Try Vite's env first
  try {
    // Cast to any to appease TS about import.meta.env shape in different runtimes
    const viteEnv = (import.meta as any)?.env;
    const viteVal = viteEnv?.[flagName];
    if (typeof viteVal !== 'undefined') {
      if (typeof viteVal === 'boolean') return viteVal;
      if (typeof viteVal === 'string') return viteVal.toLowerCase() === 'true';
    }
  } catch {
    // ignore
  }

  // Fallback to Node process.env (useful in tests)
  try {
    const envVal = (process as any)?.env?.[flagName];
    if (typeof envVal !== 'undefined') {
      if (typeof envVal === 'boolean') return envVal;
      if (typeof envVal === 'string') return envVal.toLowerCase() === 'true';
    }
  } catch {
    // ignore
  }

  return defaultValue;
}

/**
 * DEV flag: enable Phase 3 in development (localhost)
 * Example: VITE_PHASE3_DEV_ENABLED=true
 */
export const isPhase3DevEnabled = (): boolean => {
  return readFlagFromEnv('VITE_PHASE3_DEV_ENABLED', false);
};

/**
 * PROD flag: enable Phase 3 globally in production
 * This is used for controlled, global rollout and easy rollback.
 * Example: VITE_PHASE3_PROD_ENABLED=true
 */
export const isPhase3ProdEnabled = (): boolean => {
  return readFlagFromEnv('VITE_PHASE3_PROD_ENABLED', false);
};

/**
 * Activation predicate for Phase 3:
 * - In dev: active if VITE_PHASE3_DEV_ENABLED=true
 * - In prod: active if VITE_PHASE3_PROD_ENABLED=true (and NODE_ENV=production)
 * - In all other cases: inactive
 */
export const isPhase3Active = (): boolean => {
  const dev = isPhase3DevEnabled();
  const prod = isPhase3ProdEnabled();
  const inProd =
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'production' || (process as any).env?.NODE_ENV === 'production');
  return dev || (prod && inProd);
};

export default {
  isPhase3Active,
  isPhase3DevEnabled,
  isPhase3ProdEnabled,
};
