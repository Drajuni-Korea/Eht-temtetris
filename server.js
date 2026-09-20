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

function detectSpecial(txt, slot) {
  const list = specialBySlot[slot] || [];
  const noSpace = txt.replace(/\s+/g, '');
  for (const [key, label] of list) {
    if (key === 'normal') continue;
    if (noSpace.includes(label.replace(/\s+/g, ''))) return key;
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
        const [{ data:{ text } }, cGrade] = await Promise.all([
          worker.recognize(f.path),
          colorGrade(f.path)
        ]);

        const txt = normalizeOCR(text);
        const found = [];

        for(const [key, re] of patterns){
          if(re.test(txt) && !found.includes(key)) found.push(key);
        }

        let tier = null;
        if(/심연/.test(txt)) tier = 'abyss';
        else if(/혼돈/.test(txt)) tier = 'chaos';
        else if(/태초/.test(txt)) tier = 'origin';

        let slot = null;
        for(const [key, re] of slotMap){
          if(re.test(txt)){
            slot = key;
            break;
          }
        }

        const special = slot ? detectSpecial(txt, slot) : null;
        const fixed = fixedSpecial[special] || [];
        const opts = [...new Set([...fixed, ...found])].slice(0,4);
        const grade = cGrade || textGrade(txt, tier);

        const complete = !!(slot && tier && opts.length===4);
        const reason = complete ? '' :
          !slot ? '부위를 인식하지 못함' :
          !tier ? '장비 단계를 인식하지 못함' :
          `유효 옵션 ${opts.length}/4개 인식`;

        job.results[i] = {
          index:i,
          name:f.originalName,
          imageUrl:`/uploads/${job.id}/${path.basename(f.path)}`,
          complete,
          reason,
          data:{
            slot,
            tier,
            special:special || 'normal',
            grade,
            opts,
            found
          }
        };
      }catch{
        job.results[i] = {
          index:i,
          name:f.originalName,
          imageUrl:`/uploads/${job.id}/${path.basename(f.path)}`,
          complete:false,
          reason:'OCR 분석 실패',
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
