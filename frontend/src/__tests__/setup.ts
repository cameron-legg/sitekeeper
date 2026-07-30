/**
 * Shared test setup and utilities for all frontend tests.
 *
 * Provides:
 * - Mock for AsyncStorage
 * - Mock for apiClient (axios)
 * - QueryClient wrapper for testing hooks
 * - Helper to render components with providers
 */

import "@testing-library/jest-native/extend-expect";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock the API client
jest.mock("../api/client", () => {
  const mockClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return { __esModule: true, default: mockClient };
});
