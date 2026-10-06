import { index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Utility Routes
  route("/healthz", "routes/util/healthz.ts"),

  // API Routes
  ...prefix("/api", [
    route("/info", "routes/util/info.ts"),
    route("/color-scheme", "routes/util/color-scheme.ts"),
    route("/update-check", "routes/util/update-check.ts"),
    ...prefix("/v1/headplane", [route("/settings", "routes/api/v1/headplane-settings.ts")]),
  ]),
  ...prefix("/events", [route("/live", "routes/util/live.ts")]),

  // Authentication Routes
  route("/login", "routes/auth/login/page.tsx"),
  route("/logout", "routes/auth/logout.ts"),
  route("/oidc/callback", "routes/auth/oidc-callback.ts"),
  route("/oidc/start", "routes/auth/oidc-start.ts"),
  route("/ssh/:id", "routes/ssh/page.tsx"),

  // All the main logged-in routes
  layout("layout/app.tsx", [
    index("routes/home.tsx"),
    ...prefix("/machines", [
      index("routes/machines/overview.tsx"),
      route("/:id", "routes/machines/machine.tsx"),
    ]),

    route("/users", "routes/users/overview.tsx"),
    route("/acls", "routes/acls/overview.tsx"),
    route("/dns", "routes/dns/overview.tsx"),
    route("/routes", "routes/routes/overview.tsx"),
    route("/derp", "routes/derp/overview.tsx"),
    route("/topology", "routes/topology/overview.tsx"),
    route("/audit", "routes/audit/overview.tsx"),

    ...prefix("/instances", [
      index("routes/instances/overview.tsx"),
      route("/new", "routes/instances/new.tsx"),
    ]),

    ...prefix("/admin", [route("/", "routes/admin/route.tsx")]),

    ...prefix("/settings", [
      index("routes/settings/overview.tsx"),
      route("/profile", "routes/settings/profile.tsx"),
      route("/auth-keys", "routes/settings/auth-keys/overview.tsx"),
      route("/restrictions", "routes/settings/restrictions/overview.tsx"),
      route("/agent", "routes/settings/agent.tsx"),
      route("/export", "routes/settings/export/overview.tsx"),
    ]),
  ]),
];
