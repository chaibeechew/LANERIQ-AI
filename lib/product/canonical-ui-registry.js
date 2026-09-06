export const CANONICAL_UI_VERSION = "2026.09-canonical-ui-v1";

export const CANONICAL_PRIMARY_NAV = Object.freeze([
  { id: "home", label: "Home", href: "/", icon: "⌂" },
  { id: "projects", label: "Projects", href: "/my-apps", icon: "▣" },
  { id: "create", label: "Create", href: "/create", icon: "✦" },
  { id: "templates", label: "Templates", href: "/templates", icon: "▦" },
  { id: "more", label: "More", href: "/studio", icon: "•••" },
]);

export const CANONICAL_PROJECT_RAIL = Object.freeze([
  { id: "home", label: "Home", href: "/", icon: "⌂" },
  { id: "projects", label: "Projects", href: "/my-apps", icon: "▣" },
  { id: "templates", label: "Templates", href: "/templates", icon: "▦" },
  { id: "automation", label: "Automation", href: "/studio", icon: "⌘" },
  { id: "assistant", label: "AI Assistant", href: "/soolen-ai", icon: "◎" },
  { id: "more", label: "More", href: "/studio", icon: "⚙" },
]);

export const CANONICAL_CREATION_JOURNEY = Object.freeze([
  { id: "idea", label: "Idea", route: "/" },
  { id: "plan", label: "Plan", route: "/create" },
  { id: "build", label: "Build", route: "/create?flow=build-progress" },
  { id: "preview", label: "Preview", route: "/preview/[id]" },
  { id: "launch", label: "Launch", route: "/release/[id]" },
  { id: "manage", label: "Manage", route: "/app-dashboard/[id]" },
]);

const ROUTES = [
  { id:"home", pattern:/^\/$/, surface:"creation", name:"Home", group:"creation", nav:"Home", stage:"Idea", risk:"low", approval:false, evidence:"production-surface", primaryAction:"Start a new build" },
  { id:"login", pattern:/^\/login\/?$/, surface:"auth", name:"Login", group:"auth", nav:"", stage:"Login", risk:"low", approval:false, evidence:"session-entry", primaryAction:"Continue with Email" },
  { id:"auth", pattern:/^\/auth\/?$/, surface:"auth", name:"Email Verification", group:"auth", nav:"", stage:"Verify", risk:"medium", approval:true, evidence:"verification-runtime", primaryAction:"Verify email and continue" },
  { id:"create", pattern:/^\/create\/?$/, surface:"creation", name:"Create", group:"creation", nav:"Create", stage:"Plan", risk:"medium", approval:true, evidence:"generation-planning", primaryAction:"Generate Project" },
  { id:"preview", pattern:/^\/preview\//, surface:"preview", name:"Preview", group:"project", nav:"Projects", stage:"Preview", risk:"low", approval:true, evidence:"browser-preview", primaryAction:"Review preview" },
  { id:"release", pattern:/^\/release\//, surface:"launch", name:"Launch", group:"project", nav:"Projects", stage:"Launch", risk:"high", approval:true, evidence:"release-readiness", primaryAction:"Prepare release" },
  { id:"dashboard", pattern:/^\/app-dashboard\//, surface:"manage", name:"Manage & Grow", group:"project", nav:"Projects", stage:"Manage", risk:"medium", approval:true, evidence:"real-data-only", primaryAction:"Open project workspace" },
  { id:"projects", pattern:/^\/(?:my-apps|projects)\/?$/, surface:"creations", name:"Projects", group:"library", nav:"Projects", stage:"Projects", risk:"low", approval:false, evidence:"owner-scoped", primaryAction:"Open or continue a project" },
  { id:"templates", pattern:/^\/templates\/?$/, surface:"templates", name:"Templates", group:"library", nav:"Templates", stage:"Templates", risk:"low", approval:false, evidence:"template-intelligence", primaryAction:"Choose a template" },
  { id:"template-detail", pattern:/^\/templates\//, surface:"template-detail", name:"Template Detail", group:"library", nav:"Templates", stage:"Template", risk:"medium", approval:true, evidence:"template-adaptation", primaryAction:"Use template" },
  { id:"assistant", pattern:/^\/soolen-ai\/?$/, surface:"assistant", name:"AI Assistant", group:"workspace", nav:"More", stage:"Assistant", risk:"medium", approval:true, evidence:"command-layer", primaryAction:"Run an AI command" },
  { id:"workflow", pattern:/^\/workflows\//, surface:"workflow", name:"Automation", group:"workspace", nav:"Projects", stage:"Automation", risk:"high", approval:true, evidence:"workflow-runtime", primaryAction:"Save workflow" },
  { id:"analytics", pattern:/^\/analytics\//, surface:"analytics", name:"Analytics & Growth", group:"workspace", nav:"Projects", stage:"Analytics", risk:"medium", approval:false, evidence:"real-data-required", primaryAction:"Review insights" },
  { id:"studio", pattern:/^\/studio\/?$/, surface:"more", name:"More & Settings", group:"workspace", nav:"More", stage:"More", risk:"high", approval:true, evidence:"settings-boundary", primaryAction:"Open a tool or setting" },
  { id:"image-studio", pattern:/^\/image-studio\/?$/, surface:"media", name:"Image Studio", group:"workspace", nav:"More", stage:"Media", risk:"medium", approval:true, evidence:"media-runtime", primaryAction:"Create or edit an image" },
  { id:"video-studio", pattern:/^\/video-studio\/?$/, surface:"media", name:"Video Studio", group:"workspace", nav:"More", stage:"Media", risk:"medium", approval:true, evidence:"media-runtime", primaryAction:"Create or edit video" },
  { id:"avatar-studio", pattern:/^\/avatar-studio\/?$/, surface:"media", name:"Avatar Studio", group:"workspace", nav:"More", stage:"Media", risk:"medium", approval:true, evidence:"media-runtime", primaryAction:"Create an avatar" },
  { id:"brand-kit", pattern:/^\/brand-kit\/?$/, surface:"brand", name:"Brand Kit", group:"workspace", nav:"More", stage:"Brand", risk:"medium", approval:true, evidence:"brand-runtime", primaryAction:"Save brand direction" },
  { id:"asset-library", pattern:/^\/asset-library\/?$/, surface:"assets", name:"Asset Library", group:"workspace", nav:"More", stage:"Assets", risk:"medium", approval:true, evidence:"owner-scoped", primaryAction:"Manage assets" },
  { id:"community-chat", pattern:/^\/community-chat\/?$/, surface:"community", name:"Community", group:"workspace", nav:"More", stage:"Community", risk:"medium", approval:true, evidence:"community-runtime", primaryAction:"Open community" },
  { id:"credits", pattern:/^\/credits\/?$/, surface:"credits", name:"Credits", group:"account", nav:"More", stage:"Credits", risk:"medium", approval:true, evidence:"billing-runtime", primaryAction:"Review usage" },
  { id:"domains", pattern:/^\/domains\/?$/, surface:"domains", name:"Domains", group:"account", nav:"More", stage:"Domains", risk:"high", approval:true, evidence:"domain-runtime", primaryAction:"Manage domain" },
  { id:"device-compute", pattern:/^\/account\/device-compute\/?$/, surface:"account", name:"Device & Compute", group:"account", nav:"More", stage:"Account", risk:"high", approval:true, evidence:"device-runtime", primaryAction:"Manage device compute" },
  { id:"security", pattern:/^\/account\/security\/?$/, surface:"account", name:"Security & Email", group:"account", nav:"More", stage:"Account", risk:"high", approval:true, evidence:"security-runtime", primaryAction:"Manage security" },
  { id:"cloud", pattern:/^\/account\/cloud\/?$/, surface:"account", name:"LANERIQ Cloud", group:"account", nav:"More", stage:"Account", risk:"high", approval:true, evidence:"cloud-runtime", primaryAction:"Review cloud settings" },
  { id:"editor", pattern:/^\/editor\//, surface:"editor", name:"AI Editor", group:"project", nav:"Projects", stage:"Editor", risk:"high", approval:true, evidence:"versioned-editing", primaryAction:"Apply AI change safely" },
  { id:"database", pattern:/^\/database\//, surface:"database", name:"Database", group:"project", nav:"Projects", stage:"Database", risk:"critical", approval:true, evidence:"database-security", primaryAction:"Apply safe data change" },
  { id:"operations", pattern:/^\/operations\//, surface:"quality", name:"Testing & Self-Heal", group:"project", nav:"Projects", stage:"Testing", risk:"critical", approval:true, evidence:"quality-evidence", primaryAction:"Run tests" },
  { id:"publish", pattern:/^\/publish\//, surface:"publish", name:"Publish & Deployment", group:"project", nav:"Projects", stage:"Publish", risk:"critical", approval:true, evidence:"release-evidence", primaryAction:"Publish or deploy" },
];

export const CANONICAL_UI_ROUTES = Object.freeze(ROUTES.map((item) => Object.freeze({ ...item })));

export function resolveCanonicalUiContext(pathname, searchParams) {
  const path = String(pathname || "/");
  const match = CANONICAL_UI_ROUTES.find((item) => item.pattern.test(path));
  if (!match) return null;
  if (match.id === "create" && searchParams?.get?.("flow") === "build-progress") {
    return Object.freeze({ ...match, id:"build-progress", name:"Build Progress", stage:"Build", primaryAction:"Open build result", approval:false, evidence:"runtime-progress" });
  }
  if (match.id === "workflow" && searchParams?.get?.("view") === "editor") {
    return Object.freeze({ ...match, id:"workflow-editor", name:"Workflow Editor", stage:"Workflow Editor", primaryAction:"Save & Activate" });
  }
  return match;
}

export function canonicalNavLabel(pathname, searchParams) {
  return resolveCanonicalUiContext(pathname, searchParams)?.nav || "";
}

export function canonicalCreationIndex(stage) {
  return CANONICAL_CREATION_JOURNEY.findIndex((item) => item.label === stage);
}
