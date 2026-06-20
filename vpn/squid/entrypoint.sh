#!/bin/bash
set -e

# Remove stale PID file from a previous crash/restart
rm -f /run/squid.pid

# Fix permissions on mounted volumes
mkdir -p /var/log/squid /var/spool/squid
chown -R proxy:proxy /var/log/squid /var/spool/squid
chmod 755 /var/log/squid /var/spool/squid
chmod +x /usr/local/bin/fake-auth-helper.sh /usr/local/bin/squid-auth-helper.sh

# Initialize swap directories
squid -z --foreground 2>&1 | grep -v "^$" || true

exec /usr/sbin/squid -NYCd 1