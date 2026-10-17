#!/bin/sh
until docker info >/dev/null 2>&1; do sleep 5; done
mkdir -p /opt/n2a /opt/pub; cd /opt/n2a
curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/env.enc -o env.enc && openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:$N2K -in env.enc -out env && chmod 600 env
V=4
if [ "$(cat ver 2>/dev/null)" != "$V" ] || ! docker image inspect n2a >/dev/null 2>&1; then
 for i in 1 2 3 4 5; do rm -rf src; mkdir src; curl -fsSL https://codeload.github.com/maverickxone/notion2api/tar.gz/5882102d019a9c8f2075fa357fe6a0c573c71af0 | tar xz -C src --strip-components=1 && curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/app_notion_client.py -o src/app/notion_client.py && curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/app_model_registry.py -o src/app/model_registry.py && curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/app_stream_parser.py -o src/app/stream_parser.py && curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/app_api_chat.py -o src/app/api/chat.py && curl -fsSL https://raw.githubusercontent.com/chosuicide/staff/main/deploy/n2a/requirements.txt -o src/requirements.txt && break; sleep 20; done
 docker build -t n2a src && echo $V > ver
fi
docker rm -f n2a n2cf
docker run -d --restart unless-stopped --name n2a -m 400m -p 127.0.0.1:18800:8000 --env-file /opt/n2a/env -v n2adata:/app/data n2a
docker run -d --restart unless-stopped --name n2cf --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://localhost:18800
L=
while true; do U=$(docker logs n2cf 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1); [ -n "$U" ] && echo "$U" > /opt/pub/n2.txt
 M="n2=$U staff=$(cat /opt/pub/*staff* /opt/pub/cf.txt 2>/dev/null | tr '\n' ' ') lg=$(cat /opt/pub/lg.txt 2>/dev/null) n2a=$(docker inspect -f '{{.State.Status}}' n2a 2>&1) ls=$(ls /opt/pub | tr '\n' ,)"
 [ "$M" != "$L" ] && curl -s -m 10 -d "$M" https://ntfy.sh/n2a-91e04a8a1ac46f47 >/dev/null && L="$M"
 sleep 30; done
