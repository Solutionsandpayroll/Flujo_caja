# 🎨 Solutions & Payroll - React Template

Template base reutilizable para proyectos React con el diseño corporativo de Solutions & Payroll.

## ✨ Características Incluidas

- ✅ **Header corporativo** con logo y bienvenida
- ✅ **Diseño profesional** con colores y estilos de S&P
- ✅ **Sección de ayuda colapsable** (opcional)
- ✅ **Sistema de cards** con animaciones suaves
- ✅ **Footer** corporativo
- ✅ **100% responsive** para móviles y desktop
- ✅ **Animaciones** de entrada elegantes
- ✅ **Variables CSS** fáciles de personalizar

## 🚀 Cómo Usar Este Template

### Opción 1: Copiar para Nuevo Proyecto

```bash
# 1. Copiar la carpeta completa
cp -r syp-react-template mi-nuevo-proyecto

# 2. Entrar al nuevo proyecto
cd mi-nuevo-proyecto

# 3. Instalar dependencias
npm install

# 4. Iniciar desarrollo
npm run dev
```

### Opción 2: Clonar y Modificar

```bash
# 1. Copiar todo el contenido
Copy-Item -Path "syp-react-template" -Destination "nuevo-proyecto" -Recurse

# 2. Cambiar nombre en package.json
# Edita la línea: "name": "tu-nombre-proyecto"

# 3. Instalar y ejecutar
cd nuevo-proyecto
npm install
npm run dev
```

## 📝 Estructura del Template

```
syp-react-template/
├── public/
│   └── Logo syp.png          # Logo corporativo S&P
├── src/
│   ├── App.jsx               # Componente principal (limpio)
│   ├── App.css               # Estilos completos
│   ├── index.css             # Estilos globales
│   └── main.jsx              # Entry point
├── index.html                # HTML base con favicon
├── package.json              # Dependencias mínimas
└── vite.config.js            # Configuración Vite
```

## 🎯 Personalización Rápida

### 1. Cambiar Título de la App

Edita `src/App.jsx` línea ~20:
```jsx
<p className="subtitle">Tu Nuevo Título</p>
```

### 2. Modificar Mensaje de Bienvenida

Edita `src/App.jsx` línea ~30:
```jsx
<span>Bienvenido, Tu Usuario</span>
```

### 3. Personalizar Colores

Edita `src/App.css`, variables CSS al inicio:
```css
:root {
  --primary: #2563eb;        /* Azul principal */
  --primary-dark: #1e40af;   /* Azul oscuro */
  /* ... más colores */
}
```

### 4. Agregar tu Lógica

En `src/App.jsx`, dentro del `<div className="card-body">`:
- Agrega tus estados con `useState`
- Crea tus funciones
- Añade tus componentes de formulario

## 📦 Agregar Dependencias

Según lo que necesites para tu proyecto:

```bash
# Para procesar archivos Excel
npm install xlsx exceljs file-saver

# Para formularios
npm install react-hook-form

# Para hacer requests
npm install axios

# Para routing
npm install react-router-dom

# etc...
```

## 🎨 Componentes Disponibles

### Sección de Ayuda Colapsable

Si no la necesitas, puedes eliminar todo el bloque:
```jsx
<div className="help-section">
  {/* ... */}
</div>
```

### Form Groups

```jsx
<div className="form-group">
  <label className="label">
    {/* Icono SVG */}
    Tu Label
  </label>
  <input className="select-input" />
</div>
```

### Botones

```jsx
<button className="btn-primary">
  {/* Icono SVG */}
  Texto del Botón
</button>
```

## 🌈 Estilos Predefinidos

Clases disponibles en `App.css`:
- `.card` - Contenedor con sombra
- `.form-section` - Espaciado de formularios
- `.form-group` - Grupo de campo
- `.label` - Label con icono
- `.select-input` - Input/Select estilizado
- `.btn-primary` - Botón principal
- `.btn-remove` - Botón eliminar
- `.drop-zone` - Zona drag & drop
- `.modal-overlay` - Overlay de modal
- `.help-section` - Sección colapsable

## 💡 Tips

1. **Mantén limpio el App.jsx** - Crea componentes separados si crece mucho
2. **Usa las variables CSS** - No modifiques los colores directamente
3. **Los SVG están inline** - Puedes cambiarlos fácilmente o usar íconos de librerías
4. **Las animaciones ya están configuradas** - Se activarán automáticamente

## 📚 Recursos

- [Documentación React](https://react.dev/)
- [Documentación Vite](https://vitejs.dev/)
- [Iconos SVG](https://feathericons.com/)
- [Colores](https://tailwindcss.com/docs/customizing-colors)

## 🔒 No Subir a Git

Si inicias Git en tu nuevo proyecto, asegúrate de tener `.gitignore`:
```
node_modules
dist
.env
```

## 📄 Licencia

© 2026 Solutions & Payroll. Template de uso interno.

---

**¡Listo para crear tu próximo proyecto!** 🚀
