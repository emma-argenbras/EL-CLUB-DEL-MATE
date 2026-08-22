#!/usr/bin/env python3
"""
Revisa que en public/ no haya quedado nada que no deba ser publico.

Por que existe
--------------
La app se publica en un hosting estatico. Cualquier archivo que quede en
public/ lo puede bajar cualquiera que sepa la direccion: no hay login que
valga para un archivo estatico. Ya paso dos veces --el catalogo con los
costos y el historial de ventas de todo el año-- y las dos veces se
encontro de casualidad.

Esto lo convierte en una regla que se verifica sola. Corre en el CI, y el
deploy no publica nada si esto falla.

Que se considera privado
------------------------
  - Lo que se paga y a quien: precio de compra, markup, proveedor.
  - Lo que se vendio y se gasto: ventas, movimientos, jornadas, arqueos.
  - El stock.

Que si puede ser publico: codigo, descripcion y precio de venta. Es lo
que ve un cliente en el catalogo, y es lo unico que necesita un
dispositivo recien instalado para arrancar.

Uso:
    python3 scripts/revisar-publicos.py                 # revisa public/
    python3 scripts/revisar-publicos.py --carpeta dist  # revisa lo construido

La segunda forma es la que corre el deploy: dist/ es lo que realmente se
sube, y ahi entra tambien cualquier cosa que haya generado el build.
"""
import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Claves que no pueden aparecer con un valor cargado en ningun archivo
# publicado. Van con el motivo, para que el que vea fallar el CI entienda
# de que se trata sin tener que venir a leer este archivo.
PROHIBIDAS = {
    "precioCompra": "el precio de compra",
    "rentabilidad": "el markup",
    "proveedor": "el proveedor",
    "proveedorId": "el proveedor",
    "fechaCompra": "la fecha de compra",
    "stock": "el stock",
    "cajaInicial": "la caja de un turno",
    "arqueoApertura": "el conteo de billetes",
    "arqueoCierre": "el conteo de billetes",
    "jornadas": "los turnos de caja",
    "ventas": "las ventas",
    "movimientos": "los gastos",
}


def recorrer(dato, camino=""):
    """Devuelve (clave, camino) por cada clave prohibida con valor."""
    if isinstance(dato, dict):
        for clave, valor in dato.items():
            if clave in PROHIBIDAS and valor not in (None, [], {}, ""):
                yield clave, camino or "(raíz)"
            yield from recorrer(valor, f"{camino}.{clave}" if camino else clave)
    elif isinstance(dato, list):
        # Con listas largas alcanza con mirar los primeros: si el campo
        # esta, esta en todos. Mirar 200.000 filas no aporta nada.
        for i, item in enumerate(dato[:50]):
            yield from recorrer(item, f"{camino}[{i}]")


def main():
    partes = argparse.ArgumentParser(description="Revisa que no se publique nada privado.")
    partes.add_argument(
        "--carpeta",
        default="public",
        help="Carpeta a revisar, relativa a la raiz del proyecto (por defecto: public).",
    )
    carpeta = RAIZ / partes.parse_args().carpeta

    if not carpeta.is_dir():
        sys.exit(f"No encuentro {carpeta}")

    problemas = []
    revisados = 0

    for archivo in sorted(carpeta.rglob("*.json")):
        revisados += 1
        try:
            dato = json.loads(archivo.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problemas.append((archivo, f"no es un JSON valido: {e}"))
            continue

        vistas = {}
        for clave, camino in recorrer(dato):
            vistas.setdefault(clave, camino)

        for clave, camino in vistas.items():
            problemas.append((archivo, f"expone {PROHIBIDAS[clave]} ({clave}, en {camino})"))

    if problemas:
        print("SE ESTA PUBLICANDO INFORMACION PRIVADA\n")
        for archivo, motivo in problemas:
            print(f"  {archivo.relative_to(RAIZ)}")
            print(f"      {motivo}")
        print()
        print("Estos archivos los puede bajar cualquiera que sepa la direccion.")
        print("Sacalos de public/ (por ejemplo a datos/, que no se publica) o")
        print("quitales esos campos antes de publicarlos.")
        sys.exit(1)

    print(f"{carpeta.relative_to(RAIZ)}/ revisado: {revisados} archivos JSON, ninguno expone datos privados.")


if __name__ == "__main__":
    main()
