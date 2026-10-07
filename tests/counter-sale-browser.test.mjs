// Real VentasPage + cashService in Chromium; Firestore is an isolated memory fixture.
// Setup: npm install --prefix .tmp/caja-audit --no-save --package-lock=false playwright
// Run after npm run build: node tests/counter-sale-browser.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const require = createRequire(new URL('../.tmp/caja-audit/package.json', import.meta.url));
const { chromium } = require('playwright');
const mocks = {
  'firebase/firestore': `
    export * from './tests/firestoreStub';
    import {records, getDoc, setDoc, updateDoc} from './tests/firestoreStub';
    export const limit = () => ({operator:'order'});
    export const onSnapshot = () => { throw new Error('Unexpected database listener'); };
    export const runTransaction = async (_db, callback) => {
      const writes = [];
      const result = await callback({
        get: getDoc,
        set: (ref, data) => writes.push(() => setDoc(ref, data)),
        update: (ref, data) => writes.push(() => updateDoc(ref, data)),
      });
      for (const write of writes) await write();
      return result;
    };
  `,
  '@/lib/firebase': 'export const db = {};',
  '@/modules/audit/services/auditService': 'export const addAuditLog = async () => {};',
  '@/shared/services/currentUserIdentity': `export const getCurrentUserIdentity = async () => ({usuarioId:'cashier',usuarioNombre:'Cajero de prueba',usuarioEmail:'cashier@example.test'});`,
  '@/auth': 'export const useCan = () => ({can: () => true, loading:false});',
  '@/modules/inventario': `import {fixture} from 'sale-fixture'; export const useInventory = () => ({products:fixture.products,productsLoading:false});`,
  '@/modules/patients': `import {fixture} from 'sale-fixture'; export const usePatients = () => ({patients:fixture.patients,patientsLoading:false});`,
  '@/modules/services': `import {fixture} from 'sale-fixture'; export const useDentalServices = () => ({services:fixture.services,servicesLoading:false});`,
  '../hooks/useCashRegister': `import {fixture} from 'sale-fixture'; import {cashService} from '@/modules/ventas/services/cashService'; export const useCashRegister = () => ({payments:[],paymentsLoading:false,cashClosures:fixture.closures,registerDirectSale:cashService.registerDirectSale,registerDirectSaleWithReceivable:cashService.registerDirectSaleWithReceivable});`,
  '../services/saleReceiptPdfService': 'export const generateSaleReceiptPDF = () => {};',
  'sale-fixture': `
    import {records} from './tests/firestoreStub';
    import {cashService} from '@/modules/ventas/services/cashService';
    const now = new Date();
    const date = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    export const fixture = {
      date,
      products:[{id:'brush',nombre:'Cepillo dental',marca:'',categoria:'vendible',estado:'activo',precioVenta:55,costoUnitario:20,stock:5,unidad:'pieza'}],
      services:[{id:'surgery',nombre:'Cirugia de tercer molar',precio:555.50,estado:'activo'}],
      patients:[{id:'patient',nombres:'Paciente',apellidos:'Prueba',estado:'activo'}],
      closures:[{id:'cut',fecha:date,estado:'abierto'}],
    };
    records.set('cortesCaja/cut',fixture.closures[0]);
    records.set('inventarioProductos/brush',fixture.products[0]);
    records.set('pacientes/patient',fixture.patients[0]);
    window.saleTest = {
      fixture,
      records: () => [...records].map(([path,data]) => ({path,...data})),
      direct: input => cashService.registerDirectSale({fecha:date,metodo:'efectivo',pacienteNombre:'',...input}),
      installment: input => cashService.registerDirectSaleWithReceivable({fecha:date,metodo:'efectivo',pacienteNombre:'Venta mostrador',...input}),
    };
  `,
};
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {TooltipProvider} from '@/shared/components/ui/tooltip'; import {Toaster} from 'sonner'; import Sales from './src/modules/ventas/pages/VentasPage'; createRoot(document.getElementById('root')).render(<MemoryRouter><TooltipProvider><main style={{padding:16}}><Sales/></main><Toaster/></TooltipProvider></MemoryRouter>);`,
    loader: 'tsx', resolveDir: root,
  },
  jsx: 'automatic', bundle: true, format: 'esm', write: false, logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-sale', setup(builder) {
    builder.onResolve({filter:/.*/}, args => {
      if (mocks[args.path]) return {path:args.path, namespace:'fixture'};
      if (args.path.startsWith('@/')) {
        const base = path.join(root, 'src', args.path.slice(2));
        return {path:['.ts','.tsx','/index.ts','/index.tsx',''].map(ext => base+ext).find(existsSync)};
      }
    });
    builder.onLoad({filter:/.*/,namespace:'fixture'}, args => ({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
  }}],
});
const cssName = readdirSync(path.join(root,'dist/assets')).find(name => name.endsWith('.css'));
assert.ok(cssName, 'Run npm run build first');
const css = readFileSync(path.join(root,'dist/assets',cssName));
const server = createServer((req,res) => {
  if(req.url === '/app.js') {res.setHeader('Content-Type','text/javascript'); return res.end(bundle.outputFiles[0].text);}
  if(req.url === '/app.css') {res.setHeader('Content-Type','text/css'); return res.end(css);}
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const cachedChrome = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
  browser = await chromium.launch({headless:true, ...(existsSync(cachedChrome) ? {executablePath:cachedChrome} : {})});
  const context = await browser.newContext({viewport:{width:1366,height:900},timezoneId:'America/Mexico_City'});
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let passed = 0;
  const test = async (name, run) => {
    await page.goto(base);
    await page.getByRole('heading',{name:'Ventas',exact:true}).waitFor();
    await run();
    assert.deepEqual(errors, []);
    console.log('PASS '+name); passed++;
  };
  const addService = async () => {
    await page.getByRole('combobox').filter({hasText:'Seleccionar tratamiento'}).click();
    await page.getByRole('option',{name:/Cirugia de tercer molar/}).click();
    await page.getByRole('button',{name:'Agregar al resumen'}).nth(0).click();
  };
  const addProduct = async () => {
    await page.getByRole('combobox').filter({hasText:'Buscar producto'}).click();
    await page.getByRole('option',{name:/Cepillo dental/}).click();
    await page.getByRole('button',{name:'Agregar al resumen'}).nth(1).click();
  };
  const choosePatient = async (name='Paciente Prueba') => {
    await page.getByLabel('Paciente (opcional en mostrador)').click();
    await page.getByRole('option',{name,exact:true}).click();
  };
  const checkout = async (anonymous=true) => {
    await page.getByRole('button',{name:/^Cobrar /}).click();
    const confirmation = page.getByRole('dialog',{name:'Confirmar venta'});
    await confirmation.waitFor();
    if(anonymous) assert.match(await confirmation.innerText(),/sin crear historial clinico ni saldo pendiente/);
    await confirmation.getByRole('button',{name:'Confirmar venta',exact:true}).click();
    await page.getByRole('dialog',{name:'Venta registrada'}).waitFor();
  };
  const rows = collection => page.evaluate(name => window.saleTest.records().filter(row => row.path.startsWith(name+'/')), collection);
  const assertSale = async ({amount,products,patient=null,pending=0}) => {
    const payments = await rows('pagos');
    assert.equal(payments.length,1);
    assert.equal(payments[0].pacienteId,patient);
    assert.equal(payments[0].pacienteNombre,patient ? 'Paciente Prueba' : 'Venta mostrador');
    assert.equal(payments[0].monto,amount);
    assert.equal(payments[0].saldoPendiente,pending);
    const cash = await rows('cajaMovimientos');
    assert.equal(cash.length,1);
    assert.equal(cash[0].monto,amount);
    assert.equal(cash[0].referenciaId,payments[0].path.split('/')[1]);
    assert.equal((await rows('inventarioProductos'))[0].stock,products ? 4 : 5);
    assert.equal((await rows('inventarioMovimientos')).length,products ? 1 : 0);
    assert.equal((await rows('cuentasPorCobrar')).length,pending > 0 ? 1 : 0);
    const histories = (await rows('pacientes')).filter(row => row.path.includes('/historial/'));
    assert.equal(histories.length,patient ? 1 : 0);
  };

  await test('mostrador: producto sin paciente registra caja y descuenta stock',async () => {
    await addProduct(); await checkout();
    await assertSale({amount:55,products:true});
  });
  await test('mostrador: venta mixta de la captura cobra 610.50 sin paciente',async () => {
    await addService(); await addProduct(); await checkout();
    await assertSale({amount:610.5,products:true});
    assert.equal((await rows('pagos'))[0].tipoIngreso,'venta_mixta');
    assert.equal((await rows('tratamientos'))[0].pacienteId,null);
  });
  await test('mostrador: servicio sin paciente permite pago completo sin historial',async () => {
    await addService(); await checkout();
    await assertSale({amount:555.5,products:false});
  });
  await test('paciente: el pago completo conserva su historial',async () => {
    await choosePatient(); await addService(); await checkout(false);
    await assertSale({amount:555.5,products:false,patient:'patient'});
  });
  await test('paciente: el abono conserva historial y cuenta pendiente',async () => {
    await choosePatient(); await addService();
    await page.getByLabel('Liquidacion',{exact:true}).click();
    await page.getByRole('option',{name:'Abono / pagos'}).click();
    await page.getByLabel('Abono inicial',{exact:true}).fill('100');
    await checkout(false);
    await assertSale({amount:100,products:false,patient:'patient',pending:455.5});
  });
  await test('cambiar abono a mostrador muestra y cobra el pago completo',async () => {
    await choosePatient(); await addService();
    await page.getByLabel('Liquidacion',{exact:true}).click();
    await page.getByRole('option',{name:'Abono / pagos'}).click();
    await page.getByLabel('Abono inicial',{exact:true}).fill('100');
    await choosePatient('Venta mostrador / sin paciente');
    assert.match(await page.getByLabel('Liquidacion',{exact:true}).innerText(),/Pago completo/);
    assert.equal(await page.getByLabel('Liquidacion',{exact:true}).isDisabled(),true);
    assert.equal(await page.getByLabel('Abono inicial',{exact:true}).inputValue(),'555.5');
    await checkout(); await assertSale({amount:555.5,products:false});
  });
  const service = {servicioId:'surgery',nombre:'Cirugia',cantidad:1,precioUnitario:555.5};
  for(const [name,method,input,message] of [
    ['servicio: abono sin paciente rechazado','installment',{servicios:[service],montoPagado:100},/Selecciona un paciente para registrar abonos/],
    ['servicio: venta de mostrador parcial rechazada','direct',{servicios:[service],montoPagado:100},/flujo de abonos/],
    ['servicio: paciente seleccionado sin nombre rechazado','direct',{pacienteId:'patient',servicios:[service]},/debe tener nombre/],
    ['servicio: stock insuficiente no deja cobros parciales','direct',{productos:[{productoId:'brush',cantidad:6,precioUnitario:55}]},/stock suficiente/],
  ]) {
    await test(name,async () => {
      const error = await page.evaluate(async ({method,input}) => {
        try {await window.saleTest[method](input); return null;} catch(error) {return error.message;}
      },{method,input});
      assert.match(error,message);
      assert.equal((await rows('pagos')).length,0);
      assert.equal((await rows('cajaMovimientos')).length,0);
      assert.equal((await rows('cuentasPorCobrar')).length,0);
      assert.equal((await rows('inventarioProductos'))[0].stock,5);
    });
  }
  await test('servicio: sin id ni nombre se registra como Venta mostrador',async () => {
    await page.evaluate(input => window.saleTest.direct(input),{servicios:[service]});
    await assertSale({amount:555.5,products:false});
  });
  console.log(`${passed} escenarios de venta de mostrador aprobados.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
