# 📖 EJEMPLO DE USO

## Cómo agregar funcionalidad al template

Ejemplo: Crear un contador simple

### 1. Agrega el estado en App.jsx

```jsx
import { useState } from 'react'
import './App.css'

function App() {
  const [isHelpExpanded, setIsHelpExpanded] = useState(false)
  
  // ⭐ NUEVA LÍNEA: Agregar estado para tu funcionalidad
  const [contador, setContador] = useState(0)

  return (
    // ... resto del código
  )
}
```

### 2. Modifica el contenido del card-body

```jsx
<div className="card-body">
  <div className="form-section">
    
    {/* ⭐ NUEVO CONTENIDO */}
    <div className="form-group">
      <h3>Contador: {contador}</h3>
    </div>

    <div className="form-group" style={{display: 'flex', gap: '1rem'}}>
      <button 
        className="btn-primary"
        onClick={() => setContador(contador + 1)}
      >
        Incrementar
      </button>
      
      <button 
        className="btn-primary"
        onClick={() => setContador(contador - 1)}
      >
        Decrementar
      </button>
    </div>

  </div>
</div>
```

### 3. Guarda y listo! 

El diseño corporativo ya está aplicado. Solo agregaste la lógica.

---

## Otro Ejemplo: Formulario de Contacto

### 1. Estados

```jsx
const [nombre, setNombre] = useState('')
const [email, setEmail] = useState('')
const [mensaje, setMensaje] = useState('')
```

### 2. Función

```jsx
const enviarFormulario = () => {
  console.log({nombre, email, mensaje})
  alert('Formulario enviado!')
  // Aquí harías tu lógica real (API call, etc.)
}
```

### 3. JSX

```jsx
<div className="form-section">
  <div className="form-group">
    <label className="label">Nombre</label>
    <input
      type="text"
      value={nombre}
      onChange={(e) => setNombre(e.target.value)}
      className="select-input"
      placeholder="Tu nombre"
    />
  </div>

  <div className="form-group">
    <label className="label">Email</label>
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="select-input"
      placeholder="tu@email.com"
    />
  </div>

  <div className="form-group">
    <label className="label">Mensaje</label>
    <textarea
      value={mensaje}
      onChange={(e) => setMensaje(e.target.value)}
      className="select-input"
      placeholder="Tu mensaje"
      rows="4"
    />
  </div>

  <button 
    className="btn-primary"
    onClick={enviarFormulario}
  >
    Enviar
  </button>
</div>
```

---

## 💡 Tips

- **Clases ya disponibles**: `.form-group`, `.label`, `.select-input`, `.btn-primary`
- **No necesitas crear CSS nuevo** para componentes básicos
- **Enfócate en la lógica**, el diseño ya está hecho
- **Agrega librerías según necesites**: `npm install lodash`, `npm install axios`, etc.

## 🎨 Si necesitas estilos custom

Agrégalos al final de `App.css`:

```css
/* Mis estilos custom */
.mi-clase-especial {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 12px;
}
```

---

**¡El template te ahorra todo el trabajo de diseño!** 🚀
Solo programas tu funcionalidad específica.
