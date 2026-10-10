import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const executable=process.env.BROWSER_PATH||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync);
const server=spawn(process.execPath,['scripts/server.js'],{cwd:root,env:{...process.env,PORT:'5174'},stdio:['ignore','pipe','pipe']});
let browser;
try {
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Test server startup timed out')),10000);server.once('error',reject);server.once('exit',code=>{clearTimeout(t);reject(new Error(`Test server exited ${code}`));});server.stdout.once('data',()=>{clearTimeout(t);resolve();});});
  browser=await chromium.launch({...(executable?{executablePath:executable}:{}),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.clock.install();await page.goto('http://127.0.0.1:5174');await page.locator('.player-hand .game-card').first().waitFor();
  const click=async selector=>{await page.locator(selector).first().click({force:true});await page.clock.runFor(6000);};
  assert.equal(await page.locator('.player-hand .game-card').count(),9);
  assert.ok(await page.locator('.game-actions [data-action="draw"]').isEnabled());
  await click('.game-actions [data-action="draw"]');assert.equal(await page.locator('.player-hand .game-card').count(),10);
  assert.equal(await page.locator('.game-actions [data-action="discard"]').isEnabled(),false);
  await click('.player-hand [data-card]');assert.equal(await page.locator('.game-actions [data-action="discard"]').isEnabled(),true);
  await click('.game-actions [data-action="discard"]');
  // Play a full human-vs-AI game through visible controls, not engine hooks.
  let moves=0,melds=0;
  while(await page.locator('.gameover-banner').count()===0 && moves++<600) {
    if(await page.locator('.game-actions [data-action="accept"]:enabled').count()) {await click('.game-actions [data-action="accept"]');continue;}
    if(await page.locator('.game-actions [data-action="next"]:enabled').count()) {await click('.game-actions [data-action="next"]');continue;}
    if(await page.locator('.game-actions [data-action="draw"]:enabled').count()) {await click('.game-actions [data-action="draw"]');continue;}
    if(await page.locator('[data-suggest-meld]:enabled').count()) {await click('[data-suggest-meld]');await click('.game-actions [data-action="meld"]');melds++;continue;}
    if(await page.locator('.game-actions [data-action="discard"]').count()) {
      const candidates=await page.locator('.player-hand [data-card]').evaluateAll(es=>es.map(e=>({id:e.dataset.card,label:e.getAttribute('aria-label')})));
      const support=candidates.find(c=>!['Duelista','Sentinela','Controlador','Iniciador'].some(r=>c.label.includes(r)));
      await click(`[data-card="${support?.id||candidates[0].id}"]`);await click('.game-actions [data-action="discard"]');continue;
    }
    if(await page.locator('.game-actions [data-action="play"]').count()) {
      const candidates=await page.locator('.player-hand [data-card]').evaluateAll(es=>es.map(e=>({id:e.dataset.card,label:e.getAttribute('aria-label')})));
      const agents=candidates.filter(c=>['Duelista','Sentinela','Controlador','Iniciador'].some(r=>c.label.includes(r))).sort((a,b)=>Number(b.label.match(/força (\d+)/)[1])-Number(a.label.match(/força (\d+)/)[1]));
      assert.ok(agents.length,'No agents available in duel');await click(`[data-card="${agents[0].id}"]`);await click('.game-actions [data-action="play"]');continue;
    }
    throw new Error(`No available action at step ${moves}: ${await page.locator('.phase-message').innerText()}`);
  }
  assert.equal(await page.locator('.gameover-banner').count(),1,'Game did not finish');
  let profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('distrito.profile.v1')));
  assert.equal(profile.games,1);assert.ok(profile.xp>=30);
  console.log(`PASS: full browser match (${moves} actions, ${melds} melds), XP awarded once.`);
  await click('.nav-link[data-page="collection"]');assert.equal(await page.locator('.collection-item').count(),34);
  await click('[data-remove="duelist-1"]');assert.ok(await page.locator('[data-action="save-deck"]').isDisabled());
  await click('[data-add="duelist-1"]');assert.ok(await page.locator('[data-action="save-deck"]').isEnabled());
  await click('[data-action="save-deck"]');
  await click('[data-filter="weapon"]');assert.equal(await page.locator('.collection-item').count(),6);
  await click('.collection-item [data-detail="sidearm"]');assert.ok(await page.locator('#card-detail').isVisible());assert.ok((await page.locator('#detail-content').innerText()).includes('nível 1 ou 2'));
  await click('#close-detail');
  await click('.nav-link[data-page="guide"]');assert.equal(await page.locator('.guide-steps article').count(),3);
  await click('.guide-page [data-action="training"]');assert.equal(await page.locator('.training-tip').count(),1);
  await page.selectOption('#difficulty','hard');await page.locator('#confirm-restart').click({force:true});await page.clock.runFor(6000);
  assert.equal(await page.locator('#difficulty').inputValue(),'hard');assert.equal(await page.locator('.training-tip').count(),1);
  await page.locator('#sound-toggle').click({force:true});await page.clock.runFor(1000);
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'true');
  await page.reload();await page.locator('.player-hand .game-card').first().waitFor();
  profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('distrito.profile.v1')));assert.equal(profile.games,1);assert.equal(profile.sound,true);
  console.log('PASS: collection, deck legality/edit/save, details, training, difficulty, sound and persistence.');
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const tab of ['match','collection','guide']) {
      await click(`.nav-link[data-page="${tab}"]`);
      const dimensions=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
      assert.ok(dimensions.body<=dimensions.viewport,`${tab} overflows at ${width}: ${dimensions.body}`);
    }
  }
  await page.setViewportSize({width:390,height:1150});await click('.nav-link[data-page="match"]');
  await click('.game-actions [data-action="draw"]');
  await page.locator('.player-hand [data-card]').last().click();await page.clock.runFor(1000);
  assert.ok(await page.locator('.player-hand').evaluate(e=>e.scrollLeft)>0,'Card selection reset horizontal hand scroll');
  await click('[data-action="sort"]');
  assert.equal(await page.locator('.player-hand .game-card').count(),10);
  console.log('PASS: mobile hand selection preserves scrolling; hand organization works.');
  assert.deepEqual(errors,[]);
  console.log('PASS: all pages at 320, 390, 768, 1024 and 1440px; no runtime or resource errors.');
  await page.setViewportSize({width:1440,height:1150});await click('.nav-link[data-page="match"]');await page.screenshot({path:'/tmp/distrito-final-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:1150});await page.screenshot({path:'/tmp/distrito-final-mobile.png',fullPage:true});
} finally {await browser?.close();server.kill();}
