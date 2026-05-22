import { useState } from 'react'
import { formatCOP } from '../utils/excelParser'
import EditableCell from './EditableCell'

const ESTADO_OPTIONS_CXP = ['Cancelado', 'Pagar', 'Sin Pagar']
const ESTADO_BADGE_CXP = {
  'cancelado': 'badge badge-success',
  'sin pagar': 'badge badge-warning',
  'pagar':     'badge badge-action',
}

function EstadoBadge({ estado }) {
  if (!estado) return null
  const lower = estado.toLowerCase()
  const cls =
    lower === 'cancelado' || lower === 'pagado'
      ? 'badge badge-success'
      : 'badge badge-warning'
  return <span className={cls}>{estado}</span>
}

/**
 * SectionCXP
 * Muestra la sección "Cuentas x Pagar Mes" con un selector
 * de subsecciones en chips desplazables y la tabla de ítems.
 */
function SectionCXP({ subsections, sheetName, edits, onCellEdit, insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow }) {
  const [activeIdx, setActiveIdx]       = useState(0)
  const [filterEstado, setFilterEstado] = useState('')
  const [search, setSearch]             = useState('')

  const current = subsections[activeIdx] ?? null

  // Resetear filtros al cambiar subsección
  const switchSub = (idx) => {
    setActiveIdx(idx)
    setFilterEstado('')
    setSearch('')
  }

  const filteredRows = current ? current.rows.filter(row => {
    const estado = String((filterEstado ? edits[`${row._row},0`] ?? row.estado : row.estado) || '')
    const prov   = String(row.proveedor || '').toLowerCase()

    if (filterEstado && estado.toLowerCase() !== filterEstado.toLowerCase()) return false
    if (search && !prov.includes(search.toLowerCase())) return false
    return true
  }) : []

  // Filas nuevas pendientes de esta subsección
  const subInsertions = current
    ? (insertions || []).filter(ins => ins.sectionKey === `cxp:${current.title}`)
    : []

  return (
    <div className="viewer-section">
      {/* Encabezado */}
      <div className="viewer-section-header">
        <div>
          <h3 className="viewer-section-title">Cuentas x Pagar Mes</h3>
          <p className="viewer-section-sub">Pagos y obligaciones · {sheetName}</p>
        </div>
        {current && (
          <div className="section-total-badge">
            <span className="section-total-label">Total seleccionado</span>
            <span className="section-total-value">{formatCOP(current.total)}</span>
          </div>
        )}
      </div>

      {/* Dropdown de subsecciones */}
      <div className="cxp-dropdown-bar">
        <label className="cxp-dropdown-label" htmlFor="cxp-select">Subsección</label>
        <select
          id="cxp-select"
          className="cxp-dropdown"
          value={activeIdx}
          onChange={e => switchSub(Number(e.target.value))}
        >
          {subsections.map((sub, i) => (
            <option key={i} value={i}>
              {sub.title} — {formatCOP(sub.total)}
            </option>
          ))}
        </select>
      </div>

      {/* Barra de filtros */}
      {current && (
        <div className="filter-bar">
          <select
            className="filter-select"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADO_OPTIONS_CXP.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="filter-search-wrap">
            <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="filter-search"
              placeholder="Buscar en Proveedor / Concepto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="filter-clear" onClick={() => setSearch('')} title="Limpiar">×</button>
            )}
          </div>
          {(filterEstado || search) && (
            <span className="filter-count">{filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Tabla de ítems */}
      {current && (
        <div className="table-scroll-wrapper">
          <table className="viewer-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Estado</th>
                <th style={{ width: '50px' }} className="col-center">Sem.</th>
                <th style={{ width: '130px' }}>Factura</th>
                <th>Proveedor / Concepto</th>
                <th className="col-right" style={{ width: '160px' }}>Valor (COP)</th>
                <th style={{ width: '110px' }}>Vencimiento</th>
                <th style={{ width: '32px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && subInsertions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-empty">Sin resultados para este filtro</td>
                </tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'tr-even' : ''}>
                    <EditableCell rowIdx={row._row} colIdx={6} raw={row.estado}           edits={edits} onCellEdit={onCellEdit} options={ESTADO_OPTIONS_CXP} badgeMap={ESTADO_BADGE_CXP} />
                    <EditableCell rowIdx={row._row} colIdx={1} raw={row.semana}           edits={edits} onCellEdit={onCellEdit} format="text" className="col-center" />
                    <EditableCell rowIdx={row._row} colIdx={2} raw={row.factura}          edits={edits} onCellEdit={onCellEdit} format="text" className="td-factura" />
                    <EditableCell rowIdx={row._row} colIdx={3} raw={row.proveedor}        edits={edits} onCellEdit={onCellEdit} format="text" className="td-desc" />
                    <EditableCell rowIdx={row._row} colIdx={4} raw={row.valor}            edits={edits} onCellEdit={onCellEdit} format="cop"  className="col-right td-valor" />
                    <EditableCell rowIdx={row._row} colIdx={5} raw={row.fechaVencimiento} edits={edits} onCellEdit={onCellEdit} format="text" className="td-fecha" />
                    <td className="td-action"></td>
                  </tr>
                ))
              )}

              {/* Filas nuevas pendientes */}
              {subInsertions.map(ins => (
                <tr key={ins.id} className="tr-new">
                  <td className="td-new-cell">
                    <select
                      className="new-row-select"
                      value={ins.cells[6] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 6, e.target.value)}
                    >
                      <option value="">— Estado —</option>
                      {ESTADO_OPTIONS_CXP.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="td-new-cell col-center">
                    <input
                      className="new-row-input"
                      type="text"
                      placeholder="Sem."
                      value={ins.cells[1] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 1, e.target.value)}
                    />
                  </td>
                  <td className="td-new-cell">
                    <input
                      className="new-row-input"
                      type="text"
                      placeholder="Factura"
                      value={ins.cells[2] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 2, e.target.value)}
                      autoFocus
                    />
                  </td>
                  <td className="td-new-cell">
                    <input
                      className="new-row-input"
                      type="text"
                      placeholder="Proveedor / Concepto"
                      value={ins.cells[3] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 3, e.target.value)}
                    />
                  </td>
                  <td className="td-new-cell col-right">
                    <input
                      className="new-row-input"
                      type="number"
                      placeholder="0"
                      value={ins.cells[4] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 4, e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </td>
                  <td className="td-new-cell">
                    <input
                      className="new-row-input"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={ins.cells[5] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 5, e.target.value)}
                    />
                  </td>
                  <td className="td-action">
                    <button
                      className="btn-del-new"
                      onClick={() => onDeleteInsertedRow(ins.id)}
                      title="Eliminar fila nueva"
                    >×</button>
                  </td>
                </tr>
              ))}

              {/* Botón agregar fila */}
              <tr className="tr-add-row">
                <td colSpan={7}>
                  <button
                    className="btn-add-row"
                    disabled={!current || current.rows.length === 0}
                    title={!current || current.rows.length === 0 ? 'Esta subsección no tiene filas aún' : ''}
                    onClick={() => {
                      const lastRow = current.rows[current.rows.length - 1]._row
                      onAddRow(lastRow, `cxp:${current.title}`)
                    }}
                  >
                    + Agregar fila
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default SectionCXP
