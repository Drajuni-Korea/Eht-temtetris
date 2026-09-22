import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { abyssUniques, specialBySlot, fixedSpecial, matchEquipment, detectSpecial, mergeEquipmentOptions } from '../equipment-db.js';

const cases = [
  ['진 서리거인의 흉갑','armor','trueFrost',true],
  ['흡수의 갑옷','armor','absorb',false],
  ['진 블러디피스트','gloves','trueBlood',true],
  ['마이다스의 손','gloves','midas',false],
  ['진 질풍의 경갑','boots','trueGale',true],
  ['뱀파이어 부츠','boots','vampire',false],
  ['진 하데스의 목걸이','necklace','trueHades',true],
  ['용의 가호 목걸이','necklace','dragon',false],
  ['진 싸이클론 링','ring','trueCyclone',true],
  ['수호자의 희생 반지','ring','sacrifice',false],
  ['진 통찰의 투구','helmet','trueInsight',true],
  ['드래곤 로드 크라운','helmet','dragonLord',false],
  ['진 뇌룡의 허리띠','belt','trueThunder',true],
  ['듀얼 허리띠','belt','dual',false]
];

for (const [name,slot,special,isTrue] of cases) {
  test(`Abyss reference: ${name}`, () => {
    for (const text of [name, name.replaceAll(' ',''), `초월한 ${name}`]) {
      const result = matchEquipment(text);
      assert.equal(result.slot,slot);
      assert.equal(result.special,special);
      assert.equal(result.tier,'abyss');
      assert.equal(result.grade,'L');
      assert.equal(result.isTrue,isTrue);
      assert.equal(detectSpecial(text,slot),special);
    }
  });
}

test('Chaos names remain separate from their true counterparts', () => {
  for (const [name,slot,key] of [
    ['블러디 피스트','gloves','blood'],['블러드 피스트','gloves','blood'],
    ['질풍의 경갑','boots','gale'],['하데스의 목걸이','necklace','hades'],
    ['싸이클론 링','ring','cyclone'],['뇌룡의 허리띠','belt','thunder'],
    ['서리거인의 흉갑','armor','frost'],['통찰의 투구','helmet','insight'],
    ['호박 머리 모자','helmet','pumpkin'],['헤카테의 장갑','gloves','hecate'],
    ['불굴의 경갑','boots','indomitable'],['실프의 허리띠','belt','sylph']
  ]) {
    assert.equal(detectSpecial(name,slot),key);
    assert.equal(matchEquipment(name).tier,undefined);
  }
  assert.equal(detectSpecial('진 블러드 피스트','gloves'),'trueBlood');
  assert.equal(matchEquipment('저거너트 헬름').slot,'helmet');
  assert.equal(detectSpecial('저거너트 헬름','belt'),'normal');
  assert.deepEqual(fixedSpecial.juggernautUnique,fixedSpecial.juggernaut);
});

test('Only true Gale has a fixed option among these 14 uniques', () => {
  assert.equal(Object.keys(abyssUniques).length,14);
  for (const item of Object.values(abyssUniques)) {
    assert.equal(item.randomOptionCount,item.special==='trueGale'?3:4);
    assert.equal(item.fixedOptions.length,item.special==='trueGale'?1:0);
    assert.ok(specialBySlot[item.slot].some(([key])=>key===item.special));
  }
  assert.deepEqual(abyssUniques.trueGale.fixedOptions,[{key:'movespd',min:17,max:32,unit:'%'}]);
  assert.deepEqual(mergeEquipmentOptions('trueGale',['atkspd','crit','hp','movespd']),['movespd','atkspd','crit','hp']);
  assert.equal(mergeEquipmentOptions('trueGale',['atkspd','crit','hp','eva']).length,5);
  assert.deepEqual(mergeEquipmentOptions('midas',['atkspd','crit','hp','eva']),['atkspd','crit','hp','eva']);
});

test('No ambiguous equipment aliases or duplicate selector keys', () => {
  const seen = new Set();
  for (const [slot, entries] of Object.entries(specialBySlot)) {
    for (const [key,label] of entries) {
      assert.ok(!seen.has(`${slot}:${key}`)); seen.add(`${slot}:${key}`);
      if (key!=='normal') assert.equal(detectSpecial(label,slot),key);
    }
  }
});

// Execute the actual production job path, replacing image OCR and disk I/O only.
const source = fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const getBlock = (start,end) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
async function runJob(name, found, text='') {
  const context = vm.createContext({
    abyssUniques,matchEquipment,detectSpecial,mergeEquipmentOptions,path,
    console:{log(){},error(){}},
    writeJob:async()=>{},
    colorGrade:async()=>null,
    createWorker:async()=>({recognize:async()=>({data:{text:name+' '+text,confidence:99}}),terminate:async()=>{}}),
    recognizeBlueOptions:async()=>({found,blueLines:[],blueLineCount:found.length,confidence:99}),
    recognizeEquipmentHeader:async()=>({text:name,lines:[name],confidence:99})
  });
  vm.runInContext([
    getBlock('const slotMap =','function normalizeOCR'),
    getBlock('function normalizeOCR','function isEffectiveBlue'),
    getBlock('function textGrade','async function writeJob'),
    getBlock('function extractEquipmentName','async function processJob'),
    getBlock('async function processJob','app.post(')
  ].join('\n'),context);
  const job={id:'fixture',files:[{path:'fixture.png',originalName:'fixture.png'}],results:[]};
  await context.processJob(job);
  return job.results[0];
}

test('All reference names reach auto-registration even without generic slot or tier text',async()=>{
  for (const [name,slot,special] of cases) {
    const found=special==='trueGale'?['atkspd','crit','hp']:['atkspd','crit','hp','eva'];
    const result=await runJob(name,found,'혼돈 무기류');
    assert.equal(result.complete,true,`${name}: ${result.reason}`);
    assert.equal(result.data.special,special);
    assert.equal(result.data.slot,slot);
    assert.equal(result.data.tier,'abyss');
    assert.equal(result.data.grade,'L');
    assert.equal(result.data.opts.length,4);
  }
});

test('Missing/excess blue options require review; fixed option is not duplicated',async()=>{
  assert.equal((await runJob('진 질풍의 경갑',['crit','hp'])).complete,false);
  assert.equal((await runJob('진 질풍의 경갑',['crit','hp','eva','atkspd'])).complete,false);
  assert.equal((await runJob('진 질풍의 경갑',['movespd','crit','hp','atkspd'])).complete,true);
  const normal=await runJob('초월한 심연의 경갑',['boss','critdmg','crit','atkspd']);
  assert.equal(normal.complete,true);
  assert.equal(normal.data.special,'normal');
  assert.equal(normal.data.tier,'abyss');
  const chaos=await runJob('뇌룡의 허리띠',['human','demon','hp','hunger'],'혼돈');
  assert.equal(chaos.data.special,'thunder');
  assert.equal(chaos.data.tier,'chaos');
});

test('Manual registration enforces Abyss tier and rejects excess options',async()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const module=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  new vm.Script(module.replace(/^import .*;$/m,''));
  const start=module.indexOf("$('registerBtn').onclick=async()=>{");
  const handler=module.slice(start,module.indexOf("$('clearScan')",start));
  for (const [options,expectedSaves] of [
    [['crit','hp','atkspd',''],1],
    [['crit','hp','atkspd','movespd'],1],
    [['crit','hp','atkspd','eva'],0],
    [['crit','hp','',''],0]
  ]) {
    const elements=Object.fromEntries(['registerBtn','ocrStatus','scanSlot','scanTier','scanSpecial','so1','so2','so3','so4'].map(id=>[id,{}]));
    elements.scanSlot.value='boots'; elements.scanTier.value='chaos'; elements.scanSpecial.value='trueGale';
    options.forEach((value,i)=>elements[`so${i+1}`].value=value);
    const saved=[];
    const context=vm.createContext({$:id=>elements[id],abyssUniques,mergeEquipmentOptions,nextId:1,alert(){},saveItem:async item=>saved.push(item)});
    vm.runInContext(handler,context);
    await elements.registerBtn.onclick();
    assert.equal(saved.length,expectedSaves);
    if (saved.length) {
      assert.equal(saved[0].tier,'abyss');
      assert.equal(saved[0].opts.filter(key=>key==='movespd').length,1);
      assert.equal(saved[0].opts.length,4);
    }
  }
});
