import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startHeadscale } from "../integration/setup/start-headscale";

const E2E_DIR = join(process.cwd(), "tests", "e2e");
const STATE_FILE = join(E2E_DIR, ".e2e-state.json");
const CONFIG_FILE = join(E2E_DIR, ".headplane-e2e.yaml");
const HS_CONFIG_FILE = join(E2E_DIR, ".headscale-e2e.yaml");

/**
 * Global setup for the Playwright e2e suite.
 *
 * Starts a real Headscale container (via testcontainers), creates an API key,
 * and writes:
 *   - a Headplane config pointing at the container (used by the dev server),
 *   - a minimal Headscale config so the DNS page can read settings,
 *   - a state file with the API key for the tests to log in with.
 *
 * The returned teardown stops the container after the run.
 */
export default async function globalSetup() {
  const env = await startHeadscale("0.29.1");

  await mkdir(E2E_DIR, { recursive: true });

  // A minimal Headscale config so Headplane can read DNS settings.
  const hsConfig = [
    "dns:",
    "  magic_dns: true",
    "  base_domain: example.com",
    "  nameservers:",
    "    global:",
    "      - 1.1.1.1",
    "  search_domains: []",
    "  extra_records: []",
    "",
  ].join("\n");
  await writeFile(HS_CONFIG_FILE, hsConfig);

  const hpConfig = [
    "server:",
    '  host: "127.0.0.1"',
    "  port: 3100",
    '  base_url: "http://127.0.0.1:3100"',
    `  data_path: "${E2E_DIR}/data"`,
    '  cookie_secret: "0123456789abcdef0123456789abcdef"',
    "  cookie_secure: false",
    "headscale:",
    `  url: "${env.apiUrl}"`,
    `  config_path: "${HS_CONFIG_FILE}"`,
    "",
  ].join("\n");
  await writeFile(CONFIG_FILE, hpConfig);

  await writeFile(STATE_FILE, JSON.stringify({ apiUrl: env.apiUrl, apiKey: env.apiKey }));

  return async () => {
    await env.container.stop({ remove: true, removeVolumes: true });
  };
}
