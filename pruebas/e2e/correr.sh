#!/bin/bash
# Corre un guion de punta a punta: la app de verdad, en un navegador, contra
# los emuladores de Firestore y Auth con las reglas de firestore.rules.
#
#   bash pruebas/e2e/correr.sh sueldos
#   RECONSTRUIR=1 bash pruebas/e2e/correr.sh sueldos   (vuelve a armar el paquete)
#
# Necesita Java (el emulador de Firestore) y Playwright con su Chromium.
# Usa los puertos 4174, 8080 y 9099: de a un guion por vez.
set -u
GUION=${1:?"Decí qué guion correr, por ejemplo: sueldos"}
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
T=${TMPDIR:-/tmp}/ecdm-e2e
mkdir -p "$T/emu" "$T/capturas"
cd "$RAIZ"

# El paquete de prueba: la app igual a la que se publica, apuntando a los
# emuladores. Se arma una vez; RECONSTRUIR=1 lo arma de nuevo.
if [ ! -f "$T/dist/index.html" ] || [ -n "${RECONSTRUIR:-}" ]; then
  echo "armando el paquete de prueba…"
  VITE_FIREBASE_EMULADOR=1 VITE_FIREBASE_API_KEY=fake-key VITE_FIREBASE_PROJECT_ID=demo-ecdm \
    VITE_FIREBASE_APP_ID=fake-app VITE_FIREBASE_AUTH_DOMAIN=localhost \
    npx vite build --outDir "$T/dist" > "$T/build.log" 2>&1 || { tail -20 "$T/build.log"; exit 1; }
fi

cp firestore.rules "$T/emu/reglas.rules"
cat > "$T/emu/firebase.json" <<'JSON'
{
  "firestore": { "rules": "reglas.rules" },
  "emulators": { "firestore": { "port": 8080 }, "auth": { "port": 9099 }, "ui": { "enabled": false } }
}
JSON

npx vite preview --outDir "$T/dist" --port 4174 --strictPort > "$T/preview.log" 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT
sleep 4
grep -q "4174" "$T/preview.log" || { echo "No arrancó el servidor de la app:"; cat "$T/preview.log"; exit 1; }

cd "$T/emu" && CAPTURAS="$T/capturas" npx --prefix "$RAIZ" firebase emulators:exec --only firestore,auth --project demo-ecdm \
  "node $RAIZ/pruebas/e2e/$GUION.cjs" 2>&1 | grep --line-buffered -v "Warning\|⚠\|i  \|MetadataLookup"
echo "capturas en: $T/capturas"
