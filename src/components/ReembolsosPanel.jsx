/**
 * ReembolsosPanel.jsx
 *
 * Panel "Automatización - Reembolsos".
 * El usuario sube el archivo de formato, la app detecta la hoja correcta,
 * genera las descripciones "Reembolso {nombre} {empresa}" y permite
 * asignarlas a una subsección de Cuentas x Pagar Mes de un mes elegido.
 */

import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { parseMonthSheet, MONTHS, formatCOP, isMonthSheet, monthSheetIndex } from '../utils/excelParser'
import { parseReembolsosFile } from '../utils/reembolsosParser'

function ReembolsosPanel({ workbook, onApplyReembolsos }) {
  // ── Archivo de formato ──────────────────────────────────────
  const [formatoData, setFormatoData]     = useState(null)   // { sheetName, dataRows }
  const [formatoFileName, setFormatoFileName] = useState('')
  const [parseError, setParseError]       = useState('')
  const [isLoading, setIsLoading]         = useState(false)

  // ── Selección de mes y subsección ──────────────────────────
  const availableMonths = useMemo(
    () => (workbook?.SheetNames ?? []).filter(isMonthSheet)
            .sort((a, b) => monthSheetIndex(a) - monthSheetIndex(b)),
    [workbook]
  )
  const [targetMonth, setTargetMonth] = useState(() =>
    (workbook?.SheetNames ?? []).find(isMonthSheet) ?? ''
  )
  const [targetSubIdx, setTargetSubIdx] = useState(0)

  // Parsear el mes seleccionado para obtener las subsecciones CXP
  const subsections = useMemo(() => {
    if (!workbook || !targetMonth || !workbook.Sheets[targetMonth]) return []
    const rows   = XLSX.utils.sheet_to_json(workbook.Sheets[targetMonth], { header: 1, defval: '' })
    const parsed = parseMonthSheet(rows)
    return parsed?.sectionCXP ?? []
  }, [workbook, targetMonth])

  // Resetear idx cuando cambian las subsecciones
  const prevMonthRef = useRef(targetMonth)
  if (prevMonthRef.current !== targetMonth) {
    prevMonthRef.current = targetMonth
    if (targetSubIdx >= subsections.length) setTargetSubIdx(0)
  }

  // ── Selección de filas ──────────────────────────────────────
  const [selected, setSelected] = useState({})   // { rowIdx: bool }

  const toggleRow   = idx => setSelected(prev => ({ ...prev, [idx]: !prev[idx] }))
  const toggleAll   = () => {
    if (!formatoData) return
    const allOn = formatoData.dataRows.every((_, i) => selected[i])
    const next  = {}
    formatoData.dataRows.forEach((_, i) => { next[i] = !allOn })
    setSelected(next)
  }
  const selectedCount = formatoData
    ? formatoData.dataRows.filter((_, i) => selected[i]).length
    : 0

  // ── Upload del formato ──────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setIsLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })
      const result = parseReembolsosFile(wb)
      if (!result) {
        setParseError(
          'No se encontró la hoja con los encabezados esperados. ' +
          'Verifica que el archivo tenga la columna "N°", "NOMBRE TRABAJADOR", etc.'
        )
        setIsLoading(false)
        return
      }
      setFormatoFileName(file.name)
      setFormatoData(result)
      // Seleccionar todas las filas por defecto
      const sel = {}
      result.dataRows.forEach((_, i) => { sel[i] = true })
      setSelected(sel)
    } catch (err) {
      setParseError('Error al leer el archivo: ' + err.message)
    }
    setIsLoading(false)
    // Limpiar el input para permitir subir el mismo archivo de nuevo
    e.target.value = ''
  }

  // ── Aplicar reembolsos al mes/subsección elegidos ───────────
  const handleApply = () => {
    if (!formatoData || !subsections.length) return
    const sub = subsections[targetSubIdx]
    if (!sub || sub.rows.length === 0) return

    const lastRow = sub.rows[sub.rows.length - 1]._row
    const now     = Date.now()

    const insertions = formatoData.dataRows
      .filter((_, i) => selected[i])
      .map((row, i) => ({
        id:             `reimb-${now}-${i}`,
        insertAfterRow: lastRow,
        sectionKey:     `cxp:${sub.title}`,
        cells: {
          3: row.generatedDesc,          // Proveedor / Concepto
          ...(row.valorAPagar ? { 4: row.valorAPagar } : {}),  // Valor
        },
      }))

    if (insertions.length === 0) return
    onApplyReembolsos(targetMonth, insertions)
  }

  // ── Formato de número COP simple ───────────────────────────
  const fmtCOP = n =>
    Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="reimb-panel">

      {/* ── Encabezado ── */}
      <div className="reimb-header">
        <div className="reimb-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <div>
          <h2 className="reimb-title">Automatización — Reembolsos</h2>
          <p className="reimb-subtitle">
            Sube el archivo de formato para agregar automáticamente los reembolsos
            a la sección <strong>Cuentas x Pagar Mes</strong>.
          </p>
        </div>
      </div>

      {/* ── Zona de upload ── */}
      <div className="reimb-upload-section">
        <label className="reimb-upload-label">Archivo de formato (.xlsx)</label>
        <label className="reimb-upload-zone">
          <input
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--primary)', opacity: 0.7 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          {isLoading ? (
            <span className="reimb-upload-text">Procesando…</span>
          ) : formatoFileName ? (
            <span className="reimb-upload-text reimb-upload-loaded">
              ✓ {formatoFileName}
              <span className="reimb-upload-change">Cambiar archivo</span>
            </span>
          ) : (
            <span className="reimb-upload-text">
              Haz clic para seleccionar el archivo de formato
              <span className="reimb-upload-hint">Solo archivos .xlsx</span>
            </span>
          )}
        </label>

        {parseError && (
          <div className="reimb-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {parseError}
          </div>
        )}
      </div>

      {/* ── Panel de configuración y resultados (visible tras upload) ── */}
      {formatoData && (
        <>
          {/* Configuración: mes + subsección */}
          <div className="reimb-config">
            <div className="reimb-config-row">
              <div className="reimb-field">
                <label className="reimb-field-label">Mes destino</label>
                <select
                  className="reimb-select"
                  value={targetMonth}
                  onChange={e => setTargetMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="reimb-field reimb-field-grow">
                <label className="reimb-field-label">Subsección de Cuentas x Pagar</label>
                {subsections.length === 0 ? (
                  <span className="reimb-no-subs">
                    Este mes no tiene subsecciones en Cuentas x Pagar
                  </span>
                ) : (
                  <select
                    className="reimb-select"
                    value={targetSubIdx}
                    onChange={e => setTargetSubIdx(Number(e.target.value))}
                  >
                    {subsections.map((sub, i) => (
                      <option key={i} value={i}>
                        {sub.title}
                        {sub.rows.length > 0 ? ` (${sub.rows.length} ítem${sub.rows.length !== 1 ? 's' : ''})` : ' — vacía'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Info sobre la hoja detectada */}
            <div className="reimb-source-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="8"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
              Hoja detectada: <strong>{formatoData.sheetName}</strong> · {formatoData.dataRows.length} registro{formatoData.dataRows.length !== 1 ? 's' : ''} encontrado{formatoData.dataRows.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Tabla de resultados */}
          <div className="reimb-results-section">
            <div className="reimb-results-toolbar">
              <label className="reimb-check-all">
                <input
                  type="checkbox"
                  checked={selectedCount === formatoData.dataRows.length && formatoData.dataRows.length > 0}
                  onChange={toggleAll}
                />
                Seleccionar todo
              </label>
              <span className="reimb-sel-count">
                {selectedCount} de {formatoData.dataRows.length} seleccionados
              </span>
            </div>

            <div className="table-scroll-wrapper">
              <table className="viewer-table reimb-table">
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th style={{ width: '30px' }}>N°</th>
                    <th>Nombre trabajador</th>
                    <th>Empresa</th>
                    <th>Descripción generada</th>
                    <th className="col-right" style={{ width: '150px' }}>Valor a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {formatoData.dataRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`${i % 2 === 0 ? 'tr-even' : ''} ${selected[i] ? '' : 'reimb-row-deselected'}`}
                      onClick={() => toggleRow(i)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="col-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!selected[i]}
                          onChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="col-center" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {row.numero}
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.nombre}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.empresa}</td>
                      <td className="reimb-generated">
                        <span className="reimb-generated-badge">{row.generatedDesc}</span>
                      </td>
                      <td className="col-right td-valor">{fmtCOP(row.valorAPagar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón aplicar */}
          <div className="reimb-apply-bar">
            <button
              className="btn-reimb-apply"
              disabled={selectedCount === 0 || subsections.length === 0 || (subsections[targetSubIdx]?.rows?.length ?? 0) === 0}
              onClick={handleApply}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Agregar {selectedCount} reembolso{selectedCount !== 1 ? 's' : ''} a {targetMonth} → {subsections[targetSubIdx]?.title ?? '…'}
            </button>
            {(subsections[targetSubIdx]?.rows?.length ?? 0) === 0 && subsections.length > 0 && (
              <span className="reimb-apply-warn">
                La subsección seleccionada está vacía — necesita al menos una fila existente para insertar después.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ReembolsosPanel
