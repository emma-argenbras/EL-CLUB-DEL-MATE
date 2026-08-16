#!/usr/bin/env python3
"""
Importa las ventas, egresos y gastos de un mes ya cargado en la planilla
vieja (una hoja por turno: "1M", "1T", "2M", "2T", ... + hoja TOTALES)
y genera un seed historico para que la app lo cargue solo, una vez,
la primera vez que se abre.

Uso:
    pip install openpyxl
    python3 scripts/importar-historico.py "planilla.xlsx" 2026 7

Genera:
    public/historico-2026-07.seed.json
"""
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Falta openpyxl. Instalalo con: pip install openpyxl")

RAIZ = Path(__file__).resolve().parent.parent

# Los textos con que el vendedor anotaba el medio de pago en la columna F
# de cada fila de venta (a mano, con variantes y errores de tipeo).
MEDIOS = {
    "": "EFECTIVO",
    "TRANSFERENCIA": "TRANSFERENCIA",
    "TRNASFERENCIA": "TRANSFERENCIA",
    "DEBITO": "DEBITO",
    "DEBTIO": "DEBITO",
    "QR": "QR",
    "CREDITO": "CREDITO",
    "CRED": "CREDITO",
    "CRED UN PAGO": "CREDITO",
    "UN PAGO": "CREDITO",
    "CONSUMAX": "CREDITO",
}

# Categorias de gasto que se detectan por palabras clave en el concepto.
CATEGORIA_POR_PALABRA = {
    "ALQUILER": "ALQUILER",
    "LUZ": "SERVICIOS",
    "INTERNET": "SERVICIOS",
    "CONTADOR": "CONTADOR",
    "IMPUESTO": "IMPUESTOS",
    "AFIP": "IMPUESTOS",
    "SUELDO": "SUELDOS",
    "GABI": "SUELDOS",
    "ELENA": "SUELDOS",
}

FIJOS = {"ALQUILER", "SERVICIOS", "SUELDOS", "CONTADOR", "IMPUESTOS", "MANTENIMIENTO"}


def num(valor):
    return valor if isinstance(valor, (int, float)) else None


def txt(valor):
    return " ".join(str(valor).split()).strip() if valor is not None else ""


def normalizar(cadena):
    sin_tildes = unicodedata.normalize("NFD", cadena)
    sin_tildes = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return sin_tildes.lower()


def categoria_de(concepto):
    mayus = concepto.upper()
    for palabra, cat in CATEGORIA_POR_PALABRA.items():
        if palabra in mayus:
            return cat
    return "PROVEEDORES"


def main():
    if len(sys.argv) < 4:
        sys.exit(f"Uso: python3 {sys.argv[0]} <planilla.xlsx> <anio> <mes>")
    ruta = Path(sys.argv[1])
    anio = int(sys.argv[2])
    mes = int(sys.argv[3])
    if not ruta.exists():
        sys.exit(f"No encuentro el archivo: {ruta}")

    libro = openpyxl.load_workbook(ruta, data_only=True)

    # Precios de compra actuales, para asignar el costo de cada venta.
    costos = {}
    if "PRODUCTOS" in libro.sheetnames:
        hp = libro["PRODUCTOS"]
        for r in range(2, hp.max_row + 1):
            codigo = txt(hp.cell(r, 1).value).upper()
            compra = num(hp.cell(r, 5).value)
            if codigo:
                costos[codigo] = compra

    jornadas = []
    ventas = []
    movimientos = []
    sin_costo = {}  # codigo -> {descripcion, unidades, monto}

    for dia in range(1, 32):
        for turno in ("M", "T"):
            nombre_hoja = f"{dia}{turno}"
            if nombre_hoja not in libro.sheetnames:
                continue
            ws = libro[nombre_hoja]

            try:
                fecha = datetime(anio, mes, dia).date().isoformat()
            except ValueError:
                continue  # dia invalido para el mes (ej. 31 de un mes de 30)

            caja_inicial = num(ws.cell(6, 6).value) or 0

            ventas_dia = []
            for r in range(8, 28):
                codigo = txt(ws.cell(r, 2).value).upper()
                cantidad = num(ws.cell(r, 4).value)
                precio_unit = num(ws.cell(r, 5).value)
                f_val = ws.cell(r, 6).value
                g_val = num(ws.cell(r, 7).value)

                if isinstance(f_val, (int, float)):
                    total = f_val
                    medio_txt = ""
                else:
                    total = g_val
                    medio_txt = txt(f_val).upper()

                if not total or total <= 0:
                    continue

                # Algunas filas anotan el total directo sin cargar la cantidad
                # (ej. "CAMBIO", "DIFERENCIA DE CAMBIO", "OFERTAS DE 500"). La
                # propia planilla las suma igual en el subtotal del dia, asi
                # que las contamos como 1 unidad para no perder esa plata.
                if not cantidad or cantidad <= 0:
                    cantidad = 1

                medio = MEDIOS.get(medio_txt)
                if medio is None:
                    medio = "EFECTIVO"  # texto no reconocido: no perdemos la venta

                descripcion = txt(ws.cell(r, 3).value) or codigo or "Venta sin descripción"
                if not precio_unit:
                    precio_unit = round(total / cantidad, 2)

                costo = costos.get(codigo) if codigo else None
                if codigo and costo is None:
                    entrada = sin_costo.setdefault(
                        codigo, {"descripcion": descripcion, "unidades": 0, "monto": 0}
                    )
                    entrada["unidades"] += cantidad
                    entrada["monto"] += total

                ventas_dia.append(
                    {
                        "fecha": fecha,
                        "turno": turno,
                        "hora": "",
                        "codigo": codigo,
                        "descripcion": descripcion,
                        "cantidad": cantidad,
                        "precioUnitario": precio_unit,
                        "costoUnitario": costo,
                        "medioPago": medio,
                        "total": round(total, 2),
                        "vendedor": None,
                    }
                )

            # Egresos chicos pagados con la caja del turno (H8:H17, detalle en I).
            egresos_dia = []
            for r in range(8, 18):
                monto = num(ws.cell(r, 8).value)
                if monto and monto > 0:
                    concepto = txt(ws.cell(r, 9).value) or "Egreso"
                    egresos_dia.append({"concepto": concepto, "monto": monto})

            # Efectivo que se pasa de la caja del turno a la caja grande (H21:H27).
            pases_dia = []
            for r in range(21, 28):
                monto = num(ws.cell(r, 8).value)
                if monto and monto > 0:
                    concepto = txt(ws.cell(r, 9).value) or "Pase a caja grande"
                    pases_dia.append({"concepto": concepto, "monto": monto})

            if not ventas_dia and not egresos_dia and not pases_dia and caja_inicial == 0:
                continue  # turno que nunca se abrio

            indice_jornada = len(jornadas)
            jornadas.append(
                {
                    "fecha": fecha,
                    "turno": turno,
                    "estado": "cerrado",
                    "vendedor": None,
                    "cajaInicial": caja_inicial,
                    "horaApertura": None,
                    "horaCierre": None,
                    "arqueoApertura": {"billetes": {}, "monedas": caja_inicial},
                    "arqueoCierre": None,
                    "notas": "Importado desde la planilla de Google Sheets.",
                }
            )

            for v in ventas_dia:
                v["_jornadaIndice"] = indice_jornada
                ventas.append(v)

            for e in egresos_dia:
                movimientos.append(
                    {
                        "fecha": fecha,
                        "tipo": "EGRESO_CAJA",
                        "concepto": e["concepto"],
                        "monto": e["monto"],
                        "categoria": categoria_de(e["concepto"]),
                        "_jornadaIndice": indice_jornada,
                        "esVariable": True,
                    }
                )
            for p in pases_dia:
                movimientos.append(
                    {
                        "fecha": fecha,
                        "tipo": "A_CAJA_GRANDE",
                        "concepto": p["concepto"],
                        "monto": p["monto"],
                        "categoria": None,
                        "_jornadaIndice": indice_jornada,
                        "esVariable": False,
                    }
                )

    # Gastos pagados desde la caja grande (hoja TOTALES, columnas J concepto / K monto / L fecha).
    if "TOTALES" in libro.sheetnames:
        wt = libro["TOTALES"]
        for r in range(6, 200):
            concepto = txt(wt.cell(r, 10).value)
            monto = num(wt.cell(r, 11).value)
            fecha_celda = wt.cell(r, 12).value
            if not concepto or not monto:
                continue
            fecha = (
                fecha_celda.date().isoformat()
                if isinstance(fecha_celda, datetime)
                else f"{anio:04d}-{mes:02d}-01"
            )
            categoria = categoria_de(concepto)
            movimientos.append(
                {
                    "fecha": fecha,
                    "tipo": "GASTO_CAJA_GRANDE",
                    "concepto": concepto,
                    "monto": monto,
                    "categoria": categoria,
                    "_jornadaIndice": None,
                    "esVariable": categoria not in FIJOS,
                }
            )

    salida = {
        "mes": f"{anio:04d}-{mes:02d}",
        "jornadas": jornadas,
        "ventas": ventas,
        "movimientos": movimientos,
    }

    destino = RAIZ / "public" / f"historico-{anio:04d}-{mes:02d}.seed.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    total_ventas = sum(v["total"] for v in ventas)
    print(f"Jornadas importadas  : {len(jornadas)}")
    print(f"Ventas importadas    : {len(ventas)} por un total de ${total_ventas:,.0f}".replace(",", "."))
    print(f"Movimientos          : {len(movimientos)}")
    print(f"Archivo generado     : {destino.relative_to(RAIZ)}")
    print()
    print(f"Productos vendidos SIN costo de compra cargado ({len(sin_costo)}):")
    for codigo, d in sorted(sin_costo.items(), key=lambda kv: -kv[1]["monto"]):
        print(f"  {codigo:12s} {d['descripcion']:45s} {d['unidades']:>4.0f} un.  ${d['monto']:>10,.0f}".replace(",", "."))


if __name__ == "__main__":
    main()
