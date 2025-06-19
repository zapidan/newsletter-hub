import { createClient, SupabaseClient, User, Session, AuthError, AuthResponse, AuthTokenResponse, AuthTokenResponsePassword, UserResponse, OAuthResponse, SignInWithPasswordCredentials, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

type MockUser = User & {
  email: string;
  password: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
};

type MockSession = Session & {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

class MockAuthClient {
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, MockSession> = new Map();
  private currentSession: MockSession | null = null;
  private authStateChangeListeners: Array<(
    event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
    session: Session | null
  ) => void> = [];

  async signUp(credentials: SignUpWithPasswordCredentials): Promise<AuthResponse> {
    const { email, password, options } = credentials;
    
    if (this.users.has(email)) {
      return {
        data: { user: null, session: null },
        error: new Error('User already registered') as AuthError,
      };
    }

    const user: MockUser = {
      id: `mock-user-${Date.now()}`,
      email: email,
      password: password, // In a real app, never store plaintext passwords!
      user_metadata: options?.data || {},
      app_metadata: { provider: 'email', ...(options?.data?.role ? { role: options.data.role } : {}) },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.users.set(email, user);

    // Auto-sign in after sign up
    return this.signInWithPassword({ email, password });
  }

  async signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;
    const user = this.users.get(email);

    if (!user || user.password !== password) {
      return {
        data: { user: null, session: null },
        error: new Error('Invalid login credentials') as AuthError,
      };
    }

    const session = this.createSession(user);
    this.currentSession = session;
    this.sessions.set(session.access_token, session);

    // Notify listeners
    this.notifyAuthStateChange('SIGNED_IN', session);

    return {
      data: { user, session },
      error: null,
    };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    if (this.currentSession) {
      this.sessions.delete(this.currentSession.access_token);
      this.notifyAuthStateChange('SIGNED_OUT', null);
      this.currentSession = null;
    }
    return { error: null };
  }

  async getSession(): Promise<{ data: { session: Session | null } }> {
    return {
      data: {
        session: this.currentSession,
      },
    };
  }

  async getUser(accessToken: string): Promise<{ data: { user: User | null } }> {
    const session = this.sessions.get(accessToken);
    if (!session) {
      return { data: { user: null } };
    }
    
    const user = Array.from(this.users.values()).find(u => u.id === session.user.id);
    return { data: { user: user || null } };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.authStateChangeListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.authStateChangeListeners = this.authStateChangeListeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  private createSession(user: MockUser): MockSession {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: `mock-access-token-${Date.now()}`,
      refresh_token: `mock-refresh-token-${Date.now()}`,
      expires_at: now + 3600, // 1 hour from now
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  private notifyAuthStateChange(
    event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
    session: MockSession | null
  ) {
    this.authStateChangeListeners.forEach((listener) => {
      try {
        listener(event, session);
      } catch (error) {
        console.error('Error in auth state change listener:', error);
      }
    });
  }
}

export function createMockSupabaseClient(): SupabaseClient {
  const auth = new MockAuthClient();
  
  // Create a proxy to handle all Supabase client methods
  const client = new Proxy({}, {
    get(_, prop) {
      // Handle auth methods
      if (prop === 'auth') {
        return new Proxy({}, {
          get(_, authMethod) {
            return async (...args: any[]) => {
              // Special case for onAuthStateChange to handle the callback registration
              if (authMethod === 'onAuthStateChange') {
                return (callback: any) => {
                  return auth.onAuthStateChange((event, session) => {
                    callback({
                      event,
                      session,
                    });
                  });
                };
              }

              
              // Call the corresponding method on our mock auth client
              if (typeof (auth as any)[authMethod] === 'function') {
                return (auth as any)[authMethod](...args);
              }
              
              // Default return for unimplemented methods
              return Promise.resolve({ data: null, error: null });
            };
          },
        });
      }
      
      // For other methods, return a function that returns a promise
      return () => Promise.resolve({ data: null, error: null });
    },
  }) as unknown as SupabaseClient;

  return client;
}

// Export for direct use in tests
export const mockSupabase = createMockSupabaseClient();

export default mockSupabase;
