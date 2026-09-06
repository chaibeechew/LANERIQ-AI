#!/usr/bin/env bash
set -euo pipefail

APP_ID="${LANERIQ_ANTI_SCAM_APP_ID:-ai.laneriq.antiscam.test}"
TEST_ACTIVITY="${LANERIQ_WEB_SHIELD_TEST_ACTIVITY:-ai.laneriq.antiscam.InternalWebShieldTestActivity}"
TEST_RECEIVER="${LANERIQ_WEB_SHIELD_TEST_RECEIVER:-ai.laneriq.antiscam.InternalWebShieldTestReceiver}"
SERIAL="${ANDROID_SERIAL:-}"
CONSENT_WAIT_SECONDS="${LANERIQ_VPN_CONSENT_WAIT_SECONDS:-120}"
ALLOW_NETWORK_TOGGLE="${LANERIQ_ALLOW_NETWORK_TOGGLE:-0}"
OUT="${LANERIQ_L1_EVIDENCE_OUT:-laneriq-webshield-l1-device-evidence.json}"
TEST_DOMAIN="example.com"
BENIGN_DOMAIN="www.iana.org"

ADB=(adb)
if [[ -n "$SERIAL" ]]; then ADB+=( -s "$SERIAL" ); fi

command -v adb >/dev/null || { echo "adb not found" >&2; exit 2; }
"${ADB[@]}" get-state >/dev/null

MODEL=$("${ADB[@]}" shell getprop ro.product.model | tr -d '\r')
MANUFACTURER=$("${ADB[@]}" shell getprop ro.product.manufacturer | tr -d '\r')
SDK=$("${ADB[@]}" shell getprop ro.build.version.sdk | tr -d '\r')
FINGERPRINT=$("${ADB[@]}" shell getprop ro.build.fingerprint | tr -d '\r')
STARTED_AT=$(date +%s)

PASS_TUN_ESTABLISHED=false
PASS_SIGNED_BLOCK=false
PASS_CLEAR_RECOVERY=false
PASS_BENIGN_RESOLUTION=false
PASS_STOP_REMOVES_TUN=false
PASS_WIFI_CELLULAR_HANDOFF=false
HANDOFF_ATTEMPTED=false
IPV6_TUN_PRESENT=false

route4_present() {
  "${ADB[@]}" shell 'ip route show table all 2>/dev/null' | tr -d '\r' | grep -q '10\.111\.222\.2'
}

route6_present() {
  "${ADB[@]}" shell 'ip -6 route show table all 2>/dev/null' | tr -d '\r' | grep -qi 'fd66:6c61:6e65::2'
}

resolver_output() {
  local domain="$1"
  "${ADB[@]}" shell "ping -c 1 -W 1 $domain 2>&1" | tr -d '\r' || true
}

resolves() {
  local domain="$1"
  local output
  output=$(resolver_output "$domain")
  printf '%s\n' "$output" | head -n 2
  printf '%s\n' "$output" | grep -Eq '^PING[[:space:]].*(\(|[0-9a-fA-F]{0,4}:)'
}

seed_block() {
  "${ADB[@]}" shell am broadcast \
    -n "$APP_ID/$TEST_RECEIVER" \
    -a ai.laneriq.antiscam.test.INTERNAL_WEB_SHIELD_CONTROL \
    --es mode seed-block 2>&1 | tr -d '\r'
}

clear_block() {
  "${ADB[@]}" shell am broadcast \
    -n "$APP_ID/$TEST_RECEIVER" \
    -a ai.laneriq.antiscam.test.INTERNAL_WEB_SHIELD_CONTROL \
    --es mode clear-block 2>&1 | tr -d '\r'
}

stop_shield() {
  "${ADB[@]}" shell am broadcast \
    -n "$APP_ID/$TEST_RECEIVER" \
    -a ai.laneriq.antiscam.test.INTERNAL_WEB_SHIELD_CONTROL \
    --es mode stop 2>&1 | tr -d '\r'
}

# The test activity requires explicit human confirmation and Android's own VPN
# consent. The script never bypasses VpnService.prepare().
"${ADB[@]}" shell am start -W -n "$APP_ID/$TEST_ACTIVITY" >/dev/null
cat <<'MSG'
On the Android device, tap "Begin Internal Test" and approve Android's VPN dialog.
This is a debug-only DNS Shield test; Production claims remain disabled.
MSG

DEADLINE=$(( $(date +%s) + CONSENT_WAIT_SECONDS ))
while (( $(date +%s) < DEADLINE )); do
  if route4_present; then
    PASS_TUN_ESTABLISHED=true
    break
  fi
  sleep 2
done

if [[ "$PASS_TUN_ESTABLISHED" != "true" ]]; then
  echo "Internal DNS Shield TUN route was not observed within ${CONSENT_WAIT_SECONDS}s" >&2
  exit 3
fi
if route6_present; then IPV6_TUN_PRESENT=true; fi

# Seed a cryptographically signed, debug-only KNOWN_MALICIOUS verdict for a
# normally resolvable domain. The private test key exists only in src/debug.
SEED_RESULT=$(seed_block)
printf '%s\n' "$SEED_RESULT"
if printf '%s' "$SEED_RESULT" | grep -q 'seeded:'; then
  sleep 1
  if ! resolves "$TEST_DOMAIN"; then PASS_SIGNED_BLOCK=true; fi
fi

CLEAR_RESULT=$(clear_block)
printf '%s\n' "$CLEAR_RESULT"
sleep 1
if resolves "$TEST_DOMAIN"; then PASS_CLEAR_RECOVERY=true; fi
if resolves "$BENIGN_DOMAIN"; then PASS_BENIGN_RESOLUTION=true; fi

# Optional physical-network handoff test. Enable only with USB ADB and a device
# that has working cellular data; otherwise the script intentionally records it
# as not attempted instead of manufacturing PASS evidence.
if [[ "$ALLOW_NETWORK_TOGGLE" == "1" ]]; then
  HANDOFF_ATTEMPTED=true
  "${ADB[@]}" shell svc wifi disable >/dev/null 2>&1 || true
  sleep 8
  if route4_present && resolves "$BENIGN_DOMAIN"; then
    "${ADB[@]}" shell svc wifi enable >/dev/null 2>&1 || true
    sleep 8
    if route4_present && resolves "$BENIGN_DOMAIN"; then PASS_WIFI_CELLULAR_HANDOFF=true; fi
  else
    "${ADB[@]}" shell svc wifi enable >/dev/null 2>&1 || true
  fi
fi

stop_shield >/dev/null || true
sleep 3
if ! route4_present; then PASS_STOP_REMOVES_TUN=true; fi

FINISHED_AT=$(date +%s)
cat > "$OUT" <<JSON
{
  "schema": 1,
  "layer": "L1",
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
  "checks": {
    "tunEstablishedAfterExplicitVpnConsent": $PASS_TUN_ESTABLISHED,
    "ipv6TunRouteObserved": $IPV6_TUN_PRESENT,
    "signedExactDomainBlock": $PASS_SIGNED_BLOCK,
    "signedBlockClearRestoresResolution": $PASS_CLEAR_RECOVERY,
    "benignResolutionThroughShield": $PASS_BENIGN_RESOLUTION,
    "wifiCellularHandoffAttempted": $HANDOFF_ATTEMPTED,
    "wifiCellularHandoffPass": $PASS_WIFI_CELLULAR_HANDOFF,
    "stopRemovesTunRoute": $PASS_STOP_REMOVES_TUN
  },
  "scope": "DNS-path internal test only; does not prove direct-IP, app-owned DoH/DoT, all IPv6 extension headers or full-firewall coverage.",
  "truth": "Raw device evidence only. This becomes L1 release evidence only after immutable artifact binding, reviewer approval and release-evidence signing for the exact shipping build."
}
JSON

cat "$OUT"

[[ "$PASS_TUN_ESTABLISHED" == "true" ]]
[[ "$PASS_SIGNED_BLOCK" == "true" ]]
[[ "$PASS_CLEAR_RECOVERY" == "true" ]]
[[ "$PASS_BENIGN_RESOLUTION" == "true" ]]
[[ "$PASS_STOP_REMOVES_TUN" == "true" ]]
