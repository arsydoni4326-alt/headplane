// Lighthouse CI configuration.
//
// The budgets below are initial values — run `pnpm lighthouse:ci` locally to
// capture a baseline and tighten them. The deterministic performance gate is
// the bundle-size analysis (`pnpm analyze:bundle`); Lighthouse provides the
// runtime trend data.
module.exports = {
  ci: {
    collect: {
      startServerCommand: "HEADPLANE_CONFIG_PATH=./tests/lighthouse/config.yaml pnpm start",
      startServerTimeout: 60_000,
      url: ["http://127.0.0.1:3101/admin/login"],
      numberOfRuns: 1,
      settings: {
        chromeFlags: "--no-sandbox",
      },
    },
    assert: {
      assertions: {
        // Warn (not error) so CI does not flake on runner variance; tighten
        // after a baseline is captured.
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
