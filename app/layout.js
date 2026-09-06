import { Suspense } from "react";
import "./globals.css";
import "./landscape-theme.css";
import "./modern-product-theme.css";
import "./backgrounds.css";
import "./premium-journey-theme.css";
import "./home-resilient.css";
import "./home-load-guard.css";
import "./language-runtime.css";
import "./mobile-quality.css";
import "./generated-app-premium.css";
import "./property-crm-golden-reference.css";
import "./generated-industry-visual-v2.css";
import "./home-mobile-input-safety.css";
import "./mobile-feature-hardening.css";
import "./liui-real-product-surface.css";
import "./liui-canonical-product-surface.css";
import "./liui-context-intelligence.css";
import "./liui-runtime-capabilities.css";
import "./liui-adaptive-experience.css";
import "./liui-simplification-performance.css";
import "./home-liui-v5.css";
import AccountNav from "./components/AccountNav";
import BuilderGlobalOverlays from "./components/BuilderGlobalOverlays";
import ProductCopyFix from "./components/ProductCopyFix";
import LaunchModeGuard from "./components/LaunchModeGuard";
import AdaptiveWallpaperEngine from "./components/AdaptiveWallpaperEngine";
import PremiumJourneyTheme from "./components/PremiumJourneyTheme";
import PreciseEditAssistant from "./components/PreciseEditAssistant";
import GeneratedDataManager from "./components/GeneratedDataManager";
import PublishingReadinessMount from "./components/PublishingReadinessMount";
import CreationCapabilityBanner from "./components/CreationCapabilityBanner";
import GameProGate from "./components/GameProGate";
import GameCommercialTermsNotice from "./components/GameCommercialTermsNotice";
import HomeLoadGuard from "./components/HomeLoadGuard";
import LanguageRuntime from "./components/LanguageRuntime";
import AuthFlowGuard from "./components/AuthFlowGuard";
import DeviceComputeManager from "./components/DeviceComputeManager";
import OfflineRuntimeBootstrap from "./components/OfflineRuntimeBootstrap";
import LIUIRealProductSurface from "./components/LIUIRealProductSurface";
import LIUIContextIntelligence from "./components/LIUIContextIntelligence";
import LIUIRuntimeCapabilityLayer from "./components/LIUIRuntimeCapabilityLayer";
import LIUIAdaptiveExperienceLayer from "./components/LIUIAdaptiveExperienceLayer";
import LIUIInteractionIntegrity from "./components/LIUIInteractionIntegrity";
import CreatorEncouragement from "./components/CreatorEncouragement";
import ProjectPortabilityMount from "./components/ProjectPortabilityMount";
import { PRODUCT_BRAND } from "../lib/product-brand.js";
import { SEO_CORE_KEYWORDS, SEO_INDEXING_ENABLED, SEO_SITE_URL, absoluteSeoUrl, buildOrganizationJsonLd, buildSoftwareJsonLd } from "../lib/seo-foundation.js";

const homeCanonical = absoluteSeoUrl("/");
const googleVerification = String(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "").trim();
const organizationSchema = buildOrganizationJsonLd();
const softwareSchema = buildSoftwareJsonLd();
const discoveryDescription = `${PRODUCT_BRAND.capabilities}. ${PRODUCT_BRAND.tagline} Create apps, games and websites with AI-powered planning, design, building, testing and preview workflows for web, iOS and Android targets.`;
const discoveryTitle = `${PRODUCT_BRAND.name} — AI App, Game & Website Builder`;

const earlyHomeLoadGuard = `(()=>{try{if(location.pathname!=="/"||window.__laneriqEarlyFetchGuard)return;window.__laneriqEarlyFetchGuard=true;const blocked=new Set(["/credits","/my-apps","/templates","/studio","/image-studio","/design-studio"]);const NativeIO=window.IntersectionObserver;if(NativeIO&&!window.__laneriqPrivateLinkIOGuard){window.__laneriqPrivateLinkIOGuard=true;const GuardedIO=function(callback,options){return new NativeIO((entries,observer)=>{const safe=entries.filter(entry=>{try{const target=entry.target;if(!(target instanceof HTMLAnchorElement))return true;const u=new URL(target.href,location.href);return !(location.pathname==="/"&&u.origin===location.origin&&blocked.has(u.pathname));}catch{return true;}});if(safe.length)callback(safe,observer);},options);};GuardedIO.prototype=NativeIO.prototype;window.IntersectionObserver=GuardedIO;}let allowPath="",allowUntil=0;addEventListener("click",e=>{try{const a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&blocked.has(u.pathname)){allowPath=u.pathname;allowUntil=Date.now()+8000;}}catch{}},true);const original=window.fetch.bind(window);window.fetch=(input,init)=>{try{const raw=typeof input==="string"?input:input&&input.url;const url=new URL(raw||"",location.href);if(url.origin===location.origin&&blocked.has(url.pathname)){const allowed=url.pathname===allowPath&&Date.now()<allowUntil;if(!allowed)return Promise.resolve(new Response(null,{status:204,headers:{"Cache-Control":"no-store"}}));}}catch{}return original(input,init);};}catch{}})();`;

export const metadata = {
  ...(SEO_SITE_URL ? { metadataBase: new URL(SEO_SITE_URL) } : {}),
  title: discoveryTitle,
  description: discoveryDescription,
  applicationName: PRODUCT_BRAND.name,
  category: "technology",
  keywords: SEO_CORE_KEYWORDS,
  robots: { index: SEO_INDEXING_ENABLED, follow: SEO_INDEXING_ENABLED },
  ...(homeCanonical ? { alternates: { canonical: homeCanonical } } : {}),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: PRODUCT_BRAND.name,
    title: discoveryTitle,
    description: discoveryDescription,
    ...(homeCanonical ? { url: homeCanonical } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: discoveryTitle,
    description: `${PRODUCT_BRAND.tagline} ${PRODUCT_BRAND.capabilities}.`,
  },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/laneriq-future-city-people.webp" type="image/webp" fetchPriority="high" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: earlyHomeLoadGuard }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
        <LIUIRuntimeCapabilityLayer />
        <LIUIAdaptiveExperienceLayer />
        <LIUIInteractionIntegrity />
        <HomeLoadGuard />
        <LanguageRuntime />
        <AuthFlowGuard />
        <DeviceComputeManager />
        <OfflineRuntimeBootstrap />
        <LaunchModeGuard />
        <PremiumJourneyTheme />
        <ProductCopyFix />
        <AdaptiveWallpaperEngine />
        <AccountNav />
        <GameProGate />
        <GameCommercialTermsNotice />
        {children}
        <Suspense fallback={null}><LIUIContextIntelligence /></Suspense>
        <ProjectPortabilityMount />
        <CreatorEncouragement />
        <Suspense fallback={null}><LIUIRealProductSurface /></Suspense>
        <CreationCapabilityBanner />
        <PreciseEditAssistant />
        <GeneratedDataManager />
        <PublishingReadinessMount />
        <BuilderGlobalOverlays />
      </body>
    </html>
  );
}
