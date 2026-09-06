import { createClient } from '../supabase/server.js';
import { createAdminClient } from '../supabase/admin.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getCurrentCustomerPaymentUser(){
  const supabase=await createClient();
  const {data:{user}={},error}=await supabase.auth.getUser();
  if(error||!user?.id)return null;
  return user;
}

export async function getOwnedCustomerPaymentApp(userId,appId){
  if(!UUID.test(String(userId||''))||!UUID.test(String(appId||'')))return null;
  const admin=createAdminClient();
  const {data,error}=await admin
    .from('apps')
    .select('id,name,description')
    .eq('id',appId)
    .eq('owner_id',userId)
    .maybeSingle();
  if(error)throw new Error('Owned payment app lookup failed.');
  return data||null;
}
