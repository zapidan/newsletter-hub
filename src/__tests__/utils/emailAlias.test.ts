import { describe, expect, it, vi } from 'vitest';
import { generateEmailAliasFromEmail } from '../../common/utils/emailAlias';

// Mock the environment variables
vi.mock('../../common/config/email', () => ({
  default: {
    defaultDomain: 'testdomain.com',
  },
}));

describe('emailAlias', () => {
  describe('generateEmailAliasFromEmail', () => {
    it('should generate an email alias using the username part of the email', () => {
      const email = 'test.user@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('testuser@testdomain.com');
    });

    it('should remove email filters (text after +)', () => {
      const email = 'test.user+filter@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('testuser@testdomain.com');
    });

    it('should remove numbers from the username', () => {
      const email = 'user123.name@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('username@testdomain.com');
    });

    it('should preserve dashes in the username', () => {
      const email = 'user-name.with-dashes@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('username-with-dashes@testdomain.com');
    });

    it('should handle emails with multiple special characters', () => {
      const email = 'user.name-with-dots+filter123@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('username-with-dots@testdomain.com');
    });

    it('should handle emails with consecutive special characters', () => {
      const email = 'user..name--with..dots@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('username-with-dots@testdomain.com');
    });

    it('should throw an error for empty email', () => {
      expect(() => generateEmailAliasFromEmail('')).toThrow('Invalid email address');
      expect(() => generateEmailAliasFromEmail('not-an-email')).toThrow('Invalid email address');
    });

    it('should use default username when empty after processing', () => {
      const email = '123.456@example.com';
      const alias = generateEmailAliasFromEmail(email);
      expect(alias).toBe('user@testdomain.com');
    });
  });
});
