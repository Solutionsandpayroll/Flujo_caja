import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import MonthViewer from './MonthViewer'
import MonthViewerGuatemala from './MonthViewerGuatemala'
import ReembolsosPanel from './ReembolsosPanel'
import { isMonthSheet, monthSheetIndex } from '../utils/excelParser'
import { patchXlsx } from '../utils/xlsxPatcher'
import { saveHandle, loadHandle, clearHandle, requestPermission } from '../utils/fileHandleStore'

const SLOT_KEYS   = ['colombia', 'guatemala', 'costarica', 'peru']
const SLOT_LABELS = { colombia: '🇨🇴 Colombia', guatemala: '🇬🇹 Guatemala', costarica: '🇨🇷 Costa Rica', peru: '🇵🇪 Perú' }

// Etiqueta de moneda local por país (columna D en la hoja)
const SLOT_CURRENCY = { colombia: null, guatemala: 'QTQ', costarica: '₡ CRC', peru: 'S/ Sol' }

function emptySlot(handle, fileName, buffer, wb) {
  const first = wb.SheetNames.find(isMonthSheet) || wb.SheetNames[0] || ''
  return { fileHandle: handle, rawBuffer: buffer, fileName, workbook: wb,
           selectedSheet: first, pendingEdits: {}, pendingInsertions: {} }
}

function ExcelEditor() {
  // slots: { colombia: FileSlot | null, guatemala: FileSlot | null }
  // FileSlot: { fileHandle, rawBuffer, fileName, workbook, selectedSheet, pendingEdits, pendingInsertions }
  const [slots,       setSlots]       = useState({ colombia: null, guatemala: null, costarica: null, peru: null })
  const [activeSlot,  setActiveSlot]  = useState(null)   // 'colombia' | 'guatemala' | 'costarica' | 'peru' | null
  // savedHandles: handles de IndexedDB pendientes de reconexión (aún sin cargar)
  const [savedHandles, setSavedHandles] = useState({ colombia: null, guatemala: null, costarica: null, peru: null })
  const [error,        setError]        = useState('')
  const [saveStatus,   setSaveStatus]   = useState('idle') // 'idle' | 'saving' | 'saved'
  const [reconnecting, setReconnecting] = useState(null)   // null | 'colombia' | 'guatemala'

  // ── Derived from active slot ──
  const current           = activeSlot ? slots[activeSlot] : null
  const fileHandle        = current?.fileHandle        ?? null
  const rawBuffer         = current?.rawBuffer         ?? null
  const fileName          = current?.fileName          ?? ''
  const workbook          = current?.workbook          ?? null
  const selectedSheet     = current?.selectedSheet     ?? ''
  const pendingEdits      = current?.pendingEdits      ?? {}
  const pendingInsertions = current?.pendingInsertions ?? {}
  const isGuatemalaFormat = activeSlot !== null && activeSlot !== 'colombia'
  const currencyLabel     = SLOT_CURRENCY[activeSlot] ?? 'QTQ'

  const totalEdits      = Object.values(pendingEdits).reduce((s, e) => s + Object.keys(e).length, 0)
  const totalInsertions = Object.values(pendingInsertions).reduce((s, a) => s + a.length, 0)
  const hasChanges      = totalEdits > 0 || totalInsertions > 0
  const hasAnyFile      = SLOT_KEYS.some(k => slots[k] !== null)

  // ──────────────────────────────────────────────
  // Al montar: verificar IndexedDB para ambos slots
  // FIX: usar handle.name (no requiere permiso) en vez de handle.getFile()
  // ──────────────────────────────────────────────
  useEffect(() => {
    SLOT_KEYS.forEach(key => {
      loadHandle(`slot-${key}`).then(handle => {
        if (!handle) return
        // handle.name es una propiedad del FileSystemHandle, sin permiso requerido
        setSavedHandles(prev => ({ ...prev, [key]: handle }))
      }).catch(() => {})
    })
  }, [])

  // ── Cargar archivo en un slot (compartido entre Open y Reconnect) ──
  async function loadIntoSlot(handle, slotKey) {
    const file   = await handle.getFile()
    const buffer = await file.arrayBuffer()
    const wb     = XLSX.read(buffer, { type: 'array' })
    setSlots(prev => ({
      ...prev,
      [slotKey]: emptySlot(handle, file.name, buffer, wb)
    }))
    setActiveSlot(slotKey)
  }

  // ──────────────────────────────────────────────
  // Abrir archivo para un slot específico
  // ──────────────────────────────────────────────
  const handleOpenFile = async (slotKey) => {
    setError('')
    if (!window.showOpenFilePicker) {
      setError('Tu navegador no soporta la File System Access API. Usa Chrome o Edge.')
      return
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Archivo Excel',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
        multiple: false
      })
      await loadIntoSlot(handle, slotKey)
      saveHandle(`slot-${slotKey}`, handle).catch(() => {})
      setSavedHandles(prev => ({ ...prev, [slotKey]: null }))
    } catch (err) {
      if (err.name !== 'AbortError') setError('Error al abrir el archivo: ' + err.message)
    }
  }

  // ──────────────────────────────────────────────
  // Reconectar desde handle guardado
  // ──────────────────────────────────────────────
  const handleReconnect = async (slotKey) => {
    const handle = savedHandles[slotKey]
    if (!handle) return
    setReconnecting(slotKey)
    setError('')
    try {
      const granted = await requestPermission(handle)
      if (!granted) {
        setError('Permiso denegado. Usa el botón "Abrir" para buscar el archivo manualmente.')
        setReconnecting(null)
        return
      }
      await loadIntoSlot(handle, slotKey)
      setSavedHandles(prev => ({ ...prev, [slotKey]: null }))
    } catch (err) {
      setError('No se pudo reconectar: ' + err.message)
    }
    setReconnecting(null)
  }

  // ──────────────────────────────────────────────
  // Cerrar un slot
  // ──────────────────────────────────────────────
  const handleCloseFile = (slotKey) => {
    setSlots(prev => ({ ...prev, [slotKey]: null }))
    clearHandle(`slot-${slotKey}`).catch(() => {})
    setSavedHandles(prev => ({ ...prev, [slotKey]: null }))
    if (activeSlot === slotKey) {
      // Pasar al primer slot que aún tenga archivo cargado
      const next = SLOT_KEYS.find(k => k !== slotKey && slots[k] !== null) ?? null
      setActiveSlot(next)
    }
  }

  // ── setSelectedSheet en el slot activo ──
  const setSelectedSheet = (name) => {
    if (!activeSlot) return
    setSlots(prev => ({ ...prev, [activeSlot]: { ...prev[activeSlot], selectedSheet: name } }))
  }

  // ──────────────────────────────────────────────
  // Edición de celdas
  // ──────────────────────────────────────────────
  const handleCellEdit = (rowIdx, colIdx, draft) => {
    if (!activeSlot) return
    const trimmed = typeof draft === 'string' ? draft.trim() : draft
    let value
    if (trimmed === '' || trimmed === null || trimmed === undefined) { value = '' }
    else { const n = Number(trimmed); value = isNaN(n) ? trimmed : n }
    setSlots(prev => {
      const s = prev[activeSlot]
      return { ...prev, [activeSlot]: { ...s,
        pendingEdits: { ...s.pendingEdits,
          [selectedSheet]: { ...(s.pendingEdits[selectedSheet] || {}), [`${rowIdx},${colIdx}`]: value }
        }
      }}
    })
  }

  // ──────────────────────────────────────────────
  // Inserción de filas
  // ──────────────────────────────────────────────
  const handleAddRow = (insertAfterRow, sectionKey) => {
    if (!activeSlot) return
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setSlots(prev => {
      const s = prev[activeSlot]
      return { ...prev, [activeSlot]: { ...s,
        pendingInsertions: { ...s.pendingInsertions,
          [selectedSheet]: [...(s.pendingInsertions[selectedSheet] || []), { id, insertAfterRow, cells: {}, sectionKey }]
        }
      }}
    })
  }

  const handleInsertedRowEdit = (id, colIdx, value) => {
    if (!activeSlot) return
    setSlots(prev => {
      const s = prev[activeSlot]
      return { ...prev, [activeSlot]: { ...s,
        pendingInsertions: { ...s.pendingInsertions,
          [selectedSheet]: (s.pendingInsertions[selectedSheet] || []).map(ins =>
            ins.id === id ? { ...ins, cells: { ...ins.cells, [colIdx]: value } } : ins
          )
        }
      }}
    })
  }

  const handleDeleteInsertedRow = (id) => {
    if (!activeSlot) return
    setSlots(prev => {
      const s = prev[activeSlot]
      return { ...prev, [activeSlot]: { ...s,
        pendingInsertions: { ...s.pendingInsertions,
          [selectedSheet]: (s.pendingInsertions[selectedSheet] || []).filter(ins => ins.id !== id)
        }
      }}
    })
  }

  // ──────────────────────────────────────────────
  // Guardar archivo
  // ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!fileHandle || !rawBuffer || !activeSlot) return
    setSaveStatus('saving')
    setError('')
    try {
      const buf = await patchXlsx(rawBuffer, pendingEdits, pendingInsertions)
      const writable = await fileHandle.createWritable()
      await writable.write(buf)
      await writable.close()
      const newWb = XLSX.read(buf, { type: 'array' })
      setSlots(prev => ({ ...prev, [activeSlot]: {
        ...prev[activeSlot], rawBuffer: buf, workbook: newWb,
        pendingEdits: {}, pendingInsertions: {}
      }}))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      setError('Error al guardar: ' + err.message)
      setSaveStatus('idle')
    }
  }

  const handleDiscard = () => {
    if (!activeSlot) return
    setSlots(prev => ({ ...prev, [activeSlot]: {
      ...prev[activeSlot], pendingEdits: {}, pendingInsertions: {}
    }}))
  }

  // ──────────────────────────────────────────────
  // Reembolsos
  // ──────────────────────────────────────────────
  const handleApplyReembolsos = (monthSheet, insertions) => {
    if (!activeSlot) return
    setSlots(prev => {
      const s = prev[activeSlot]
      return { ...prev, [activeSlot]: { ...s, selectedSheet: monthSheet,
        pendingInsertions: { ...s.pendingInsertions,
          [monthSheet]: [...(s.pendingInsertions[monthSheet] || []), ...insertions]
        }
      }}
    })
  }

  // ──────────────────────────────────────────────
  // Helpers UI
  // ──────────────────────────────────────────────
  const sheetExists = (name) => workbook?.SheetNames.includes(name) ?? false

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
    const monthTabs = visibleNames.filter(isMonthSheet).sort((a, b) => monthSheetIndex(a) - monthSheetIndex(b))
    const otherTabs = visibleNames.filter(s => !isMonthSheet(s))
    return [...monthTabs, ...otherTabs]
  }, [workbook])

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

          {/* Country tabs — uno por cada slot cargado */}
          {SLOT_KEYS.map(key => {
            const slot = slots[key]
            if (!slot) return null
            return (
              <div
                key={key}
                className={`country-tab ${activeSlot === key ? 'active' : ''}`}
                onClick={() => setActiveSlot(key)}
                title={slot.fileName}
              >
                <span className="country-tab-label">{SLOT_LABELS[key]}</span>
                <span className="country-tab-filename">{slot.fileName}</span>
                <button
                  className="btn-close-country"
                  onClick={e => { e.stopPropagation(); handleCloseFile(key) }}
                  title="Cerrar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}

          {/* Botones para slots sin archivo: reconectar si hay handle guardado, o abrir nuevo */}
          {SLOT_KEYS.map(key => {
            if (slots[key]) return null
            const saved = savedHandles[key]
            if (saved) {
              // Handle guardado disponible → mostrar botón de reconexión directa
              return (
                <div key={key} className="slot-reconnect-group">
                  <button
                    className="btn-toolbar btn-slot-reconnect"
                    onClick={() => handleReconnect(key)}
                    disabled={reconnecting === key}
                    title={`Reconectar: ${saved.name}`}
                  >
                    <span>⚡</span>
                    <span className="slot-reconnect-label">{SLOT_LABELS[key]}</span>
                    <span className="slot-reconnect-filename">{saved.name}</span>
                    {reconnecting === key && <span className="slot-reconnect-spinner">…</span>}
                  </button>
                  <button
                    className="btn-slot-open-other"
                    onClick={() => handleOpenFile(key)}
                    title="Abrir otro archivo"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </button>
                </div>
              )
            }
            // Sin handle guardado → botón simple para abrir archivo
            return (
              <button key={key} className="btn-toolbar btn-open" onClick={() => handleOpenFile(key)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {!hasAnyFile && key === 'colombia' ? 'Abrir Excel' : `+ ${SLOT_LABELS[key]}`}
              </button>
            )
          })}
        </div>

        {/* Botones de guardado */}
        {hasChanges && (
          <div className="toolbar-right">
            {totalEdits > 0 && (
              <span className="changes-badge">{totalEdits} cambio{totalEdits !== 1 ? 's' : ''}</span>
            )}
            {totalInsertions > 0 && (
              <span className="changes-badge changes-badge-new">{totalInsertions} fila{totalInsertions !== 1 ? 's' : ''} nueva{totalInsertions !== 1 ? 's' : ''}</span>
            )}
            <button className="btn-toolbar btn-discard" onClick={handleDiscard}>Descartar</button>
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
          <div className="toolbar-right"><span className="save-ok-badge">✓ Guardado</span></div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert alert-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Drop-zones duales (sin ningún archivo cargado) ── */}
      {!hasAnyFile && (
        <div className="dual-dropzone">
          {SLOT_KEYS.map(key => {
            const saved = savedHandles[key]
            return (
              <div
                key={key}
                className="dropzone-card"
                onClick={!saved ? () => handleOpenFile(key) : undefined}
                style={saved ? { cursor: 'default' } : {}}
              >
                <div className="dropzone-card-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                  </svg>
                </div>
                <span className="dropzone-card-label">{SLOT_LABELS[key]}</span>
                {saved ? (
                  <>
                    <span className="reconnect-filename">{saved.name}</span>
                    <button
                      className="btn-reconnect"
                      onClick={e => { e.stopPropagation(); handleReconnect(key) }}
                      disabled={reconnecting === key}
                    >
                      {reconnecting === key ? 'Conectando…' : '⚡ Reconectar'}
                    </button>
                    <button className="btn-reconnect-other" onClick={e => { e.stopPropagation(); handleOpenFile(key) }}>
                      Abrir otro
                    </button>
                  </>
                ) : (
                  <span className="dropzone-card-hint">Haz clic para buscar el archivo .xlsx</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Drop-zone adicional cuando ya hay UN archivo y el otro slot está vacío ── */}
      {hasAnyFile && !workbook && (
        <div className="empty-slot-hint">
          Selecciona una pestaña activa arriba o carga el otro archivo.
        </div>
      )}

      {/* ── Contenido del slot activo ── */}
      {workbook && (
        <>
          <div className="sheet-selector-bar">
            {displayTabs.map(name => {
              const exists  = sheetExists(name)
              const isMonth = isMonthSheet(name)
              return (
                <button
                  key={name}
                  className={['sheet-tab', selectedSheet === name ? 'active' : '', !exists ? 'unavailable' : '', !isMonth ? 'tab-special' : ''].filter(Boolean).join(' ')}
                  onClick={() => exists && setSelectedSheet(name)}
                  disabled={!exists}
                  title={!exists ? `${name} — sin datos` : name}
                >
                  {name}
                </button>
              )
            })}
            {!isGuatemalaFormat && (
              <button
                className={`sheet-tab tab-special tab-reembolsos ${selectedSheet === '__REEMBOLSOS__' ? 'active' : ''}`}
                onClick={() => setSelectedSheet('__REEMBOLSOS__')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '5px', verticalAlign: 'middle' }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Reembolsos
              </button>
            )}
          </div>

          {!isGuatemalaFormat && isMonthSheet(selectedSheet) && sheetExists(selectedSheet) && (
            <MonthViewer
              rows={sheetRows} sheetName={selectedSheet}
              edits={pendingEdits[selectedSheet] || {}}
              onCellEdit={handleCellEdit}
              insertions={pendingInsertions[selectedSheet] || []}
              onAddRow={handleAddRow}
              onInsertedRowEdit={handleInsertedRowEdit}
              onDeleteInsertedRow={handleDeleteInsertedRow}
            />
          )}

          {isGuatemalaFormat && isMonthSheet(selectedSheet) && sheetExists(selectedSheet) && (
            <MonthViewerGuatemala
              rows={sheetRows} sheetName={selectedSheet}
              currencyLabel={currencyLabel}
              edits={pendingEdits[selectedSheet] || {}}
              onCellEdit={handleCellEdit}
              insertions={pendingInsertions[selectedSheet] || []}
              onAddRow={handleAddRow}
              onInsertedRowEdit={handleInsertedRowEdit}
              onDeleteInsertedRow={handleDeleteInsertedRow}
            />
          )}

          {selectedSheet === '__REEMBOLSOS__' && !isGuatemalaFormat && (
            <ReembolsosPanel workbook={workbook} onApplyReembolsos={handleApplyReembolsos} />
          )}

          {!isMonthSheet(selectedSheet) && selectedSheet !== '__REEMBOLSOS__' && sheetExists(selectedSheet) && (
            <div className="coming-soon-panel">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p>La vista estructurada de <strong>DISTRIBUCIÓN</strong> estará disponible próximamente.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ExcelEditor
