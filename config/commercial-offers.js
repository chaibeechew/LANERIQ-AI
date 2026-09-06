import { PRODUCT_POLICY } from "./product-policy.js";

const usd = (value) => Math.round(Number(value) * 100);

export const COMMERCIAL_OFFERS = Object.freeze({
  standard: Object.freeze({
    code: "standard",
    name: "LANERIQ AI Standard",
    description: "One Standard project creation credit.",
    amountMinor: usd(PRODUCT_POLICY.pricing.standard.priceUsd),
    currency: "usd",
    checkoutMode: "payment",
    accessKind: "standard_project_credit",
    accessDays: 0,
    gameAccessPlan: "professional",
    launchSellable: true,
  }),
  professional: Object.freeze({
    code: "professional",
    name: "LANERIQ AI Professional",
    description: "Professional creator access for 12 months. No automatic renewal.",
    amountMinor: usd(PRODUCT_POLICY.pricing.professional.priceUsd),
    currency: "usd",
    checkoutMode: "payment",
    accessKind: "professional_access",
    accessDays: PRODUCT_POLICY.pricing.professional.accessDays,
    gameAccessPlan: "professional",
    launchSellable: true,
  }),
  full_access: Object.freeze({
    code: "full_access",
    name: "LANERIQ AI Full Access",
    description: "Full creator access for 12 months. No automatic renewal.",
    amountMinor: usd(PRODUCT_POLICY.pricing.fullAccess.priceUsd),
    currency: "usd",
    checkoutMode: "payment",
    accessKind: "professional_access",
    accessDays: PRODUCT_POLICY.pricing.fullAccess.accessDays,
    gameAccessPlan: "full",
    launchSellable: true,
  }),
});

export function getCommercialOffer(code) {
  const key = String(code || "").trim().toLowerCase();
  const offer = COMMERCIAL_OFFERS[key];
  return offer?.launchSellable === true ? offer : null;
}

export function publicCommercialOffers() {
  return Object.values(COMMERCIAL_OFFERS)
    .filter((offer) => offer.launchSellable)
    .map(({ code, name, description, amountMinor, currency, checkoutMode, accessDays }) => ({
      code,
      name,
      description,
      amountMinor,
      currency: currency.toUpperCase(),
      checkoutMode,
      accessDays,
    }));
}
