import { useState } from 'react'
import './App.css'
import ExcelEditor from './components/ExcelEditor'

function App() {
  const [isHelpExpanded, setIsHelpExpanded] = useState(false)

  return (
    <div className="app">
      {/* Header Corporativo Solutions & Payroll */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-container">
              <div className="logo">
                <img 
                  src="/Logo syp.png" 
                  alt="Solutions & Payroll Logo" 
                  width="60" 
                  height="60"
                />
              </div>
              <div className="header-text">
                <h1>Solutions & Payroll</h1>
                <p className="subtitle">Editor de Flujo de Caja</p>
              </div>
            </div>
            <div className="welcome-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Bienvenido, Usuario</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="main-content">
        <div className="container">

          {/* Instrucciones colapsables */}
          <div className="help-section">
            <button
              className="help-toggle"
              onClick={() => setIsHelpExpanded(!isHelpExpanded)}
              aria-expanded={isHelpExpanded}
            >
              <div className="help-toggle-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>¿Cómo usar esta aplicación?</span>
              </div>
              <svg
                className={`chevron ${isHelpExpanded ? 'expanded' : ''}`}
                width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div className={`help-content ${isHelpExpanded ? 'expanded' : ''}`}>
              <ol className="help-list">
                <li>
                  <span className="step-number">1</span>
                  <div>
                    <strong>Abrir archivo</strong>
                    <p>Haz clic en "Abrir Excel" y selecciona el archivo .xlsx del Flujo de Caja desde tu computador.</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">2</span>
                  <div>
                    <strong>Seleccionar hoja</strong>
                    <p>Usa la barra de meses para navegar entre ENERO, FEBRERO, etc. Las hojas sin datos aparecen desactivadas.</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">3</span>
                  <div>
                    <strong>Explorar secciones</strong>
                    <p>Cada mes tiene dos secciones: la Sección Inicial (Bancos, Clientes, EOR) y Cuentas x Pagar con sus subcategorías.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* Editor principal */}
          <div className="card">
            <div className="card-header">
              <h2>Editor de Archivos Excel</h2>
              <p className="description">
                Abre, edita y guarda archivos .xlsx directamente en tu computador, sin subir nada a la nube.
              </p>
            </div>
            <div className="card-body card-body--full">
              <ExcelEditor />
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Solutions & Payroll. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
