# Memoria y Reglas del Proyecto — TusCauchos / LAMO C.A.

## 1. Identidad de Marca y Estética
- **Nombre comercial**: TusCauchos / LAMO C.A. (Autoperiquitos y Cauchos).
- **Logo oficial**: Formato tipográfico original con `.brand-lamo` (azul con relieve/sombra blanca) + `.brand-ca` (rojo deportivo) y el subtítulo `.brand-tag-css` (`AUTOPERIQUITOS Y CAUCHOS`). No sustituir por textos genéricos.
- **Paleta de colores**:
  - Fondo principal: `#0E1218` / `#12161C` / `#171C24`
  - Azul Eléctrico: `#2563EB` (hover: `#1D4ED8`)
  - Rojo Acento: `#D90429`
  - Verde Stock / Pulse: `#22C55E`
- **Tipografías**: `Chakra Petch` (títulos y acentos deportivos), `Inter` (cuerpo y datos de producto).

---

## 2. Experiencia de Usuario: Modo App Móvil (Tipo Cashea)

### Flujo Inicial (`body.app-wizard-mode`)
- Al cargar la página, el usuario entra directamente al **Modo App a pantalla completa** (`100dvh`).
- Se ocultan por completo la barra superior de búsqueda (`.topbar`), el menú móvil inferior (`.mobile-bottom-nav`) y la cuadrícula del catálogo (`.layout`).
- La pantalla está **estrictamente centrada** vertical y horizontalmente (`padding: 0 !important;`).
- Muestra únicamente:
  1. Logo centrado `LAMO C.A.` con `AUTOPERIQUITOS Y CAUCHOS`.
  2. Stepper visual `(1) ── (2) ── (3)`.
  3. El modal / tarjeta del paso activo:
     - **Paso 1 (¿Qué buscas?)**: Selección táctil de hasta 4 categorías (Cauchos, Rines, Baterías, Forros, etc.) con contador `(1/4)` + botón de acción + enlace de escape *"O explorar todo el catálogo directamente ›"*.
     - **Paso 2 (Tu Vehículo)**: Píldoras rápidas de marcas más comunes (*Chevrolet, Toyota, Ford, Chery, Fiat, Hyundai, Renault, Jeep*) + selectores desplegables Marca/Modelo + cajón alternativo por Rin (*R13* a *R18*).
     - **Paso 3 (Tus Medidas)**: Tarjetas con medidas compatibles de fábrica y alternativas calculadas dinámicamente desde `VEHICLE_DATABASE`.

### Transición a Modo Catálogo (`body:not(.app-wizard-mode)`)
- Al tocar una medida en el Paso 3 (o saltar el asistente):
  - El asistente se oculta y se activa el catálogo completo.
  - Se fija arriba la barra de vehículo: `🚗 [Marca Modelo] • Medida: [Medida]` con botón `[Cambiar Vehículo]`.
  - Se habilitan la barra de búsqueda superior y el menú móvil inferior.
  - Al hacer clic en `[Cambiar Vehículo]` o `Inicio` en el menú inferior, se reabre el asistente en pantalla completa.
  - **Sincronización Asíncrona**: Uso de flags `_dataReady` y `_pendingApplyFilters` en `app.js` para asegurar que al saltar directamente al catálogo antes de que termine el fetch de Google Sheets, los filtros se apliquen automáticamente en cuanto lleguen los datos, evitando pantallas en blanco o "stock 0".

---

## 3. Catálogo y Modal de Detalle de Producto

### Tarjetas de la Cuadrícula
- Mantener diseño limpio y uniforme: imagen, marca, modelo, medida, stock, precios (BCV y Divisas) y botón de apartar.
- **Sin párrafos extensos en la cuadrícula**: La descripción detallada de la marca se muestra al presionar la tarjeta para no sobrecargar el catálogo en móviles.
- Todas las tarjetas son interactivas (`cursor: pointer`) y abren el modal de detalle al hacer clic en cualquier parte excepto en el botón "Apartar".

### Modal de Detalle y Zoom (`#image-zoom-modal`)
- **Foto Principal**: Formato cuadrado destacado (`aspect-ratio: 1/1; width: 100%; object-fit: cover;`) con lupa interactiva al mover el cursor / tocar.
- **Cabecera Compacta (`.zoom-modal-header`)**:
  - Lado izquierdo: Marca (`.zoom-brand`), Título/Medida (`.zoom-title`).
  - Lado derecho: Badge de stock (`.zoom-stock`).
- **Caja de Fortalezas y Marca (`.zoom-modal-desc-box`)**:
  - Estilizada con borde izquierdo azul eléctrico, fondo traslúcido, icono de información y encabezado *"Sobre esta marca"*.
  - Contenido dinámico alimentado por `getBrandDescription(item)`.
- **Precios Unificados**: Presentación en una sola fila fluida: `Ref. BCV $XX.XX • Divisas: $YY.YY`.
- **Botón CTA**: Apartar por WhatsApp con mensaje preconfigurado.
- **Reset de Scroll**: Se restablece `scrollTop = 0` al abrir el modal para garantizar visualización superior limpia en móviles.

---

## 4. Sistema de Descripciones Contextuales (`BRAND_DESCRIPTIONS`)
- **Mapeo Sensible al Rin**: La función `getBrandDescription(item)` evalúa tanto la marca como el rin del producto (`minRim`, `maxRim`).
  - *Ejemplo*: `Duringon` en R13/R14 describe "construcción robusta para uso diario en turismo", mientras que en R15+ describe "patrón MT agresivo para 4x4".
  - *Ejemplo*: `Rapid`, `Wideway`, `Crossmaxx`, `Sportrak`, `Antares`, `Ilink` tienen descripciones diferenciadas según si son para autos compactos o camionetas/SUV.
- **Marcas Incorporadas**: Bridgestone, Firestone, Rapid, Mazzini, Antares, Ilink, Maxtrek, Gremax, Tourador, Vantage, Mirage, Qualid, Crossmaxx, Aplus, Compasal, Royal, Annaite, Sunwide, Wideway, Pneus, Sportrak, Pathranger, Ambertone, Dovroad, Everland, Fujisaki, Duraturn, Nereus, Duringon, etc.
- **Fallbacks Inteligentes**: Si un artículo no tiene marca mapeada directamente, se genera una descripción contextual basada en su categoría y terreno (*MT, AT, HT, Baterías, Rines, Forros*).

---

## 5. Manejo de Imágenes de Productos

### Estructura Universal de Carpetas — Cauchos
- Las fotos de cauchos se almacenan en `public/cauchos/` organizadas en **subcarpetas por rin** (`r13`, `r14`, `r15`, `r16`, `r17`, `r18`).
- Formato de nombre: `{ancho}.{perfil}r{rin}{marca}.jpg` (ej: `185.60r14aplus.jpg`, `195.60r15rapid.jpg`, `185.65r14crossmaxx.jpg`, `255.70r16crossmaxx.jpg`, `7.50r16crossmaxx.jpg`).
- Medidas offroad usan `x` minúscula: `31x10.50r15aplus.jpg`.
- **No** se guardan fotos en `public/products/`.

### Baterías, Forros y Rines
- Fotos de baterías en `public/baterias/` mapeadas mediante `BATERIAS_IMAGE_MAP`.
- Forros usan logo Zega (`/brands/zega.svg`) y filtro por palabras clave en `FORROS_VEHICLES`.
- Artículos que no son cauchos ni rines tienen `rim = 0` para no contaminar los filtros de Rin.

### Mapeo en Código (`CUSTOM_IMAGE_MAP`)
- Ubicado en `src/scripts/app.js`. Toda foto agregada se mapea allí directamente a las claves normalizadas del inventario.
- Uso exclusivo de fotos reales crudas sin filtros de IA.

---

## 6. Datos en Vivo y Normalización de Errores de Hoja
- Conexión dinámica con Google Sheets vía CSV (`GOOGLE_SHEETS_CSV_URL`).
- Precios calculados en Referencia BCV y Divisas.
- **Sanitización de Typos Conocidos**:
  - En `parseGoogleSheetsCSV`, se detectan y normalizan inconsistencias tipográficas de la hoja de cálculo (ej. fila 11 de `LISTA PRECIOS.xlsx` donde `175/70R15` fue tipiado en el bloque de Rin 13; el parser lo normaliza a `175/70R13` para asignarle su foto real y evitar que aparezca erróneamente en R15).
- Botones de "Apartar" generan un enlace directo a WhatsApp con el mensaje pre-llenado indicando producto, medida y precio.

---

## 7. Próximos Pasos
- Revisar con el usuario cualquier nuevo producto o medida que se incorpore a la hoja.
- Cargar nuevas fotos en `public/cauchos/` y vincularlas a `CUSTOM_IMAGE_MAP` según vayan llegando muestras de inventario.

---

## 8. 🔜 Plan Pendiente — Sistema de Tiendas Aliadas (Hacer Cita)

> **Estado**: Aprobado, pendiente de datos finales para implementar.

### Concepto
Modelo inspirado en Tire Rack / Discount Tire adaptado al mercado venezolano: **sin envío**, el cliente elige en qué punto afiliado le instalan el producto y agenda por WhatsApp.

### Flujo del usuario
```
[Btn "Hacer Cita"] → Modal de Tiendas Aliadas → Seleccionar tienda → WhatsApp con tienda incluida
```

### Tiendas aliadas confirmadas
- **Autoperiquitos y Cauchos LAMO** (sede principal) — *dirección pendiente*
- **Servicauchos Libertador** — *dirección pendiente*

### Cambios de diseño ya acordados
- Botón **"Apartar"** → renombrar a **"Hacer Cita"** en todo el sitio
- Modal nuevo `#tiendas-modal` con glassmorphism y tarjetas de radio-button por tienda
- Al confirmar, genera mensaje WhatsApp incluyendo: producto + precio + tienda elegida

### Datos aún pendientes (pedir al usuario)
1. Dirección, municipio/zona y horario de cada tienda
2. Número de WhatsApp de cada tienda (o si va todo al número central de LAMO C.A.)
3. Confirmar si el modal aplica a todos los productos o solo Cauchos + Rines

### Estructura técnica planificada
- Nueva constante `TIENDAS_ALIADAS` en `src/scripts/app.js`
- Cada entrada: `{ id, name, zone, address, hours, phone, categories[] }`
- Función `openTiendasModal({ item, waBaseText, priceMsg, category })` intercepta el click de "Hacer Cita"
- Filtro por `categories` según el tipo de producto seleccionado
- Mensaje WhatsApp final: _"Hola LAMO C.A., quiero hacer cita para instalar [producto] por [precio]. Tienda elegida: [Tienda] ([zona])."_

