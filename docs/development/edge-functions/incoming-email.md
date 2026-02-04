# Incoming Email Edge Function

## Overview

The incoming email edge function processes newsletters sent to user-specific email addresses. It handles email parsing, validation, and storage in the database.

## Flow

1. **Receipt**
   - Email received at `{alias}@newsletterhub.app`
   - Edge function triggered by email provider

2. **Validation**
   - Extracts user ID from email alias
   - Validates user can receive emails (`can_receive_newsletter`)
   - Checks source limits (`can_add_source`)

3. **Processing**
   - Extracts content and metadata
   - Calculates word count
   - Identifies/creates source
   - Stores in database

## Database Functions Used

### `can_receive_newsletter(user_id, title, content)`

- **Purpose**: Validates if a newsletter can be received
- **Checks**:
  - User exists and is active
  - Content meets quality standards
  - Not a duplicate
- **Returns**: `{ allowed: boolean, reason?: string }`

### `can_add_source(user_id)`

- **Purpose**: Checks source limits
- **Rules**:
  - Free tier: 50 sources
  - Pro tier: 500 sources
  - Enterprise: Unlimited
- **Returns**: `boolean`

### `handle_incoming_email(...)`

- **Purpose**: Main processing function
- **Parameters**:
  ```typescript
  {
    from_email: string;
    subject: string;
    content: string;
    received_at: string;
    user_id?: string;
  }
  ```
- **Returns**: Newsletter ID

## Error Handling

| Error Code | Description   | Resolution              |
| ---------- | ------------- | ----------------------- |
| 400        | Invalid input | Check email format      |
| 403        | Forbidden     | Verify user permissions |
| 422        | Unprocessable | Check content           |
| 429        | Rate limited  | Wait and retry          |

## Monitoring

### Logs

- Email received
- Processing started
- Validation results
- Storage outcome
- Errors

### Metrics

- Processing time
- Success/failure rates
- Source creation stats
- Content analysis

## Testing

### Deno Unit Tests

#### Test Setup

```typescript
// test/edge/email_processor_test.ts
import { assertEquals } from 'https://deno.land/std@0.200.0/assert/mod.ts';
import { processEmail } from '../../src/edge/email_processor.ts';

Deno.test('processEmail handles valid input', async () => {
  const result = await processEmail({
    from: 'newsletter@example.com',
    subject: 'Test Newsletter',
    content: 'Hello World',
  });

  assertEquals(result.success, true);
  assertEquals(result.newsletterId).toBeDefined();
});
```

#### Key Test Cases

1. **Email Parsing**
   - Valid email formats
   - HTML content extraction
   - Character encoding handling
   - Large email processing

2. **Validation Logic**
   - Rate limiting
   - Source limits
   - Content filtering
   - Duplicate detection

3. **Error Handling**
   - Malformed input
   - Missing fields
   - Database errors
   - Network timeouts

### Deno Integration Tests

#### Test Environment

```typescript
// test/edge/integration_test.ts
import { assert } from 'https://deno.land/std@0.200.0/assert/mod.ts';
import { test } from 'https://deno.land/x/denops_test@v1.4.0/mod.ts';
import { createTestClient } from '../test_utils.ts';

test('end-to-end email processing', async () => {
  const client = createTestClient();

  // Test with mock SMTP server
  const response = await client.post('/process-email', {
    // Test payload
  });

  assert(response.ok);
  // Verify database state
});
```

#### Test Coverage Areas

- End-to-end flow with mock SMTP server
- Rate limiting behavior
- Concurrency handling
- Error recovery scenarios
- Database consistency checks

### Running Tests

```bash
# Run all tests
deno test --allow-net --allow-env --allow-read --allow-write

# Run with coverage
deno test --coverage=./coverage
```

### Test Fixtures

Located in `test/fixtures/`:

- `emails/` - Sample email files (.eml)
- `newsletters/` - Expected parsed output
- `mocks/` - Mock services and responses

## Deployment

1. Update function code
2. Run tests
3. Deploy to staging
4. Monitor logs
5. Deploy to production

## Version History

### v1.0.0

- Initial release
- Basic email processing
- Source management

### v1.1.0

- Rate limiting
- Enhanced validation
- Improved error handling
