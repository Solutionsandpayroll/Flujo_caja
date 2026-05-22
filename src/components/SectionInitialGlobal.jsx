import { useState } from 'react'
import { formatCOP } from '../utils/excelParser'
import EditableCell from './EditableCell'

const TABS = [
  { key: 'bancos',      label: 'Bancos' },
  { key: 'facturacion', label: 'Facturación Pendiente' }
]

const ESTADO_OPTIONS = ['Pagado', 'Sin Pagar']
const ESTADO_BADGE = {
  'pagado':    'badge badge-success',
  'sin pagar': 'badge badge-warning',
}

function SectionInitialGlobal({ data, sheetName, edits, onCellEdit, insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow }) {
  const [activeTab, setActiveTab]       = useState('bancos')
  const [filterEstado, setFilterEstado] = useState('')
  const [search, setSearch]             = useState('')

  const current = data[activeTab]

  const switchTab = (key) => {
    setActiveTab(key)
    setFilterEstado('')
    setSearch('')
  }

  const filteredRows = (current?.rows ?? []).filter(row => {
    const estado = String(edits[`${row._row},2`] ?? row.estado ?? '')
    const desc   = String(row.descripcion || '').toLowerCase()
    if (filterEstado && estado.toLowerCase() !== filterEstado.toLowerCase()) return false
    if (search && !desc.includes(search.toLowerCase())) return false
    return true
  })

  const tabInsertions = (insertions || []).filter(ins => ins.sectionKey === `initial:${activeTab}`)

  // Bancos muestra 3 columnas de valor; Facturación solo 1
  const isBancos = activeTab === 'bancos'

  return (
    <div className="viewer-section">
      <div className="viewer-section-header">
        <div>
          <h3 className="viewer-section-title">Sección Inicial</h3>
          <p className="viewer-section-sub">Ingresos y saldos · {sheetName}</p>
        </div>
      </div>

      <div className="subsection-tabs">
        {TABS.map(tab => {
          const group = data[tab.key]
          return (
            <button
              key={tab.key}
              className={`subsection-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => switchTab(tab.key)}
            >
              <span className="tab-label">{tab.label}</span>
              {group?.total !== null && group?.total !== undefined && (
                <span className="tab-total">{formatCOP(group.total)}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="filter-bar">
        <select
          className="filter-select"
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="filter-search-wrap">
          <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="filter-search"
            placeholder="Buscar en Descripción…"
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

      <div className="table-scroll-wrapper">
        <table className="viewer-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>Estado</th>
              <th>Descripción</th>
              <th className="col-right" style={{ width: '150px' }}>Valor (COP)</th>
              {isBancos && <th className="col-right" style={{ width: '150px' }}>Valor F</th>}
              {isBancos && <th className="col-right" style={{ width: '150px' }}>Valor G</th>}
              <th style={{ width: '32px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && tabInsertions.length === 0 ? (
              <tr>
                <td colSpan={isBancos ? 6 : 4} className="td-empty">Sin resultados para este filtro</td>
              </tr>
            ) : (
              filteredRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'tr-even' : ''}>
                  <EditableCell rowIdx={row._row} colIdx={2} raw={row.estado}      edits={edits} onCellEdit={onCellEdit} options={ESTADO_OPTIONS} badgeMap={ESTADO_BADGE} className="td-estado" />
                  <EditableCell rowIdx={row._row} colIdx={3} raw={row.descripcion} edits={edits} onCellEdit={onCellEdit} format="text" className="td-desc" />
                  <EditableCell rowIdx={row._row} colIdx={4} raw={row.valor}       edits={edits} onCellEdit={onCellEdit} format="cop"  className="col-right td-valor" />
                  {isBancos && <EditableCell rowIdx={row._row} colIdx={5} raw={row.valorF} edits={edits} onCellEdit={onCellEdit} format="cop" className="col-right td-valor" />}
                  {isBancos && <EditableCell rowIdx={row._row} colIdx={6} raw={row.valorG} edits={edits} onCellEdit={onCellEdit} format="cop" className="col-right td-valor" />}
                  <td className="td-action"></td>
                </tr>
              ))
            )}

            {tabInsertions.map(ins => (
              <tr key={ins.id} className="tr-new">
                <td className="td-new-cell">
                  <select
                    className="new-row-select"
                    value={ins.cells[2] ?? ''}
                    onChange={e => onInsertedRowEdit(ins.id, 2, e.target.value)}
                  >
                    <option value="">— Estado —</option>
                    {ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </td>
                <td className="td-new-cell">
                  <input
                    className="new-row-input"
                    type="text"
                    placeholder="Descripción"
                    value={ins.cells[3] ?? ''}
                    onChange={e => onInsertedRowEdit(ins.id, 3, e.target.value)}
                    autoFocus
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
                {isBancos && (
                  <td className="td-new-cell col-right">
                    <input
                      className="new-row-input"
                      type="number"
                      placeholder="0"
                      value={ins.cells[5] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 5, e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </td>
                )}
                {isBancos && (
                  <td className="td-new-cell col-right">
                    <input
                      className="new-row-input"
                      type="number"
                      placeholder="0"
                      value={ins.cells[6] ?? ''}
                      onChange={e => onInsertedRowEdit(ins.id, 6, e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </td>
                )}
                <td className="td-action">
                  <button
                    className="btn-del-new"
                    onClick={() => onDeleteInsertedRow(ins.id)}
                    title="Eliminar fila nueva"
                  >×</button>
                </td>
              </tr>
            ))}

            <tr className="tr-add-row">
              <td colSpan={isBancos ? 6 : 4}>
                <button
                  className="btn-add-row"
                  disabled={!current?.rows?.length}
                  title={!current?.rows?.length ? 'Esta sección no tiene filas aún' : ''}
                  onClick={() => {
                    const lastRow = current.rows[current.rows.length - 1]._row
                    onAddRow(lastRow, `initial:${activeTab}`)
                  }}
                >
                  + Agregar fila
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SectionInitialGlobal
