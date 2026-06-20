#!/bin/sh
# Squid external_acl_type helper — validates API keys against the Node API.
# Squid passes %LOGIN (the proxy username) on stdin, one per line.
# Must respond with "OK" or "ERR" — never exit.

API_URL="http://api:4000/proxy-auth"

while IFS= read -r line; do
    # Extract first token (the API key / username)
    KEY=$(printf '%s' "$line" | awk '{print $1}')

    # Quick reject anything that isn't a pak_ key
    case "$KEY" in
        pak_*)
            STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
                --max-time 5 \
                -H "X-Proxy-Key: $KEY" \
                "$API_URL" 2>/dev/null)
            if [ "$STATUS" = "200" ]; then
                printf 'OK\n'
            else
                printf 'ERR\n'
            fi
            ;;
        *)
            printf 'ERR\n'
            ;;
    esac
done