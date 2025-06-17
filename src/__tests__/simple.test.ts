import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const message = 'Hello World';
    expect(message).toBe('Hello World');
    expect(message.length).toBe(11);
  });

  it('should work with arrays', () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });

  it('should work with objects', () => {
    const user = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    };

    expect(user).toHaveProperty('id');
    expect(user.name).toBe('Test User');
    expect(user.email).toMatch(/test@/);
  });

  it('should handle async operations', async () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('async result'), 10);
    });

    const result = await promise;
    expect(result).toBe('async result');
  });
});
