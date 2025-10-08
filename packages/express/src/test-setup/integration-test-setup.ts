import express, { Express } from 'express';

/**
 * Creates a fresh Express app instance for integration testing
 * This centralizes the app creation logic to reduce boilerplate
 */
export const createTestApp = (): Express => {
  return express();
};
