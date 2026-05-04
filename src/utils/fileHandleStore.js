/**
 * fileHandleStore.js
 *
 * Persiste un FileSystemFileHandle en IndexedDB para que la app
 * pueda reconectarse automáticamente al archivo sin que el usuario
 * tenga que buscarlo de nuevo cada vez.
 *
 * API pública:
 *   saveHandle(key, handle)   → guarda el handle
 *   loadHandle(key)           → devuelve el handle guardado o null
 *   clearHandle(key)          → elimina el handle guardado
 *   requestPermission(handle) → pide/verifica permiso de lectura y escritura
 */

const DB_NAME    = 'syp-flujo-caja'
const DB_VERSION = 1
const STORE_NAME = 'file-handles'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function saveHandle(key, handle) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(handle, key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

export async function loadHandle(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function clearHandle(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = e => reject(e.target.error)
  })
}

/**
 * Solicita permiso de lectura y escritura sobre el handle.
 * Devuelve true si el permiso fue concedido, false en caso contrario.
 */
export async function requestPermission(handle) {
  if (!handle) return false
  const opts = { mode: 'readwrite' }
  // Si ya tiene permiso no muestra ningún diálogo
  if ((await handle.queryPermission(opts)) === 'granted') return true
  // Si no, solicita al usuario (muestra un pequeño pop-up del navegador)
  return (await handle.requestPermission(opts)) === 'granted'
}
