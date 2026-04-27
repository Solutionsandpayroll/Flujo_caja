/**
 * excelParser.js
 * Utilidades para leer y estructurar los datos del
 * archivo "Flujo de Caja" desde una hoja de SheetJS.
 */

export const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

export const DISPLAY_SHEETS = [...MONTHS, 'DISTRIBUCIÓN']

/**
 * Devuelve true si el nombre de la hoja corresponde a un mes.
 * Soporta tanto nombres exactos ('ABRIL') como compuestos ('Flujo Caja Abril 2026').
 */
export function isMonthSheet(sheetName) {
  const up = (sheetName || '').toUpperCase()
  return MONTHS.some(m => up === m || up.includes(m))
}

/** Índice 0-11 del mes en MONTHS, usado para ordenar hojas. -1 si no es mes. */
export function monthSheetIndex(sheetName) {
  const up = (sheetName || '').toUpperCase()
  return MONTHS.findIndex(m => up === m || up.includes(m))
}

// ─────────────────────────────────────────────
// Formateo de fechas y valores
// ─────────────────────────────────────────────

/**
 * Convierte un serial de fecha Excel (e.g. 46024) a "dd/mm/yyyy".
 */
export function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number') return ''
  const date = new Date((serial - 25569) * 86400 * 1000)
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const y = date.getUTCFullYear()
  return `${d}/${m}/${y}`
}

/**
 * Convierte una fecha en formato "dd/mm/yyyy" a serial de Excel.
 * Útil para guardar fechas editadas de vuelta al .xlsx.
 */
export function dateStringToSerial(str) {
  if (!str) return null
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(Number)
  if (!d || !m || !y) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(date.getTime())) return null
  return Math.round(date.getTime() / 86400000) + 25569
}

/**
 * Formatea un número como moneda colombiana (sin símbolo, con puntos).
 */
export function formatCOP(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value !== 'number') return String(value)
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Convierte cualquier valor a string recortado. */
function s(val) {
  return String(val ?? '').trim()
}

/**
 * Devuelve true si el string está completamente en mayúsculas
 * y contiene al menos una letra (evita falsos positivos con números).
 */
function isAllCaps(str) {
  const t = s(str)
  if (!t) return false
  return t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(t)
}

// Identificadores de la Sección Inicial
const INITIAL_GROUP_MAP = {
  'BANCOS': 'bancos',
  'CLIENTES': 'clientes',
  'PE': 'eor',   // ENERO y FEBRERO usan "PE"
  'EOR': 'eor'   // MARZO en adelante usan "EOR"
}

// ─────────────────────────────────────────────
// Función principal de parseo
// ─────────────────────────────────────────────

/**
 * Parsea las filas crudas de una hoja de mes y retorna
 * la estructura de dos secciones.
 *
 * @param {any[][]} rows  - Array 2D de celdas (resultado de sheet_to_json con header:1)
 * @returns {{ sectionInitial: object, sectionCXP: object[] }}
 */
export function parseMonthSheet(rows) {
  if (!rows || rows.length === 0) {
    return { sectionInitial: null, sectionCXP: [] }
  }

  // Encuentra la fila separadora "CUENTAS X PAGAR MES"
  let cxpIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if (s(rows[i][2]).startsWith('CUENTAS X PAGAR')) {
      cxpIdx = i
      break
    }
  }

  const initialRows = cxpIdx >= 0 ? rows.slice(0, cxpIdx) : rows
  const cxpRows     = cxpIdx >= 0 ? rows.slice(cxpIdx)    : []

  return {
    sectionInitial: parseInitialSection(initialRows),
    sectionCXP:     parseCXPSection(cxpRows, cxpIdx >= 0 ? cxpIdx : 0)
  }
}

// ─────────────────────────────────────────────
// Sección Inicial (BANCOS / CLIENTES / EOR)
// ─────────────────────────────────────────────

function parseInitialSection(rows) {
  const result = {
    bancos:   { title: 'BANCOS',   total: null, rows: [] },
    clientes: { title: 'CLIENTES', total: null, rows: [] },
    eor:      { title: 'EOR',      total: null, rows: [] }
  }
  let currentKey = null

  rows.forEach((row, i) => {
    const c3  = s(row[3])
    const key = INITIAL_GROUP_MAP[c3]

    if (key) {
      currentKey = key
      result[key].total = typeof row[4] === 'number' ? row[4] : null
      return
    }

    if (currentKey && c3) {
      result[currentKey].rows.push({
        _row:        i,
        estado:      s(row[2]),
        descripcion: c3,
        valor:       typeof row[4] === 'number' ? row[4] : null,
        valorF:      typeof row[5] === 'number' ? row[5] : null,
        valorG:      typeof row[6] === 'number' ? row[6] : null
      })
    }
  })

  return result
}

// ─────────────────────────────────────────────
// Sección CUENTAS X PAGAR MES
// ─────────────────────────────────────────────

function parseCXPSection(rows, offset = 0) {
  const subsections = []
  let current = null

  // Saltar filas de título y cabecera de columnas
  let start = 0
  for (let i = 0; i < rows.length; i++) {
    if (s(rows[i][3]) === 'PROVEEDOR' || s(rows[i][2]) === 'Factura') {
      start = i + 1
      break
    }
  }

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const c0  = s(row[0])
    const c2  = s(row[2])
    const c3  = s(row[3])

    if (!c3) continue

    /*
     * Criterio para encabezado de subsección:
     *   - col A (estado) vacía
     *   - col C (factura) vacía
     *   - col D (descripción) en MAYÚSCULAS con al menos una letra
     *   - col E (valor) es número (el total de la subsección)
     *   - col F (fecha) NO es número (los ítems tienen fecha serial)
     */
    if (!c0 && !c2 && isAllCaps(c3) && typeof row[4] === 'number' && typeof row[5] !== 'number') {
      // Parar si ya terminamos con IMPREVISTO (última subsección válida)
      if (current && current.title.toUpperCase().startsWith('IMPREVISTO')) break
      current = { title: c3, total: row[4], rows: [] }
      subsections.push(current)
    } else if (current) {
      // Fila de datos: el estado puede venir en col A o col G
      const estado = s(row[0]) || s(row[6])
      current.rows.push({
        _row:             offset + i,
        estado,
        semana:           (row[1] !== null && row[1] !== undefined && row[1] !== '') ? String(row[1]) : '',
        factura:          c2,
        proveedor:        c3,
        valor:            typeof row[4] === 'number' ? row[4] : null,
        fechaVencimiento: typeof row[5] === 'number' ? excelDateToString(row[5]) : ''
      })
    }
  }

  return subsections
}
