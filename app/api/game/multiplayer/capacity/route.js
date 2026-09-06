import {NextResponse} from "next/server";
import {createClient} from "../../../../../lib/supabase/server.js";
import {getAppBuilderAccess} from "../../../../../lib/app-builder-access.js";
import {getMultiplayerProviderConfig} from "../../../../../lib/game/multiplayer-provider-gateway.js";
import {buildMobaCreatorCapacityReport,buildMobaLoadRampPlan,calculateMobaAutoscalePlan,evaluateMobaCapacityCertification,MOBA_RESILIENCE_ORCHESTRATOR_V5} from "../../../../../lib/game/moba-resilience-orchestrator-v5.js";

const MAX_REQUEST_BYTES=16*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_REGION=/^(auto|[a-z0-9][a-z0-9_-]{1,47})$/i;
const MODES=new Set(["5v5","ranked","unranked"]);
function json(payload,status=200){return NextResponse.json(payload,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});}
function clampInt(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;}
async function ownedGame(supabase,userId,appId){const{data:app}=await supabase.from("apps").select("id,current_version_id").eq("id",appId).eq("owner_id",userId).maybeSingle();if(!app?.current_version_id)return null;const{data:version}=await supabase.from("app_versions").select("id,specification").eq("id",app.current_version_id).eq("app_id",app.id).maybeSingle();const spec=version?.specification||{};return spec?.productType==="mobile_game"||spec?.game?.enabled===true?{app,version}:null;}

export async function POST(request){
  try{
    const length=Number(request.headers.get("content-length")||0);if(length>MAX_REQUEST_BYTES)return json({error:"Capacity request is too large."},413);
    const supabase=await createClient();const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)return json({error:"Authentication required."},401);if(!user.confirmed_at&&!user.email_confirmed_at&&!user.phone_confirmed_at)return json({error:"Account verification is required."},403);
    const access=await getAppBuilderAccess(supabase,user.id);if(!access.professional.active)return json({error:"MOBA Network Autopilot is a Professional Game Creator capability.",code:"PRO_GAME_CREATOR_REQUIRED"},403);
    const body=await request.json().catch(()=>null);if(!body)return json({error:"Invalid capacity request."},400);if(Buffer.byteLength(JSON.stringify(body),"utf8")>MAX_REQUEST_BYTES)return json({error:"Capacity request is too large."},413);
    const appId=String(body?.appId||"").trim();if(!UUID.test(appId))return json({error:"A valid Game project is required."},400);const game=await ownedGame(supabase,user.id,appId);if(!game)return json({error:"Owned mobile Game project not found."},404);
    const targetConcurrentPlayers=clampInt(body?.targetConcurrentPlayers,10,100000,1000),targetConcurrentMatches=Math.ceil(targetConcurrentPlayers/10),mode=MODES.has(String(body?.mode||"").toLowerCase())?String(body.mode).toLowerCase():"5v5";let region=String(body?.region||"auto").trim().toLowerCase();if(!SAFE_REGION.test(region))region="auto";
    const provider=getMultiplayerProviderConfig();
    const loadRamp=buildMobaLoadRampPlan({targetConcurrentPlayers,rampMinutes:clampInt(body?.rampMinutes,5,60,10),holdMinutes:clampInt(body?.holdMinutes,30,240,45),steps:5});
    const autoscale=calculateMobaAutoscalePlan({activeMatches:0,queuedMatches:targetConcurrentMatches,readyHosts:0,hostMatchCapacity:10,targetUtilization:.7,minWarmHosts:2,maxHosts:2000});
    const simulation=Object.freeze({evidenceLevel:"topology_only",capacityKnown:false,targetConcurrentPlayers,targetConcurrentMatches,modeledStablePlayers:0,productionTrafficSent:false,providerCapacityUsed:false,truthRule:"Topology planning can size matches and load-test stages, but no gamer-count smoothness claim is made until provider limits and measured telemetry exist."});
    const certification=evaluateMobaCapacityCertification({targetConcurrentPlayers,simulation});
    const creatorReport=buildMobaCreatorCapacityReport({certification,simulation});
    return json({success:true,version:MOBA_RESILIENCE_ORCHESTRATOR_V5.version,mode,region,targetConcurrentPlayers,targetConcurrentMatches,architecture:{playersPerMatch:10,providerRouterManaged:true,authoritativeServerRequired:true,relayRequired:true,matchmakingRequired:true,autoscalingPlanned:true,multiRegionCapable:true,dedicatedLanerIqServerRequired:false,creatorServerConfigurationRequired:false},provider:{connected:provider.configured===true,blockedByCostPolicy:provider.blockedByCostPolicy===true,costClass:provider.costClass,endpointExposed:false,credentialExposed:false},autoscale,loadRamp,simulation,certification,creatorReport,liveExecutionAvailable:provider.configured===true&&!provider.blockedByCostPolicy,productionEvidenceVerified:false,truthRule:"Normal creators do not need to configure server endpoints or credentials. LIVE execution still depends on platform-level connected provider adapters and measured load/failover/device evidence."});
  }catch(error){console.error("MOBA_CAPACITY_PLAN_ERROR",error?.name||"unknown");return json({error:"Unable to prepare MOBA capacity planning right now."},500);}
}
