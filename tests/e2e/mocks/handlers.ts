import { http, HttpResponse } from 'msw';

// Test user data
const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'authenticated',
  app_metadata: {
    provider: 'email',
    providers: ['email']
  },
  user_metadata: {
    full_name: 'Test User'
  },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  phone: null,
  confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: new Date().toISOString(),
  identities: [{
    id: 'test-user-123',
    user_id: 'test-user-123',
    identity_data: {
      email: 'test@example.com',
      sub: 'test-user-123'
    },
    provider: 'email',
    last_sign_in_at: new Date().toISOString(),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }]
};

const TEST_SESSION = {
  access_token: 'mock-access-token-123',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token-123',
  user: TEST_USER
};

// Store for active sessions (in-memory)
const activeSessions = new Map<string, typeof TEST_SESSION>();

export const handlers = [
  // Auth sign in endpoint
  http.post('http://localhost:3000/auth/v1/token', async ({ request }) => {
    const body = await request.json() as any;

    // Check for password grant type
    if (body.grant_type === 'password') {
      const { email, password } = body;

      // Validate credentials
      if (email === 'test@example.com' && password === 'testpassword123') {
        const session = { ...TEST_SESSION };
        activeSessions.set(session.access_token, session);

        return HttpResponse.json(session, { status: 200 });
      }

      // Invalid credentials
      return HttpResponse.json(
        {
          error: 'invalid_grant',
          error_description: 'Invalid login credentials'
        },
        { status: 400 }
      );
    }

    // Refresh token grant
    if (body.grant_type === 'refresh_token') {
      const session = { ...TEST_SESSION };
      return HttpResponse.json(session, { status: 200 });
    }

    return HttpResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400 }
    );
  }),

  // Get user endpoint
  http.get('http://localhost:3000/auth/v1/user', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = activeSessions.get(token);

    if (session) {
      return HttpResponse.json({ user: TEST_USER }, { status: 200 });
    }

    return HttpResponse.json(
      { message: 'Invalid token' },
      { status: 401 }
    );
  }),

  // Sign out endpoint
  http.post('http://localhost:3000/auth/v1/logout', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      const token = authHeader.substring(7);
      activeSessions.delete(token);
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Sign up endpoint
  http.post('http://localhost:3000/auth/v1/signup', async ({ request }) => {
    const body = await request.json() as any;
    const { email, password } = body;

    // For testing, we'll allow any sign up
    const newUser = {
      ...TEST_USER,
      id: `user-${Date.now()}`,
      email,
      identities: [{
        ...TEST_USER.identities[0],
        id: `user-${Date.now()}`,
        user_id: `user-${Date.now()}`,
        identity_data: {
          email,
          sub: `user-${Date.now()}`
        }
      }]
    };

    const session = {
      ...TEST_SESSION,
      user: newUser
    };

    return HttpResponse.json(session, { status: 200 });
  }),

  // Password reset endpoint
  http.post('http://localhost:3000/auth/v1/recover', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json(
      { message: 'Password recovery email sent' },
      { status: 200 }
    );
  }),

  // Get session endpoint (used by Supabase client on init)
  http.get('http://localhost:3000/auth/v1/session', () => {
    // Return null session for unauthenticated state
    return HttpResponse.json({ session: null }, { status: 200 });
  }),

  // Mock newsletter data endpoints
  http.get('http://localhost:3000/rest/v1/newsletters', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return HttpResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Return empty newsletters for authenticated users
    return HttpResponse.json([], { status: 200 });
  }),

  // Mock users table for initial connection check
  http.get('http://localhost:3000/rest/v1/users', ({ request }) => {
    const url = new URL(request.url);
    const select = url.searchParams.get('select');
    const limit = url.searchParams.get('limit');

    // Connection check query
    if (select === 'id' && limit === '1') {
      return HttpResponse.json([], { status: 200 });
    }

    return HttpResponse.json([], { status: 200 });
  }),

  // Mock tags endpoint
  http.get('http://localhost:3000/rest/v1/tags', () => {
    return HttpResponse.json([], { status: 200 });
  }),

  // Mock newsletter sources endpoint
  http.get('http://localhost:3000/rest/v1/newsletter_sources', () => {
    return HttpResponse.json([], { status: 200 });
  })
];

// Helper to reset sessions between tests
export const resetSessions = () => {
  activeSessions.clear();
};
