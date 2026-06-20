FROM ubuntu/squid:latest

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY fake-auth-helper.sh /usr/local/bin/fake-auth-helper.sh
COPY squid-auth-helper.sh /usr/local/bin/squid-auth-helper.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /usr/local/bin/fake-auth-helper.sh \
              /usr/local/bin/squid-auth-helper.sh \
              /entrypoint.sh

USER root
ENTRYPOINT ["/entrypoint.sh"]