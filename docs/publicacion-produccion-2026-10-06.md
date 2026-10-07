# Publicación en producción — 6 de octubre de 2026

## Origen y destino

- Destino: `claudentsuport942-hub/ClauDent`, rama `main`.
- Base de producción: `99dec98`.
- Desarrollo integrado: `devs2-0/ClauDent-v2`, hasta
  `c3b1a950cd98227ff572ac6ffb50fcf122c28062` (PR #29).
- Rama de publicación: `release/produccion-2026-10-06`.

La rama se creó desde producción y se fusionó desarrollo sin conflictos. Se
conservan los siete archivos exclusivos de producción: `public/manifest.json`,
`src/App.tsx`, `src/dawdawda` y las páginas antiguas `Bitacora`, `Login`, `Register`
y `ResetPassword` de `src/pages`. La entrada activa sigue siendo `src/app/App.tsx`.
No se sustituyen configuraciones de entorno, dependencias ni archivos de Firebase
o Vercel específicos del destino. Se incluyen los cambios de `firestore.rules`
descritos abajo. No se ejecutaron migraciones ni modificaciones de datos reales.

## Cambios incluidos

- **Caja:** filtros de fechas inclusivos y visibles, cortes sin duplicar IDs,
  detalle con scroll, paginación y salida en laptop/móvil; reportes financieros
  por rango, comparativas y gastos más claros; exportaciones del rango completo
  y distinción entre datos no disponibles y totales en cero.
- **Ventas:** mostrador sin paciente para productos, servicios y ventas mixtas,
  siempre con pago completo. Los abonos requieren paciente y el historial solo
  se crea cuando hay uno asociado.
- **Inventario:** diálogos con formulario desplazable, tablas con desplazamiento
  horizontal, alertas y distribución adaptadas a pantallas pequeñas.
- **Agenda y navegación:** ajustes del calendario y sus desplazamientos,
  referencias históricas de personal eliminado, validación de selecciones
  obsoletas y correcciones de menús y desplegables táctiles.
- **Pacientes:** formularios e historial, recuperación de borradores, distinción
  entre recordatorio e inactividad, referencias históricas y conservación de
  expedientes al eliminar el registro principal.
- **Servicios, usuarios y roles:** catálogo compartido de categorías, filtros y
  referencias históricas, renovación de roles temporales, permisos específicos
  de eliminación de personal y protecciones al eliminar accesos.
- **Documentación y pruebas:** incorpora las auditorías y las pruebas de cada
  fase. En la preparación de esta publicación solo se corrigieron finales de
  línea y una línea vacía final para que `git diff --check` pasara.

Las descripciones históricas de fases intermedias deben leerse junto con
[las correcciones finales](correcciones-finales-modulos.md), que recogen el
comportamiento definitivo. También se incluyen [la auditoría de caja](auditoria-caja.md),
[los ajustes de inventario](ajustes-responsive-inventario.md) y
[la venta de mostrador](venta-mostrador-sin-paciente.md).

## Validación de la combinación con producción

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Correcto; advertencias de Browserslist y tamaño del bundle. |
| ESLint de todos los archivos `.ts` y `.tsx` incluidos en el cambio | 0 errores y 10 advertencias de hooks/fast refresh. |
| `node scripts/verify-operational.mjs` | 22 pruebas correctas. |
| `node tests/business-providers.test.mjs` | 15 escenarios correctos. |
| `node --test tests/cash-reporting.test.mjs` | 13 pruebas correctas. |
| `node tests/cash-browser.test.mjs` | 21 escenarios correctos; incluye 1366×768, 1280×720, 1024×600 y 375×667. |
| `node tests/counter-sale-browser.test.mjs` | 11 escenarios correctos. |
| `node tests/direct-sale-discount.test.mjs` | Correcto. |
| `git diff --check production/main` | Correcto después de normalizar las líneas indicadas. |

El chequeo independiente de TypeScript conserva los dos errores de
`NavigatorUAData` y `Navigator.userAgentData` en `sessionService.ts:45,80`.
`tests/permissions.test.mjs` sigue fallando porque su fixture de servicios no
proporciona `configuredCategories`. Ambos problemas ya se reprodujeron en
desarrollo antes de esta integración; no se presentan como comprobaciones aprobadas.

Las pruebas utilizan datos aislados, sin cobros ni escrituras contra producción.
No verifican reglas ni concurrencia con un emulador de Firestore.

## Despliegue de reglas de Firestore

Se incluye la nueva lectura/escritura de `configuracionModulos/servicios`, su
lectura del catálogo de servicios desde configuración y los permisos específicos
para eliminar doctores y asistentes.

**El merge del PR y el despliegue web no publican estas reglas en Firebase.** Esta
publicación en GitHub no ejecuta un despliegue de reglas. Deben verificarse y
publicarse en el proyecto Firebase que realmente utiliza producción antes de
utilizar el catálogo compartido y los nuevos permisos de eliminación. El alias
local apunta a `claudent-v2`; por sí solo no confirma el proyecto del sitio de
producción. Los permisos nuevos deben asignarse expresamente a los roles que los
necesiten.
