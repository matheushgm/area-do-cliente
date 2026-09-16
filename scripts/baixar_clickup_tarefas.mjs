// Baixa toda a hierarquia + tarefas do space Clientes do ClickUp para um JSON.
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/\\n/g,'')]}))
const TOKEN = env.CLICKUP_API_TOKEN
const SPACE = env.CLICKUP_CLIENTES_SPACE_ID || '90090377342'
const OUT = process.argv[2]
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms))
let n=0
async function cu(path){
  for (let tent=0; tent<6; tent++){
    const res = await fetch('https://api.clickup.com/api/v2'+path,{headers:{Authorization:TOKEN}})
    n++
    if (res.status===429){ const w = Number(res.headers.get('retry-after')||30); console.error('429, esperando',w); await sleep(w*1000+500); continue }
    const j = await res.json().catch(()=>null)
    if(!res.ok){ console.error('ERR',res.status,path,JSON.stringify(j).slice(0,200)); if(res.status>=500){await sleep(3000);continue} return null }
    return j
  }
  return null
}
const space = await cu(`/space/${SPACE}`)
const folders = (await cu(`/space/${SPACE}/folder?archived=false`))?.folders||[]
const looseLists = (await cu(`/space/${SPACE}/list?archived=false`))?.lists||[]
const out = { space:{id:space.id,name:space.name,statuses:space.statuses}, folders:[], looseLists, tasks:[] }
for (const f of folders){
  out.folders.push({ id:f.id, name:f.name, orderindex:f.orderindex, lists:(f.lists||[]).map(l=>({id:l.id,name:l.name,orderindex:l.orderindex,statuses:l.statuses,task_count:l.task_count,content:l.content})) })
}
const allLists = [...looseLists.map(l=>({...l,folderId:null})), ...folders.flatMap(f=>(f.lists||[]).map(l=>({...l,folderId:f.id})))]
console.error('listas:',allLists.length)
for (const l of allLists){
  for (let page=0; page<50; page++){
    const r = await cu(`/list/${l.id}/task?include_closed=true&subtasks=true&include_markdown_description=true&page=${page}`)
    const batch = r?.tasks||[]
    for (const t of batch) out.tasks.push({...t, _listId:l.id, _folderId:l.folderId})
    if (!r || r.last_page===true || batch.length<100) break
  }
  console.error(l.name, l.id, 'acum', out.tasks.length, 'req', n)
}
fs.writeFileSync(OUT, JSON.stringify(out))
console.error('DONE tasks', out.tasks.length, 'requests', n)
