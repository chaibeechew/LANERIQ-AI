function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function v3(v={}){return{x:Number(v.x)||0,y:Number(v.y)||0,z:Number(v.z)||0};}
function add(a,b){return{x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};}
function sub(a,b){return{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function mul(a,s){return{x:a.x*s,y:a.y*s,z:a.z*s};}
function len(a){return Math.hypot(a.x,a.y,a.z);}
function norm(a){const l=len(a)||1;return mul(a,1/l);}
function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function cross(a,b){return{x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};}

export function solveAvatarTwoBoneIK({root,joint,end,target,pole={x:0,y:0,z:1},maxReachScale=.995}={}){
  const r=v3(root),j=v3(joint),e=v3(end),t=v3(target),p=v3(pole),upper=Math.max(.001,len(sub(j,r))),lower=Math.max(.001,len(sub(e,j))),toTarget=sub(t,r),rawDistance=len(toTarget),maxReach=(upper+lower)*clamp(maxReachScale,.8,1),distance=clamp(rawDistance,.001,maxReach),dir=norm(toTarget);
  const poleDir=norm(sub(p,r)),planeNormal=norm(cross(dir,poleDir)),bendDir=norm(cross(planeNormal,dir));
  const cosRoot=clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1),along=upper*cosRoot,height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const solvedJoint=add(add(r,mul(dir,along)),mul(bendDir,height)),solvedEnd=add(r,mul(dir,distance));
  return{contract:"laneriq-avatar-two-bone-ik-v1",root:r,joint:solvedJoint,end:solvedEnd,target:t,reachable:rawDistance<=upper+lower,stretchRatio:clamp(rawDistance/(upper+lower),0,2),planeNormal};
}

export function createAvatarFootLock({leftFoot,rightFoot,groundY=0}={}){
  return{contract:"laneriq-avatar-foot-lock-v1",groundY:Number(groundY)||0,left:{locked:false,anchor:v3(leftFoot)},right:{locked:false,anchor:v3(rightFoot)},lastRoot:v3()};
}

export function advanceAvatarFootLock(lock,{leftFoot,rightFoot,root,velocity=0,contactThreshold=.035}={}){
  if(lock?.contract!=="laneriq-avatar-foot-lock-v1")throw new Error("AVATAR_FOOT_LOCK_REQUIRED");
  const ground=lock.groundY,left=v3(leftFoot),right=v3(rightFoot),nextRoot=v3(root),slow=Math.abs(Number(velocity)||0)<.12,nearL=Math.abs(left.y-ground)<=contactThreshold,nearR=Math.abs(right.y-ground)<=contactThreshold;
  const next={...lock,left:{...lock.left},right:{...lock.right},lastRoot:nextRoot};
  for(const [name,foot,near] of [["left",left,nearL],["right",right,nearR]]){
    const current=next[name];
    if(!current.locked&&slow&&near){current.locked=true;current.anchor={...foot,y:ground};}
    if(current.locked&&(!slow||Math.abs(foot.y-ground)>contactThreshold*2.5))current.locked=false;
  }
  return next;
}

export function applyAvatarFootLock(lock,{leftFoot,rightFoot}={}){
  const left=lock?.left?.locked?v3(lock.left.anchor):v3(leftFoot),right=lock?.right?.locked?v3(lock.right.anchor):v3(rightFoot);
  return{leftFoot:left,rightFoot:right,lockedLeft:Boolean(lock?.left?.locked),lockedRight:Boolean(lock?.right?.locked)};
}

export function createAvatarSecondaryMotion({damping=.82,stiffness=.18}={}){
  return{contract:"laneriq-avatar-secondary-motion-v1",damping:clamp(damping,.2,.98),stiffness:clamp(stiffness,.02,.8),value:v3(),velocity:v3()};
}

export function advanceAvatarSecondaryMotion(runtime,{target,dtMs=16,maxMagnitude=.35}={}){
  if(runtime?.contract!=="laneriq-avatar-secondary-motion-v1")throw new Error("AVATAR_SECONDARY_MOTION_REQUIRED");
  const dt=clamp(dtMs,1,80)/16.6667,t=v3(target),delta=sub(t,runtime.value),accel=mul(delta,runtime.stiffness*dt),velocity=mul(add(runtime.velocity,accel),Math.pow(runtime.damping,dt)),candidate=add(runtime.value,mul(velocity,dt)),m=len(candidate),value=m>maxMagnitude?mul(norm(candidate),maxMagnitude):candidate;
  return{...runtime,value,velocity};
}

export function buildAvatarMotionIntelligencePacket({bodyCommand,handTarget=null,lookTarget=null,footLock=null,secondaryMotion=null}={}){
  return{contract:"laneriq-avatar-motion-intelligence-v1",gesture:bodyCommand?.gesture||"idle-balanced",bodyJoints:bodyCommand?.joints||{},handTarget:handTarget?v3(handTarget):null,lookTarget:lookTarget?v3(lookTarget):null,footLock:footLock?{left:Boolean(footLock.left?.locked),right:Boolean(footLock.right?.locked)}:null,secondaryMotion:secondaryMotion?.value?v3(secondaryMotion.value):null};
}
