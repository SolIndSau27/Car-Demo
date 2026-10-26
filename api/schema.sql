-- MiNave · esquema propuesto para la fase 2 (MySQL 8 / MariaDB 10.6, Hostinger).
-- Aún no se usa: el frontend de la fase 1 funciona sin backend.

CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,
  google_sub    VARCHAR(64) NULL UNIQUE,
  nombre        VARCHAR(120) NULL,
  ciudad        VARCHAR(80) NULL,
  plan          ENUM('gratis','pro') NOT NULL DEFAULT 'gratis',
  pro_until     DATE NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cars (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  vehiculo      VARCHAR(40) NOT NULL,          -- ej. 'sonata-2016'
  nombre        VARCHAR(40) NOT NULL,
  config        JSON NOT NULL,                 -- mismo JSON corto que la URL de compartir
  kilometraje   INT UNSIGNED NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE services_log (                    -- Pro: historial de servicios
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id        BIGINT UNSIGNED NOT NULL,
  fecha         DATE NOT NULL,
  kilometraje   INT UNSIGNED NOT NULL,
  descripcion   VARCHAR(255) NOT NULL,
  costo_mxn     DECIMAL(10,2) NULL,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

CREATE TABLE reminders (                       -- Pro: recordatorios por kilometraje
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id        BIGINT UNSIGNED NOT NULL,
  pieza         VARCHAR(60) NOT NULL,          -- id de pieza, ej. 'filtro_aceite'
  cada_km       INT UNSIGNED NOT NULL,
  ultimo_km     INT UNSIGNED NOT NULL,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

CREATE TABLE shops (                           -- talleres
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  ciudad        VARCHAR(80) NOT NULL,          -- empezamos con 'Chihuahua'
  telefono      VARCHAR(30) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  especialidades JSON NULL,
  plan          ENUM('por_lead','suscripcion') NOT NULL DEFAULT 'por_lead',
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  INDEX (ciudad, activo)
);

CREATE TABLE leads (                           -- "Cotizar instalación"
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NULL,
  ciudad        VARCHAR(80) NOT NULL,
  contacto      VARCHAR(190) NOT NULL,
  vehiculo      VARCHAR(40) NOT NULL,
  lista         JSON NOT NULL,                 -- salida de buildShoppingList()
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lead_deliveries (
  lead_id       BIGINT UNSIGNED NOT NULL,
  shop_id       BIGINT UNSIGNED NOT NULL,
  cobrado_mxn   DECIMAL(10,2) NULL,
  estado        ENUM('enviado','visto','cotizado','ganado','perdido') NOT NULL DEFAULT 'enviado',
  PRIMARY KEY (lead_id, shop_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE TABLE affiliate_clicks (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pieza         VARCHAR(60) NOT NULL,
  tienda        VARCHAR(30) NOT NULL,
  vehiculo      VARCHAR(40) NOT NULL,
  ts            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (pieza, tienda, ts)
);
