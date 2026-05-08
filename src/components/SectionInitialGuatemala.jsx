/**
 * SectionInitialGuatemala.jsx
 *
 * Sección Inicial del Libro Caja Guatemala.
 * Dos tabs: BANCOS (Descripción + QTQ + USD) y CLIENTES (Estado + Desc + QTQ + USD).
 */

import { useState } from 'react'
import EditableCell from './EditableCell'
import { GT_INIT_COL } from '../utils/guatemalaParser'

const ESTADO_OPTIONS = ['Pagado', 'Sin Pagar']
const ESTADO_BADGE   = { 'pagado': 'badge badge-success', 'sin pagar': 'badge badge-warning' }

export default function SectionInitialGuatemala({
  rows, edits, onCellEdit, insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow,
  currencyLabel = 'QTQ'
}) {
  const [activeTab,    setActiveTab]    = useState('bancos')
  const [filterEstado, setFilterEstado] = useState('')
  const [search,       setSearch]       = useState('')

  const { bancos, clientes } = rows

  const switchTab = (tab) => { setActiveTab(tab); setFilterEstado(''); setSearch('') }

  const filteredClientes = clientes.filter(item => {
    const estado = String(item.raw[GT_INIT_COL.estado] || '').toLowerCase()
    const desc   = String(item.raw[GT_INIT_COL.desc]   || '').toLowerCase()
    if (filterEstado && estado !== filterEstado.toLowerCase()) return false
    if (search && !desc.includes(search.toLowerCase())) return false
    return true
  })

  const bancosInsertions  = insertions.filter(ins => ins.sectionKey === 'gt:initial:bancos')
  const clientesInsertions = insertions.filter(ins => ins.sectionKey === 'gt:initial:clientes')
  const tabInsertions = activeTab === 'bancos' ? bancosInsertions : clientesInsertions
  const lastBancos   = bancos[bancos.length - 1]
  const lastClientes = clientes[clientes.length - 1]

  return (
    <div className="viewer-section">
      <div className="viewer-section-header">
        <div>
          <h3 className="viewer-section-title">Sección Inicial</h3>
        </div>
      </div>

      {/* Tabs BANCOS / CLIENTES */}
      <div className="subsection-tabs">
        {['bancos', 'clientes'].map(tab => (
          <button
            key={tab}
            className={`subsection-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => switchTab(tab)}
          >
            <span className="tab-label">{tab.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ─── BANCOS ─── */}
      {activeTab === 'bancos' && (
        <div className="table-scroll-wrapper">
          <table className="viewer-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="col-right">Valor {currencyLabel}</th>
                <th className="col-right">Valor USD</th>
              </tr>
            </thead>
            <tbody>
              {bancos.length === 0 && bancosInsertions.length === 0 ? (
                <tr><td colSpan={3} className="empty-state">Sin datos de BANCOS</td></tr>
              ) : (
                <>
                  {bancos.map(item => (
                    <tr key={item._row}>
                      <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.desc} raw={item.raw[GT_INIT_COL.desc]} edits={edits} onCellEdit={onCellEdit} />
                      <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.qtq} raw={item.raw[GT_INIT_COL.qtq]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                      <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.usd} raw={item.raw[GT_INIT_COL.usd]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                    </tr>
                  ))}

                  {/* Filas nuevas pendientes BANCOS */}
                  {bancosInsertions.map(ins => (
                    <tr key={ins.id} className="tr-new">
                      <td className="td-new-cell">
                        <input className="new-row-input" autoFocus placeholder="Descripción" value={ins.cells[GT_INIT_COL.desc] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.desc, e.target.value)} />
                      </td>
                      <td className="td-new-cell">
                        <input className="new-row-input" type="number" placeholder="0" value={ins.cells[GT_INIT_COL.qtq] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.qtq, Number(e.target.value))} style={{ textAlign: 'right' }} />
                      </td>
                      <td className="td-new-cell">
                        <input className="new-row-input" type="number" placeholder="0" value={ins.cells[GT_INIT_COL.usd] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.usd, Number(e.target.value))} style={{ textAlign: 'right' }} />
                      </td>
                      <td className="td-action">
                        <button className="btn-del-new" onClick={() => onDeleteInsertedRow(ins.id)}>×</button>
                      </td>
                    </tr>
                  ))}

                  {lastBancos && (
                    <tr className="tr-add-row">
                      <td colSpan={3}>
                        <button className="btn-add-row" onClick={() => onAddRow(lastBancos._row, 'gt:initial:bancos')}>+ Agregar fila</button>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── CLIENTES ─── */}
      {activeTab === 'clientes' && (
        <>
          <div className="filter-bar">
            <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <div className="filter-search-wrap">
              <svg className="filter-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="filter-search" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="filter-clear" onClick={() => setSearch('')}>×</button>}
            </div>
            {(filterEstado || search) && (
              <span className="filter-count">{filteredClientes.length} resultado{filteredClientes.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="table-scroll-wrapper">
            <table className="viewer-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Descripción</th>
                  <th className="col-right">Valor {currencyLabel}</th>
                  <th className="col-right">Valor USD</th>
                  <th style={{ width: '32px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredClientes.length === 0 && tabInsertions.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">Sin resultados</td></tr>
                ) : (
                  <>
                    {filteredClientes.map(item => (
                      <tr key={item._row}>
                        <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.estado} raw={item.raw[GT_INIT_COL.estado]} edits={edits} onCellEdit={onCellEdit} options={ESTADO_OPTIONS} badgeMap={ESTADO_BADGE} />
                        <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.desc} raw={item.raw[GT_INIT_COL.desc]} edits={edits} onCellEdit={onCellEdit} />
                        <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.qtq} raw={item.raw[GT_INIT_COL.qtq]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                        <EditableCell rowIdx={item._row} colIdx={GT_INIT_COL.usd} raw={item.raw[GT_INIT_COL.usd]} edits={edits} onCellEdit={onCellEdit} format="number" className="col-right" />
                        <td style={{ width: '32px' }}></td>
                      </tr>
                    ))}

                    {/* Filas nuevas pendientes */}
                    {tabInsertions.map(ins => (
                      <tr key={ins.id} className="tr-new">
                        <td className="td-new-cell">
                          <select className="new-row-select" value={ins.cells[GT_INIT_COL.estado] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.estado, e.target.value)}>
                            <option value="">-- Estado --</option>
                            {ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="td-new-cell">
                          <input className="new-row-input" autoFocus placeholder="Descripción" value={ins.cells[GT_INIT_COL.desc] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.desc, e.target.value)} />
                        </td>
                        <td className="td-new-cell">
                          <input className="new-row-input" type="number" placeholder="0" value={ins.cells[GT_INIT_COL.qtq] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.qtq, Number(e.target.value))} style={{ textAlign: 'right' }} />
                        </td>
                        <td className="td-new-cell">
                          <input className="new-row-input" type="number" placeholder="0" value={ins.cells[GT_INIT_COL.usd] || ''} onChange={e => onInsertedRowEdit(ins.id, GT_INIT_COL.usd, Number(e.target.value))} style={{ textAlign: 'right' }} />
                        </td>
                        <td className="td-action">
                          <button className="btn-del-new" onClick={() => onDeleteInsertedRow(ins.id)}>×</button>
                        </td>
                      </tr>
                    ))}

                    {clientes.length > 0 && (
                      <tr className="tr-add-row">
                        <td colSpan={5}>
                          <button className="btn-add-row" onClick={() => onAddRow(lastClientes._row, 'gt:initial:clientes')}>
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
        </>
      )}
    </div>
  )
}
