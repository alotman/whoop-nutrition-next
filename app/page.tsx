'use client';
import React, { useMemo, useState, useEffect } from 'react';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const GOALS: Record<string, number> = { calories:2500, protein:190, carbs:250, fat:75, fiber:30, sodium:3000, potassium:4000, calcium:1200, magnesium:450, addedSugar:50 };
type Meal = { name:string, time?:string, kcal:number, protein:number, carbs:number, fat:number, fiber:number, sodium:number, potassium:number, calcium:number, magnesium:number, addedSugar:number };

const toNum=(x:any)=>{ const n = Number(String(x??'').replace(/[^0-9.\-]/g,'')); return isFinite(n)?n:0; };
const todayISO=()=>new Date().toISOString().slice(0,10);
const parseCSV=(file: File, onDone: (rows:any[])=>void)=>Papa.parse(file,{header:true,skipEmptyLines:true,complete:(res:any)=>onDone(res.data)});
const normalizeCycles=(rows:any[])=>rows.map(r=>({date:String(r['Cycle start time']||'').slice(0,10),recovery:toNum(r['Recovery score %']),strain:toNum(r['Strain score']),hrv:toNum(r['HRV (ms)']),rhr:toNum(r['Resting heart rate (bpm)']),sleep_perf:toNum(r['Sleep performance %']),calories_burned:toNum(r['Calories burned (kCal)'])}));
const normalizeSleeps=(rows:any[])=>rows.map(r=>({date:String(r['Cycle start time']||r['Start time']||'').slice(0,10),sleep_hours:toNum(r['Sleep duration (hours)']??r['Duration (hours)']),sleep_perf:toNum(r['Performance %']??r['Sleep performance %'])}));
const normalizeWorkouts=(rows:any[])=>rows.map(r=>({date:String(r['Start time']||'').slice(0,10),type:r['Activity type'],strain:toNum(r['Strain score']),kcal:toNum(r['Calories burned (kCal)']),duration_min:toNum(r['Duration (minutes)']),distance_m:toNum(r['Distance (meters)'])}));

function aggregate(items:Meal[], supp:any={}){
  const base = items.reduce((a:any,m:any)=>({
    calories:a.calories+(m.kcal||0), protein:a.protein+(m.protein||0), carbs:a.carbs+(m.carbs||0), fat:a.fat+(m.fat||0), fiber:a.fiber+(m.fiber||0),
    sodium:a.sodium+(m.sodium||0), potassium:a.potassium+(m.potassium||0), calcium:a.calcium+(m.calcium||0), magnesium:a.magnesium+(m.magnesium||0),
    addedSugar:a.addedSugar+(m.addedSugar||0),
  }), {calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0,potassium:0,calcium:0,magnesium:0,addedSugar:0});
  if(supp?.ag1){ base.calories+=50; base.carbs+=6; base.sodium+=40; }
  if(supp?.lmnt_servings){ base.sodium += (supp.lmnt_servings||0)*1000; }
  return base;
}
function mergeDaily(whoop:any, meals:any, supps:any){
  const dates = new Set([...Object.keys(meals||{}),...(whoop.cycles||[]).map((x:any)=>x.date),...(whoop.sleeps||[]).map((x:any)=>x.date),...(whoop.workouts||[]).map((x:any)=>x.date)]);
  return Array.from(dates).sort().map((d:any)=>{
    const totals = aggregate(meals[d]||[], supps[d]);
    const cyc=(whoop.cycles||[]).find((x:any)=>x.date===d)||{};
    const slp=(whoop.sleeps||[]).find((x:any)=>x.date===d)||{};
    const wks=(whoop.workouts||[]).filter((x:any)=>x.date===d);
    const kcal_burned=wks.reduce((a:number,b:any)=>a+(b.kcal||0),0)||cyc.calories_burned||0;
    return {date:d,...totals,ag1:(supps[d]||{}).ag1||false,creatine_g:(supps[d]||{}).creatine_g||0,lmnt_servings:(supps[d]||{}).lmnt_servings||0,
      recovery:cyc.recovery||0,strain:cyc.strain||0,hrv:cyc.hrv||0,rhr:cyc.rhr||0,sleep_hours:slp.sleep_hours||0,kcal_burned};
  });
}

export default function Page(){
  const [date,setDate]=useState(todayISO());
  const [tab,setTab]=useState<'dashboard'|'nutrition'|'whoop'>('dashboard');
  const [meals,setMeals]=useState<any>({});
  const [supps,setSupps]=useState<any>({});
  const [whoop,setWhoop]=useState<any>({cycles:[],sleeps:[],workouts:[]});

  useEffect(()=>{ try{const m=localStorage.getItem('meals'); if(m) setMeals(JSON.parse(m));}catch{} },[]);
  useEffect(()=>{ try{const s=localStorage.getItem('supps'); if(s) setSupps(JSON.parse(s));}catch{} },[]);
  useEffect(()=>{ try{const w=localStorage.getItem('whoop'); if(w) setWhoop(JSON.parse(w));}catch{} },[]);
  useEffect(()=>{ localStorage.setItem('meals', JSON.stringify(meals)); },[meals]);
  useEffect(()=>{ localStorage.setItem('supps', JSON.stringify(supps)); },[supps]);
  useEffect(()=>{ localStorage.setItem('whoop', JSON.stringify(whoop)); },[whoop]);

  const dayMeals:Meal[] = meals[date]||[];
  const totals = useMemo(()=>aggregate(dayMeals, supps[date]),[dayMeals,supps,date]);
  const merged = useMemo(()=>mergeDaily(whoop,meals,supps),[whoop,meals,supps]);

  const addMeal=(m:Meal)=>{ const next={...meals}; const arr:Meal[]=next[date]?[...next[date]]:[]; arr.push({...m,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}); next[date]=arr; setMeals(next); };
  const deleteMeal=(i:number)=>{ const next={...meals}; next[date]=(next[date]||[]).filter((_:any,idx:number)=>idx!==i); setMeals(next); };
  const setSupp=(k:string,v:any)=>{ const next={...supps}; next[date]={...(next[date]||{}),[k]:v}; setSupps(next); };
  const onUpload=(file:File,kind:'cycles'|'sleeps'|'workouts')=>parseCSV(file,(rows)=>{
    if(kind==='cycles') setWhoop((w:any)=>({...w,cycles:normalizeCycles(rows)}));
    if(kind==='sleeps') setWhoop((w:any)=>({...w,sleeps:normalizeSleeps(rows)}));
    if(kind==='workouts') setWhoop((w:any)=>({...w,workouts:normalizeWorkouts(rows)}));
  });
  const exportMerged=()=>{
    const rows = merged.map((r:any)=>({date:r.date,calories:r.calories,protein:r.protein,carbs:r.carbs,fat:r.fat,fiber:r.fiber,sodium:r.sodium,potassium:r.potassium,calcium:r.calcium,magnesium:r.magnesium,addedSugar:r.addedSugar,ag1:r.ag1?1:0,creatine_g:r.creatine_g||0,lmnt_servings:r.lmnt_servings||0,recovery:r.recovery,strain:r.strain,hrv:r.hrv,rhr:r.rhr,sleep_hours:r.sleep_hours,kcal_burned:r.kcal_burned}));
    const csv = Papa.unparse(rows); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='merged_whoop_nutrition.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (<div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <h1>WHOOP + Nutrition Tracker</h1>
      <div style={{display:'flex',gap:8}}>
        <input type="date" value={date} onChange={(e)=>setDate((e.target as HTMLInputElement).value)} />
        <button onClick={exportMerged} style={btn}>Export CSV</button>
      </div>
    </div>
    <div style={{display:'flex',gap:8,margin:'12px 0'}}>
      {(['dashboard','nutrition','whoop'] as const).map(t=>(<button key={t} onClick={()=>setTab(t)} style={{...pill,background:tab===t?'#4f46e5':'#1e1e1e'}}>{t.toUpperCase()}</button>))}
    </div>

    {tab==='dashboard' && (<div style={grid2 as any}>
      <Card><h2>Today Overview — {date}</h2><Totals totals={totals}/></Card>
      <Card><h2>WHOOP Today</h2><WhoopToday whoop={whoop} date={date}/></Card>
      <Card style={{gridColumn:'1 / -1'}}><h2>7‑Day Trends</h2><Trends merged={merged}/></Card>
    </div>)}

    {tab==='nutrition' && (<div>
      <Card><h2>Add Meal / Snack</h2><MealForm onAdd={addMeal}/>
        <h3 style={{color:'#9ca3af'}}>Meals for {date}</h3>
        <MealList items={dayMeals} onDelete={deleteMeal}/>
        <h3 style={{color:'#9ca3af'}}>Supplements</h3>
        <Supps supp={supps[date]||{}} setSupp={setSupp}/>
        <div style={{height:10}}/>
        <Totals totals={totals}/>
      </Card>
    </div>)}

    {tab==='whoop' && (<div>
      <Card>
        <h2>Upload WHOOP CSVs</h2>
        <Uploader label="physiological_cycles.csv" onFile={(f)=>onUpload(f,'cycles')}/>
        <div style={{height:10}}/>
        <Uploader label="sleeps.csv" onFile={(f)=>onUpload(f,'sleeps')}/>
        <div style={{height:10}}/>
        <Uploader label="workouts.csv" onFile={(f)=>onUpload(f,'workouts')}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:12}}>
          <Stat title="Records (cycles)" value={(whoop.cycles||[]).length}/>
          <Stat title="Records (sleeps)" value={(whoop.sleeps||[]).length}/>
          <Stat title="Records (workouts)" value={(whoop.workouts||[]).length}/>
        </div>
      </Card>
    </div>)}
  </div>);
}

const pill:React.CSSProperties={padding:'8px 12px',border:'1px solid #2a2a2a',borderRadius:999};
const btn:React.CSSProperties={background:'#4f46e5',color:'#fff',border:0,borderRadius:10,padding:'10px 14px',fontWeight:600,cursor:'pointer'};
const cardStyle:React.CSSProperties={background:'#121212',border:'1px solid #2a2a2a',borderRadius:14,padding:16};
let grid2:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr',gap:16}; if(typeof window!=='undefined' && window.innerWidth>900){ grid2={...grid2,gridTemplateColumns:'1fr 1fr'}; }
function Card({children,style}:{children:React.ReactNode,style?:React.CSSProperties}){ return <div style={{...cardStyle, ...(style||{})}}>{children}</div>; }
function BarRow({label,val,goal,unit}:{label:string,val:number,goal:number,unit:string}){ const pct=goal?Math.min(100,Math.round((val/goal)*100)):0; return (<div><div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#9ca3af'}}>{label}</div><div>{Math.round(val)} {unit} <span style={{color:'#9ca3af'}}>/ {goal}{unit}</span></div></div><div style={{height:8,background:'#1e1e1e',borderRadius:999,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:'#4f46e5'}}/></div></div>); }
function Totals({totals}:{totals:any}){ const items=[['Calories','calories','kcal'],['Protein','protein','g'],['Carbs','carbs','g'],['Fat','fat','g'],['Added Sugar','addedSugar','g'],['Fiber','fiber','g'],['Sodium','sodium','mg']]; return (<div style={{display:'grid',gap:10}}>{items.map(([l,k,u])=><BarRow key={k as string} label={l as string} val={totals[k as string]||0} goal={GOALS[k as string]||0} unit={u as string}/>)}</div>); }
function WhoopToday({whoop,date}:{whoop:any,date:string}){ const c=(whoop.cycles||[]).find((x:any)=>x.date===date)||{}; const s=(whoop.sleeps||[]).find((x:any)=>x.date===date)||{}; const w=(whoop.workouts||[]).filter((x:any)=>x.date===date); const kcal=(w||[]).reduce((a:number,b:any)=>a+(b.kcal||0),0)||c.calories_burned||0; const stats=[['Recovery %',c.recovery||0,'%'],['Strain',c.strain||0,''],['HRV',c.hrv||0,' ms'],['RHR',c.rhr||0,' bpm'],['Sleep',s.sleep_hours||0,' h'],['Activity kcal',kcal||0,' kcal']]; return (<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{stats.map(([t,v,suf])=><Stat key={t as string} title={t as string} value={`${v}${suf}`}/>)}</div>); }
function Trends({merged}:{merged:any[]}){ const last7=merged.slice(-7); return (<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><div style={{height:260}}><ResponsiveContainer width="100%" height="100%"><LineChart data={last7}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a"/><XAxis dataKey="date" stroke="#9ca3af"/><YAxis stroke="#9ca3af"/><Tooltip/><Legend/><Line type="monotone" dataKey="recovery" name="Recovery %" stroke="#60a5fa"/><Line type="monotone" dataKey="strain" name="Strain" stroke="#34d399"/></LineChart></ResponsiveContainer></div><div style={{height:260}}><ResponsiveContainer width="100%" height="100%"><BarChart data={last7}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a"/><XAxis dataKey="date" stroke="#9ca3af"/><YAxis stroke="#9ca3af"/><Tooltip/><Legend/><Bar dataKey="protein" name="Protein (g)" fill="#a78bfa"/><Bar dataKey="carbs" name="Carbs (g)" fill="#f472b6"/><Bar dataKey="calories" name="Calories" fill="#f59e0b"/></BarChart></ResponsiveContainer></div></div>); }
function MealForm({onAdd}:{onAdd:(m:Meal)=>void}){ const [name,setName]=useState(''); const [kcal,setKcal]=useState(''); const [protein,setProtein]=useState(''); const [carbs,setCarbs]=useState(''); const [fat,setFat]=useState(''); const [fiber,setFiber]=useState(''); const [sodium,setSodium]=useState(''); const [potassium,setPotassium]=useState(''); const [calcium,setCalcium]=useState(''); const [magnesium,setMagnesium]=useState(''); const [addedSugar,setAddedSugar]=useState(''); return (<div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:10}}><div style={{gridColumn:'span 2'}}><label>Name</label><input value={name} onChange={e=>setName((e.target as HTMLInputElement).value)} placeholder="e.g. Chipotle Bowl"/></div>{([['kcal',kcal,setKcal],['P',protein,setProtein],['C',carbs,setCarbs],['F',fat,setFat],['Fiber',fiber,setFiber],['Na',sodium,setSodium],['K',potassium,setPotassium],['Ca',calcium,setCalcium],['Mg',magnesium,setMagnesium],['Added Sugar',addedSugar,setAddedSugar]] as const).map(([lab,val,set],i)=>(<div key={i}><label>{lab}</label><input type="number" value={val} onChange={e=>set((e.target as HTMLInputElement).value)}/></div>))}<div style={{gridColumn:'1 / -1'}}><button style={btn} onClick={()=>{ if(!name) return; onAdd({name,kcal:+kcal||0,protein:+protein||0,carbs:+carbs||0,fat:+fat||0,fiber:+fiber||0,sodium:+sodium||0, potassium:+potassium||0,calcium:+calcium||0,magnesium:+magnesium||0,addedSugar:+addedSugar||0}); [setName,setKcal,setProtein,setCarbs,setFat,setFiber,setSodium,setPotassium,setCalcium,setMagnesium,setAddedSugar].forEach(fn=>fn('')); }}>Add</button></div></div>); }
function MealList({items,onDelete}:{items:Meal[],onDelete:(i:number)=>void}){ if(!items.length) return <div style={{color:'#9ca3af'}}>No meals logged yet.</div>; return (<div style={{display:'grid',gap:10}}>{items.map((m,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(255,255,255,.03)',border:'1px solid #2a2a2a',padding:'10px 12px',borderRadius:10}}><div><div style={{fontWeight:600}}>{m.name} <span style={{color:'#9ca3af',fontSize:12}}>{m.time}</span></div><div style={{color:'#9ca3af'}}>{m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat} · Added sugar {m.addedSugar}g</div></div><button onClick={()=>onDelete(i)} style={{...btn,background:'#27272a',border:'1px solid #2a2a2a'}}>Delete</button></div>))}</div>); }
function Supps({supp,setSupp}:{supp:any,setSupp:(k:string,v:any)=>void}){ return (<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}><div><label>AG1</label><div><button onClick={()=>setSupp('ag1',!supp?.ag1)} style={{...btn,background:supp?.ag1?'#4f46e5':'#27272a',border:supp?.ag1?0:'1px solid #2a2a2a'}}>{supp?.ag1?'Logged':'Log AG1'}</button></div></div><div><label>Creatine (g)</label><input type="number" value={supp?.creatine_g??''} onChange={e=>setSupp('creatine_g',+(e.target as HTMLInputElement).value)}/></div><div><label>LMNT servings</label><input type="number" value={supp?.lmnt_servings??''} onChange={e=>setSupp('lmnt_servings',+(e.target as HTMLInputElement).value)}/></div></div>); }
function Uploader({label,onFile}:{label:string,onFile:(f:File)=>void}){ return (<div style={{padding:12,background:'#121212',border:'1px solid #2a2a2a',borderRadius:10}}><label>{label}</label><input type="file" accept=".csv" onChange={(e)=>e.target.files && onFile(e.target.files[0])}/></div>); }
function Stat({title,value}:{title:string,value:any}){ return (<div style={{background:'rgba(255,255,255,.03)',border:'1px solid #2a2a2a',padding:12,borderRadius:10}}><div style={{color:'#9ca3af',fontSize:12}}>{title}</div><div style={{fontSize:20,fontWeight:700}}>{value??0}</div></div>); }
