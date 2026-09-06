import {openSuperGameDataAdapterSession} from "../cloud-adapters/super-game-data.js";

// Provider-neutral boundary for AI Map, Game Intelligence Forge, Super Game and Living World routes.
// Route modules must depend on this domain rather than importing the current persistence provider.
export async function openSuperGameDataSession(){
  return openSuperGameDataAdapterSession();
}

export function accountVerified(session){
  return Boolean(session?.verified);
}
