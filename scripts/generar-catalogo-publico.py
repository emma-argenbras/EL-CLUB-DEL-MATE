#!/usr/bin/env python3
"""
Genera public/catalogo.json: lo unico que ve un cliente que abre el
catalogo publico desde WhatsApp.

Por que un archivo aparte y no productos.seed.json
--------------------------------------------------
productos.seed.json lleva el precio de compra, la rentabilidad y el
proveedor de cada producto, porque la app los necesita para calcular el
margen. Eso NO puede quedar a la vista de un cliente. Este script deja
pasar solo tres campos: codigo, descripcion y precio de venta.

Que queda afuera del catalogo
-----------------------------
  - los productos inactivos y los archivados,
  - los que no tienen precio de venta cargado (no se puede publicar un
    producto sin precio),
  - los descontinuados, que ya no se reponen.

Uso:
    python3 scripts/generar-catalogo-publico.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "public" / "productos.seed.json"
DESTINO = RAIZ / "public" / "catalogo.json"


def normalizar(texto):
    """Minusculas y sin acentos, para que el buscador encuentre 'mate
    calabaza' escribiendo 'MATE CALABAZA' o 'mate calabasa'."""
    sin_tildes = unicodedata.normalize("NFD", texto or "")
    sin_tildes = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", sin_tildes).strip().lower()


def main():
    if not ORIGEN.exists():
        sys.exit(f"No encuentro {ORIGEN}")

    productos = json.loads(ORIGEN.read_text(encoding="utf-8"))

    publicos = []
    for p in productos:
        if not p.get("activo"):
            continue
        if p.get("archivado") or p.get("descontinuado"):
            continue
        precio = p.get("precioVenta")
        if not precio or precio <= 0:
            continue
        descripcion = (p.get("descripcion") or "").strip()
        codigo = (p.get("codigo") or "").strip()
        if not descripcion:
            continue
        publicos.append(
            {
                "c": codigo,
                "d": descripcion,
                "p": round(float(precio)),
                "b": normalizar(f"{codigo} {descripcion}"),
            }
        )

    # Alfabetico, que es como se busca con el ojo cuando no se usa el buscador.
    publicos.sort(key=lambda x: x["b"])

    DESTINO.write_text(
        json.dumps(publicos, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    descartados = len(productos) - len(publicos)
    peso = DESTINO.stat().st_size / 1024
    print(f"Catalogo publico generado : {DESTINO.relative_to(RAIZ)}")
    print(f"Productos publicados      : {len(publicos)}")
    print(f"Descartados               : {descartados} (inactivos, sin precio o descontinuados)")
    print(f"Peso                      : {peso:.0f} KB")
    print()
    print("Campos publicados: codigo, descripcion, precio de venta.")
    print("NO se publica: precio de compra, rentabilidad, proveedor ni stock.")


if __name__ == "__main__":
    main()
