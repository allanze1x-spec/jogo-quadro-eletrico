#!/usr/bin/env bash
# Gera os assets visuais do jogo com o modelo Z Image (0.15 creditos/geracao).
# Uso: bash gerar_assets.sh
set -u
cd "$(dirname "$0")"
mkdir -p assets

BASE="product photograph, industrial electrical panel hardware, front view, perfectly centered, isolated on a pure flat white seamless background, soft even studio lighting, sharp focus, high detail, no text, no numbers, no labels, no logos, no watermark, no shadow on the floor"

gen () {
  local name="$1"; shift
  local prompt="$1"; shift
  local ratio="${1:-1:1}"
  echo ">>> gerando $name ..."
  local out
  out=$(higgsfield generate create z_image --prompt "$BASE. $prompt" --aspect_ratio "$ratio" --wait --json 2>&1)
  local url
  url=$(printf '%s' "$out" | grep -o '"result_url": "[^"]*"' | head -1 | sed 's/.*: "//; s/"$//')
  if [ -z "$url" ]; then
    echo "!!! falhou: $name"
    printf '%s\n' "$out" | tail -20
    return 1
  fi
  curl -fsSL "$url" -o "assets/$name.png" && echo "ok  assets/$name.png"
}

gen contator         "a black and grey three-pole magnetic contactor, din rail mount, three screw terminals on top and three on the bottom, small auxiliary contact block on the side, straight-on front view"
gen rele-termico     "a black thermal overload relay with adjustable dial on the front and six screw terminals, din rail mount, straight-on front view"
gen disjuntor-3p     "a black three-pole miniature circuit breaker with three toggle levers and six screw terminals, din rail mount, straight-on front view"
gen disjuntor-2p     "a black two-pole miniature circuit breaker with two toggle levers and four screw terminals, din rail mount, straight-on front view"
gen botao-s0         "a red mushroom head emergency stop push button, 22mm panel mount, front view"
gen botao-s1         "a green flat round push button, 22mm panel mount, front view"
gen botao-s2         "a black flat round push button, 22mm panel mount, front view"
gen lampada-verde    "a single green pilot light indicator lamp, 22mm round panel mount, glass dome, front view"
gen lampada-amarela  "a single yellow pilot light indicator lamp, 22mm round panel mount, glass dome, front view"
gen lampada-vermelha "a single red pilot light indicator lamp, 22mm round panel mount, glass dome, front view"
gen lampada-branca   "a single clear white pilot light indicator lamp, 22mm round panel mount, glass dome, front view"
gen quadro           "an empty grey painted steel electrical panel enclosure with a perforated metal mounting plate and din rails inside, front view, wide shot"

echo "=== concluido ==="
ls -la assets
