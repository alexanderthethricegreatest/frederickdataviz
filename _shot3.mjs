import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const DIR = process.env.CLAUDE_JOB_DIR + '/tmp/';
async function shot(name, setup) {
  const p = await b.newPage({ viewport: { width: 1300, height: 1050 } });
  try {
    await p.goto('http://localhost:3939/map', { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1500);
    if (setup) await setup(p);
    await p.waitForTimeout(3500);
    await p.locator('.card').first().screenshot({ path: DIR + name });
    console.log('ok', name);
  } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); }
  await p.close();
}
await shot('m-heat.png', async p => { await p.getByRole('button',{name:'Heatmap'}).click(); });
await shot('m-districts.png', async p => { await p.getByRole('button',{name:'Districts'}).click(); });
await shot('m-apps.png', async p => { await p.getByRole('button',{name:'Applications'}).click(); });
await shot('m-dark.png', async p => { await p.evaluate(()=>{document.documentElement.setAttribute('data-theme','dark');localStorage.setItem('atlas_theme','dark');}); });
await b.close();
