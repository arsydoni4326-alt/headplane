import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

export interface E2EState {
  apiUrl: string;
  apiKey: string;
}

export async function readE2EState(): Promise<E2EState> {
  const raw = await readFile(join(process.cwd(), "tests", "e2e", ".e2e-state.json"), "utf-8");
  return JSON.parse(raw) as E2EState;
}

export const test = base.extend<{ apiKey: string; authedPage: Page }>({
  apiKey: async (_fixtures, use) => {
    const state = await readE2EState();
    await use(state.apiKey);
  },
  authedPage: async ({ page, apiKey }, use) => {
    await page.goto("/admin/login");
    await page.getByPlaceholder("API Key").fill(apiKey);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/machines/);
    await use(page);
  },
});

export { expect };
