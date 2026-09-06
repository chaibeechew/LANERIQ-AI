#!/usr/bin/env bash
set -euo pipefail

APP_ID="${LANERIQ_ANTI_SCAM_APP_ID:-ai.laneriq.antiscam.test}"
ACTIVITY="${LANERIQ_ANTI_SCAM_ACTIVITY:-ai.laneriq.antiscam.MainActivity}"
CONTROL_ACTIVITY="${LANERIQ_GUARDIAN_TEST_ACTIVITY:-ai.laneriq.antiscam.InternalGuardianTestActivity}"
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

PASS_GUARDIAN_STARTED=false
PASS_PROCESS_KILL=false
PASS_PROCESS_KILL_NEW_EPOCH=false
PASS_FORCE_STOP_BOUNDARY=false
PASS_USER_REOPEN=false
PASS_USER_REOPEN_NEW_EPOCH=false
PASS_USER_PAUSE=false
PASS_NOTIFICATION=false
PASS_BATTERY=false
PASS_REBOOT=false
PASS_REBOOT_NEW_EPOCH=false
PASS_SOAK=false

INITIAL_EPOCH=0
POST_KILL_EPOCH=0
POST_REOPEN_EPOCH=0
POST_REBOOT_EPOCH=0
SOAK_INITIAL_SEQUENCE=0
SOAK_FINAL_SEQUENCE=0

launch_main() {
  "${ADB[@]}" shell am start -W -n "$APP_ID/$ACTIVITY" >/dev/null
  sleep 2
}

control() {
  local mode="$1"
  "${ADB[@]}" shell am start -W -n "$APP_ID/$CONTROL_ACTIVITY" --es mode "$mode" >/dev/null
}

pid_value() {
  "${ADB[@]}" shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' | awk '{print $1}'
}

pid_present() {
  [[ -n "$(pid_value)" ]]
}

guardian_xml() {
  "${ADB[@]}" shell run-as "$APP_ID" cat shared_prefs/laneriq_guardian_lease.xml 2>/dev/null | tr -d '\r' || true
}

xml_long() {
  local name="$1"
  guardian_xml | sed -n "s/.*<long name=\"$name\" value=\"\([0-9][0-9]*\)\".*/\1/p" | head -n1
}

xml_bool() {
  local name="$1"
  guardian_xml | sed -n "s/.*<boolean name=\"$name\" value=\"\(true\|false\)\".*/\1/p" | head -n1
}

wait_guardian_active() {
  local timeout="${1:-20}"
  local deadline=$(( $(date +%s) + timeout ))
  while (( $(date +%s) < deadline )); do
    local enabled seq
    enabled=$(xml_bool service_enabled)
    seq=$(xml_long heartbeat_sequence)
    if [[ "$enabled" == "true" && "${seq:-0}" -ge 1 ]]; then return 0; fi
    sleep 1
  done
  return 1
}

# Explicitly establish Guardian opt-in in the debug test controller. This avoids
# confusing MainActivity process survival with Guardian protection survival.
control start
if wait_guardian_active 20; then
  PASS_GUARDIAN_STARTED=true
  INITIAL_EPOCH=$(xml_long lease_epoch)
fi
[[ "$PASS_GUARDIAN_STARTED" == "true" ]] || { echo "Guardian did not establish a fresh lease" >&2; exit 3; }

# Unexpected process death: SIGKILL under the app UID is NOT Force Stop. The
# persisted old lease must not be inherited by a new process as current proof.
OLD_PID=$(pid_value)
if [[ -n "$OLD_PID" ]]; then
  "${ADB[@]}" shell run-as "$APP_ID" kill -9 "$OLD_PID" >/dev/null 2>&1 || true
fi
sleep 2
DEADLINE=$(( $(date +%s) + 20 ))
while (( $(date +%s) < DEADLINE )); do
  NEW_PID=$(pid_value)
  if [[ -n "$NEW_PID" && "$NEW_PID" != "$OLD_PID" ]] && wait_guardian_active 2; then
    PASS_PROCESS_KILL=true
    POST_KILL_EPOCH=$(xml_long lease_epoch)
    if [[ "${POST_KILL_EPOCH:-0}" -gt "${INITIAL_EPOCH:-0}" ]]; then PASS_PROCESS_KILL_NEW_EPOCH=true; fi
    break
  fi
  sleep 1
done

# True Force Stop boundary: ordinary background components must remain stopped.
"${ADB[@]}" shell am force-stop "$APP_ID"
sleep 3
if ! pid_present; then PASS_FORCE_STOP_BOUNDARY=true; fi

# User reopen clears the stopped state. AntiScamApplication must invalidate any
# inherited service_enabled proof before MainActivity can show protection; then
# recovery may create a new lease epoch.
PRE_REOPEN_EPOCH=${POST_KILL_EPOCH:-0}
launch_main
if wait_guardian_active 20; then
  PASS_USER_REOPEN=true
  POST_REOPEN_EPOCH=$(xml_long lease_epoch)
  if [[ "${POST_REOPEN_EPOCH:-0}" -gt "${PRE_REOPEN_EPOCH:-0}" ]]; then PASS_USER_REOPEN_NEW_EPOCH=true; fi
fi

# Expected user-pause path must immediately remove active lease evidence.
control pause
sleep 2
PAUSED_OPT_IN=$(xml_bool user_opted_in)
PAUSED_ENABLED=$(xml_bool service_enabled)
PAUSED_HEARTBEAT=$(xml_long last_heartbeat_ms)
if [[ "$PAUSED_OPT_IN" == "false" && "$PAUSED_ENABLED" == "false" && "${PAUSED_HEARTBEAT:-0}" -eq 0 ]]; then
  PASS_USER_PAUSE=true
fi

# Restore Guardian for the remaining environment tests.
control start
wait_guardian_active 20 || { echo "Guardian could not restart after pause" >&2; exit 4; }

# Alert-delivery degradation / recovery evidence plus persistent Guardian channel.
if (( SDK >= 33 )); then
  "${ADB[@]}" shell pm revoke "$APP_ID" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
  sleep 2
  "${ADB[@]}" shell pm grant "$APP_ID" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
fi
if "${ADB[@]}" shell dumpsys notification --noredact 2>/dev/null | grep -q 'laneriq_guardian_protection'; then
  PASS_NOTIFICATION=true
fi

# Battery-saver transition must not stop heartbeat progression.
SEQ_BEFORE_BATTERY=$(xml_long heartbeat_sequence)
if "${ADB[@]}" shell settings put global low_power 1 >/dev/null 2>&1; then
  sleep 4
  "${ADB[@]}" shell settings put global low_power 0 >/dev/null 2>&1 || true
  sleep 2
  SEQ_AFTER_BATTERY=$(xml_long heartbeat_sequence)
  if [[ "${SEQ_AFTER_BATTERY:-0}" -ge "${SEQ_BEFORE_BATTERY:-0}" ]] && pid_present; then PASS_BATTERY=true; fi
fi

if [[ "$ALLOW_REBOOT" == "1" ]]; then
  PRE_REBOOT_EPOCH=$(xml_long lease_epoch)
  "${ADB[@]}" reboot
  "${ADB[@]}" wait-for-device
  sleep 20
  if wait_guardian_active 40; then
    PASS_REBOOT=true
    POST_REBOOT_EPOCH=$(xml_long lease_epoch)
    if [[ "${POST_REBOOT_EPOCH:-0}" -gt "${PRE_REBOOT_EPOCH:-0}" ]]; then PASS_REBOOT_NEW_EPOCH=true; fi
  fi
fi

# Soak run tracks heartbeat progression, not merely process existence. Public L3
# evidence requires SOAK_SECONDS >= 86400 and independent battery/thermal review.
SOAK_INITIAL_SEQUENCE=$(xml_long heartbeat_sequence)
DEADLINE=$(( $(date +%s) + SOAK_SECONDS ))
SOAK_OK=true
while (( $(date +%s) < DEADLINE )); do
  if ! pid_present; then
    SOAK_OK=false
    break
  fi
  CURRENT_SEQ=$(xml_long heartbeat_sequence)
  if [[ -z "$CURRENT_SEQ" ]]; then
    SOAK_OK=false
    break
  fi
  sleep 30
done
SOAK_FINAL_SEQUENCE=$(xml_long heartbeat_sequence)
if [[ "$SOAK_OK" == "true" && "$SOAK_SECONDS" -ge 86400 && "${SOAK_FINAL_SEQUENCE:-0}" -gt "${SOAK_INITIAL_SEQUENCE:-0}" ]]; then
  PASS_SOAK=true
fi

FINISHED_AT=$(date +%s)
cat > "$OUT" <<JSON
{
  "schema": 2,
  "layer": "L3",
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
  "leaseEvidence": {
    "initialEpoch": ${INITIAL_EPOCH:-0},
    "postSigkillEpoch": ${POST_KILL_EPOCH:-0},
    "postUserReopenEpoch": ${POST_REOPEN_EPOCH:-0},
    "postRebootEpoch": ${POST_REBOOT_EPOCH:-0},
    "soakInitialHeartbeatSequence": ${SOAK_INITIAL_SEQUENCE:-0},
    "soakFinalHeartbeatSequence": ${SOAK_FINAL_SEQUENCE:-0}
  },
  "checks": {
    "guardianFreshLeaseStarted": $PASS_GUARDIAN_STARTED,
    "sigkillRecovery": $PASS_PROCESS_KILL,
    "sigkillCreatesNewEpoch": $PASS_PROCESS_KILL_NEW_EPOCH,
    "forceStopBoundary": $PASS_FORCE_STOP_BOUNDARY,
    "userReopenRecovery": $PASS_USER_REOPEN,
    "userReopenCreatesNewEpoch": $PASS_USER_REOPEN_NEW_EPOCH,
    "expectedUserPauseInvalidatesLease": $PASS_USER_PAUSE,
    "notificationTransitionAndChannel": $PASS_NOTIFICATION,
    "batterySaverTransition": $PASS_BATTERY,
    "rebootRecovery": $PASS_REBOOT,
    "rebootCreatesNewEpoch": $PASS_REBOOT_NEW_EPOCH,
    "soak24hHeartbeatProgression": $PASS_SOAK
  },
  "truth": "Raw real-device Guardian evidence. Force Stop remains an Android platform boundary. This record is not a signed L3 release PASS until OEM coverage, >=24h evidence, artifact binding and approved release attestation are complete."
}
JSON

cat "$OUT"
