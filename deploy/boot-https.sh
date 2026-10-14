#!/bin/sh
# EC2 boot script: run STAFF behind Caddy with automatic HTTPS on <ip>.sslip.io
until docker info >/dev/null 2>&1; do sleep 5; done
T=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
IP=$(curl -s -H "X-aws-ec2-metadata-token: $T" http://169.254.169.254/latest/meta-data/public-ipv4)
H=$(echo "$IP" | tr . -).sslip.io
echo "$H" > /opt/staff-host
docker rm -f staff caddy
docker run -d --restart unless-stopped --name staff -p 127.0.0.1:8080:7860 -v /opt/staffdata:/data -e QLOO_KEY_FILE=/data/qloo_key staff
docker run -d --restart unless-stopped --name caddy --network host -v caddy_data:/data caddy:2 caddy reverse-proxy --from "$H" --to localhost:8080
