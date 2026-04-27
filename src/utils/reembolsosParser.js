/**
 * reembolsosParser.js
 *
 * Lee el archivo "Formato de envío información" (.xlsx) y extrae
 * las filas de reembolsos de la hoja correcta.
 *
 * La hoja correcta se identifica porque contiene EXACTAMENTE estos
 * 10 encabezados (sin más columnas no vacías):
 *   N°, TIPO DOCUMENTO, # DOCUMENTO, NOMBRE TRABAJADOR, EMPRESA,
 *   DESCRIPCIÓN, CUENTA A DEPOSITAR, VALOR REPORTADO, VALOR RECIBOS, VALOR A PAGAR
 *
 * La búsqueda es tolerante a espacios extra en los encabezados.
 */

import * as XLSX from 'xlsx'

const TARGET_HEADERS = [
  'N°',
  'TIPO DOCUMENTO',
  '# DOCUMENTO',
  'NOMBRE TRABAJADOR',
  'EMPRESA',
  'DESCRIPCIÓN',
  'CUENTA A DEPOSITAR',
  'VALOR REPORTADO',
  'VALOR RECIBOS',
  'VALOR A PAGAR',
]

function normalize(h) {
  return String(h).trim().toUpperCase().replace(/\s+/g, ' ')
}

/** Convierte número colombiano "7.639.026,00" o número nativo a float. */
function parseValor(val) {
  if (typeof val === 'number') return val
  const s = String(val).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Recorre todas las hojas del workbook y encuentra la que tiene
 * exactamente los 10 encabezados objetivo.
 *
 * @param {Object} workbook  Workbook de SheetJS (XLSX.read)
 * @returns {{ sheetName: string, dataRows: Array }|null}
 */
export function parseReembolsosFile(workbook) {
  const targetNorm = TARGET_HEADERS.map(normalize)

  for (const sheetName of workbook.SheetNames) {
    const ws   = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Buscar la fila de encabezados en las primeras 10 filas
    let headerRowIdx = -1
    let colMap = {}

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowNorm = rows[i].map(normalize)
      const nonEmpty = rowNorm.filter(h => h !== '')

      // Debe tener EXACTAMENTE 10 celdas no vacías que coincidan con nuestros headers
      if (nonEmpty.length !== 10) continue
      if (!targetNorm.every(th => nonEmpty.includes(th))) continue

      headerRowIdx = i
      targetNorm.forEach(th => {
        const idx = rowNorm.findIndex(h => h === th)
        if (idx >= 0) colMap[th] = idx
      })
      break
    }

    if (headerRowIdx === -1) continue  // esta hoja no es la correcta

    // Extraer filas de datos
    const dataRows = []
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i]

      // Parar si encontramos "TOTAL GENERAL" en cualquier celda
      const rowText = row.map(c => String(c).toUpperCase()).join(' ')
      if (rowText.includes('TOTAL GENERAL')) break

      // Saltar filas vacías (sin número de registro)
      const numStr = String(row[colMap['N°']] ?? '').trim()
      if (!numStr || numStr === '') continue

      const nombre  = String(row[colMap['NOMBRE TRABAJADOR']] ?? '').trim()
      const empresa = String(row[colMap['EMPRESA']] ?? '').trim()
      if (!nombre) continue

      dataRows.push({
        numero:        row[colMap['N°']],
        tipoDoc:       String(row[colMap['TIPO DOCUMENTO']]   ?? '').trim(),
        numDoc:        String(row[colMap['# DOCUMENTO']]      ?? '').trim(),
        nombre,
        empresa,
        descripcion:   String(row[colMap['DESCRIPCIÓN']]      ?? '').trim(),
        cuenta:        String(row[colMap['CUENTA A DEPOSITAR']] ?? '').trim(),
        valorReportado: parseValor(row[colMap['VALOR REPORTADO']]),
        valorRecibos:   parseValor(row[colMap['VALOR RECIBOS']]),
        valorAPagar:    parseValor(row[colMap['VALOR A PAGAR']]),
        // Descripción generada para la columna "Proveedor / Concepto" en CXP
        generatedDesc: `Reembolso ${nombre.toLowerCase()} ${empresa.toLowerCase()}`,
      })
    }

    if (dataRows.length > 0) return { sheetName, dataRows }
  }

  return null  // no se encontró la hoja correcta
}
