import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import MonthViewer from './MonthViewer'
import MonthViewerGuatemala from './MonthViewerGuatemala'
import ReembolsosPanel from './ReembolsosPanel'
import { MONTHS, isMonthSheet, monthSheetIndex } from '../utils/excelParser'
import { patchXlsx } from '../utils/xlsxPatcher'
import { saveHandle, loadHandle, clearHandle, requestPermission } from '../utils/fileHandleStore'

/**
 * ExcelEditor
 * Orquesta la apertura del archivo .xlsx, el selector de hojas
 * y la visualización estructurada del flujo de caja.
 *
 * El fileHandle se conserva para el futuro módulo de guardado.
 */
function ExcelEditor() {
  const [fileHandle, setFileHandle] = useState(null)
  const [rawBuffer, setRawBuffer]   = useState(null)   // buffer original → base para guardar
  const [fileName, setFileName]     = useState('')
  const [workbook, setWorkbook]     = useState(null)
  const [selectedSheet, setSelectedSheet] = useState('')
  const [error, setError]           = useState('')
  const [pendingEdits, setPendingEdits]           = useState({})  // { sheetName: { "row,col": value } }
  const [pendingInsertions, setPendingInsertions] = useState({})  // { sheetName: [{ id, insertAfterRow, cells, sectionKey }] }
  const [saveStatus, setSaveStatus]     = useState('idle') // 'idle' | 'saving' | 'saved'
  const [savedHandle, setSavedHandle]   = useState(null)   // handle guardado en IndexedDB (aún sin cargar)
  const [savedFileName, setSavedFileName] = useState('')   // nombre del archivo guardado
  const [reconnecting, setReconnecting] = useState(false)

  // ──────────────────────────────────────────────
  // Al montar: verificar si hay un handle guardado en IndexedDB
  // ──────────────────────────────────────────────
  useEffect(() => {
    loadHandle('main').then(async handle => {
      if (!handle) return
      try {
        // Obtener el nombre del archivo sin pedir permiso aún
        const file = await handle.getFile().catch(() => null)
        if (file) {
          setSavedHandle(handle)
          setSavedFileName(file.name)
        } else {
          // El archivo ya no existe en esa ruta
          clearHandle('main')
        }
      } catch {
        clearHandle('main')
      }
    }).catch(() => {})
  }, [])

  const totalEdits      = Object.values(pendingEdits).reduce((s, e) => s + Object.keys(e).length, 0)
  const totalInsertions = Object.values(pendingInsertions).reduce((s, a) => s + a.length, 0)
  const hasChanges      = totalEdits > 0 || totalInsertions > 0

  // ──────────────────────────────────────────────
  // Abrir archivo
  // ──────────────────────────────────────────────
  const handleOpenFile = async () => {
    setError('')

    if (!window.showOpenFilePicker) {
      setError('Tu navegador no soporta la File System Access API. Usa Chrome o Edge.')
      return
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Archivo Excel',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }],
        multiple: false
      })

      const file   = await handle.getFile()
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })

      setFileHandle(handle)
      setRawBuffer(buffer)   // guardar buffer original para preservar formato al guardar
      setFileName(file.name)
      setWorkbook(wb)

      // Persistir handle en IndexedDB para reconexión futura
      saveHandle('main', handle).catch(() => {})
      setSavedHandle(null)
      setSavedFileName('')

      // Auto-seleccionar el primer mes con datos
      const first = wb.SheetNames.find(isMonthSheet) || wb.SheetNames[0] || ''
      setSelectedSheet(first)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Error al abrir el archivo: ' + err.message)
      }
    }
  }

  // ──────────────────────────────────────────────
  // Edición de celdas existentes
  // ──────────────────────────────────────────────
  const handleCellEdit = (rowIdx, colIdx, draft) => {
    const trimmed = typeof draft === 'string' ? draft.trim() : draft
    let value
    if (trimmed === '' || trimmed === null || trimmed === undefined) {
      value = ''
    } else {
      const n = Number(trimmed)
      value = isNaN(n) ? trimmed : n
    }
    setPendingEdits(prev => ({
      ...prev,
      [selectedSheet]: {
        ...(prev[selectedSheet] || {}),
        [`${rowIdx},${colIdx}`]: value
      }
    }))
  }

  // ──────────────────────────────────────────────
  // Inserción de filas nuevas
  // ──────────────────────────────────────────────
  const handleAddRow = (insertAfterRow, sectionKey) => {
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setPendingInsertions(prev => ({
      ...prev,
      [selectedSheet]: [...(prev[selectedSheet] || []), { id, insertAfterRow, cells: {}, sectionKey }]
    }))
  }

  const handleInsertedRowEdit = (id, colIdx, value) => {
    setPendingInsertions(prev => ({
      ...prev,
      [selectedSheet]: (prev[selectedSheet] || []).map(ins =>
        ins.id === id ? { ...ins, cells: { ...ins.cells, [colIdx]: value } } : ins
      )
    }))
  }

  const handleDeleteInsertedRow = (id) => {
    setPendingInsertions(prev => ({
      ...prev,
      [selectedSheet]: (prev[selectedSheet] || []).filter(ins => ins.id !== id)
    }))
  }

  // ──────────────────────────────────────────────
  // Guardar archivo
  // ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!fileHandle || !rawBuffer) return
    setSaveStatus('saving')
    setError('')
    try {
      // Parchar el ZIP original — solo las celdas cambiadas, todo lo demás intacto
      const buf = await patchXlsx(rawBuffer, pendingEdits, pendingInsertions)

      const writable = await fileHandle.createWritable()
      await writable.write(buf)
      await writable.close()

      // Actualizar buffer Y workbook para reflejar los cambios en la UI sin recargar
      const newWb = XLSX.read(buf, { type: 'array' })
      setRawBuffer(buf)
      setWorkbook(newWb)
      setPendingEdits({})
      setPendingInsertions({})
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      setError('Error al guardar: ' + err.message)
      setSaveStatus('idle')
    }
  }

  const handleDiscard = () => {
    setPendingEdits({})
    setPendingInsertions({})
  }

  // ──────────────────────────────────────────────
  // Reembolsos: aplicar lote de inserciones desde el panel
  // ──────────────────────────────────────────────
  const handleApplyReembolsos = (monthSheet, insertions) => {
    setPendingInsertions(prev => ({
      ...prev,
      [monthSheet]: [...(prev[monthSheet] || []), ...insertions]
    }))
    // Navegar al mes destino para que el usuario vea los pendientes
    setSelectedSheet(monthSheet)
  }

  // ──────────────────────────────────────────────
  // Cerrar archivo
  // ──────────────────────────────────────────────
  const handleCloseFile = () => {
    setFileHandle(null)
    setRawBuffer(null)
    setFileName('')
    setWorkbook(null)
    setSelectedSheet('')
    setError('')
    setPendingEdits({})
    setPendingInsertions({})
    setSaveStatus('idle')
    // Limpiar también el handle guardado
    clearHandle('main').catch(() => {})
    setSavedHandle(null)
    setSavedFileName('')
  }

  // ──────────────────────────────────────────────
  // Reconectar desde handle guardado
  // ──────────────────────────────────────────────
  const handleReconnect = async () => {
    if (!savedHandle) return
    setReconnecting(true)
    setError('')
    try {
      const granted = await requestPermission(savedHandle)
      if (!granted) {
        setError('Permiso denegado. Haz clic en "Abrir Excel" para buscar el archivo manualmente.')
        setReconnecting(false)
        return
      }
      const file   = await savedHandle.getFile()
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer, { type: 'array' })

      setFileHandle(savedHandle)
      setRawBuffer(buffer)
      setFileName(file.name)
      setWorkbook(wb)
      setSavedHandle(null)
      setSavedFileName('')

      const first = wb.SheetNames.find(isMonthSheet) || wb.SheetNames[0] || ''
      setSelectedSheet(first)
    } catch (err) {
      setError('No se pudo reconectar: ' + err.message)
    }
    setReconnecting(false)
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────
  const sheetExists = (name) => workbook?.SheetNames.includes(name) ?? false

  // Detección de país por nombre de archivo
  const isGuatemala = fileName.toLowerCase().includes('guatemala')

  // Tabs dinámicos: meses ordenados por mes del año + resto de hojas
  // Excluye hojas ocultas (Hidden: 1) o muy ocultas (Hidden: 2) del workbook
  const displayTabs = useMemo(() => {
    if (!workbook) return []
    const wbSheets = workbook.Workbook?.Sheets ?? []
    const hiddenSet = new Set(
      wbSheets.reduce((acc, s, i) => {
        if (s.Hidden && s.Hidden > 0) acc.push(workbook.SheetNames[i])
        return acc
      }, [])
    )
    const visibleNames = workbook.SheetNames.filter(n => !hiddenSet.has(n))
    const monthTabs = visibleNames
      .filter(isMonthSheet)
      .sort((a, b) => monthSheetIndex(a) - monthSheetIndex(b))
    const otherTabs = visibleNames.filter(s => !isMonthSheet(s))
    return [...monthTabs, ...otherTabs]
  }, [workbook])

  // Filas crudas de la hoja seleccionada
  const sheetRows = useMemo(() => {
    if (!workbook || !selectedSheet || !workbook.Sheets[selectedSheet]) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { header: 1, defval: '' })
  }, [workbook, selectedSheet])

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="excel-editor">

      {/* ── Barra de herramientas ── */}
      <div className="excel-toolbar">
        <div className="toolbar-left">
          <button className="btn-toolbar btn-open" onClick={handleOpenFile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            {workbook ? 'Cambiar archivo' : 'Abrir Excel'}
          </button>

          {workbook && (
            <div className="file-info-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <span className="file-badge-name">{fileName}</span>
              <button className="btn-close-file" onClick={handleCloseFile} title="Cerrar archivo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Botones de guardado — visibles cuando hay cambios */}
        {hasChanges && (
          <div className="toolbar-right">
            {totalEdits > 0 && (
              <span className="changes-badge">{totalEdits} cambio{totalEdits !== 1 ? 's' : ''}</span>
            )}
            {totalInsertions > 0 && (
              <span className="changes-badge changes-badge-new">{totalInsertions} fila{totalInsertions !== 1 ? 's' : ''} nueva{totalInsertions !== 1 ? 's' : ''}</span>
            )}
            <button className="btn-toolbar btn-discard" onClick={handleDiscard} title="Descartar todos los cambios">
              Descartar
            </button>
            <button
              className={`btn-toolbar btn-save ${saveStatus === 'saving' ? 'saving' : ''}`}
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Guardando…' : 'Guardar en Excel'}
            </button>
          </div>
        )}
        {saveStatus === 'saved' && !hasChanges && (
          <div className="toolbar-right">
            <span className="save-ok-badge">✓ Guardado</span>
          </div>
        )}
      </div>

      {/* ── Alerta de error ── */}
      {error && (
        <div className="alert alert-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Zona de apertura (sin archivo) ── */}
      {!workbook && (
        <div className="drop-zone" onClick={!savedHandle ? handleOpenFile : undefined}
             style={savedHandle ? { cursor: 'default' } : {}}>
          <div className="drop-zone-content">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>

            {/* ── Reconexión disponible ── */}
            {savedHandle ? (
              <>
                <div className="drop-zone-text">
                  <span className="drop-zone-title">Archivo reciente detectado</span>
                  <span className="drop-zone-subtitle reconnect-filename">{savedFileName}</span>
                </div>
                <div className="reconnect-actions">
                  <button
                    className="btn-reconnect"
                    onClick={handleReconnect}
                    disabled={reconnecting}
                  >
                    {reconnecting ? 'Conectando…' : '⚡ Reconectar'}
                  </button>
                  <button className="btn-reconnect-other" onClick={handleOpenFile}>
                    Abrir otro archivo
                  </button>
                </div>
                <span className="drop-zone-hint">Se cargará el archivo tal como está en disco ahora mismo</span>
              </>
            ) : (
              <>
                <div className="drop-zone-text">
                  <span className="drop-zone-title">Seleccionar archivo Excel</span>
                  <span className="drop-zone-subtitle">
                    Haz clic para buscar un archivo .xlsx en tu computador
                  </span>
                </div>
                <span className="drop-zone-hint">Solo archivos .xlsx · Compatible con Chrome y Edge</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Archivo cargado: selector de hojas + vista ── */}
      {workbook && (
        <>
          {/* Selector de hojas — hojas detectadas en el workbook + REEMBOLSOS */}
          <div className="sheet-selector-bar">
            {displayTabs.map(name => {
              const exists  = sheetExists(name)
              const isMonth = isMonthSheet(name)
              return (
                <button
                  key={name}
                  className={[
                    'sheet-tab',
                    selectedSheet === name ? 'active' : '',
                    !exists ? 'unavailable' : '',
                    !isMonth ? 'tab-special' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => exists && setSelectedSheet(name)}
                  disabled={!exists}
                  title={!exists ? `${name} — sin datos` : name}
                >
                  {name}
                </button>
              )
            })}
            {/* Tab especial: Automatización - Reembolsos (solo Colombia) */}
            {!isGuatemala && (
            <button
              className={`sheet-tab tab-special tab-reembolsos ${selectedSheet === '__REEMBOLSOS__' ? 'active' : ''}`}
              onClick={() => setSelectedSheet('__REEMBOLSOS__')}
              title="Automatización — Reembolsos"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Reembolsos
            </button>
            )}
          </div>

          {/* Vista de mes — Colombia */}
          {!isGuatemala && isMonthSheet(selectedSheet) && sheetExists(selectedSheet) && (
            <MonthViewer
              rows={sheetRows}
              sheetName={selectedSheet}
              edits={pendingEdits[selectedSheet] || {}}
              onCellEdit={handleCellEdit}
              insertions={pendingInsertions[selectedSheet] || []}
              onAddRow={handleAddRow}
              onInsertedRowEdit={handleInsertedRowEdit}
              onDeleteInsertedRow={handleDeleteInsertedRow}
            />
          )}

          {/* Vista de mes — Guatemala */}
          {isGuatemala && isMonthSheet(selectedSheet) && sheetExists(selectedSheet) && (
            <MonthViewerGuatemala
              rows={sheetRows}
              sheetName={selectedSheet}
              edits={pendingEdits[selectedSheet] || {}}
              onCellEdit={handleCellEdit}
              insertions={pendingInsertions[selectedSheet] || []}
              onAddRow={handleAddRow}
              onInsertedRowEdit={handleInsertedRowEdit}
              onDeleteInsertedRow={handleDeleteInsertedRow}
            />
          )}

          {/* Vista Automatización - Reembolsos */}
          {selectedSheet === '__REEMBOLSOS__' && (
            <ReembolsosPanel
              workbook={workbook}
              onApplyReembolsos={handleApplyReembolsos}
            />
          )}

          {/* Vista de hojas no-mes (DISTRIBUCIÓN, etc.) — próximamente */}
          {!isMonthSheet(selectedSheet) && selectedSheet !== '__REEMBOLSOS__' && sheetExists(selectedSheet) && (
            <div className="coming-soon-panel">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <p>
                La vista estructurada de <strong>DISTRIBUCIÓN</strong> estará disponible próximamente.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ExcelEditor
