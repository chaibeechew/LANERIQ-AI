export const CUSTOMER_PAYMENT_CONNECT_POLICY=Object.freeze({
  provider:'stripe-connect',
  platformModel:'saas_direct_charges',
  merchantOfRecord:'connected_customer',
  dashboard:'full',
  feesCollector:'stripe',
  lossesCollector:'stripe',
  requirementsCollector:'stripe',
  requiredCapabilities:['card_payments'],
  laneriqTransactionFeePercent:0,
  onboarding:'embedded',
  onboardingCollection:'currently_due',
  futureRequirements:'notification_banner',
  sensitiveKycStoredByLaneriq:false,
  rawBankDetailsStoredByLaneriq:false,
  identityDocumentsStoredByLaneriq:false,
  autoPrefill:['contact_email','display_name'],
  paymentReadinessAuthority:'stripe_capability_status',
  liveClaimRequiresStripeActiveCapability:true,
});

const ACCOUNT=/^acct_[A-Za-z0-9]+$/;
const COUNTRY=/^[A-Za-z]{2}$/;
function clean(value,max=160){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
export function normalizeConnectSetupInput(input={}){
  const appId=clean(input.appId,80);
  const displayName=clean(input.displayName,120);
  const country=clean(input.country,2).toLowerCase();
  const locale=clean(input.locale,20)||'en-US';
  if(country&&!COUNTRY.test(country))throw new Error('Country must be a two-letter code.');
  return {appId:appId||null,displayName:displayName||null,country:country||null,locale};
}
export function assertStripeConnectedAccountId(value){const id=clean(value,120);if(!ACCOUNT.test(id))throw new Error('Stripe connected account id is invalid.');return id;}
export function getCustomerPaymentConnectRuntime(){
  const secret=String(process.env.STRIPE_SECRET_KEY||'').trim();
  const publishableKey=String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY||'').trim();
  const enabled=String(process.env.STRIPE_CONNECT_ENABLED||'false').toLowerCase()==='true';
  const apiVersion=String(process.env.STRIPE_CONNECT_API_VERSION||'2026-07-29.preview').trim();
  const webhookSecret=String(process.env.STRIPE_CONNECT_WEBHOOK_SECRET||'').trim();
  return {enabled,configured:enabled&&/^sk_(test|live)_/.test(secret)&&/^pk_(test|live)_/.test(publishableKey),secret,publishableKey,apiVersion,webhookConfigured:/^whsec_/.test(webhookSecret),webhookSecret,live:/^sk_live_/.test(secret)};
}
