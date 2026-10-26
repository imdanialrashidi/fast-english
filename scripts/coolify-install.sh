#!/usr/bin/env bash
# Preflight and first-time Coolify install for a fresh Linux host.
#
# Coolify needs root: it installs Docker, binds 80/443, and writes /data.
# Run the check as your normal user, then the install with sudo:
#
#   scripts/coolify-install.sh --check
#   sudo scripts/coolify-install.sh --install
#
# Optional: --domain fastenglish.ir — the DNS check warns (never fails) when
# the name does not resolve to this host yet. Coolify still needs the DNS
# record before it can issue a certificate.
set -Eeuo pipefail

usage() {
    cat <<'USAGE'
usage: scripts/coolify-install.sh [--check | --install] [--domain host]

  --check     (default) verify this host can run Coolify; change nothing.
  --install   run the official Coolify installer (requires root).
  --domain H  optional DNS sanity check for the public hostname.
USAGE
}

mode="check"
domain=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) mode="check"; shift ;;
        --install) mode="install"; shift ;;
        --domain) domain="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "coolify-install: unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

fail=0
warn=0
ok()   { printf '  PASS  %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1" >&2; fail=1; }
soft() { printf '  WARN  %s\n' "$1"; warn=1; }

echo "coolify-install: host preflight"

# --- root (only required to install) ---------------------------------------
if [[ "$mode" == "install" ]]; then
    if [[ "$(id -u)" -ne 0 ]]; then
        echo "coolify-install: --install requires root (sudo scripts/coolify-install.sh --install)" >&2
        exit 1
    fi
    ok "running as root"
else
    if [[ "$(id -u)" -eq 0 ]]; then
        ok "running as root"
    else
        soft "not root; --check only. The install step needs sudo."
    fi
fi

# --- operating system -------------------------------------------------------
os_id="unknown"; os_like=""
if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    os_id="${ID:-unknown}"; os_like="${ID_LIKE:-}"
fi
case " $os_id $os_like " in
    *" debian "*|*" ubuntu "*|*" arch "*|*" alpine "*|*" centos "*|*" fedora "*|*" rhel "*|*" rocky "*|*" almalinux "*|*" opensuse "*|*" sles "*)
        ok "supported OS family ($os_id)" ;;
    *) bad "unsupported OS ($os_id); Coolify supports Debian/Ubuntu, RHEL family, SUSE, Arch, Alpine" ;;
esac

# --- hardware ---------------------------------------------------------------
cpus="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 0)"
if [[ "$cpus" -ge 2 ]]; then ok "CPU cores: $cpus"; else bad "CPU cores: $cpus (Coolify needs >= 2)"; fi

mem_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
mem_gb=$(( mem_kb / 1024 / 1024 ))
if [[ "$mem_gb" -ge 2 ]]; then ok "RAM: ${mem_gb} GiB"; else bad "RAM: ${mem_gb} GiB (Coolify needs >= 2)"; fi

disk_gb="$(df -Pk / 2>/dev/null | awk 'NR==2 {print int($4/1024/1024)}')"
if [[ "${disk_gb:-0}" -ge 10 ]]; then ok "free disk on /: ${disk_gb} GiB"; else bad "free disk on /: ${disk_gb:-0} GiB (Coolify needs >= 10)"; fi

# --- ports Coolify binds ----------------------------------------------------
port_busy() {
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
    elif command -v netstat >/dev/null 2>&1; then
        netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
    else
        return 1
    fi
}
for port in 80 443 8000 6001 6002; do
    if port_busy "$port"; then bad "port $port is already in use"; else ok "port $port is free"; fi
done

# --- tooling ----------------------------------------------------------------
if command -v curl >/dev/null 2>&1; then ok "curl available"; else bad "curl is missing"; fi
if command -v docker >/dev/null 2>&1; then
    ok "docker present ($(docker --version 2>/dev/null | head -1))"
    if docker info >/dev/null 2>&1; then ok "docker daemon reachable"; else soft "docker daemon not reachable by this user (the installer starts it)"; fi
else
    soft "docker not installed yet (the Coolify installer installs it)"
fi

# --- DNS (advisory) ---------------------------------------------------------
if [[ -n "$domain" ]]; then
    if command -v getent >/dev/null 2>&1 && getent hosts "$domain" >/dev/null 2>&1; then
        ok "DNS resolves: $domain -> $(getent hosts "$domain" | awk '{print $1}' | paste -sd, -)"
        soft "confirm that address is this host's public IP before attaching the domain"
    else
        soft "DNS does not resolve for $domain yet; add the A/AAAA record before attaching it in Coolify"
    fi
fi

echo
if [[ "$fail" -ne 0 ]]; then
    echo "coolify-install: preflight FAILED — fix the FAIL lines above before installing." >&2
    exit 1
fi
if [[ "$mode" == "check" ]]; then
    echo "coolify-install: preflight passed. Install with:"
    echo "  sudo scripts/coolify-install.sh --install"
    exit 0
fi

# --- install ----------------------------------------------------------------
installer="$(mktemp /tmp/coolify-install.XXXXXX.sh)"
trap 'rm -f "$installer"' EXIT
echo "coolify-install: downloading the official installer (cdn.coollabs.io)..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh -o "$installer"
echo "coolify-install: running $installer"
bash "$installer"

cat <<'NEXT'

coolify-install: done. Next steps:
  1. Open http://<server-ip>:8000 and create the first admin account
     (do this before exposing the panel to the internet).
  2. Settings → Instance domain: https://coolify.<your-domain>, then enable
     HTTPS so the panel itself is not plain HTTP.
  3. Add the Fast English resource:
       Project → New → Docker Compose (Git repository)
       Base Directory: /            Docker Compose Location: /compose.prod.yml
       Domains: Add domain → app → https://<your-domain>:8080
       Environment: paste the block from scripts/coolify-env.sh
  4. Deploy, then run the migration/release step once inside the app:
       docker compose exec app sh /var/www/html/docker/release.sh
     (or Coolify → app service → Terminal).
  5. Verify from your machine:
       scripts/coolify-smoke.sh https://<your-domain>
     Full checklist: docs/ops/COOLIFY.md, docs/ops/STAGING_CHECKLIST.md.
NEXT
