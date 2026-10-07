# Ajustes responsive pendientes de inventario

Fecha: 2026-10-06.

## Alcance

Se incorporan los cambios que quedaban sin publicar en
`src/modules/inventario/pages/InventarioPage.tsx`, sobre la versión de `main`
`dc05ac966f2a8ece1ff2ae0b944a984caacd6f1e`.

La auditoría y las correcciones de caja ya fueron integradas en el
[PR #22](https://github.com/devs2-0/ClauDent-v2/pull/22).

## Cambios

- Los diálogos de producto, categoría, reabastecimiento por lote y ajuste de
  inventario limitan su altura al viewport. El formulario tiene desplazamiento
  vertical propio y la cabecera y los botones quedan fuera del área desplazable.
- Las tablas de reabastecimiento, categorías y movimientos utilizan el componente
  existente `InventoryTable`, con controles de desplazamiento horizontal y un
  ancho mínimo que conserva legibles las columnas.
- La tabla del lote de reabastecimiento conserva un ancho mínimo de 640 px dentro
  de un contenedor desplazable.
- Las acciones de la cabecera pueden distribuirse en varias filas; los indicadores
  usan dos columnas desde el tamaño `sm` y las pestañas se apilan en pantallas de
  menos de 420 px.
- El panel de alertas ajusta su ancho a la pantalla, con un máximo de 420 px.
  La integración conserva el recorte y el desplazamiento táctil incorporados en
  `main`, así como el selector modal de productos para reabastecer.

No se modifican cálculos, permisos, operaciones de stock ni persistencia de datos.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run build` | Correcto; advertencias sobre Browserslist y tamaño del bundle. |
| `npx eslint src/modules/inventario/pages/InventarioPage.tsx` | Correcto. |
| `node tests/business-providers.test.mjs` | 15 escenarios correctos de montaje y permisos con los proveedores de inventario, ventas y caja. |
| `git diff --check origin/main...HEAD` | Correcto. |
| `node tests/permissions.test.mjs` | Falla en servicios: el fixture de `useDentalServices` no proporciona las categorías y `configuredCategories.map` recibe `undefined`. |
| `npx tsc --noEmit -p tsconfig.app.json` | Falla por los tipos `NavigatorUAData` y `Navigator.userAgentData` en `sessionService.ts`, líneas 45 y 80. |

Los dos últimos fallos se reprodujeron también en un checkout separado de `main`
en `dc05ac9`, sin estos cambios. Se registran como incidencias preexistentes.

Esta publicación no repitió pruebas visuales en navegador ni ejecutó operaciones
contra Firestore; la prueba de proveedores utiliza renderizado del servidor y no
ejecuta efectos de base de datos.
