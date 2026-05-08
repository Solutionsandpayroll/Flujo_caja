/**
 * MonthViewerGuatemala.jsx
 *
 * Visualizador de hoja mensual para el Libro Caja Guatemala.
 * Orquesta SectionInitialGuatemala + SectionCXPGuatemala.
 */

import { useMemo } from 'react'
import { parseMonthSheetGuatemala } from '../utils/guatemalaParser'
import SectionInitialGuatemala from './SectionInitialGuatemala'
import SectionCXPGuatemala from './SectionCXPGuatemala'

export default function MonthViewerGuatemala({
  rows, sheetName, edits, onCellEdit,
  insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow,
  currencyLabel = 'QTQ'
}) {
  const parsed = useMemo(() => parseMonthSheetGuatemala(rows), [rows])

  if (!parsed) {
    return (
      <div className="section-card">
        <p style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          No se pudo parsear la estructura de <strong>{sheetName}</strong>.
          Verifica que la hoja contenga la sección «CUENTAS X PAGAR MES».
        </p>
      </div>
    )
  }

  const { sectionInitial, sectionCXP } = parsed

  return (
    <div className="month-viewer">
      <SectionInitialGuatemala
        rows={sectionInitial}
        edits={edits}
        onCellEdit={onCellEdit}
        insertions={insertions}
        onAddRow={onAddRow}
        onInsertedRowEdit={onInsertedRowEdit}
        onDeleteInsertedRow={onDeleteInsertedRow}
        currencyLabel={currencyLabel}
      />
      <SectionCXPGuatemala
        sections={sectionCXP}
        edits={edits}
        onCellEdit={onCellEdit}
        insertions={insertions}
        onAddRow={onAddRow}
        onInsertedRowEdit={onInsertedRowEdit}
        onDeleteInsertedRow={onDeleteInsertedRow}
        currencyLabel={currencyLabel}
      />
    </div>
  )
}
