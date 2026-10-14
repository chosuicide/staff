#!/bin/sh
# EC2 boot script: STAFF behind Caddy (auto-HTTPS on <ip>.sslip.io) plus a Cloudflare quick tunnel.
until docker info >/dev/null 2>&1; do sleep 5; done
T=$(curl -s -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
IP=$(curl -s -H "X-aws-ec2-metadata-token: $T" http://169.254.169.254/latest/meta-data/public-ipv4)
H=$(echo "$IP" | tr . -).sslip.io
echo "$H" > /opt/staff-host
mkdir -p /opt/pub /opt/caddy
cat > /opt/caddy/Caddyfile <<CF
$H {
  handle_path /_t/* {
    root * /opt/pub
    file_server
  }
  handle {
    reverse_proxy localhost:8080
  }
}
CF
docker rm -f staff caddy cf
docker run -d --restart unless-stopped --name staff -p 127.0.0.1:8080:7860 -v /opt/staffdata:/data -e QLOO_KEY_FILE=/data/qloo_key staff
docker run -d --restart unless-stopped --name caddy --network host -v caddy_data:/data -v /opt/caddy/Caddyfile:/etc/caddy/Caddyfile:ro -v /opt/pub:/opt/pub:ro caddy:2
docker run -d --restart unless-stopped --name cf --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://localhost:8080
while true; do
  U=$(docker logs cf 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)
  [ -n "$U" ] && echo "$U" > /opt/pub/u.txt
  sleep 30
done
