#!/usr/bin/env bash
# Gera os assets da MISSÃO 02 (inversor + potenciômetro) com o modelo Z Image
# (0,15 créditos por geração) e trata a imagem: fundo branco -> transparente,
# recorte automático e escala final.
#
#   bash tools/gen_assets_missao2.sh
#
# FFMPEG: usa o do PATH ou o instalado pelo WinGet.
set -u
cd "$(dirname "$0")/.."
mkdir -p assets/orig

FF="${FFMPEG:-}"
if [ -z "$FF" ]; then
  FF=$(command -v ffmpeg 2>/dev/null \
       || ls -d /c/Users/*/AppData/Local/Microsoft/WinGet/Packages/*FFmpeg*/*/bin/ffmpeg.exe 2>/dev/null | head -1)
fi
[ -n "$FF" ] || { echo "ffmpeg não encontrado (defina FFMPEG=/caminho/ffmpeg)"; exit 1; }
echo "ffmpeg: $FF"

BASE="product photograph, industrial electrical panel hardware, front view, perfectly centered, isolated on a pure flat white seamless background, soft even studio lighting, sharp focus, high detail, no text, no numbers, no labels, no logos, no watermark, no shadow on the floor"

gen () {
  local name="$1"; shift
  local prompt="$1"; shift
  local ratio="${1:-1:1}"
  echo ">>> gerando $name ..."
  local out url
  out=$(higgsfield generate create z_image --prompt "$BASE. $prompt" --aspect_ratio "$ratio" --wait --json 2>&1)
  url=$(printf '%s' "$out" | grep -o '"result_url": "[^"]*"' | head -1 | sed 's/.*: "//; s/"$//')
  if [ -z "$url" ]; then
    echo "!!! falhou: $name"
    printf '%s\n' "$out" | tail -20
    return 1
  fi
  curl -fsSL "$url" -o "assets/orig/$name.png" && echo "ok  assets/orig/$name.png"
}

gen inversor      "a grey industrial variable frequency drive inverter, tall vertical housing with a removable front keypad showing a small display and arrow keys, a long control terminal strip across the top, three power screw terminals on top and three at the bottom, straight-on front view" "3:4"
gen potenciometro "a black panel mount rotary potentiometer with a round knurled knob and a small metal dial scale behind it, three small screw terminals at the bottom back, 22mm panel mount, straight-on front view" "1:1"

# --- tratamento: recorte automático + fundo branco virando transparência -------
# A caixa do objeto vem do detect.js (normalizada) e o trim2.js recorta + aplica
# o mesmo critério de alfa dos outros assets (min(r,g,b) alto = fundo).
FFMPEG="$FF" node tools/detect.js | grep -E 'inversor|potenciometro' || true
FFMPEG="$FF" node tools/trim2.js inversor potenciometro
[ -f tools/final.html ] && echo "folha de conferência: tools/final.html"
