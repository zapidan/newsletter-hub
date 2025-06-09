# Web Application

This directory contains all web-specific code for the application.

## Structure

- `components/`: Web-specific components
- `pages/`: Page components that use common components and web-specific layouts
- `App.tsx`: Web application entry point

## Guidelines

1. Keep web-specific code in this directory
2. Reuse components from `common/` whenever possible
3. Use relative imports for files within this directory
4. Import common components using absolute imports (e.g., `@/common/components/Button`)
