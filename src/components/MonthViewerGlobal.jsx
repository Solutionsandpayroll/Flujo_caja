import { useMemo } from 'react'
import { parseMonthSheet } from '../utils/excelParser'
import SectionInitialGlobal from './SectionInitialGlobal'
import SectionCXP from './SectionCXP'

function MonthViewerGlobal({ rows, sheetName, edits, onCellEdit, insertions, onAddRow, onInsertedRowEdit, onDeleteInsertedRow }) {
  const parsed = useMemo(() => parseMonthSheet(rows), [rows])

  if (!parsed) {
    return <div className="empty-sheet">Esta hoja no tiene datos para mostrar.</div>
  }

  const { sectionInitial, sectionCXP } = parsed

  const hasInitial =
    sectionInitial &&
    (sectionInitial.bancos.rows.length > 0 ||
      sectionInitial.facturacion.rows.length > 0)

  const hasCXP = sectionCXP && sectionCXP.length > 0

  if (!hasInitial && !hasCXP) {
    return (
      <div className="empty-sheet">
        Esta hoja no tiene datos estructurados para mostrar.
      </div>
    )
  }

  return (
    <div className="month-viewer">
      {hasInitial && (
        <SectionInitialGlobal
          data={sectionInitial}
          sheetName={sheetName}
          edits={edits}
          onCellEdit={onCellEdit}
          insertions={insertions}
          onAddRow={onAddRow}
          onInsertedRowEdit={onInsertedRowEdit}
          onDeleteInsertedRow={onDeleteInsertedRow}
        />
      )}
      {hasCXP && (
        <SectionCXP
          subsections={sectionCXP}
          sheetName={sheetName}
          edits={edits}
          onCellEdit={onCellEdit}
          insertions={insertions}
          onAddRow={onAddRow}
          onInsertedRowEdit={onInsertedRowEdit}
          onDeleteInsertedRow={onDeleteInsertedRow}
        />
      )}
    </div>
  )
}

export default MonthViewerGlobal
