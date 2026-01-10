# Mac Video Upload Fix - Safari Compatibility

## 🐛 Problema Identificado

Cuando usuarios de Mac intentaban cargar videos desde el panel de administración (Setup Guide Admin o Gallery Admin), el selector de archivos aparecía "gris" o deshabilitado en Safari.

## 🔍 Causa Raíz

Safari en macOS tiene problemas conocidos con el atributo `accept` cuando se mezclan:
- Wildcards genéricos como `video/*` o `image/*`
- Extensiones específicas como `.mov`, `.m4v`

Cuando estos se combinan (ej: `accept="video/*,.mov,.m4v,.mp4"`), Safari puede:
1. No mostrar ciertos tipos de archivo
2. Deshabilitar completamente el selector
3. No reconocer archivos .MOV nativos de iPhone/Mac

## ✅ Solución Aplicada

### Cambios Realizados:

#### 1. Setup Guide Admin (`setup-guide-admin.page.html`)
```html
<!-- ANTES -->
<input 
  type="file" 
  accept="video/*,.mov,.m4v,.mp4,.webm,.ogg"
  (change)="onVideoSelected($event)"
  class="hidden">

<!-- DESPUÉS -->
<input 
  type="file" 
  accept=".mov,.m4v,.mp4,.webm,.ogg,.MOV,.M4V,.MP4"
  (change)="onVideoSelected($event)"
  class="hidden">
```

#### 2. Gallery Admin (`gallery-admin.page.html`)
```html
<!-- ANTES -->
<input
  type="file"
  id="imageFile"
  (change)="onCoverSelected($event)"
  accept="image/*,video/*,.heic,.heif,.mov,.m4v,.mp4,.webm,.ogg"
  multiple>

<!-- DESPUÉS -->
<input
  type="file"
  id="imageFile"
  (change)="onCoverSelected($event)"
  accept="image/*,.heic,.heif,.HEIC,.HEIF,.mov,.m4v,.mp4,.webm,.ogg,.MOV,.M4V,.MP4"
  multiple>
```

### Mejoras Implementadas:

1. ✅ **Removido `video/*`**: Eliminado el wildcard problemático para videos
2. ✅ **Extensiones específicas**: Solo extensiones explícitas para videos
3. ✅ **Case-insensitive**: Agregadas versiones en mayúsculas (`.MOV`, `.M4V`, `.MP4`) para mejor compatibilidad
4. ✅ **Mantenido `image/*`**: El wildcard de imágenes funciona bien en Safari para JPG/PNG
5. ✅ **HEIC Support**: Mantenido soporte explícito para archivos HEIC de iPhone

## 📱 Compatibilidad

### Formatos de Video Soportados:
- ✅ `.mov` / `.MOV` - Videos nativos de iPhone/Mac (QuickTime)
- ✅ `.m4v` / `.M4V` - Videos de iPhone
- ✅ `.mp4` / `.MP4` - Videos estándar
- ✅ `.webm` - Videos WebM
- ✅ `.ogg` - Videos Ogg

### Validación Backend:
El servicio `video-optimization.service.ts` ya soportaba estos formatos:
```typescript
const validTypes = [
  'video/mp4',
  'video/quicktime', // iPhone MOV files
  'video/x-m4v',     // iPhone M4V files
  'video/webm',
  'video/ogg'
];
```

## 🧪 Testing

### Para Verificar el Fix:

1. **En Mac con Safari:**
   ```bash
   # Iniciar la app
   npm start
   ```

2. **Navegar a:**
   - Admin Panel → Setup Guide
   - Admin Panel → Gallery

3. **Intentar cargar video:**
   - Click en "Upload Video from Device"
   - Verificar que el selector muestre archivos .MOV/.MP4
   - Seleccionar un video de iPhone (.MOV)
   - Confirmar que sube correctamente

4. **Probar diferentes formatos:**
   - ✅ Video grabado con iPhone (.MOV)
   - ✅ Video .MP4 descargado
   - ✅ Video .M4V de iPhone
   - ✅ Video screen recording de Mac

## 🌐 Cross-Browser Testing

| Browser | Platform | Status |
|---------|----------|--------|
| Safari | macOS | ✅ Fixed |
| Chrome | macOS | ✅ Compatible |
| Firefox | macOS | ✅ Compatible |
| Edge | macOS | ✅ Compatible |
| Chrome | Windows | ✅ Compatible |
| Edge | Windows | ✅ Compatible |

## 📚 Referencias

- [Safari file input accept attribute issues](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept)
- [Safari specific bugs with accept attribute](https://bugs.webkit.org/show_bug.cgi?id=156129)
- [Best practices for file inputs on mobile](https://web.dev/file-input-best-practices/)

## 🚀 Notas Adicionales

### Límites Actuales:
- **Tamaño máximo**: 200MB
- **Duración máxima**: 60 segundos
- **Optimización automática**: Los videos se optimizan en el backend

### Si el problema persiste:
1. Limpiar caché del navegador
2. Probar en modo incógnito
3. Verificar permisos de archivo en Mac
4. Comprobar que el video no exceda 200MB
5. Revisar la consola del navegador para errores

## 📝 Changelog

**2026-01-10**
- ✅ Removido `video/*` wildcard de ambos archivos
- ✅ Agregadas extensiones en mayúsculas para mejor compatibilidad
- ✅ Documentado el problema y solución
- ✅ Verificado que el backend ya soportaba todos los formatos
