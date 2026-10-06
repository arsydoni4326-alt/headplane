import { type } from "arktype";
import { describe, it, expect } from "vitest";

describe("Config Schema - User Fields", () => {
  it("should validate user config with name and avatar", () => {
    const userConfig = type({
      username: "string",
      password: "string",
      name: "string?",
      avatar: type("string.url").optional(),
    });

    const validUser = {
      username: "admin",
      password: "$2a$10$abcdefghijklmnopqrstuv",
      name: "Administrator",
      avatar: "https://example.com/avatar.png",
    };

    const result = userConfig(validUser);
    expect(result).toEqual(validUser);
  });

  it("should validate user config without optional fields", () => {
    const userConfig = type({
      username: "string",
      password: "string",
      name: "string?",
      avatar: type("string.url").optional(),
    });

    const validUser = {
      username: "admin",
      password: "$2a$10$abcdefghijklmnopqrstuv",
    };

    const result = userConfig(validUser);
    expect(result).toEqual(validUser);
  });

  it("should reject invalid avatar URL", () => {
    const userConfig = type({
      username: "string",
      password: "string",
      name: "string?",
      avatar: type("string.url").optional(),
    });

    const invalidUser = {
      username: "admin",
      password: "$2a$10$abcdefghijklmnopqrstuv",
      avatar: "not-a-url",
    };

    const result = userConfig(invalidUser);
    expect(result instanceof type.errors).toBe(true);
  });

  it("should validate partial user config", () => {
    const partialUserConfig = type({
      username: "string?",
      password: "string?",
      name: "string?",
      avatar: type("string.url").optional(),
    });

    const partialUpdate = {
      name: "New Name",
      avatar: "https://example.com/new-avatar.png",
    };

    const result = partialUserConfig(partialUpdate);
    expect(result).toEqual(partialUpdate);
  });
});
