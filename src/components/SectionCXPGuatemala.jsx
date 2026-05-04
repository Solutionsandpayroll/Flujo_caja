/**
 * SectionCXPGuatemala.jsx
 *
 * Cuentas x Pagar del Libro Caja Guatemala.
 * Columnas: Ref./Banco | Proveedor | Valor QTQ | Valor USD | Vencimiento | Estado
 * Las columnas KPI (H, I, J) están ocultas en la UI pero se propagan
 * como fórmulas automáticamente al insertar filas (xlsxPatcher).
 */

import { useState } from 'react'
import EditableCell from './EditableCell'
import { GT_CXP_COL } from '../utils/guatemalaParser'

const ESTADO_OPTIONS = ['Cancelado', 'Pagar', 'Sin Pagar']
const ESTADO_BADGE   = {
  'cancelado':  'badge badge-success',
  'pagar':      'badge badge-error',
  'sin pagar':  'badge badge-warning',
}

export default function SectionCXPGuatemala({
  sections, edits, onCellEdit, insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow
}) {
  const [activeIdx,    setActiveIdx]    = useState(0)
  const [filterEstado, setFilterEstado] = useState('')
  const [search,       setSearch]       = useState('')

  if (!sections || sections.length === 0) {
    return (
      <div className="section-card">
        <p style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Sin datos de Cuentas x Pagar</p>
      </div>
    )
  }

  const safeIdx = Math.min(activeIdx, sections.length - 1)
  const current = sections[safeIdx]

  const switchSub = (idx) => { setActiveIdx(idx); setFilterEstado(''); setSearch('') }

  const filteredRows = current.rows.filter(item => {
    const estado = String(item.raw[GT_CXP_COL.estado] || '').toLowerCase()
    const prov   = String(item.raw[GT_CXP_COL.prov]   || '').toLowerCase()
    const ref    = String(item.raw[GT_CXP_COL.ref]     || '').toLowerCase()
    if (filterEstado && estado !== filterEstado.toLowerCase()) return false
    if (search && !prov.includes(search.toLowerCase()) && !ref.includes(search.toLowerCase())) return false
    return true
  })

  const subInsertions = insertions.filter(ins => ins.sectionKey === `gt:cxp:${current.title}`)
  const lastRow       = current.rows[current.rows.length - 1]
  const refLabel      = current.isNominas ? 'Banco' : 'Factura'

  return (
    <div className="viewer-section">
      {/* Encabezado */}
      <div className="viewer-section-header">
        <div>
          <h3 className="viewer-section-title">Cuentas × Pagar</h3>
        </div>
      </div>

      {/* Dropdown de subsecciones */}
      <div className="cxp-dropdown-bar">
        <label className="cxp-dropdown-label" htmlFor="gt-cxp-select">Subsección</label>
        <select
          id="gt-cxp-select"
          className="cxp-dropdown"
          value={safeIdx}
          onChange={e => switchSub(Number(e.target.value))}
        >
          {sections.map((s, i) => (
            <option key={i} value={i}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* ─── Barra de filtros ─── */}
      <div className="filter-bar">
        <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="filter-search-wrap">
          <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="filter-search"
            placeholder="Buscar proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="filter-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        {(filterEstado || search) && (
          <span className="filter-count">{filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ─── Tabla ─── */}
      <div className="table-scroll-wrapper">
        <table className="viewer-table">
          <thead>
            <tr>
              <th>{refLabel}</th>
              <th>Proveedor</th>
              <th className="col-right">Valor QTQ</th>
              <th className="col-right">Valor USD</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th style={{ width: '32px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && subInsertions.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">Sin registros en esta subsección</td></tr>
            ) : (
              <>
                {filteredRows.map(item => (
                  <tr key={item._row}>
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.ref} raw={item.raw[GT_CXP_COL.ref]} edits={edits} onCellEdit={onCellEdit} />
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.prov} raw={item.raw[GT_CXP_COL.prov]} edits={edits} onCellEdit={onCellEdit} />
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.qtq} raw={item.raw[GT_CXP_COL.qtq]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.usd} raw={item.raw[GT_CXP_COL.usd]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.fecha} raw={item.fecha} edits={edits} onCellEdit={onCellEdit} />
                    <EditableCell rowIdx={item._row} colIdx={GT_CXP_COL.estado} raw={item.raw[GT_CXP_COL.estado]} edits={edits} onCellEdit={onCellEdit} options={ESTADO_OPTIONS} badgeMap={ESTADO_BADGE} />
                    <td style={{ width: '32px' }}></td>
                  </tr>
                ))}

                {/* Filas nuevas pendientes */}
                {subInsertions.map(ins => (
                  <tr key={ins.id} className="tr-new">
                    <td className="td-new-cell">
                      <input
                        className="new-row-input"
                        placeholder={refLabel}
                        value={ins.cells[GT_CXP_COL.ref] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.ref, e.target.value)}
                      />
                    </td>
                    <td className="td-new-cell">
                      <input
                        className="new-row-input"
                        autoFocus
                        placeholder="Proveedor"
                        value={ins.cells[GT_CXP_COL.prov] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.prov, e.target.value)}
                      />
                    </td>
                    <td className="td-new-cell">
                      <input
                        className="new-row-input"
                        type="number"
                        placeholder="0"
                        value={ins.cells[GT_CXP_COL.qtq] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.qtq, Number(e.target.value))}
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                    <td className="td-new-cell">
                      <input
                        className="new-row-input"
                        type="number"
                        placeholder="0"
                        value={ins.cells[GT_CXP_COL.usd] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.usd, Number(e.target.value))}
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                    <td className="td-new-cell">
                      <input
                        className="new-row-input"
                        placeholder="dd/mm/yyyy"
                        value={ins.cells[GT_CXP_COL.fecha] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.fecha, e.target.value)}
                      />
                    </td>
                    <td className="td-new-cell">
                      <select
                        className="new-row-select"
                        value={ins.cells[GT_CXP_COL.estado] || ''}
                        onChange={e => onInsertedRowEdit(ins.id, GT_CXP_COL.estado, e.target.value)}
                      >
                        <option value="">-- Estado --</option>
                        {ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="td-action">
                      <button className="btn-del-new" onClick={() => onDeleteInsertedRow(ins.id)}>×</button>
                    </td>
                  </tr>
                ))}

                {/* Botón agregar fila (solo si hay filas existentes para copiar fórmulas) */}
                {lastRow && (
                  <tr className="tr-add-row">
                    <td colSpan={7}>
                      <button
                        className="btn-add-row"
                        onClick={() => onAddRow(lastRow._row, `gt:cxp:${current.title}`)}
                      >
                        + Agregar fila
                      </button>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
