# Common Code

This directory contains all the platform-agnostic code that can be shared between web and mobile applications.

## Structure

- `components/`: Reusable UI components that work on both web and mobile
- `hooks/`: Custom React hooks for business logic and data fetching
- `services/`: API clients, database layer, and other services
- `types/`: Shared TypeScript types and interfaces
- `utils/`: Utility functions and helpers
- `contexts/`: React context providers and consumers

## Guidelines

1. Keep all platform-specific code out of this directory
2. Use dependency injection for any platform-specific functionality
3. Follow the single responsibility principle for components and hooks
4. Keep components as dumb as possible, moving logic to hooks
5. Use TypeScript for type safety across platforms
