# Preparar un modelo 3D (IA o comprado) para KarDmo

`prepare_model.py` convierte un `.glb` / `.obj` / `.ply` "crudo", por ejemplo el que genera **Hunyuan3D** o **TRELLIS** en ComfyUI, en un `.glb` listo para la app:

1. Une todas las mallas y lo **orienta**: eje largo en X, frente hacia +X (detecta el cofre porque es más bajo que la cajuela).
2. Lo **escala a las medidas reales** del JSON del vehículo (largo, ancho sin espejos, alto) y lo pone en el piso.
3. **Detecta los ejes** por las huellas de las llantas y **quita las ruedas** de la IA (la app usa sus rines paramétricos).
4. **Separa puertas, cofre y cajuela** con las líneas de corte de `silueta` del JSON.
5. Asigna materiales `pintura`, `vidrio` y `negro`. Si el modelo trae textura, guarda en el canal alfa una **máscara de pintura** para que el configurador pueda cambiar el color.
6. Reduce polígonos si pasan de `--max-faces` y exporta con los nodos nombrados como los ids de la app.

Escribe además un reporte `.reporte.json` con escala, ejes detectados, caras por pieza y avisos.

## Instalación

Con Python 3.13:

```bash
pip install bpy numpy
```

O con Blender instalado: `blender -b -P tools/prepare-model/prepare_model.py -- <opciones>`.

## Uso

```bash
python tools/prepare-model/prepare_model.py \
  --input referencias/sonata_ia.glb \
  --vehicle src/data/vehicles/sonata-2016.json \
  --output public/models/sonata-2016.glb
```

Opciones:

| Opción | Para qué |
| --- | --- |
| `--front +x` / `--front -x` | Si la detección automática del frente sale al revés |
| `--uniform` | Escala uniforme (conserva las proporciones de la IA en lugar de forzar ancho y alto) |
| `--keep-wheels` | No quitar las ruedas del modelo |
| `--max-faces 250000` | Límite de polígonos |

## Ver el resultado en la app

- Para probarlo sin tocar el JSON: copia el `.glb` a `public/models/` y abre `http://localhost:5173/?modelo=models/archivo.glb` con `npm run dev`.
- Para dejarlo fijo: en el JSON del vehículo pon `"modelo": { "tipo": "glb", "glb_url": "models/sonata-2016.glb" }`.

Con un `.glb`, la app agrega el interior, el compartimento del motor (con sus 28 piezas y guías), los rines paramétricos y el alerón. La fascia y las salpicaderas intercambiables solo existen en el modelo procedural.

Si los cortes de puertas o cofre no caen donde deben, ajusta la `silueta` con el **editor de vistas** y vuelve a correr el script.

## Prueba sin modelo de IA

`make-test-input.mjs` genera una malla "desordenada" (girada, a otra escala y con el frente al revés) a partir del carro procedural:

```bash
node tools/prepare-model/make-test-input.mjs prueba.obj
python tools/prepare-model/prepare_model.py --input prueba.obj --vehicle src/data/vehicles/sonata-2016.json --output public/models/sonata-prueba.glb
```
