const freeze=value=>Object.freeze(value);

const SANDBOX_PRICES=freeze({
  standard:'price_1UCXj0CvOdsLRMQToGyqzezu',
  professional:'price_1UCXjFCvOdsLRMQTupAk6p0t',
  full_access:'price_1UCXjSCvOdsLRMQTqaemFFh3',
  buyout_personal:'price_1UCXjbCvOdsLRMQTFVP4sE24',
  buyout_business:'price_1UCXjlCvOdsLRMQTj2uFYbiy',
  buyout_enterprise:'price_1UCXjxCvOdsLRMQTJwmYSy7t',
});

export const MARKET_BILLING_CATALOG=freeze({
  standard:freeze({sku:'standard',amountMinor:1000,currency:'usd',accessDays:0,kind:'standard_credit',buyout:false,sandboxPriceId:SANDBOX_PRICES.standard,livePriceEnv:'STRIPE_PRICE_STANDARD'}),
  professional:freeze({sku:'professional',amountMinor:6800,currency:'usd',accessDays:365,kind:'professional',buyout:false,sandboxPriceId:SANDBOX_PRICES.professional,livePriceEnv:'STRIPE_PRICE_PROFESSIONAL'}),
  full_access:freeze({sku:'full_access',amountMinor:19900,currency:'usd',accessDays:365,kind:'full_access',buyout:false,sandboxPriceId:SANDBOX_PRICES.full_access,livePriceEnv:'STRIPE_PRICE_FULL_ACCESS'}),
  buyout_personal:freeze({sku:'buyout_personal',amountMinor:4900,currency:'usd',accessDays:0,kind:'buyout',buyout:true,tier:'personal',sandboxPriceId:SANDBOX_PRICES.buyout_personal,livePriceEnv:'STRIPE_PRICE_BUYOUT_PERSONAL'}),
  buyout_business:freeze({sku:'buyout_business',amountMinor:19900,currency:'usd',accessDays:0,kind:'buyout',buyout:true,tier:'business',sandboxPriceId:SANDBOX_PRICES.buyout_business,livePriceEnv:'STRIPE_PRICE_BUYOUT_BUSINESS'}),
  buyout_enterprise:freeze({sku:'buyout_enterprise',amountMinor:49900,currency:'usd',accessDays:0,kind:'buyout',buyout:true,tier:'enterprise',sandboxPriceId:SANDBOX_PRICES.buyout_enterprise,livePriceEnv:'STRIPE_PRICE_BUYOUT_ENTERPRISE'}),
});

const safeSku=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
export function getMarketBillingSku(value){return MARKET_BILLING_CATALOG[safeSku(value)]||null;}
export function isStripeLiveMode(){return String(process.env.STRIPE_LIVEMODE||'').toLowerCase()==='true';}
export function resolveMarketStripePrice(sku){
  const item=getMarketBillingSku(sku);if(!item)return null;
  if(!isStripeLiveMode())return item.sandboxPriceId;
  const price=String(process.env[item.livePriceEnv]||'').trim();
  return /^price_[A-Za-z0-9]+$/.test(price)&&price!==item.sandboxPriceId?price:null;
}
export function getMarketBillingRuntime(){
  const live=isStripeLiveMode();
  const secret=String(process.env.STRIPE_SECRET_KEY||'');
  const webhook=String(process.env.STRIPE_WEBHOOK_SECRET||'');
  const launchApproved=String(process.env.MARKET_LAUNCH_APPROVED||'').toLowerCase()==='true';
  const testEnabled=String(process.env.MARKET_BILLING_TEST_ENABLED||'').toLowerCase()==='true';
  const secretMatches=live?secret.startsWith('sk_live_'):secret.startsWith('sk_test_');
  const configured=Boolean(secretMatches&&webhook.startsWith('whsec_'));
  const liveCatalogReady=!live||Object.values(MARKET_BILLING_CATALOG).every(item=>resolveMarketStripePrice(item.sku));
  return freeze({live,configured,liveCatalogReady,launchApproved,testEnabled,checkoutAllowed:configured&&liveCatalogReady&&(live?launchApproved:testEnabled),buyoutCheckoutEnabled:String(process.env.MARKET_BUYOUT_CHECKOUT_ENABLED||'').toLowerCase()==='true'&&String(process.env.MARKET_SECURITY_CLOSED||'').toLowerCase()==='true'});
}
