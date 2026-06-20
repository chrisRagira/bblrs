#!/bin/sh
# Squid 6 basic auth helper — accepts all credentials.
# Real validation is done by the external_acl_type helper.
# CRITICAL: must use printf not echo, must never exit, must flush immediately.
while IFS= read -r line; do
    printf 'OK\n'
done