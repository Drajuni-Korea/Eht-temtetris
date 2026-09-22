import express from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JOB_DIR = path.join(DATA_DIR, 'jobs');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

await fs.mkdir(JOB_DIR, { recursive: true });
await fs.mkdir(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const jobId = req.jobId || (req.jobId = crypto.randomUUID());
      const dir = path.join(UPLOAD_DIR, jobId);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { files: 60, fileSize: 20 * 1024 * 1024 }
});

const patterns = [
  ['atkspd', /공격\s*속도/],
  ['critdmg', /치명타\s*피해량|치명타\s*피해/],
  ['crit', /치명타\s*확률/],
  ['eva', /회피/],
  ['dmgred', /데미지.*감소|받는.*데미지.*감소/],
  ['leech', /흡혈/],
  ['movespd', /이동\s*속도/],
  ['atk', /전체\s*공격력|공격력/],
  ['def', /전체\s*방어력|방어력/],
  ['hp', /체력/],
  ['boss', /보스류/],
  ['human', /영장류/],
  ['undead', /언데드/],
  ['demon', /악마류/],
  ['animal', /동물류/],
  ['exp', /경험치/],
  ['gold', /골드/],
  ['material', /재료/],
  ['hunger', /허기/],
  ['mood', /기분/],
  ['stamina', /기력/]
];


const optionLabels = {
  atkspd:'공격속도', critdmg:'치명타피해량', crit:'치명타확률', eva:'회피',
  dmgred:'데미지감소', leech:'흡혈', movespd:'이동속도', atk:'전체공격력',
  def:'전체방어력', hp:'체력', boss:'보스류', human:'영장류', undead:'언데드',
  demon:'악마류', animal:'동물류', exp:'경험치', gold:'골드', material:'재료',
  hunger:'허기', mood:'기분', stamina:'기력'
};

function compactHangul(s=''){
  return s.replace(/[^가-힣]/g,'');
}

function levenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m)return n;if(!n)return m;
  const prev=Array(n+1).fill(0).map((_,i)=>i), cur=Array(n+1).fill(0);
  for(let i=1;i<=m;i++){
    cur[0]=i;
    for(let j=1;j<=n;j++) cur[j]=Math.min(
      cur[j-1]+1, prev[j]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1)
    );
    for(let j=0;j<=n;j++) prev[j]=cur[j];
  }
  return prev[n];
}

function classifyOptionLine(text){
  const normalized=normalizeOCR(text);
  const exact=[];
  for(const [key,re] of patterns) if(re.test(normalized)) exact.push(key);
  if(exact.length===1) return {key:exact[0],score:1,method:'exact'};

  // 숫자/범위/증가 같은 뒤쪽 텍스트를 제외하고 한글 옵션명만 비교한다.
  const head=compactHangul(normalized.split(/\d|\[|%/)[0]);
  if(!head) return null;

  let best=null;
  for(const [key,label] of Object.entries(optionLabels)){
    const target=compactHangul(label);
    const d=levenshtein(head,target);
    const score=1-d/Math.max(head.length,target.length,1);
    if(!best||score>best.score) best={key,score,method:'fuzzy',head,target};
  }
  // 짧은 단어는 우연 매칭이 매우 잘 생긴다. 특히 "방어력"이 잡음에 끼는 문제가 있어 강하게 제한한다.
  if(!best) return null;
  const shortTarget=best.target.length<=3;
  const threshold=shortTarget?0.64:0.68;
  if(best.score<threshold) return null;
  // 방어력/체력/회피처럼 짧은 옵션은 원문에 해당 음절이 2글자 이상 실제로 보여야 한다.
  if(shortTarget){
    let overlap=0;
    for(const ch of new Set(best.target)) if(head.includes(ch)) overlap++;
    if(overlap<2) return null;
  }
  return best;
}

const slotMap = [
  ['gloves', /장갑류|장갑|피스트/],
  ['boots', /신발류|경갑|부츠/],
  ['helmet', /투구류|투구|헬름|모자/],
  ['armor', /갑옷류|갑옷|흉갑/],
  ['belt', /벨트류|벨트|허리띠/],
  ['ring', /반지류|반지|링/],
  ['necklace', /목걸이류|목걸이/],
  ['weapon', /무기류|검|활|지팡이|도끼/]
];

const specialBySlot = {
  weapon: [['field','필드무기'],['colo','콜로무기'],['world','월드보스무기'],['devilWeapon','대악마무기']],
  helmet: [['normal','일반'],['juggernaut','저거너트 헬름'],['blueHelm','콜로 블루 투구']],
  gloves: [['normal','일반'],['blood','블러드 피스트'],['trueBlood','진 블러드피스트']],
  boots: [['normal','일반'],['gale','질풍의 경갑'],['trueGale','진 질풍의 경갑']],
  necklace: [['normal','일반'],['hades','하데스의 목걸이'],['trueHades','진 하데스의 목걸이'],['guard','경비대장의 목걸이'],['dragon','용의 가호 목걸이']],
  ring: [['normal','일반'],['cyclone','싸이클론 링'],['trueCyclone','진 싸이클론 링'],['trinity','트리니티 링'],['sacrifice','수호자의 희생 반지']],
  belt: [['normal','일반'],['thunder','뇌룡의 허리띠'],['trueThunder','진 뇌룡의 허리띠'],['alchemy','연금술사의 벨트']],
  armor: [['normal','일반'],['frost','서리거인의 흉갑'],['trueFrost','진 서리거인의 흉갑'],['absorb','흡수의 갑옷'],['masochist','피학자의 갑옷']]
};

const fixedSpecial = {
  gale: ['movespd'],
  trueGale: ['movespd'],
  juggernaut: ['hp']
};

function normalizeOCR(s='') {
  return s.replace(/\s+/g, ' ').replace(/[|]/g, ' ');
}

function isEffectiveBlue(r,g,b){
  const [h,s,v]=rgbToHsv(r,g,b);
  // EHT 일반 유효 옵션의 청록/파랑 계열만 통과.
  // 분홍(고정/별도), 빨강(디메리트), 흰/회색 텍스트는 제거한다.
  return h>=175 && h<=225 && s>=0.28 && v>=0.30 && b>=r*1.08;
}

async function findBlueOptionLines(filePath){
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject:true });

  const w=info.width, h=info.height, ch=info.channels;

  // 1) 장비 팝업의 자홍색 제목 바를 찾아 대략적인 팝업 세로 위치를 잡는다.
  let magentaRows=[];
  const mx0=Math.floor(w*0.16), mx1=Math.floor(w*0.84);
  const my0=Math.floor(h*0.15), my1=Math.floor(h*0.55);
  for(let y=my0;y<my1;y++){
    let count=0;
    for(let x=mx0;x<mx1;x+=2){
      const p=(y*w+x)*ch;
      const [hh,ss,vv]=rgbToHsv(data[p],data[p+1],data[p+2]);
      if(hh>=285 && hh<=340 && ss>=0.35 && vv>=0.28) count++;
    }
    if(count>=Math.max(8,Math.floor((mx1-mx0)*0.008))) magentaRows.push(y);
  }

  let headerY=null;
  if(magentaRows.length){
    let best=[magentaRows[0],magentaRows[0]], a=magentaRows[0], prev=magentaRows[0];
    for(let i=1;i<magentaRows.length;i++){
      const y=magentaRows[i];
      if(y-prev>3){
        if(prev-a>best[1]-best[0]) best=[a,prev];
        a=y;
      }
      prev=y;
    }
    if(prev-a>best[1]-best[0]) best=[a,prev];
    headerY=(best[0]+best[1])/2;
  }

  // 2) "첫 옵션 위치"를 추정하지 않는다.
  // 일반/유니크 모두 대응하도록 옵션 패널 전체를 넓게 훑고 파란 글자 줄 자체를 찾는다.
  const x0=Math.floor(w*0.16), x1=Math.floor(w*0.84);
  const y0=Math.max(0,Math.floor(headerY!=null ? headerY+h*0.035 : h*0.28));
  const y1=Math.min(h,Math.floor(headerY!=null ? headerY+h*0.31 : h*0.62));

  const rowCounts=new Uint32Array(h);
  const rowMinX=new Int32Array(h); rowMinX.fill(w);
  const rowMaxX=new Int32Array(h); rowMaxX.fill(-1);

  for(let y=y0;y<y1;y++){
    let count=0,minX=w,maxX=-1;
    for(let x=x0;x<x1;x++){
      const p=(y*w+x)*ch;
      if(isEffectiveBlue(data[p],data[p+1],data[p+2])){
        count++;
        if(x<minX) minX=x;
        if(x>maxX) maxX=x;
      }
    }
    rowCounts[y]=count;
    rowMinX[y]=minX;
    rowMaxX[y]=maxX;
  }

  // 3) 안티앨리어싱 때문에 한 행의 파란 픽셀이 적어도,
  // 인접 5개 행 합계가 충분하면 텍스트 행으로 인정한다.
  const active=[];
  const minSmooth=Math.max(10,Math.floor(w*0.012));
  for(let y=y0;y<y1;y++){
    let smooth=0;
    for(let dy=-2;dy<=2;dy++){
      const yy=y+dy;
      if(yy>=y0&&yy<y1) smooth+=rowCounts[yy];
    }
    if(smooth>=minSmooth) active.push(y);
  }

  // 4) 가까운 행들을 하나의 텍스트 줄로 묶는다.
  const groups=[];
  if(active.length){
    let a=active[0],prev=active[0];
    for(let i=1;i<active.length;i++){
      const y=active[i];
      if(y-prev>4){
        groups.push([a,prev]);
        a=y;
      }
      prev=y;
    }
    groups.push([a,prev]);
  }

  let rects=groups.map(([a,b])=>{
    let minX=w,maxX=-1,bluePixels=0;
    for(let y=a;y<=b;y++){
      if(rowMinX[y]<minX) minX=rowMinX[y];
      if(rowMaxX[y]>maxX) maxX=rowMaxX[y];
      bluePixels+=rowCounts[y];
    }
    const padX=Math.max(8,Math.floor(w*0.012));
    const padY=Math.max(3,Math.floor(h*0.0025));
    const left=Math.max(x0,(minX<w?minX:x0)-padX);
    const right=Math.min(x1,(maxX>=0?maxX:x1)+padX);
    return {
      x:left,
      y:Math.max(y0,a-padY),
      width:Math.max(1,right-left+1),
      height:Math.max(1,Math.min(y1, b+padY)-Math.max(y0,a-padY)+1),
      bluePixels
    };
  }).filter(r=>{
    // 실제 옵션 한 줄은 충분한 파란 픽셀을 가진다.
    const plausibleHeight=r.height>=Math.max(8,Math.floor(h*0.004)) &&
      r.height<=Math.max(90,Math.floor(h*0.035));
    const enoughBlue=r.bluePixels>=Math.max(20,Math.floor(w*0.02));
    return plausibleHeight && enoughBlue;
  }).sort((a,b)=>a.y-b.y);

  // 5) 파란 줄이 4개 이상이면 위에서부터 서로 일정 간격인 4개 조합을 우선한다.
  // 유니크의 주황 고정효과는 애초에 파란색이 아니므로 자동으로 제외된다.
  if(rects.length>4){
    let best=null;
    for(let i=0;i<=rects.length-4;i++){
      const cand=rects.slice(i,i+4);
      const centers=cand.map(r=>r.y+r.height/2);
      const d=[centers[1]-centers[0],centers[2]-centers[1],centers[3]-centers[2]];
      const mean=d.reduce((a,b)=>a+b,0)/3;
      const variance=d.reduce((s,v)=>s+(v-mean)*(v-mean),0)/3;
      const blue=cand.reduce((s,r)=>s+r.bluePixels,0);
      const score=blue-(variance*8);
      if(!best||score>best.score) best={score,cand};
    }
    if(best) rects=best.cand;
  }

  return rects.slice(0,4);
}

async function makeBlueLineMask(filePath,rect){
  const { data, info } = await sharp(filePath)
    .extract({left:rect.x,top:rect.y,width:rect.width,height:rect.height})
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject:true });

  const w=info.width, h=info.height, ch=info.channels;
  const blue=new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const p=(y*w+x)*ch;
      if(isEffectiveBlue(data[p],data[p+1],data[p+2])) blue[y*w+x]=1;
    }
  }

  // 픽셀 폰트의 끊긴 획을 1px 정도 이어서 한글 OCR 오독을 줄인다.
  const out=Buffer.alloc(w*h,255);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      if(!blue[y*w+x]) continue;
      for(let dy=-1;dy<=1;dy++){
        for(let dx=-1;dx<=1;dx++){
          const nx=x+dx, ny=y+dy;
          if(nx>=0 && nx<w && ny>=0 && ny<h) out[ny*w+nx]=0;
        }
      }
    }
  }

  return sharp(out,{raw:{width:w,height:h,channels:1}})
    .resize({width:w*4,height:h*4,kernel:'nearest'})
    .extend({top:28,bottom:28,left:44,right:44,background:{r:255,g:255,b:255,alpha:1}})
    .png()
    .toBuffer();
}


async function makeOriginalLineCrop(filePath,rect){
  // 파란 픽셀은 "줄 위치 찾기"에만 사용하고 OCR은 원본 색상/안티앨리어싱을 보존한다.
  return sharp(filePath)
    .extract({left:rect.x,top:rect.y,width:rect.width,height:rect.height})
    .resize({width:Math.max(1,rect.width*4),height:Math.max(1,rect.height*4),kernel:'lanczos3'})
    .sharpen()
    .png()
    .toBuffer();
}

async function recognizeBlueOptions(worker,filePath){
  const rects=await findBlueOptionLines(filePath);
  const found=[];
  const lines=[];
  const confidences=[];
  const decisions=[];

  await worker.setParameters({tessedit_pageseg_mode:'7'});
  try{
    for(const rect of rects){
      // 1차: 원본 색상을 보존한 한 줄 OCR
      const original=await makeOriginalLineCrop(filePath,rect);
      const r1=await worker.recognize(original);
      const t1=normalizeOCR(r1.data.text||'');

      // 2차: 파란색 이진 마스크 OCR (보조)
      const mask=await makeBlueLineMask(filePath,rect);
      const r2=await worker.recognize(mask);
      const t2=normalizeOCR(r2.data.text||'');

      const c1=classifyOptionLine(t1);
      const c2=classifyOptionLine(t2);
      let chosen=null;

      // 원본 OCR을 우선한다. 양쪽이 같은 옵션이면 신뢰도를 높인다.
      if(c1 && c2 && c1.key===c2.key){
        chosen={...c1,score:Math.max(c1.score,c2.score),method:'consensus'};
      }else if(c1 && (!c2 || c1.score>=c2.score+0.10 || c1.method==='exact')){
        chosen=c1;
      }else if(c2 && c2.score>=0.64){
        // 색상 마스크는 한글 마지막 음절을 자주 틀린다(예: 보스튜→보스류).
        // 옵션 사전과 2/3 이상 일치하면 후보로 채택한다.
        chosen=c2;
      }

      const shown=t1 || t2;
      if(shown) lines.push(shown);
      confidences.push(Number(r1.data.confidence||0));
      decisions.push({original:t1,mask:t2,chosen});

      // 현재 반복 오검출된 방어력은 fuzzy 결과로는 절대 자동 채택하지 않는다.
      if(chosen?.key==='def' && chosen.method!=='exact' && chosen.method!=='consensus') chosen=null;
      if(chosen && !found.includes(chosen.key)) found.push(chosen.key);
    }
  }finally{
    await worker.setParameters({tessedit_pageseg_mode:'3'});
  }

  return {
    blueText:lines.join(' | '),
    blueLines:lines,
    blueLineCount:rects.length,
    decisions,
    found,
    confidence:confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : 0
  };
}

function detectSpecial(txt, slot) {
  const list = specialBySlot[slot] || [];
  const noSpace = txt.replace(/\s+/g, '');
  for (const [key, label] of list) {
    if (key === 'normal') continue;
    if (noSpace.includes(label.replace(/\s+/g, ''))) return key;
  }
  if(slot==='belt'){
    if(/진\s*뇌룡|뇌룡.*진/.test(txt)) return 'trueThunder';
    if(/뇌룡/.test(txt)) return 'thunder';
    if(/연금술사/.test(txt)) return 'alchemy';
  }
  if (slot === 'weapon') {
    if (/월드\s*보스/.test(txt)) return 'world';
    if (/콜로/.test(txt)) return 'colo';
    if (/대악마/.test(txt)) return 'devilWeapon';
    return 'field';
  }
  return 'normal';
}

function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0, s=max===0?0:d/max, v=max;
  if(d){
    if(max===r) h=((g-b)/d+(g<b?6:0));
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60;
  }
  return [h,s,v];
}

function pixelGrade(r,g,b){
  const [h,s,v]=rgbToHsv(r,g,b);
  if(v<0.18 || s<0.18) return null;
  if(h>=35 && h<=70 && v>0.28) return 'unique';
  if((h>=280 && h<=330) || (h>=330 && s>0.35 && v>0.2)) return 'L';
  if(h>=130 && h<=190 && v>0.22) return 'SSS';
  if((h<=18 || h>=345) && s>0.28 && v>0.18) return 'SS';
  return null;
}

async function colorGrade(filePath){
  try{
    const img = sharp(filePath);
    const meta = await img.metadata();
    const width0 = meta.width || 1;
    const height0 = meta.height || 1;
    const left = Math.floor(width0 * 0.04);
    const top = Math.floor(height0 * 0.66);
    const width = Math.max(1, Math.floor(width0 * 0.92));
    const height = Math.max(1, Math.floor(height0 * 0.21));
    const { data, info } = await img
      .extract({
        left,
        top,
        width: Math.min(width, width0-left),
        height: Math.min(height, height0-top)
      })
      .resize({ width: 320, fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const counts = { unique:0, L:0, SSS:0, SS:0 };
    const ch = info.channels;
    for(let i=0;i<data.length;i+=ch*4){
      const grade = pixelGrade(data[i], data[i+1], data[i+2]);
      if(grade) counts[grade]++;
    }
    const topGrade = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return topGrade && topGrade[1] >= 20 ? topGrade[0] : null;
  }catch{
    return null;
  }
}

function textGrade(txt, tier){
  const s = txt.toUpperCase();
  if(/UNIQ|유니크/.test(s)) return 'unique';
  if(/SSS|혼돈/.test(s)) return 'SSS';
  if(/\bSS\b|태초/.test(s)) return 'SS';
  if(/심연/.test(s)) return 'L';
  if(/\bS\b/.test(s)) return 'S';
  if(/\bA\b/.test(s)) return 'A';
  if(/\bB\b/.test(s)) return 'B';
  return tier==='abyss' ? 'L' : tier==='chaos' ? 'SSS' : tier==='origin' ? 'SS' : 'unknown';
}

async function writeJob(job){
  await fs.writeFile(path.join(JOB_DIR, `${job.id}.json`), JSON.stringify(job,null,2));
}

async function readJob(id){
  return JSON.parse(await fs.readFile(path.join(JOB_DIR, `${id}.json`), 'utf8'));
}

let queue = Promise.resolve();


async function recognizeEquipmentHeader(worker,filePath){
  const meta=await sharp(filePath).metadata();
  const w=meta.width||1,h=meta.height||1;
  const left=Math.floor(w*0.16), top=Math.floor(h*0.18);
  const width=Math.max(1,Math.floor(w*0.68));
  const height=Math.max(1,Math.floor(h*0.22));
  const crop=await sharp(filePath)
    .extract({
      left,
      top,
      width:Math.min(width,w-left),
      height:Math.min(height,h-top)
    })
    .resize({width:Math.max(1,width*3),height:Math.max(1,height*3),kernel:'lanczos3'})
    .sharpen()
    .png()
    .toBuffer();

  await worker.setParameters({tessedit_pageseg_mode:'6'});
  try{
    const {data:{text,confidence}}=await worker.recognize(crop);
    const lines=String(text||'').split(/\r?\n/).map(normalizeOCR).filter(Boolean);
    return {text:normalizeOCR(text),lines,confidence:Number(confidence||0)};
  }finally{
    await worker.setParameters({tessedit_pageseg_mode:'3'});
  }
}

function extractEquipmentName(header){
  const lines=header?.lines||[];
  const noise=/^(신발류|장갑류|투구류|갑옷류|허리띠|벨트류|반지류|목걸이류|무기류|품질|아이템레벨|방어력|체력|공격력)/;
  const line=lines.find(x=>x.length>=3&&!noise.test(x))||'';
  return line.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g,'').trim();
}

function inferTierFromOptionRanges(lines=[]){
  const joined=lines.join(' ');
  const votes={origin:0,chaos:0,abyss:0};
  const ranges=[...joined.matchAll(/\[(\d+)\s*[~\-]\s*(\d+)\]/g)];
  for(const m of ranges){
    const max=Number(m[2]);
    if([16,21,29,45].includes(max)) votes.abyss++;
    if([14,19,26,40].includes(max)) votes.chaos++;
    if([12,17,23,35].includes(max)) votes.origin++;
  }
  const ranked=Object.entries(votes).sort((a,b)=>b[1]-a[1]);
  return ranked[0][1]>0 && (ranked.length<2 || ranked[0][1]>ranked[1][1]) ? ranked[0][0] : null;
}

async function processJob(job){
  job.status = 'processing';
  job.startedAt = new Date().toISOString();
  await writeJob(job);

  const worker = await createWorker('kor+eng');

  try{
    for(let i=0;i<job.files.length;i++){
      const f = job.files[i];
      job.current = i+1;
      await writeJob(job);

      try{
        // 1) 장비 기본 정보는 원본 OCR.
        // 2) 옵션은 반드시 파란색 글자만 남긴 마스크에서 별도 OCR.
        //    분홍 옵션/빨간 디메리트가 일반 옵션으로 섞이는 것을 막는다.
        const [{ data:{ text, confidence:baseConfidence } }, cGrade] = await Promise.all([
          worker.recognize(f.path),
          colorGrade(f.path)
        ]);
        const blue = await recognizeBlueOptions(worker, f.path);
        const header = await recognizeEquipmentHeader(worker, f.path);

        const txt = normalizeOCR(text);
        const equipmentName = extractEquipmentName(header);
        const combinedText = normalizeOCR(header.text+' '+txt);
        const found = blue.found;

        const tierHits = [];
        if(/심연/.test(combinedText)) tierHits.push('abyss');
        if(/혼돈/.test(combinedText)) tierHits.push('chaos');
        if(/태초/.test(combinedText)) tierHits.push('origin');
        const rangeTier=inferTierFromOptionRanges(blue.blueLines);
        if(rangeTier && !tierHits.includes(rangeTier)) tierHits.push(rangeTier);
        const tier = tierHits.length===1 ? tierHits[0] : (rangeTier || null);

        const slotHits = [];
        for(const [key, re] of slotMap){
          if(re.test(combinedText) && !slotHits.includes(key)) slotHits.push(key);
        }
        const slot = slotHits.length===1 ? slotHits[0] : null;

        const specialText = normalizeOCR((equipmentName||'')+' '+header.text+' '+combinedText);
        const special = slot ? detectSpecial(specialText, slot) : null;
        const fixed = fixedSpecial[special] || [];
        const opts = [...new Set([...fixed, ...found])];
        const grade = cGrade || textGrade(txt, tier);

        // 자동등록은 보수적으로:
        // - 부위 1개 확정
        // - 단계 1개 확정
        // - 파란 유효옵션(+유니크 고정옵션)이 정확히 4개
        // 그 외는 전부 확인 필요로 보낸다.
        const exactFour = opts.length===4;
        const complete = !!(slot && tier && exactFour);
        const reason = complete ? '' :
          !slot ? (slotHits.length>1 ? '부위 후보가 여러 개 인식됨' : '부위를 인식하지 못함') :
          !tier ? (tierHits.length>1 ? '장비 단계 후보가 여러 개 인식됨' : '장비 단계를 인식하지 못함') :
          opts.length<4 ? `파란 유효 옵션 ${opts.length}/4개 인식` :
          `파란 유효 옵션이 ${opts.length}개로 과다 인식됨`;

        const uncertainFields=[];
        if(!slot) uncertainFields.push('부위');
        if(!tier) uncertainFields.push('단계');
        if(opts.length<4) uncertainFields.push(`옵션 ${4-opts.length}개`);
        if(opts.length>4) uncertainFields.push('옵션 중복/과다');

        console.log('[OCR RESULT]', JSON.stringify({
          jobId:job.id,index:i,name:f.originalName,complete,reason,
          slot,tier,special,opts,
          blueLineCount:blue.blueLineCount,
          blueLines:blue.blueLines,
          decisions:blue.decisions,
          blueConfidence:blue.confidence,
          equipmentName,
          headerText:header.text,
          headerLines:header.lines,
          headerConfidence:header.confidence,
          baseConfidence:Number(baseConfidence||0)
        }));

        job.results[i] = {
          index:i,
          name:f.originalName,
          imageUrl:`/uploads/${job.id}/${path.basename(f.path)}`,
          complete,
          reason,
          uncertainFields,
          data:{
            slot,
            tier,
            special:special || 'normal',
            grade,
            opts:opts.slice(0,4),
            found,
            blueText:blue.blueText,
            blueLines:blue.blueLines,
            blueLineCount:blue.blueLineCount,
            optionDecisions:blue.decisions,
            blueConfidence:blue.confidence,
            equipmentName,
            headerText:header.text,
            headerLines:header.lines,
            headerConfidence:header.confidence,
            baseConfidence:Number(baseConfidence||0),
            slotCandidates:slotHits,
            tierCandidates:tierHits
          }
        };
      }catch(err){
        console.error('[OCR ERROR]', f.originalName, err?.stack || err);
        job.results[i] = {
          index:i,
          name:f.originalName,
          imageUrl:`/uploads/${job.id}/${path.basename(f.path)}`,
          complete:false,
          reason:'OCR 분석 실패: '+String(err?.message || err),
          data:{
            slot:null,
            tier:null,
            special:'normal',
            grade:'unknown',
            opts:[],
            found:[]
          }
        };
      }

      job.done = i+1;
      await writeJob(job);
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    await writeJob(job);
  }finally{
    await worker.terminate();
  }
}

app.post('/api/jobs', upload.array('images',60), async (req,res)=>{
  if(!req.files?.length) return res.status(400).json({ error:'images required' });

  const id = req.jobId;
  const job = {
    id,
    status:'queued',
    createdAt:new Date().toISOString(),
    current:0,
    done:0,
    total:req.files.length,
    files:req.files.map(f=>({ originalName:f.originalname, path:f.path })),
    results:Array(req.files.length).fill(null)
  };

  await writeJob(job);

  queue = queue
    .then(()=>processJob(job))
    .catch(async e=>{
      job.status='failed';
      job.error=String(e?.message || e);
      await writeJob(job);
    });

  res.status(202).json({ id, total:job.total, status:job.status });
});

app.get('/api/jobs/:id', async (req,res)=>{
  try{
    res.json(await readJob(req.params.id));
  }catch{
    res.status(404).json({ error:'job not found' });
  }
});

app.get('/api/health', (req,res)=>res.json({ ok:true }));

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`EHT OCR server listening on ${port}`));
