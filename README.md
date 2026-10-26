# KarDmo

Web app en español (México) para ver tu carro en 3D, abrirlo, despiezar el motor, personalizarlo y guardar tu versión. Primer vehículo: sedán mediano 2016 con motor 2.4L GDI (texto de compatibilidad: "Compatible con Hyundai Sonata 2016"). No se usan logos ni marcas en el modelo ni en la interfaz.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas de lógica y de integridad de datos
npm run build    # versión de producción en dist/ (se sube tal cual a Hostinger)
```

Los tags de afiliado van en `.env.local` (no se sube a git). `.env` trae valores de ejemplo:

```
VITE_ML_AFFILIATE_TAG=tu-tag-de-mercado-libre
VITE_AMAZON_TAG=tu-tag-20
VITE_API_URL=            # vacío en fase 1
```

## Qué hace (fase 1)

| Función | Dónde |
| --- | --- |
| Visor 3D con piso, sombras suaves, luz de estudio y cámara limitada (no baja del piso) | `src/scene/stage.js` |
| Hover resalta la pieza y muestra su nombre; clic/toque la activa | `src/scene/picking.js`, `highlight.js` |
| 4 puertas, cofre y cajuela con bisagra animada | `src/vehicle/openables.js` + `articulaciones` del JSON |
| Sacar motor, vista explosionada, rayos X | `src/engine/engine-controller.js` |
| 27 piezas del motor con ficha (qué es, cómo funciona, síntomas, mantenimiento, compra) | `src/data/parts/engine-2.4-gdi.json` |
| Configurador: color + acabado, rines paramétricos, llantas filtradas por rin con aviso de ±3%, fascia/fender/alerón, suspensión, mejoras | `src/configurator/`, `src/ui/configurator-panel.js` |
| Ficha "Lo que necesitas saber": especificación, relacionadas, fusible, recomendaciones, compra | `src/ui/know-card.js` + `fichas` del JSON |
| Guardar (localStorage), compartir por link, lista de compras | `src/services/` |

## Estructura

```
src/
  main.js, app.js       arranque y orquestación
  scene/                escena, luces, cámara, picking, resaltado, vuelo de cámara
  vehicle/              carro procedural, bisagras, rines/llantas, variantes de carrocería, fuente .glb
  engine/               motor procedural (27 piezas) y controlador (sacar/explosionar/rayos X)
  configurator/         estado (claves cortas para la URL), cálculo de llantas, lista de compras
  ui/                   layout, paneles, fichas, modales, estilos
  data/
    vehicles/sonata-2016.json
    parts/engine-2.4-gdi.json
    affiliates.json
  services/             storage, share-url, affiliates, tracking, api (fase 2)
tests/                  node --test (sin dependencias extra)
docs/FASE2.md           arquitectura de cuentas, talleres, plan Pro y admin
api/schema.sql          esquema MySQL propuesto para la fase 2
```

## Datos y verificación

Todo dato técnico vive en JSON y lleva `"verificado": false` hasta que lo valides. La interfaz muestra "Verifica en tu manual de propietario" junto a cada dato técnico. Los fusibles son **datos de ejemplo** (marcados `"ejemplo": true`) para mostrar la estructura.

Para validar un dato: corrígelo en el JSON y cambia `"verificado"` a `true`; la etiqueta "sin verificar" de la pestaña Datos cambia sola.

## Afiliados

- `src/data/affiliates.json`: por pieza, `productos: [{ tienda, titulo, url_base, tag_afiliado, precio_aprox_mxn }]`. Hoy `url_base` son búsquedas; cámbialas por productos específicos cuando los tengas. `{medida}` y `{diametro}` se sustituyen con la configuración del usuario.
- `buildAffiliateUrl(producto)` (en `src/services/affiliates.js`) es la única función que arma links: agrega el tag del producto o, si viene vacío, el del `.env`. El nombre del parámetro por tienda está en `affiliates.json > tiendas` (`tag` para Amazon; `matt_tool` para Mercado Libre: confírmalo en tu panel de afiliados de Mercado Libre).
- Cada clic pasa por `trackClick(pieza, tienda)` (`src/services/tracking.js`): en fase 1 queda en consola y en `localStorage['kardmo.clicks']`; si defines `VITE_API_URL`, también se manda a la API.
- Cada bloque de compra muestra: "Este link puede generarnos una comisión sin costo extra para ti".

## Agregar otro modelo de carro

1. Crea `src/data/vehicles/<modelo>.json` copiando el del Sonata (silueta, articulaciones, llantas, fichas…).
2. Crea o reutiliza un archivo de partes de motor en `src/data/parts/`.
3. Modelo 3D: ajusta la `silueta` (procedural) **o** pon `"modelo": { "tipo": "glb", "glb_url": "..." }` con un .glb con licencia cuyos nodos se llamen igual que los ids (`puerta_del_izq`, `cofre`, `cajuela`, `monoblock`, …). Ver `src/vehicle/model-source.js`.
4. En fase 1 el vehículo se importa en `src/app.js`; en fase 2 se elegirá desde un selector.
