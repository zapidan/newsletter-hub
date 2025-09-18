# Email Handler Testing Alignment Checklist

This checklist helps keep the Deno Edge tests and Vitest handler tests consistent across the codebase.

Applies to:

- `supabase/functions/handle-email/tests/edge-function.test.ts`
- `src/__tests__/supabase/emailHandler.test.ts`
- `supabase/functions/handle-email/index.ts`

## Core Behavior

- [ ] Recipient handling: assume a single recipient. Use the raw `to` value; do not append domains or parse UUID local parts.
- [ ] Recipient validation: if `to` is malformed, return `{ success: false, error: 'Invalid recipient email format' }` before any DB call.
- [ ] User resolution: resolve `userId` from DB via `users.email_alias = to` (use `DEFAULT_RECIPIENT_USER_ID` as a fallback only).
- [ ] Source operations: call `findOrCreateSource(fromEmail, fromName, supabase, userId)` only after `userId` is known.

## Supabase Mock Shape (Edge tests)

- [ ] `from('users').select('id').eq('email_alias', <email>).single()` returns `{ data: { id: 'user-1' }, error: null }` for testing.
- [ ] `from('newsletter_sources').select('*').eq('name', ...).eq('user_id', ...)` resolves to `{ data: Source[], error: null }` (array, not single).
- [ ] `from('newsletter_sources').insert([...]).select().single()` accepts array or object; returns `{ data: Source, error: null }`.
- [ ] `from('skipped_newsletters').insert(...)` is a no-op stub that resolves.
- [ ] `rpc(name, params)` resolves with shape `{ data, error }` (not rejected promises).

## Duplicate Flow

- [ ] Simulate duplicate at the transaction level: override `rpc('handle_incoming_email_transaction')` to resolve `{ data: null, error: { message: 'duplicate...', code: '23505' } }`.
- [ ] In duplicate case, handler either returns `{ success: true, skipped: true, skipReason: 'duplicate' }` or `{ success: false, error: '...duplicate...' }`. Tests should accept either.

## Archived Source Flow

- [ ] When `newsletter_sources.select('*')` returns an archived source (`is_archived: true`) for the matching `name` and `user_id`, the handler returns `{ success: true, skipped: true, skipReason: 'source_archived' }`.

## Malformed Email Flow

- [ ] For `to` values like `invalid-email`, `user@`, `@example.com`, handler returns `{ success: false, error: 'Invalid recipient email format' }`.

## Request Handling (Edge tests)

- [ ] CORS preflight: `OPTIONS` -> `200` with `ok` body.
- [ ] Unsupported methods: e.g., `GET` -> `405`.
- [ ] Valid JSON POST: returns `200` with `{ success: true }`.
- [ ] Malformed JSON: returns `400`.
- [ ] Valid form-data POST: returns `200` with `{ success: true }`.
- [ ] Auth: if handler checks auth, provide an `Authorization: Bearer ...` header and ensure `supabase.auth.getUser()` mock returns a user.

## Skip Reason Taxonomy (Decide and Align)

- [ ] Standardize skip reasons across tests/handler. Current values in use:
  - Edge: `source_archived`, `duplicate`, `unknown_recipient`, `limit_reached`
  - Vitest: `daily_limit_reached`, `source_limit_reached`, `newsletter_limit_reached`
- [ ] If needed, map DB/rpc reasons to canonical names before returning.

## Error Shapes and Logging

- [ ] Prefer `{ data, error }` RPC shape over throwing exceptions.
- [ ] On unknown errors, return `{ success: false, error: <message> }` and avoid leaking stack traces.

## Test Data Consistency

- [ ] Use consistent `to` email across tests (e.g., `test@example.com` or `user-1@example.dev`) and ensure `users.email_alias` mock resolves it.
- [ ] For archived source tests, set `from: 'archived@example.com'` (and mock select to return archived source rows for that `name`).
- [ ] For duplicate tests, set `from: 'duplicate@example.com'` (the specific `from` value is not critical if duplicate is simulated at RPC).

## Commands

- [ ] Deno Edge tests: `deno test --allow-net --allow-env --allow-read --trace-leaks supabase/functions/handle-email/tests/edge-function.test.ts`
- [ ] Vitest handler tests: `pnpm test` or the project’s configured test script.

## When Adding/Changing Tests

- [ ] Update this checklist if a new flow is introduced.
- [ ] Ensure the Supabase mock covers any new tables or RPCs (with `{ data, error }` semantics).
- [ ] Keep handler return shapes consistent (success/skipped/error) to minimize breakage across test suites.
