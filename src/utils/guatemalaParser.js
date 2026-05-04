/**
 * guatemalaParser.js
 *
 * Parser para el Libro Caja Guatemala.
 * Estructura diferente a Colombia:
 *   - 2 monedas: VALOR QTQ (Quetzales) y VALOR USD
 *   - Sección inicial: solo BANCOS y CLIENTES (sin EOR)
 *   - CXP: columnas B-G (col 1-6), col A siempre vacía
 *   - NÓMINAS: col B = tipo de banco (Bibank, G&T Cont, etc.)
 *   - NÓMINA SAFEGUARD: bloque al final, tratado como CXP adicional
 *   - Fórmulas KPI en H (7), I (8), J (9): ocultas pero propagadas al insertar filas
 */

import { excelDateToString } from './excelParser'

// ─── Índices de columna (0-based) ────────────────────────────

/** Columnas para la Sección Inicial (BANCOS y CLIENTES). */
export const GT_INIT_COL = {
  estado: 1,  // B — solo CLIENTES
  desc:   2,  // C
  qtq:    3,  // D
  usd:    4,  // E
}

/** Columnas para la sección Cuentas x Pagar. */
export const GT_CXP_COL = {
  ref:    1,  // B — Factura (subsec. normales) o Tipo cuenta (nóminas)
  prov:   2,  // C — Proveedor / Descripción
  qtq:    3,  // D — Valor QTQ
  usd:    4,  // E — Valor USD
  fecha:  5,  // F — Fecha vencimiento
  estado: 6,  // G — Estado
  // H(7), I(8), J(9) = fórmulas KPI — propagadas automáticamente por xlsxPatcher
}

// ─── Parser principal ─────────────────────────────────────────

/**
 * Parsea una hoja de mes del Libro Caja Guatemala.
 * @param {Array[]} rows — resultado de XLSX.utils.sheet_to_json({ header:1 })
 * @returns {{ sectionInitial, sectionCXP } | null}
 */
export function parseMonthSheetGuatemala(rows) {
  if (!rows || rows.length < 10) return null

  // Inicio CXP: fila donde col B contiene "CUENTAS X PAGAR"
  const cxpHeaderIdx = rows.findIndex((r, i) =>
    i > 5 && String(r[1] || '').toUpperCase().includes('CUENTAS X PAGAR')
  )
  if (cxpHeaderIdx === -1) return null

  // Fin CXP: "TOTAL EGRESOS" en col C
  const totalIdx = rows.findIndex((r, i) =>
    i > cxpHeaderIdx && String(r[2] || '').toUpperCase().includes('TOTAL EGRESOS')
  )
  const cxpEnd = totalIdx !== -1 ? totalIdx : rows.length

  const sectionInitial = parseInitialGuatemala(rows, cxpHeaderIdx)
  const sectionCXP     = parseCXPGuatemala(rows, cxpHeaderIdx + 2, cxpEnd)

  return { sectionInitial, sectionCXP }
}

// ─── Sección Inicial ──────────────────────────────────────────

function parseInitialGuatemala(rows, cxpHeaderIdx) {
  const result = { bancos: [], clientes: [] }
  let group = null

  for (let i = 7; i < cxpHeaderIdx; i++) {
    const r    = rows[i]
    const c2   = String(r[2] || '').trim()
    const c2up = c2.toUpperCase()

    if (c2up === 'BANCOS')   { group = 'bancos';   continue }
    if (c2up === 'CLIENTES') { group = 'clientes'; continue }
    if (c2up.includes('TOTAL')) break
    if (!group) continue

    if (group === 'bancos' && c2) {
      result.bancos.push({ _row: i, raw: r })
    } else if (group === 'clientes' && (r[1] !== '' || c2)) {
      result.clientes.push({ _row: i, raw: r })
    }
  }

  return result
}

// ─── Sección CXP ──────────────────────────────────────────────

/**
 * Convierte las filas de la sección CXP en un array de subsecciones.
 * Cada subsección: { title, rows, _headerRow, isNominas }
 *
 * NÓMINA SAFEGUARD y sus sub-secciones llevan prefijo "SG: " para
 * distinguirlas de las secciones de mismo nombre al inicio del CXP.
 */
function parseCXPGuatemala(rows, startIdx, endIdx) {
  const sections = []
  let current     = null
  let inSafeguard = false

  for (let i = startIdx; i < endIdx; i++) {
    const r    = rows[i]
    const c1   = r[1]
    const c2   = String(r[2] || '').trim()
    const c5   = r[5]             // fecha
    const c6   = String(r[6] || '').trim()  // estado

    if (!c1 && !c2) continue     // fila completamente vacía

    // Cabecera de subsección: col B vacía, col C con nombre,
    //                          sin fecha y sin estado
    const isHeader = !c5 && !c6 && c2 && !String(c1 || '').trim()

    if (isHeader) {
      // Normalizar para búsqueda robusta (sin tildes)
      const c2norm = c2.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

      if (c2norm.includes('SAFEGUARD')) {
        // Grupo NÓMINA SAFEGUARD: sus filas de empleados van aquí
        inSafeguard = true
        current = { title: c2, rows: [], _headerRow: i, isNominas: true }
      } else {
        const title     = inSafeguard ? `SG: ${c2}` : c2
        const isNominas = c2norm.includes('NOMIN') || inSafeguard
        current = { title, rows: [], _headerRow: i, isNominas }
      }
      sections.push(current)

    } else if (current) {
      // Fila de datos: necesita fecha, estado, o referencia en col B
      if (c5 || c6 || c1) {
        const fechaRaw = r[GT_CXP_COL.fecha]
        current.rows.push({
          _row:  i,
          fecha: typeof fechaRaw === 'number' ? excelDateToString(fechaRaw) : String(fechaRaw || ''),
          raw:   r,
        })
      }
    }
  }

  return sections
}
