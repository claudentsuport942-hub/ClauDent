# Venta de mostrador sin paciente

## Problema

La opción `Venta mostrador / sin paciente` permitía agregar productos y servicios,
pero al cobrar exigía paciente si el resumen incluía algún tratamiento. Esto
bloqueaba, por ejemplo, una venta mixta de un servicio de $555.50 y un producto de
$55.00 aun cuando se había elegido mostrador.

## Comportamiento corregido

- Mostrador permite cobrar productos, servicios o ventas mixtas sin seleccionar
  ni crear un paciente. El cobro se identifica como `Venta mostrador` y conserva
  `pacienteId: null`.
- El pago completo entra a caja y los productos vendidos descuentan inventario.
  Los servicios conservan su registro de venta, pero no se crea historial de
  paciente cuando la venta no tiene uno asociado.
- Los abonos siguen requiriendo un paciente y al menos un tratamiento. Mostrador
  no genera cuentas pendientes.
- Al cambiar de paciente con abono a mostrador, la liquidación y el importe
  visible muestran el pago completo que se va a registrar.
- El selector y la confirmación explican que la venta sin paciente se cobra
  completa y no se guarda en historial clínico.
- La validación de pacientes o servicios eliminados permanece activa.

## Verificación

`node tests/counter-sale-browser.test.mjs` ejecuta 11 escenarios con la pantalla
real de ventas y `cashService` en Chromium. Firestore se sustituye por una fixture
en memoria; no se generan cobros reales ni se verifican reglas de seguridad o
concurrencia de Firestore con esta prueba.

Los escenarios cubren productos, servicios y venta mixta de mostrador; pago
completo y abonos con paciente; cambio de abono a mostrador; rechazo de abonos
anónimos, pagos parciales y pacientes sin nombre; rechazo por stock insuficiente
sin escrituras parciales; y la etiqueta de mostrador cuando no se proporciona
paciente. Se comprueban pagos, ingresos de caja, stock, movimientos, historial y
cuentas pendientes.

Resultados:

- `npm run build`: correcto, con las advertencias existentes de Browserslist y
  tamaño del bundle.
- ESLint en `VentasPage.tsx` y `cashService.ts`: correcto.
- `node tests/counter-sale-browser.test.mjs`: 11 escenarios correctos.
- `node tests/business-providers.test.mjs`: 15 escenarios correctos.
- `node tests/direct-sale-discount.test.mjs`: correcto.
- `node --test tests/cash-reporting.test.mjs`: 13 pruebas correctas.
- `git diff --check`: correcto.

Para ejecutar la prueba de navegador, instalar Playwright en el directorio de
pruebas como indica la cabecera del archivo y ejecutar primero `npm run build`.
Se reutiliza el Chromium de Playwright si está disponible en la ruta indicada en
el script; en otro entorno se necesita el navegador instalado por Playwright.
