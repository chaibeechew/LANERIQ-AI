package ai.laneriq.antiscam;

import android.app.Application;

/**
 * Process-level Truth Gate.
 *
 * A fresh Android process cannot inherit proof that a GuardianService instance
 * from the previous process is still alive. SIGKILL/Force Stop do not guarantee
 * Service.onDestroy(), so any persisted service_enabled=true state is invalidated
 * at cold process start before an Activity, receiver, provider or restarted
 * GuardianService can expose it as current protection evidence.
 */
public final class AntiScamApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        ProtectionLeaseStore store = new ProtectionLeaseStore(this);
        ProtectionLeaseStore.Lease inherited = store.read();
        if (inherited.serviceEnabled) {
            store.serviceStopped("cold-process-start-invalidated-inherited-lease");
            new LocalEventStore(this).recordOnce(
                    "guardian_inherited_lease_invalidated",
                    "epoch-" + inherited.epoch,
                    5_000L);
        }
    }
}
