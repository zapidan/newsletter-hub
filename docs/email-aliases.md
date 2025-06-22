# Email Aliases

## Overview

This document outlines how email aliases work in the Newsletter Hub application. Email aliases are automatically generated for users during sign-up and are used as the sender address for newsletters.

## Configuration

### Environment Variables

- `VITE_EMAIL_DEFAULT_DOMAIN`: The domain to use for email aliases (e.g., `newsletterhub.com`). Defaults to `newsletterhub.com` if not set.

Example:
```
VITE_EMAIL_DEFAULT_DOMAIN=yourdomain.com
```

## How It Works

### Alias Generation

When a user signs up, an email alias is automatically generated using the following rules:
1. The username part is extracted from the user's email (everything before the @)
2. Special characters are removed from the username
3. The alias is created as: `{cleaned_username}@{configured_domain}`

Examples:
- Email: `john.doe@example.com` → Alias: `johndoe@yourdomain.com`
- Email: `user+test@example.com` → Alias: `usertest@yourdomain.com`
- Email: `first.last+filter@example.com` → Alias: `firstlast@yourdomain.com`

### Alias Management

- Aliases are automatically assigned during user sign-up
- The alias is stored in the user's profile in the database
- Users can view their alias in their account settings
- The alias cannot be changed by the user (this is a design decision to prevent abuse)

## Testing

### Unit Tests

Unit tests for the email alias functionality can be found in:
- `src/__tests__/utils/emailAlias.test.ts`

### Integration Tests

Integration tests for the sign-up flow with email alias assignment can be found in:
- `src/__tests__/integration/authFlow.test.ts`

## Troubleshooting

### Common Issues

1. **Alias not generated on sign-up**
   - Check the server logs for any errors during user creation
   - Verify that the `VITE_EMAIL_DEFAULT_DOMAIN` environment variable is set correctly

2. **Alias format issues**
   - The alias should always be in the format `username@domain`
   - Special characters in the email username are removed during alias generation

3. **Duplicate aliases**
   - The system ensures aliases are unique by appending a number if needed
   - If you encounter duplicate aliases, check the user creation logic for race conditions
