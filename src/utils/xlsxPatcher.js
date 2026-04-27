/**
 * xlsxPatcher.js
 *
 * Parchea quirúrgicamente un archivo .xlsx sin pasar por SheetJS.
 * Un .xlsx es un ZIP que contiene archivos XML. Abrimos ese ZIP,
 * encontramos la celda exacta en el XML de la hoja, sustituimos
 * solo el valor y volvemos a comprimir. Todo lo demás (estilos,
 * celdas fusionadas, colores, fuentes, fórmulas no tocadas, macros…)
 * queda byte-a-byte idéntico al original.
 */

import JSZip from 'jszip'

// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────

/** Convierte índices 0-based a referencia de celda tipo "D6". */
function encodeCell(r, c) {
  let col = ''
  let n   = c + 1
  while (n > 0) {
    col = String.fromCharCode(65 + ((n - 1) % 26)) + col
    n   = Math.floor((n - 1) / 26)
  }
  return col + (r + 1)
}

/** Convierte índice 0-based de columna a letras ("A", "Z", "AA", …). */
function colLetter(c) {
  let col = ''
  let n   = c + 1
  while (n > 0) {
    col = String.fromCharCode(65 + ((n - 1) % 26)) + col
    n   = Math.floor((n - 1) / 26)
  }
  return col
}

/**
 * Devuelve el índice (exclusive) del final de <row r="rowNum">…</row>.
 * rowNum es 1-based (como aparece en el XML de Excel).
 */
function findRowEnd(xml, rowNum) {
  const needle = `r="${rowNum}"`
  let pos = 0
  while (pos < xml.length) {
    const rIdx = xml.indexOf(needle, pos)
    if (rIdx === -1) return -1
    // Retroceder hasta '<'
    let tagStart = rIdx
    while (tagStart > 0 && xml[tagStart] !== '<') tagStart--
    // Confirmar que es <row
    if (xml.slice(tagStart, tagStart + 4) !== '<row') {
      pos = rIdx + needle.length
      continue
    }
    // Avanzar hasta '>' de cierre del tag de apertura
    let tagEnd = rIdx + needle.length
    while (tagEnd < xml.length && xml[tagEnd] !== '>') tagEnd++
    if (tagEnd >= xml.length) return -1
    if (xml[tagEnd - 1] === '/') return tagEnd + 1   // self-closing
    const closeIdx = xml.indexOf('</row>', tagEnd + 1)
    if (closeIdx === -1) return -1
    return closeIdx + 6
  }
  return -1
}

/** Convierte letras de columna ("A", "Z", "AA", …) a índice 0-based. */
function colLetterToIndex(col) {
  let n = 0
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + col.charCodeAt(i) - 64
  }
  return n - 1
}

/**
 * Ajusta referencias de fila relativas en una fórmula de Excel.
 * Cambia COLUMN+oldRow → COLUMN+newRow para referencias no absolutas ($).
 * Las referencias con $ antes del número de fila se mantienen intactas.
 */
function adjustFormulaRow(formula, oldRow, newRow) {
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (match, colDollar, col, rowDollar, rowStr) => {
    if (rowDollar === '$') return match                          // fila absoluta → no tocar
    if (Number(rowStr) === oldRow) return colDollar + col + newRow  // fila relativa del template → actualizar
    return match
  })
}

/** Extrae el XML completo de la fila rowNum (1-based) para copiar estilos. */
function getRowXml(xml, rowNum) {
  const needle = `r="${rowNum}"`
  let pos = 0
  while (pos < xml.length) {
    const rIdx = xml.indexOf(needle, pos)
    if (rIdx === -1) return null
    let tagStart = rIdx
    while (tagStart > 0 && xml[tagStart] !== '<') tagStart--
    if (xml.slice(tagStart, tagStart + 4) !== '<row') {
      pos = rIdx + needle.length
      continue
    }
    const endIdx = findRowEnd(xml, rowNum)
    if (endIdx === -1) return null
    return xml.slice(tagStart, endIdx)
  }
  return null
}

/**
 * Construye el XML de una nueva fila.
 * @param {number}      rowNum         Número de fila 1-based.
 * @param {Object}      cells          { colIdx0based: value }
 * @param {string|null} templateRowXml XML de la fila plantilla para copiar estilos numéricos.
 */
function buildNewRowXml(rowNum, cells, templateRowXml) {
  // numericStyleMap: col letter → s= style id  (celdas numéricas sin fórmula)
  // formulaCellMap:  col letter → { style, formula }  (celdas con <f>)
  //
  // Las celdas de TEXTO no copian el estilo porque el estilo original puede tener
  // fuente blanca (el color lo gestiona conditional formatting), lo que haría el
  // texto invisible en Excel aunque el valor sí esté en el archivo.
  const numericStyleMap = {}
  const formulaCellMap  = {}
  const templateRowNum  = rowNum - 1    // fila plantilla (1-based)

  if (templateRowXml) {
    const process = (attrs, content = '') => {
      const colM = /\br="([A-Z]+)\d+"/.exec(attrs)
      const sM   = /\bs="(\d+)"/.exec(attrs)
      const tM   = /\bt="([^"]+)"/.exec(attrs)
      // Fórmula: extrae solo si hay texto real dentro de <f> (no shared slaves vacíos)
      const fM   = /<f[^>]*>([^<]+)<\/f>/.exec(content)
      if (!colM) return
      const col = colM[1]
      if (fM) {
        formulaCellMap[col] = { style: sM ? sM[1] : null, formula: fM[1] }
      } else if (sM && (!tM || tM[1] === 'n')) {
        numericStyleMap[col] = sM[1]
      }
    }
    let m
    // self-closing <c ... />
    const reSC = /<c\b([^>]*?)\/>/g
    while ((m = reSC.exec(templateRowXml)) !== null) process(m[1])
    // open-close <c ...>...</c>
    const reOC = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
    while ((m = reOC.exec(templateRowXml)) !== null) process(m[1], m[2])
  }

  // Acumular celdas indexadas por columna (0-based) para emitirlas ordenadas
  const userColLetters = new Set(Object.keys(cells).map(k => colLetter(Number(k))))
  const cellParts = {}   // colIndex → xml string

  // 1. Fórmulas propagadas desde la fila plantilla (si el usuario no sobreescribió esa columna)
  for (const [col, { style, formula }] of Object.entries(formulaCellMap)) {
    if (userColLetters.has(col)) continue
    const colIdx = colLetterToIndex(col)
    const ref    = `${col}${rowNum}`
    const sAttr  = style ? ` s="${style}"` : ''
    const adj    = adjustFormulaRow(formula, templateRowNum, rowNum)
    cellParts[colIdx] = `<c r="${ref}"${sAttr}><f>${adj}</f></c>`
  }

  // 2. Valores proporcionados explícitamente (Estado, Descripción, Valor, Fecha, etc.)
  for (const [colIdxStr, value] of Object.entries(cells)) {
    if (value === '' || value === null || value === undefined) continue
    const colIdx    = Number(colIdxStr)
    const col       = colLetter(colIdx)
    const ref       = `${col}${rowNum}`
    const isNumeric = typeof value === 'number' || dateStringToSerial(String(value)) !== null
    const sAttr     = isNumeric && numericStyleMap[col] ? ` s="${numericStyleMap[col]}"` : ''
    cellParts[colIdx] = buildCellXml(`<c r="${ref}"${sAttr}>`, value)
  }

  // Emitir celdas en orden de columna (requisito de Excel)
  const cellsXml = Object.keys(cellParts)
    .map(Number).sort((a, b) => a - b)
    .map(idx => cellParts[idx])
    .join('')

  return `<row r="${rowNum}">${cellsXml}</row>`
}

/**
 * Incrementa en +inc todos los números de fila > afterRow (1-based) en el fragmento xml dado.
 * Actualiza: <row r="N">, <c r="XN">, texto de fórmulas <f>, atributos ref= (mergeCell,
 * fórmulas compartidas, dataValidation, dimension) y sqref=.
 */
function renumberAfter(xml, afterRow, inc) {
  const shift = n => Number(n) > afterRow ? Number(n) + inc : Number(n)

  // 1. Atributos r= en <row>
  xml = xml.replace(/<row\b[^>]*>/g, tag =>
    tag.replace(/\br="(\d+)"/, (m, n) => `r="${shift(n)}"`)
  )

  // 2. Atributos r= en <c> (aperturas y self-closing)
  xml = xml.replace(/<c\b[^>]*>/g, tag =>
    tag.replace(/\br="([A-Z]+)(\d+)"/, (m, col, n) => `r="${col}${shift(n)}"`)
  )

  // 3. Texto de fórmulas <f ...>FORMULA</f>
  //    Actualiza todas las referencias A1-style dentro de la expresión.
  //    Los < dentro de fórmulas son &lt; en XML, así que [^<]* es seguro.
  xml = xml.replace(/(<f\b[^>]*>)([^<]*)(<\/f>)/g, (m, open, text, close) =>
    open + text.replace(/\b([A-Z]+)(\d+)\b/g, (r, col, n) => `${col}${shift(n)}`) + close
  )

  // 4. Todos los atributos ref="..." (mergeCell, fórmulas compartidas, dimension,
  //    dataValidation, conditionalFormatting, etc.)
  //    Rangos  ref="A5:B20"
  xml = xml.replace(/\bref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g,
    (m, c1, r1, c2, r2) => `ref="${c1}${shift(r1)}:${c2}${shift(r2)}"`
  )
  //    Celdas simples  ref="A5"
  xml = xml.replace(/\bref="([A-Z]+)(\d+)"/g,
    (m, col, n) => `ref="${col}${shift(n)}"`
  )

  // 5. sqref= (dataValidation, conditionalFormatting) puede ser lista: "A5:A10 B5:B10"
  xml = xml.replace(/\bsqref="([^"]*)"/g, (m, val) => {
    const updated = val.replace(/([A-Z]+)(\d+)/g, (r, col, n) => `${col}${shift(n)}`)
    return `sqref="${updated}"`
  })

  return xml
}

/**
 * Inserta nuevas filas en el XML de una hoja.
 * @param {string} xml
 * @param {Array}  insertions  [{ insertAfterRow (0-based), cells: { colIdx: value } }]
 */
function insertRowsInSheetXml(xml, insertions) {
  if (!insertions || insertions.length === 0) return xml
  const sorted = [...insertions].sort((a, b) => a.insertAfterRow - b.insertAfterRow)
  let offset = 0
  for (const ins of sorted) {
    const targetXmlRow = ins.insertAfterRow + 1 + offset   // convertir a 1-based + offset acumulado
    const templateXml  = getRowXml(xml, targetXmlRow)
    const endIdx       = findRowEnd(xml, targetXmlRow)
    if (endIdx === -1) continue                            // fila no encontrada, saltar
    const newRowNum = targetXmlRow + 1
    const newRowXml = '\n    ' + buildNewRowXml(newRowNum, ins.cells, templateXml)
    // Renumerar sufijo (filas > targetXmlRow) antes de insertar para mantener orden
    const prefix        = xml.slice(0, endIdx)
    const renamedSuffix = renumberAfter(xml.slice(endIdx), targetXmlRow, 1)
    xml = prefix + newRowXml + renamedSuffix
    offset++
  }
  return xml
}

/** Intenta convertir "dd/mm/yyyy" a serial de Excel. */
function dateStringToSerial(str) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str)
  if (!m) return null
  const [, d, mo, y] = m.map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (isNaN(date.getTime())) return null
  return Math.round(date.getTime() / 86400000) + 25569
}

/**
 * Construye el XML de una celda con el nuevo valor.
 * Preserva todos los atributos originales (s, r, etc.) salvo t.
 */
function buildCellXml(openTag, value) {
  // Extraer atributos: quitar < c inicial, > final y atributo t si existe
  let attrs = openTag
    .replace(/^<c\s*/, '')
    .replace(/>$/, '')
    .replace(/\bt="[^"]*"/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (typeof value === 'number') {
    return `<c ${attrs}><v>${value}</v></c>`
  }

  // Si parece una fecha "dd/mm/yyyy", convertir a serial (preserva formato de fecha de la celda)
  const serial = dateStringToSerial(String(value))
  if (serial) {
    return `<c ${attrs}><v>${serial}</v></c>`
  }

  // Texto plano → inline string (Excel acepta este formato; no requiere tocar sharedStrings.xml)
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<c ${attrs} t="inlineStr"><is><t>${escaped}</t></is></c>`
}

/**
 * Encuentra y reemplaza la celda `cellRef` en el XML de la hoja.
 *
 * Estrategia robusta en dos pasos:
 * 1. Localizar el atributo r="cellRef" en el XML.
 * 2. Retroceder hasta el inicio del <c, avanzar hasta el cierre del tag
 *    de apertura (> o />) y determinar si es self-closing o tiene contenido.
 *
 * Esto evita falsas coincidencias de regex sobre self-closing tags con
 * atributos adicionales (p.ej. <c r="E5" s="12"/>) que hacen que
 * patrones basados en [^>]* capturen el />, rompiendo el XML.
 */
function patchCell(xml, cellRef, value) {
  const needle = `r="${cellRef}"`
  let searchFrom = 0

  while (true) {
    const attrIdx = xml.indexOf(needle, searchFrom)
    if (attrIdx === -1) return xml   // celda no encontrada

    // Retroceder hasta el > del elemento anterior, lo que sigue debe ser <c
    const prevGt  = xml.lastIndexOf('>', attrIdx)
    const segment = xml.slice(prevGt + 1, attrIdx) // texto entre > previo y r="..."

    if (!segment.trimStart().startsWith('<c')) {
      // El atributo r= pertenece a otro elemento (p.ej. <row r="5">), seguir buscando
      searchFrom = attrIdx + needle.length
      continue
    }

    // Inicio del elemento <c
    const tagStart = prevGt + 1 + segment.indexOf('<c')

    // Avanzar desde el atributo hasta el cierre del tag de apertura (> o />)
    const gtIdx = xml.indexOf('>', attrIdx + needle.length)
    if (gtIdx === -1) return xml  // XML malformado

    const isSelfClosing = xml[gtIdx - 1] === '/'
    const openTag       = xml.slice(tagStart, gtIdx + 1)   // incluye > o />

    if (isSelfClosing) {
      // <c r="E5" s="12"/>  →  reemplazar solo el elemento self-closing
      const fakeOpen = openTag.slice(0, -2) + '>'  // quitar />, añadir >
      const newCell  = buildCellXml(fakeOpen, value)
      return xml.slice(0, tagStart) + newCell + xml.slice(gtIdx + 1)
    } else {
      // <c r="E5" ...>...</c>  →  reemplazar hasta </c>
      const closeIdx = xml.indexOf('</c>', gtIdx + 1)
      if (closeIdx === -1) return xml  // XML malformado
      const newCell = buildCellXml(openTag, value)
      return xml.slice(0, tagStart) + newCell + xml.slice(closeIdx + 4)
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Mapa hoja → archivo XML en el ZIP
// ─────────────────────────────────────────────────────────────

/**
 * Lee xl/workbook.xml y xl/_rels/workbook.xml.rels del ZIP para
 * construir un mapa { "ENERO": "xl/worksheets/sheet2.xml", … }.
 */
async function buildSheetFileMap(zip) {
  const relsText = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  const wbText   = await zip.file('xl/workbook.xml')?.async('string')
  if (!relsText || !wbText) throw new Error('No se pudo leer la estructura interna del .xlsx')

  // rId → ruta relativa dentro de xl/
  const relMap = {}
  const relRe  = /Id="([^"]+)"[^>]+Target="([^"]+)"/g
  let m
  while ((m = relRe.exec(relsText)) !== null) {
    relMap[m[1]] = 'xl/' + m[2].replace(/^\//, '')
  }

  // nombre de hoja → ruta completa
  const nameToFile = {}
  const sheetRe    = /<sheet\s[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g
  while ((m = sheetRe.exec(wbText)) !== null) {
    if (relMap[m[2]]) nameToFile[m[1]] = relMap[m[2]]
  }

  return nameToFile
}

// ─────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────

/**
 * Aplica edits puntuales y/o inserciones de filas al buffer original de un .xlsx.
 *
 * @param {ArrayBuffer} rawBuffer        Buffer original del archivo (sin modificar).
 * @param {Object}      pendingEdits     { sheetName: { "row,col": value } }
 * @param {Object}      pendingInsertions { sheetName: [{ insertAfterRow (0-based), cells: { colIdx: value } }] }
 * @returns {Promise<ArrayBuffer>}       Nuevo buffer listo para escribir al disco.
 */
export async function patchXlsx(rawBuffer, pendingEdits, pendingInsertions = {}) {
  const zip          = await JSZip.loadAsync(rawBuffer)
  const sheetFileMap = await buildSheetFileMap(zip)

  const allSheets = new Set([
    ...Object.keys(pendingEdits),
    ...Object.keys(pendingInsertions).filter(k => (pendingInsertions[k] || []).length > 0)
  ])

  for (const sheetName of allSheets) {
    const sheetFile = sheetFileMap[sheetName]
    if (!sheetFile) continue
    const entry = zip.file(sheetFile)
    if (!entry) continue

    let xml = await entry.async('string')

    // 1. Insertar nuevas filas (modifica números de fila del XML)
    const insertions = pendingInsertions[sheetName] || []
    if (insertions.length > 0) {
      xml = insertRowsInSheetXml(xml, insertions)
    }

    // 2. Parchear celdas existentes, ajustando índices de fila por las inserciones previas
    const sheetEdits = pendingEdits[sheetName] || {}
    if (Object.keys(sheetEdits).length > 0) {
      const sortedIns = [...insertions].sort((a, b) => a.insertAfterRow - b.insertAfterRow)
      for (const [key, value] of Object.entries(sheetEdits)) {
        let [r, c] = key.split(',').map(Number)
        // Por cada inserción cuyo insertAfterRow (0-based) < r, la fila se desplazó +1
        const shift = sortedIns.filter(ins => ins.insertAfterRow < r).length
        xml = patchCell(xml, encodeCell(r + shift, c), value)
      }
    }

    zip.file(sheetFile, xml)
  }

  // Eliminar calcChain para evitar advertencias de Excel por cadenas de fórmulas desactualizadas
  zip.remove('xl/calcChain.xml')

  return zip.generateAsync({
    type:               'arraybuffer',
    compression:        'DEFLATE',
    compressionOptions: { level: 6 }
  })
}
