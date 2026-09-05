package ai.laneriq.antiscam;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class EmergencyProtection {
    public enum Level { NONE, REVIEW, URGENT }

    public static final class Plan {
        public final Level level;
        public final boolean freezeLaneriqSensitiveFlows;
        public final boolean adviseDisconnectRemoteSupport;
        public final boolean adviseReviewAccessibility;
        public final boolean adviseAvoidPayments;
        public final List<String> steps;

        Plan(Level level,
             boolean freezeLaneriqSensitiveFlows,
             boolean adviseDisconnectRemoteSupport,
             boolean adviseReviewAccessibility,
             boolean adviseAvoidPayments,
             List<String> steps) {
            this.level = level;
            this.freezeLaneriqSensitiveFlows = freezeLaneriqSensitiveFlows;
            this.adviseDisconnectRemoteSupport = adviseDisconnectRemoteSupport;
            this.adviseReviewAccessibility = adviseReviewAccessibility;
            this.adviseAvoidPayments = adviseAvoidPayments;
            this.steps = Collections.unmodifiableList(new ArrayList<>(steps));
        }
    }

    private EmergencyProtection() {}

    public static Plan from(SensitiveActionGate.Decision gate, int remoteSignalCount) {
        List<String> steps = new ArrayList<>();
        if (gate != null && gate.action == SensitiveActionGate.Action.FREEZE) {
            steps.add("Stop the current LANERIQ-controlled sensitive action");
            steps.add("Do not approve payments, transfers, password resets or recovery requests");
            if (remoteSignalCount > 0) {
                steps.add("Disconnect screen sharing or remote-support software you did not intentionally authorize");
                steps.add("Review enabled Accessibility services and turn off unknown services");
            }
            steps.add("Re-check the destination/app after the risky condition is removed");
            return new Plan(Level.URGENT, true, remoteSignalCount > 0,
                    remoteSignalCount > 0, true, steps);
        }
        if (gate != null && gate.action == SensitiveActionGate.Action.WARN) {
            steps.add("Review the detected risk before continuing");
            if (remoteSignalCount > 0) steps.add("Review remote-control and Accessibility settings");
            return new Plan(Level.REVIEW, false, remoteSignalCount > 0,
                    remoteSignalCount > 0, false, steps);
        }
        return new Plan(Level.NONE, false, false, false, false, steps);
    }
}
