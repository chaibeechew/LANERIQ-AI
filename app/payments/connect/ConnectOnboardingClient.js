"use client";
import {useEffect,useRef,useState} from 'react';

function badge(state){if(state==='ready')return 'Ready to accept payments';if(state==='under_review')return 'Stripe is reviewing your details';if(state==='action_required')return 'More information required';if(state==='not_started')return 'Not set up';return 'Setup incomplete';}
async function readJson(response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||'Request failed.');return data;}
function loadConnectJs(){return new Promise((resolve,reject)=>{if(window.StripeConnect?.init)return resolve(window.StripeConnect);window.StripeConnect=window.StripeConnect||{};const previous=window.StripeConnect.onLoad;window.StripeConnect.onLoad=()=>{try{previous?.();}catch{}resolve(window.StripeConnect);};let script=document.querySelector('script[data-laneriq-stripe-connect]');if(!script){script=document.createElement('script');script.src='https://connect-js.stripe.com/v1.0/connect.js';script.async=true;script.dataset.laneriqStripeConnect='true';script.onerror=()=>reject(new Error('Stripe Connect could not load.'));document.head.appendChild(script);}setTimeout(()=>{if(window.StripeConnect?.init)resolve(window.StripeConnect);},1000);});}
export default function ConnectOnboardingClient(){
  const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mounted,setMounted]=useState(false);const instanceRef=useRef(null);const onboardingRef=useRef(null),bannerRef=useRef(null),financeRef=useRef(null);
  async function refresh(){try{setError('');const data=await readJson(await fetch('/api/payments/connect/account',{cache:'no-store'}));setStatus(data);return data;}catch(e){setError(e.message);return null;}}
  useEffect(()=>{refresh();},[]);
  async function createSession(){return readJson(await fetch('/api/payments/connect/account-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));}
  async function mountStripe(current){if(mounted)return;setBusy(true);try{const first=await createSession();const StripeConnect=await loadConnectJs();let firstUnused=true;const fetchClientSecret=async()=>{if(firstUnused){firstUnused=false;return first.clientSecret;}return (await createSession()).clientSecret;};const instance=StripeConnect.init({publishableKey:first.publishableKey,fetchClientSecret,appearance:{variables:{colorPrimary:'#0b5d47',borderRadius:'14px'}}});instanceRef.current=instance;for(const ref of [onboardingRef,bannerRef,financeRef])if(ref.current)ref.current.innerHTML='';const banner=instance.create('notification-banner');bannerRef.current?.appendChild(banner);if(current?.readyForPayments){const balances=instance.create('balances');const payouts=instance.create('payouts');const management=instance.create('account-management');financeRef.current?.append(balances,payouts,management);}else{const onboarding=instance.create('account-onboarding');onboarding.setOnExit?.(()=>refresh());onboarding.setOnStepChange?.(()=>setError(''));onboardingRef.current?.appendChild(onboarding);}setMounted(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function begin(){setBusy(true);try{let current=status;if(!current||current.state==='not_started'){const params=new URLSearchParams(window.location.search);const appId=params.get('appId');current=await readJson(await fetch('/api/payments/connect/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(appId?{appId}:{})}));setStatus(current);}setBusy(false);await mountStripe(current);}catch(e){setBusy(false);setError(e.message);}}
  const state=status?.onboardingState||status?.state||'loading';
  return <main style={{maxWidth:980,margin:'0 auto',padding:'32px 20px 72px'}}>
    <div style={{display:'grid',gap:18}}>
      <section style={{padding:24,border:'1px solid rgba(10,50,40,.14)',borderRadius:24,background:'rgba(255,255,255,.88)'}}>
        <div style={{fontSize:12,fontWeight:800,letterSpacing:'.12em'}}>LANERIQ CUSTOMER PAYMENT AUTOPILOT</div>
        <h1 style={{fontSize:34,margin:'10px 0'}}>Accept payments with minimal setup</h1>
        <p style={{lineHeight:1.65,maxWidth:760}}>LANERIQ automatically prepares the payment account from information you already provided. Stripe securely asks only for missing or legally required identity, business and bank information. LANERIQ never stores your identity documents or raw bank details.</p>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><strong>{badge(state)}</strong><span style={{opacity:.65}}>{status?.cardPaymentsStatus?`Card payments: ${status.cardPaymentsStatus}`:''}</span></div>
        {!mounted&&<button onClick={begin} disabled={busy||status?.configured===false} style={{marginTop:18,padding:'12px 18px',borderRadius:14,border:0,fontWeight:800,cursor:'pointer'}}>{busy?'Preparing…':state==='not_started'?'Set up payments':'Continue payment setup'}</button>}
        {status?.configured===false&&<p style={{marginTop:14}}>Stripe Connect has not been enabled for this LANERIQ environment yet.</p>}
        {error&&<p role="alert" style={{marginTop:14}}>{error}</p>}
      </section>
      <div ref={bannerRef}/>
      <div ref={onboardingRef}/>
      <div ref={financeRef} style={{display:'grid',gap:18}}/>
      <section style={{fontSize:13,lineHeight:1.6,opacity:.72}}>Payment readiness is controlled by Stripe capability status. LANERIQ does not mark a merchant Ready until Stripe reports the required payment capability active. Future compliance requests appear automatically in the Stripe notification banner.</section>
    </div>
  </main>;
}
