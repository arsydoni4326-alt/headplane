import { describe, expect, it } from "vitest";

import type { CreateInstanceRequest, UpdateInstanceRequest } from "~/types/Instance";

describe("Instance Types", () => {
  it("should define CreateInstanceRequest interface", () => {
    const request: CreateInstanceRequest = {
      name: "Test Instance",
      apiUrl: "https://test.example.com",
      apiKey: "test-key",
      isDefault: true,
    };

    expect(request.name).toBe("Test Instance");
    expect(request.apiUrl).toBe("https://test.example.com");
    expect(request.apiKey).toBe("test-key");
    expect(request.isDefault).toBe(true);
  });

  it("should define UpdateInstanceRequest interface", () => {
    const request: UpdateInstanceRequest = {
      name: "Updated Instance",
      apiUrl: "https://updated.example.com",
    };

    expect(request.name).toBe("Updated Instance");
    expect(request.apiUrl).toBe("https://updated.example.com");
  });

  it("should allow optional fields in CreateInstanceRequest", () => {
    const minimalRequest: CreateInstanceRequest = {
      name: "Minimal",
      apiUrl: "https://minimal.example.com",
    };

    expect(minimalRequest.apiKey).toBeUndefined();
    expect(minimalRequest.oidcClientId).toBeUndefined();
    expect(minimalRequest.oidcClientSecret).toBeUndefined();
    expect(minimalRequest.isDefault).toBeUndefined();
  });
});
