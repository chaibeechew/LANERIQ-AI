function freeze(v){return Object.freeze(v)}
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clone(v){return JSON.parse(JSON.stringify(v))}
const CATALOG=freeze([
  {id:"iron-heart",name:"Iron Heart",cost:1050,stats:{maxHealth:260,armor:18},uniqueGroup:null,roles:["tank","fighter"]},
  {id:"aegis-core",name:"Aegis Core",cost:2200,stats:{maxHealth:380,armor:28,resistance:24},uniqueGroup:"mythic",roles:["tank"]},
  {id:"storm-edge",name:"Storm Edge",cost:1150,stats:{attackDamage:26,moveSpeed:8},uniqueGroup:null,roles:["fighter","assassin"]},
  {id:"night-reaver",name:"Night Reaver",cost:2350,stats:{attackDamage:46,moveSpeed:14},uniqueGroup:"mythic",roles:["assassin"]},
  {id:"arc-lens",name:"Arc Lens",cost:1100,stats:{maxResource:140,abilityPower:34},uniqueGroup:null,roles:["mage","support"]},
  {id:"astral-crown",name:"Astral Crown",cost:2400,stats:{maxResource:240,abilityPower:68},uniqueGroup:"mythic",roles:["mage"]},
  {id:"swift-bow",name:"Swift Bow",cost:1050,stats:{attackDamage:18,attackCooldown:-.08},uniqueGroup:null,roles:["marksman"]},
  {id:"horizon-cannon",name:"Horizon Cannon",cost:2300,stats:{attackDamage:42,attackRange:22},uniqueGroup:"mythic",roles:["marksman"]},
  {id:"verdant-charm",name:"Verdant Charm",cost:1000,stats:{maxResource:110,healPower:28},uniqueGroup:null,roles:["support"]},
  {id:"guardian-orbit",name:"Guardian Orbit",cost:2250,stats:{maxHealth:220,resistance:22,healPower:46},uniqueGroup:"mythic",roles:["support"]},
  {id:"phase-boots",name:"Phase Boots",cost:850,stats:{moveSpeed:24},uniqueGroup:"boots",roles:["all"]},
  {id:"bulwark-boots",name:"Bulwark Boots",cost:900,stats:{moveSpeed:18,armor:14},uniqueGroup:"boots",roles:["all"]}
])

export const MOBA_ITEM_SHOP_AUTHORITY_V1=freeze({version:"moba-item-shop-authority-v1",authoritative:true,maxSlots:6,realMoneyStats:false,systems:freeze(["server-gold-check","shop-location-gate","inventory-slots","unique-groups","stat-application","sell-refund","role-recommendation","no-pay-to-win"])})
export function getMobaItemCatalogue(){return CATALOG.map(i=>clone(i))}
function applyStats(hero,stats,sign=1){for(const [k,v] of Object.entries(stats||{})){hero[k]=finite(hero[k])+sign*finite(v);if(k==="attackCooldown")hero[k]=Math.max(.2,hero[k])}return hero}
export function purchaseMobaItem(hero,itemId,{atShop=false}={}){
  const item=CATALOG.find(i=>i.id===itemId);if(!item)return{ok:false,reason:"item_not_found",hero};if(!atShop)return{ok:false,reason:"shop_location_required",hero};
  const inventory=[...(hero.inventory||[])];if(inventory.length>=6)return{ok:false,reason:"inventory_full",hero};if(finite(hero.gold)<item.cost)return{ok:false,reason:"insufficient_gold",hero};
  if(item.uniqueGroup&&inventory.some(x=>x.uniqueGroup===item.uniqueGroup))return{ok:false,reason:"unique_group_conflict",hero};
  const next={...hero,gold:finite(hero.gold)-item.cost,inventory:[...inventory,{id:item.id,cost:item.cost,uniqueGroup:item.uniqueGroup,stats:{...item.stats}}]};applyStats(next,item.stats,1);return{ok:true,hero:next,itemId:item.id,gold:next.gold}
}
export function sellMobaItem(hero,itemId,{atShop=false,refundRate=.7}={}){
  if(!atShop)return{ok:false,reason:"shop_location_required",hero};const inventory=[...(hero.inventory||[])],index=inventory.findIndex(x=>x.id===itemId);if(index<0)return{ok:false,reason:"item_not_owned",hero};
  const [owned]=inventory.splice(index,1),refund=Math.floor(finite(owned.cost)*Math.max(.5,Math.min(.8,finite(refundRate,.7)))),next={...hero,gold:finite(hero.gold)+refund,inventory};applyStats(next,owned.stats,-1);return{ok:true,hero:next,refund}
}
export function buildMobaRecommendedItems({role="fighter",enemyPhysical=.5,enemyMagic=.5}={}){
  const scored=CATALOG.map(item=>{let score=item.roles.includes(role)?5:item.roles.includes("all")?2:0;if(finite(item.stats.armor)>0)score+=enemyPhysical*3;if(finite(item.stats.resistance)>0)score+=enemyMagic*3;if(item.uniqueGroup==="boots")score+=1;return{item,score}}).sort((a,b)=>b.score-a.score||a.item.cost-b.item.cost);
  const result=[];for(const x of scored){if(result.length>=6)break;if(x.item.uniqueGroup&&result.some(i=>i.uniqueGroup===x.item.uniqueGroup))continue;result.push(x.item)}return result.map(x=>x.id)
}
