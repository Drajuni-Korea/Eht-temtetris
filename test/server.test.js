import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('Server serves the shared database as JavaScript and the module-based UI',async()=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'eht-test-'));
  const child=spawn(process.execPath,['server.js'],{
    cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  let output='';
  try {
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error(`Server startup timed out: ${output}`)),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`));});
      child.stderr.on('data',chunk=>{output+=chunk;});
      child.stdout.on('data',chunk=>{
        output+=chunk;
        const match=output.match(/listening on (\d+)/);
        if(match){clearTimeout(timer);resolve(match[1]);}
      });
    });
    const base=`http://127.0.0.1:${port}`;
    const health=await fetch(base+'/api/health');
    assert.deepEqual(await health.json(),{ok:true});
    const db=await fetch(base+'/equipment-db.js');
    assert.match(db.headers.get('content-type'),/javascript/);
    assert.match(await db.text(),/export const abyssUniques/);
    const html=await (await fetch(base)).text();
    assert.match(html,/<script type="module">/);
    assert.match(html,/from '\.\/equipment-db\.js'/);
  } finally {
    const exited=once(child,'exit');
    if(child.exitCode===null){child.kill();await exited;}
    assert.equal(path.dirname(path.resolve(dataDir)),path.resolve(tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('eht-test-'));
    await rm(dataDir,{recursive:true,force:true});
  }
});
