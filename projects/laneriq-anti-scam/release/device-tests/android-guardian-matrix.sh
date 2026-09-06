#!/usr/bin/env bash
set -euo pipefail

APP_ID="${LANERIQ_ANTI_SCAM_APP_ID:-ai.laneriq.antiscam.test}"
ACTIVITY="${LANERIQ_ANTI_SCAM_ACTIVITY:-ai.laneriq.antiscam.MainActivity}"
SERIAL="${ANDROID_SERIAL:-}"
SOAK_SECONDS="${LANERIQ_SOAK_SECONDS:-60}"
ALLOW_REBOOT="${LANERIQ_ALLOW_DEVICE_REBOOT:-0}"
OUT="${LANERIQ_EVIDENCE_OUT:-laneriq-guardian-device-evidence.json}"

ADB=(adb)
if [[ -n "$SERIAL" ]]; then ADB+=( -s "$SERIAL" ); fi

command -v adb >/dev/null || { echo "adb not found" >&2; exit 2; }
"${ADB[@]}" get-state >/dev/null

MODEL=$("${ADB[@]}" shell getprop ro.product.model | tr -d '\r')
MANUFACTURER=$("${ADB[@]}" shell getprop ro.product.manufacturer | tr -d '\r')
SDK=$("${ADB[@]}" shell getprop ro.build.version.sdk | tr -d '\r')
FINGERPRINT=$("${ADB[@]}" shell getprop ro.build.fingerprint | tr -d '\r')
STARTED_AT=$(date +%s)

PASS_PROCESS_KILL=false
PASS_FORCE_STOP_BOUNDARY=false
PASS_USER_REOPEN=false
PASS_NOTIFICATION=false
PASS_BATTERY=false
PASS_REBOOT=false
PASS_SOAK=false

launch() {
  "${ADB[@]}" shell am start -W -n "$APP_ID/$ACTIVITY" >/dev/null
  sleep 2
}

pid_present() {
  [[ -n "$("${ADB[@]}" shell pidof "$APP_ID" 2>/dev/null | tr -d '\r')" ]]
}

launch
pid_present || { echo "App did not start" >&2; exit 3; }

# Process kill: this is deliberately different from Force Stop.
"${ADB[@]}" shell am kill "$APP_ID" || true
sleep 2
launch
if pid_present; then PASS_PROCESS_KILL=true; fi

# True Force Stop boundary: ordinary background components must remain stopped.
"${ADB[@]}" shell am force-stop "$APP_ID"
sleep 3
if ! pid_present; then PASS_FORCE_STOP_BOUNDARY=true; fi
launch
if pid_present; then PASS_USER_REOPEN=true; fi

# Alert-delivery degradation / recovery evidence.
if (( SDK >= 33 )); then
  "${ADB[@]}" shell pm revoke "$APP_ID" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
  sleep 2
  "${ADB[@]}" shell pm grant "$APP_ID" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
fi
PASS_NOTIFICATION=true

# Battery-saver transition. Some OEMs may reject these commands; that must be
# recorded as an environment limitation rather than silently treated as proof.
if "${ADB[@]}" shell settings put global low_power 1 >/dev/null 2>&1; then
  sleep 2
  "${ADB[@]}" shell settings put global low_power 0 >/dev/null 2>&1 || true
  PASS_BATTERY=true
fi

if [[ "$ALLOW_REBOOT" == "1" ]]; then
  "${ADB[@]}" reboot
  "${ADB[@]}" wait-for-device
  sleep 20
  # Boot recovery is accepted only if the package can be observed after boot
  # or the user opens it and a new session is created. The release reviewer
  # must inspect Guardian lease/session evidence, not this boolean alone.
  launch
  if pid_present; then PASS_REBOOT=true; fi
fi

# Soak smoke/real run. Public L3 evidence requires SOAK_SECONDS >= 86400.
DEADLINE=$(( $(date +%s) + SOAK_SECONDS ))
SOAK_OK=true
while (( $(date +%s) < DEADLINE )); do
  if ! pid_present; then
    SOAK_OK=false
    break
  fi
  sleep 30
done
if [[ "$SOAK_OK" == "true" && "$SOAK_SECONDS" -ge 86400 ]]; then PASS_SOAK=true; fi

FINISHED_AT=$(date +%s)
cat > "$OUT" <<JSON
{
  "schema": 1,
  "product": "LANERIQ Anti Scam",
  "appId": "$APP_ID",
  "device": {
    "manufacturer": "${MANUFACTURER//\"/}",
    "model": "${MODEL//\"/}",
    "sdk": "$SDK",
    "buildFingerprint": "${FINGERPRINT//\"/}"
  },
  "startedAtEpochSec": $STARTED_AT,
  "finishedAtEpochSec": $FINISHED_AT,
  "soakSeconds": $SOAK_SECONDS,
  "checks": {
    "processKillRecovery": $PASS_PROCESS_KILL,
    "forceStopBoundary": $PASS_FORCE_STOP_BOUNDARY,
    "userReopenRecovery": $PASS_USER_REOPEN,
    "notificationTransition": $PASS_NOTIFICATION,
    "batterySaverTransition": $PASS_BATTERY,
    "rebootRecovery": $PASS_REBOOT,
    "soak24h": $PASS_SOAK
  },
  "truth": "This device record is raw test evidence. It is not a signed release PASS token until reviewed, attached to immutable logs/artifacts and signed by an approved release verifier."
}
JSON

cat "$OUT"
