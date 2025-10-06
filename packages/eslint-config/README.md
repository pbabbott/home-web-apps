# `@turbo/eslint-config`

Collection of internal eslint configurations.

# Configuration Presets

## `library.js`

A general-purpose ESLint configuration for JavaScript/TypeScript libraries. Extends the base configuration with recommended rules for library development, including TypeScript support, Turbo monorepo rules, and Prettier integration. Ideal for shared libraries, utilities, and packages that don't require React or server-specific configurations.

## `server.js`

A Node.js server-focused ESLint configuration that extends the base configuration. Includes all the standard rules for server-side development with TypeScript support, Turbo monorepo integration, and Prettier formatting. Perfect for API servers, backend services, and Node.js applications.

## `react-internal.js`

A comprehensive React development ESLint configuration that extends the base configuration with React-specific rules and plugins. Includes React Hooks rules, React Refresh support, JSX linting, and browser/service worker globals. Optimized for internal React applications with modern JSX transform support and component export patterns.
