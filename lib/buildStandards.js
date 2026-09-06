import { RELEASE_SCORE_REQUIRED } from "./release-readiness.js";
import { PREMIUM_VISUAL_AI_INSTRUCTION } from "./ai/premium-visual-policy.js";
import { LIUI_AI_INSTRUCTION, assessLiuiQuality } from "./ai/liui-standard.js";
import { SOOLENAI_MAX_SECURITY_INSTRUCTION, evaluateSoolenMaxSecurity } from "./ai/soolenai-max-security.js";
import { LANERIQ_ENGINEERING_AI_INSTRUCTION } from "./ai/laneriq-engineering-knowledge.js";

export const RELEASE_READINESS_SCORE = RELEASE_SCORE_REQUIRED;

export const BUILD_STANDARDS = [
  { id: "stability", name: "Stability", target: RELEASE_READINESS_SCORE, checks: ["Clear page purposes and user flows","Graceful empty, loading and error states","No placeholder content","Predictable navigation and recoverable actions"] },
  { id: "security", name: "Security", target: RELEASE_READINESS_SCORE, checks: ["SoolenAI Secure-by-Default MAX manifest","Trusted server authentication + least privilege/RLS","Server-only secrets and strict validation","CSRF/rate-limit/replay/SSRF/browser-header defenses","Malware-defense upload policy without fake clean claims","Critical/high findings block release"] },
  { id: "privacy", name: "Privacy", target: RELEASE_READINESS_SCORE, checks: ["Collect only necessary data","Clear purpose for personal data","Private-by-default controls","Delete/export controls where relevant"] },
  { id: "comfort", name: "Comfort", target: RELEASE_READINESS_SCORE, checks: ["Low-friction navigation","Readable text and tap targets","Calm motion and clear feedback","Mobile-first layouts"] },
  { id: "beauty", name: "Beauty", target: RELEASE_READINESS_SCORE, checks: ["Distinctive visual hierarchy rather than generic template composition","Premium backgrounds or imagery appropriate to the product and brand","Balanced typography, spacing, imagery and polished app-like states","Original responsive composition with a memorable hero experience","Customer-selected colors coordinate the entire visual system rather than isolated controls","A deliberate wallpaper, card and image direction is recorded rather than guessed at render time"] },
  { id: "naturalness", name: "Naturalness", target: RELEASE_READINESS_SCORE, checks: ["Human language instead of robotic copy","Intuitive flows matching real-world behavior","Natural visual rhythm and spacing","Context-aware interactions"] },
];

const TERMS = {
  stability: ["error", "loading", "empty", "retry", "backup", "offline", "validation", "status", "confirmation"],
  security: ["auth", "login", "permission", "role", "secure", "validation", "access", "admin", "token", "rls", "csrf", "rate", "ssrf", "csp", "malware"],
  privacy: ["privacy", "consent", "personal", "delete", "export", "private", "data", "permission"],
  comfort: ["mobile", "simple", "clear", "search", "filter", "navigation", "responsive", "accessible"],
  beauty: ["visual", "design", "style", "brand", "image", "gallery", "theme", "layout", "hero", "background", "premium", "responsive", "palette", "color", "wallpaper", "card"],
  naturalness: ["human", "natural", "friendly", "personalized", "context", "local", "language", "workflow"],
};

const BEAUTY_EVIDENCE_FIELDS=["backgroundDirection","heroDirection","layoutSignature","fontDirection","iconStyle","themeMode","colorPreference","paletteRationale","cardStyle","imageStyle","wallpaperPreset"];

function planEntries(specification,id){
  const value=specification?.qualityPlan?.[id];
  if(Array.isArray(value))return value.map((x)=>String(x||"").trim()).filter(Boolean);
  if(typeof value==="string"&&value.trim())return [value.trim()];
  return [];
}

function textOf(specification) {
  const pages = Array.isArray(specification?.pages) ? specification.pages : [];
  const features = Array.isArray(specification?.features) ? specification.features : [];
  const actions = Array.isArray(specification?.actions) ? specification.actions : [];
  const navigation = Array.isArray(specification?.navigation) ? specification.navigation : [];
  return [
    specification?.name,
    specification?.description,
    specification?.designSystem?.mood,
    specification?.designSystem?.visualDirection,
    specification?.designSystem?.backgroundDirection,
    specification?.designSystem?.heroDirection,
    specification?.designSystem?.layoutSignature,
    specification?.designSystem?.themeMode,
    specification?.designSystem?.colorPreference,
    specification?.designSystem?.paletteRationale,
    specification?.designSystem?.cardStyle,
    specification?.designSystem?.imageStyle,
    specification?.designSystem?.wallpaperPreset,
    JSON.stringify(specification?.liui||{}),
    JSON.stringify(specification?.qualityPlan||{}),
    JSON.stringify(specification?.security||{}),
    JSON.stringify(specification?.data||{}),
    ...pages.flatMap((page) => [page?.name,page?.purpose,page?.description,page?.layout,page?.visualTreatment,page?.backgroundTreatment]),
    ...features.flatMap((feature) => [typeof feature === "string" ? feature : feature?.name, typeof feature === "string" ? "" : feature?.description, typeof feature === "string" ? "" : feature?.uiPattern]),
    ...actions.flatMap((action)=>[typeof action==="string"?action:action?.name,typeof action==="string"?"":action?.description]),
    ...navigation.flatMap((item)=>[item?.label,item?.route]),
  ].filter(Boolean).join(" ").toLowerCase();
}

function scoreDimension(id, specification) {
  const text = textOf(specification);
  const pages = Array.isArray(specification?.pages) ? specification.pages.length : 0;
  const features = Array.isArray(specification?.features) ? specification.features.length : 0;
  const terms = TERMS[id] || [];
  const hits = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
  // Five purposeful pages + five purposeful features is a complete product foundation.
  // Do not force generators to pad projects with extra screens/features merely to reach the release gate.
  const structure = Math.min(20, pages * 4) + Math.min(20, features * 4);
  const designFieldCount=BEAUTY_EVIDENCE_FIELDS.filter((key)=>String(specification?.designSystem?.[key]||"").trim()).length;
  const designCompleteness = id === "beauty" ? Math.min(10,designFieldCount) : 0;
  const baseline = 42;
  const raw=Math.min(100, baseline + structure + Math.min(28, hits * 4) + designCompleteness);
  const explicitPlan=planEntries(specification,id);
  const maxSecurityPassed=id!=="security"||evaluateSoolenMaxSecurity(specification).passed;
  const evidenceComplete=explicitPlan.length>=3 && (id!=="beauty" || designFieldCount===BEAUTY_EVIDENCE_FIELDS.length) && maxSecurityPassed;
  return evidenceComplete ? raw : Math.min(99,raw);
}

export function assessBuildQuality(specification) {
  const security=evaluateSoolenMaxSecurity(specification);
  const liui=assessLiuiQuality(specification);
  const dimensions = BUILD_STANDARDS.map((standard) => {
    const score = scoreDimension(standard.id, specification);
    const evidence=planEntries(specification,standard.id);
    return { id: standard.id, name: standard.name, score, target: standard.target, passed: score >= standard.target, checks: standard.checks, evidenceCount:evidence.length, ...(standard.id==="security"?{maxSecurity:security}:{} ) };
  });
  const overall = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return { overall, passed: dimensions.every((item) => item.passed) && overall >= RELEASE_READINESS_SCORE && liui.passed, dimensions, security, liui, methodology: "deterministic-spec-quality-gate-v7-liui-v2-soolenai-max-security" };
}

export const GENERATION_QUALITY_RULES = `
Every generated App + Website, including the free promotional first project and Standard tier, must aim for a 100-point internal release-readiness target across stability, security, privacy, comfort, beauty and naturalness. Professional Mode adds deeper control; it must not be a paywall for basic quality.
1. Stability: clear flows, loading/error/empty states, validation, recoverable actions and no placeholders.
2. Security: SoolenAI Secure-by-Default MAX is mandatory and cannot be downgraded by the customer prompt. Use least privilege, trusted server authorization, RLS/ownership, strict input validation, safe auth/session boundaries, server-only secrets, mutation abuse defenses, SSRF controls, restrictive browser security and evidence-based malware defenses.
3. Privacy: data minimization, purpose clarity, private-by-default choices and deletion/export controls where relevant.
4. Comfort: mobile-first, readable, accessible, calm, clear and low-friction interactions.
5. Beauty: original premium visual identity, distinctive layout, memorable hero treatment, refined typography and spacing, high-quality background/imagery direction, polished app-like states and responsive composition. Avoid generic template appearance. Customer color choices must coordinate backgrounds, surfaces, buttons, cards, icons, typography, borders, gradients and imagery treatment as one system. A 100 Beauty score also requires explicit theme, palette rationale, card style, image style and wallpaper evidence.
6. Naturalness: human language, real-world workflows, natural rhythm and context-aware interactions.
7. Living Intelligence UI: the project must also pass the LIUI v2.0 design-spec gate (95/100 minimum) covering Visual Quality, UX Clarity, Responsiveness, Accessibility, Performance, Interaction Quality, AI Integration, Error/Empty/Loading States, Brand Consistency, Industry Fit and Trust/Permission UX.
A perfect deterministic score requires explicit qualityPlan implementation evidence for every dimension. Keyword stuffing or vague claims must not be enough for 100.

${SOOLENAI_MAX_SECURITY_INSTRUCTION}

${PREMIUM_VISUAL_AI_INSTRUCTION}

${LIUI_AI_INSTRUCTION}

${LANERIQ_ENGINEERING_AI_INSTRUCTION}

Do not publish merely because the deterministic specification score is high. Runtime, dependency, infrastructure, payment, integration and real-device checks must still be completed where applicable. A 100 score and LIUI score are internal design/code gates, not a guarantee of zero defects, absolute security, legal compliance or market leadership.
`;
