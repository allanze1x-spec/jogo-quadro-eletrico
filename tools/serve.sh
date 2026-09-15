#!/usr/bin/env bash
# reinicia o servidor local do jogo e imprime o PID
cd "$(dirname "$0")/.."
for p in $(netstat -ano | grep LISTENING | grep ':8123' | awk '{print $5}' | sort -u); do
  taskkill //PID "$p" //F >/dev/null 2>&1 || true
done
sleep 1
(nohup node server.js 8123 > server.log 2>&1 &)
sleep 2
netstat -ano | grep LISTENING | grep ':8123' | awk '{print "PID", $5}' | head -1
