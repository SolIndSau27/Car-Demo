# Fase 2 — arquitectura (pendiente de construir)

Objetivo: API pequeña en **PHP 8 + MySQL** que corra en hosting compartido de Hostinger (sin Node en servidor). El frontend sigue siendo estático (`dist/`) y habla con la API por `fetch` usando `VITE_API_URL`.

## Lo que ya quedó listo en el frontend

| Pieza | Hoy (fase 1) | Fase 2 |
| --- | --- | --- |
| `services/api.js` | inactivo si `VITE_API_URL` está vacío | `apiGet` / `apiPost` con cookies de sesión |
| `services/tracking.js` | consola + localStorage | además `POST clicks.php` vía `sendBeacon` |
| `services/storage.js` | garage en localStorage con forma `{ id, nombre, vehiculo, config, actualizado }` | misma forma contra `cars.php`; al iniciar sesión se suben los carros locales |
| Config del carro | JSON corto con versión de vehículo (`v`) | se guarda tal cual en `cars.config` (columna JSON) |
| Lista de compras | `configurator/shopping-list.js` | se manda como lead en `leads.php` |
| Vehículos | JSON importado en `app.js` | catálogo `vehicles/index.json` + selector; mismos archivos |

## Endpoints propuestos (`/api`)

| Método y ruta | Uso |
| --- | --- |
| `POST auth/login.php` (correo + enlace mágico) / `POST auth/google.php` (ID token) | sesión con cookie `HttpOnly` |
| `GET/POST/DELETE cars.php` | autos guardados del usuario (plan gratis: 1; Pro: varios) |
| `POST clicks.php` | conteo de clics de afiliado (`pieza`, `tienda`, `vehiculo`, sin datos personales) |
| `POST leads.php` | "Cotizar instalación": lista de compras + ciudad + contacto → talleres registrados de esa ciudad |
| `GET/POST shops.php` | registro y perfil de talleres (empezando por Chihuahua) |
| `POST maintenance.php` | Pro: kilometraje, recordatorios e historial de servicios |
| `GET export-pdf.php?car=` | Pro: ficha del carro en PDF |
| `admin/*.php` | panel simple para editar piezas, datos técnicos (incl. `verificado`) y links |

## Modelo de negocio en datos

- **Talleres:** `shops.plan` = `por_lead` | `suscripcion`. Cada lead enviado crea filas en `lead_deliveries` (cobro por lead) o cuenta contra la suscripción mensual.
- **Plan Pro:** `users.plan = 'pro'` con `pro_until`; el cobro mensual (Mercado Pago o Stripe) actualiza esa fecha por webhook.
- **Afiliados:** `affiliate_clicks` agrega por día/pieza/tienda para saber qué piezas convierten.

## Datos técnicos

Los JSON siguen siendo la fuente de verdad del frontend. El panel de admin edita tablas (`parts`, `tech_data`, `affiliate_products`) y un script `admin/export.php` regenera los JSON para el build, así el sitio sigue funcionando sin base de datos si la API falla.

## Seguridad

Consultas preparadas (PDO), CSRF token en formularios del admin, rate limit por IP en `clicks.php` y `leads.php`, y validación del `config` con el mismo esquema que `normalizeConfig()` del frontend.

Ver `api/schema.sql` para el esquema propuesto.
