#!/usr/bin/env python3
"""
Pruebas del parser de ventas del importador. Cubren los cuatro modos en
que la planilla puede tener cargada una fila, que es donde se perdian
ventas antes.

Uso: python3 scripts/importar-historico.test.py
"""
import importlib.util
import sys
from pathlib import Path

RUTA = Path(__file__).resolve().parent / "importar-historico.py"
spec = importlib.util.spec_from_file_location("importador", RUTA)
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)


def fila(numero, codigo="", cantidad=None, precio=None, f=None, g=None):
    """Arma una fila como la que devuelve leer_filas()."""
    f_num = f if isinstance(f, (int, float)) else None
    f_txt = "" if f_num is not None else (f or "")
    return {
        "fila": numero,
        "codigo": codigo,
        "descripcion": codigo,
        "cantidad": cantidad,
        "precio": precio,
        "f_num": f_num,
        "f_txt": f_txt.upper(),
        "g_num": g,
    }


def procesar(filas):
    avisos = []
    ventas = imp.procesar_ventas(filas, "2026-08-01", "M", {}, {}, avisos)
    efectivo = sum(v["total"] for v in ventas if v["medioPago"] == "EFECTIVO")
    tarjeta = sum(v["total"] for v in ventas if v["medioPago"] != "EFECTIVO")
    return ventas, efectivo, tarjeta, avisos


casos = []


def caso(nombre):
    def envoltura(fn):
        casos.append((nombre, fn))
        return fn

    return envoltura


@caso("efectivo simple: una venta, la plata en efectivo")
def _():
    ventas, ef, tj, _ = procesar([fila(8, "A", 1, 9500, f=9500)])
    assert len(ventas) == 1, ventas
    assert (ef, tj) == (9500, 0)


@caso("tarjeta simple: el importe esta en la columna de tarjetas")
def _():
    ventas, ef, tj, _ = procesar([fila(8, "A", 1, 8500, f="QR", g=8500)])
    assert len(ventas) == 1
    assert ventas[0]["medioPago"] == "QR"
    assert (ef, tj) == (0, 8500)


@caso("medio de pago mal tipeado pero con importe en tarjetas: no cae en efectivo")
def _():
    ventas, ef, tj, _ = procesar([fila(8, "A", 1, 25000, f="TRANSFRENCIA", g=25000)])
    assert (ef, tj) == (0, 25000), (ef, tj)
    assert ventas[0]["medioPago"] == "TRANSFERENCIA"


@caso("pago partido: parte en efectivo y parte con tarjeta en la misma fila")
def _():
    ventas, ef, tj, _ = procesar([fila(8, "A", 1, 25500, f=20000, g=5500)])
    assert (ef, tj) == (20000, 5500)
    # Las unidades se cuentan una sola vez, y el costo tambien.
    assert sum(v["cantidad"] for v in ventas) == 1


@caso("varios productos en un solo pago con tarjeta, con recargo")
def _():
    ventas, ef, tj, avisos = procesar(
        [
            fila(11, "A", 1, 62500, f="CREDITO"),
            fila(12, "B", 1, 25500, f="TRES", g=143750),
            fila(13, "C", 1, 24000, f="CTAS"),
            fila(14, "D", 1, 16000),
        ]
    )
    assert (ef, tj) == (0, 143750), (ef, tj)
    # Los cuatro productos quedan registrados, mas la linea del recargo.
    codigos = [v["codigo"] for v in ventas]
    for c in "ABCD":
        assert c in codigos, codigos
    assert imp.CODIGO_AJUSTE in codigos
    assert all(v["medioPago"] == "CREDITO" for v in ventas)
    assert len(avisos) == 1


@caso("varios productos con descuento: la plata cierra igual")
def _():
    ventas, ef, tj, _ = procesar(
        [fila(8, "A", 1, 25100, f="DEBITO", g=32000), fila(9, "B", 1, 10500)]
    )
    assert (ef, tj) == (0, 32000), (ef, tj)
    assert {"A", "B"} <= {v["codigo"] for v in ventas}


@caso("entrega a cuenta en efectivo + resto con tarjeta")
def _():
    ventas, ef, tj, _ = procesar(
        [
            fila(8, "A", 1, 15700, f="QR", g=15700),
            fila(9, "B", 1, 47500, f=3000),
            fila(10, "C", 1, 25500, f="TRANSFERENCIA", g=70000),
        ]
    )
    assert (ef, tj) == (3000, 85700), (ef, tj)
    assert {"A", "B", "C"} <= {v["codigo"] for v in ventas}


@caso("la misma venta anotada en efectivo y en tarjetas: se cuenta una vez")
def _():
    ventas, ef, tj, avisos = procesar([fila(16, "A", 1, 25500, f=25500, g=25500)])
    assert (ef, tj) == (25500, 0), (ef, tj)
    assert len(ventas) == 1
    assert len(avisos) == 1


@caso("fila anotada sin importe que la planilla no suma: no se importa")
def _():
    ventas, ef, tj, avisos = procesar(
        [
            fila(10, "A", 1, 25500, f="TRANSFERENCIA", g=25500),
            fila(14, "B", 3, 8500, f="TRANSFERENCIA"),
        ]
    )
    assert (ef, tj) == (0, 25500), (ef, tj)
    assert "B" not in {v["codigo"] for v in ventas}
    assert len(avisos) == 1


@caso("las ventas de mas abajo de la fila 27 tambien entran")
def _():
    ws_filas = [fila(n, f"P{n}", 1, 1000, f=1000) for n in range(8, 31)]
    ventas, ef, _, _ = procesar(ws_filas)
    assert len(ventas) == 23, len(ventas)
    assert ef == 23000


def main():
    fallos = 0
    for nombre, fn in casos:
        try:
            fn()
            print(f"  ok   {nombre}")
        except AssertionError as e:
            fallos += 1
            print(f"  FALLA {nombre}: {e}")
    print()
    print(f"{len(casos) - fallos}/{len(casos)} pruebas pasaron")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
