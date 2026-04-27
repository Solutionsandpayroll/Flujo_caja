import { useState, useEffect, useRef } from 'react'
import { formatCOP } from '../utils/excelParser'

/**
 * EditableCell
 * Celda de tabla editable inline.
 * - Sin options: clic → input de texto/número.
 * - Con options: clic → <select> dropdown; en display muestra un badge coloreado.
 *
 * Props:
 *   rowIdx    {number}   Índice de fila en el Excel (0-based).
 *   colIdx    {number}   Índice de columna.
 *   raw       {any}      Valor original del parser.
 *   edits     {object}   Ediciones pendientes { "row,col": value }.
 *   onCellEdit {fn}      (rowIdx, colIdx, value) → void.
 *   format    {string}   'text' | 'cop'.
 *   options   {string[]} Si se pasa, la celda usa <select> con estas opciones.
 *   badgeMap  {object}   { 'valor en lowercase': 'clase CSS badge' } para mostrar badge.
 *   className {string}   Clases extra para el <td>.
 */
function EditableCell({
  rowIdx, colIdx, raw, edits, onCellEdit,
  format = 'text', options = null, badgeMap = null, className = ''
}) {
  const cellKey    = `${rowIdx},${colIdx}`
  const currentVal = cellKey in edits ? edits[cellKey] : raw
  const isModified = cellKey in edits

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef  = useRef(null)
  const selectRef = useRef(null)

  useEffect(() => {
    if (editing) {
      if (options && selectRef.current) selectRef.current.focus()
      else if (inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
    }
  }, [editing, options])

  const startEdit = () => {
    setDraft(currentVal !== null && currentVal !== undefined ? String(currentVal) : '')
    setEditing(true)
  }

  const commit = (val) => {
    const v    = val !== undefined ? val : draft
    const prev = currentVal !== null && currentVal !== undefined ? String(currentVal) : ''
    if (v !== prev) onCellEdit(rowIdx, colIdx, v)
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  const displayVal = () => {
    if (currentVal === null || currentVal === undefined || currentVal === '') return ''
    if (format === 'cop') {
      const n = typeof currentVal === 'number' ? currentVal : parseFloat(currentVal)
      return isNaN(n) ? String(currentVal) : formatCOP(n)
    }
    return String(currentVal)
  }

  const badgeClass = badgeMap
    ? (badgeMap[String(currentVal || '').toLowerCase()] || 'badge badge-neutral')
    : null

  /* ── Modo edición: dropdown ── */
  if (editing && options) {
    return (
      <td className={`${className} cell-editing`}>
        <select
          ref={selectRef}
          className="cell-select"
          value={draft}
          onChange={e => commit(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); cancel() } }}
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>
    )
  }

  /* ── Modo edición: input libre ── */
  if (editing) {
    return (
      <td className={`${className} cell-editing`}>
        <input
          ref={inputRef}
          type={format === 'cop' ? 'number' : 'text'}
          step={format === 'cop' ? 'any' : undefined}
          className="cell-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
        />
      </td>
    )
  }

  /* ── Modo display ── */
  return (
    <td
      className={`${className} cell-editable${isModified ? ' cell-modified' : ''}`}
      onClick={startEdit}
      title="Clic para editar"
    >
      {badgeClass
        ? <span className={badgeClass}>{displayVal()}</span>
        : displayVal()
      }
    </td>
  )
}

export default EditableCell
