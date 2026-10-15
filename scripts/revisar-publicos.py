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
    python3 scripts/revisar-publicos.py                   # revisa public/
    python3 scripts/revisar-publicos.py --carpeta dist    # revisa lo construido
    python3 scripts/revisar-publicos.py --versionados     # revisa el repo entero

La segunda forma es la que corre el deploy: dist/ es lo que realmente se
sube, y ahi entra tambien cualquier cosa que haya generado el build.

La tercera existe porque las dos primeras miraban el lugar equivocado.
El repositorio es PUBLICO: un archivo versionado lo puede leer cualquiera
en github.com, sin login, aunque no este en public/ ni llegue al hosting.
Durante meses datos/ guardo los costos de los 1.337 productos con sus
proveedores, las ventas de ocho meses y el conteo de billetes de cada
turno, todo porque el README decia "datos/, que no se publica" --y es
cierto que no se publica en el sitio, pero se publica en GitHub, que es
peor, porque ahi queda tambien en el historial de git--.

Asi que la regla ahora es la que corresponde: ningun archivo versionado
puede tener campos privados. Ni en public/, ni en datos/, ni en ninguna
otra carpeta.
"""
import argparse
import json
import subprocess
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


# Los JSON de herramientas, que no son datos del negocio y tienen claves
# que casualmente se llaman igual (package-lock trae "resolved", etc.).
NO_SON_DATOS = {
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "firebase.json",
    ".firebaserc",
}


def revisar(archivo):
    """Devuelve una lista de motivos por los que este archivo no deberia existir."""
    try:
        dato = json.loads(archivo.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"no es un JSON valido: {e}"]
    except UnicodeDecodeError:
        return []

    vistas = {}
    for clave, camino in recorrer(dato):
        vistas.setdefault(clave, camino)
    return [f"expone {PROHIBIDAS[clave]} ({clave}, en {camino})" for clave, camino in vistas.items()]


def versionados():
    """Los JSON que estan dentro del repositorio, segun git."""
    salida = subprocess.run(
        ["git", "ls-files", "-z", "*.json"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    for nombre in salida.split("\0"):
        if not nombre:
            continue
        ruta = RAIZ / nombre
        if ruta.name in NO_SON_DATOS or not ruta.is_file():
            continue
        yield ruta


def main():
    partes = argparse.ArgumentParser(description="Revisa que no se publique nada privado.")
    partes.add_argument(
        "--carpeta",
        default="public",
        help="Carpeta a revisar, relativa a la raiz del proyecto (por defecto: public).",
    )
    partes.add_argument(
        "--versionados",
        action="store_true",
        help="En vez de una carpeta, revisa todos los JSON versionados en git.",
    )
    args = partes.parse_args()

    if args.versionados:
        archivos = sorted(versionados())
        donde = "los archivos versionados en git"
        consejo = [
            "Un archivo versionado lo puede leer cualquiera en github.com, aunque",
            "no este en public/ y aunque nunca llegue al hosting.",
            "",
            "Sacalo del repositorio (git rm --cached, y agregalo al .gitignore) o",
            "quitale esos campos. Ojo: sacarlo del arbol NO lo saca del historial",
            "de git, que tambien es publico.",
        ]
    else:
        carpeta = RAIZ / args.carpeta
        if not carpeta.is_dir():
            sys.exit(f"No encuentro {carpeta}")
        archivos = sorted(carpeta.rglob("*.json"))
        donde = f"{carpeta.relative_to(RAIZ)}/"
        consejo = [
            "Estos archivos los puede bajar cualquiera que sepa la direccion.",
            "Quitales esos campos, o dejalos fuera de lo que se publica.",
        ]

    problemas = [(a, m) for a in archivos for m in revisar(a)]

    if problemas:
        print("SE ESTA PUBLICANDO INFORMACION PRIVADA\n")
        for archivo, motivo in problemas:
            print(f"  {archivo.relative_to(RAIZ)}")
            print(f"      {motivo}")
        print()
        for linea in consejo:
            print(linea)
        sys.exit(1)

    print(f"{donde} revisado: {len(archivos)} archivos JSON, ninguno expone datos privados.")


if __name__ == "__main__":
    main()
