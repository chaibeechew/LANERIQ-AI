import { redirect } from "next/navigation";
import { getControlTowerAuthContext } from "../../../lib/control-tower-auth.js";

export const dynamic = "force-dynamic";

export default async function ControlTowerLayout({ children }) {
  const auth = await getControlTowerAuthContext();

  if (!auth.ok && auth.status === 401) {
    redirect("/auth?next=%2Fadmin%2Fcontrol-tower");
  }

  if (!auth.ok) {
    redirect("/");
  }

  return children;
}
