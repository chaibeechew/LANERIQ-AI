import { PUBLIC_DISCOVERY_PATHS } from "../auth/session-safety.js";

const HIDDEN_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/auth",
  "/create",
  "/studio",
  "/production-e2e",
  "/mobile-readiness",
  "/landing",
  "/templates",
  ...PUBLIC_DISCOVERY_PATHS,
]);

const HIDDEN_PREFIXES = [
  "/a/",
  "/website/",
  "/release/",
  "/landing/",
  "/templates/",
];

export function shouldHideBuilderGlobalOverlay(pathname) {
  const path = String(pathname || "/").split("?")[0] || "/";
  return HIDDEN_EXACT_PATHS.has(path) || HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function shouldShowBuilderGlobalOverlay(pathname) {
  return !shouldHideBuilderGlobalOverlay(pathname);
}
