/**
 * ExcelTable – tabla editable con inputs en cada celda.
 * La primera fila (índice 0) se trata como cabecera.
 *
 * Props:
 *   data          – 2D array completo (cabecera + filas de datos)
 *   onCellChange  – fn(rowIdx, colIdx, value)
 *   onDeleteRow   – fn(rowIdx) – rowIdx 0 = cabecera (no se puede borrar)
 */
function ExcelTable({ data, onCellChange, onDeleteRow }) {
  if (!data || data.length === 0) return null

  const [headerRow, ...bodyRows] = data

  return (
    <div className="table-wrapper">
      <table className="excel-table">
        <thead>
          <tr>
            {/* Columna de acciones vacía en cabecera */}
            <th className="col-actions" aria-label="Acciones" />

            {headerRow.map((cell, colIdx) => (
              <th key={colIdx}>
                <input
                  className="cell-input cell-header"
                  value={cell ?? ''}
                  onChange={e => onCellChange(0, colIdx, e.target.value)}
                  placeholder={`Col ${colIdx + 1}`}
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {bodyRows.map((row, relIdx) => {
            const absoluteRowIdx = relIdx + 1 // índice real en `data`

            return (
              <tr key={absoluteRowIdx} className="data-row">
                {/* Botón eliminar fila */}
                <td className="col-actions">
                  <button
                    className="btn-delete-row"
                    onClick={() => onDeleteRow(absoluteRowIdx)}
                    title="Eliminar fila"
                    aria-label="Eliminar fila"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </td>

                {headerRow.map((_, colIdx) => (
                  <td key={colIdx}>
                    <input
                      className="cell-input"
                      value={row[colIdx] ?? ''}
                      onChange={e => onCellChange(absoluteRowIdx, colIdx, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ExcelTable
