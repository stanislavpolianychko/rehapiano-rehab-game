// // /static/app.js
// (function () {
//   // ---------- DOM ----------
//   const wsState   = document.getElementById('wsState');
//   const devicesEl = document.getElementById('devices');
//   const logEl     = document.getElementById('log');

//   // Charts (niektoré môžu v starom HTML chýbať – fallback nižšie)
//   const elChartAdc   = document.getElementById('chart-adc');
//   const elChartAcc   = document.getElementById('chart-acc');
//   const elChartGyro  = document.getElementById('chart-gyro');   // existuje aj v starom HTML
//   const elChartEuler = document.getElementById('chart-euler');  // nový
//   const elChartGrav  = document.getElementById('chart-grav');   // nový
//   const elChartMag   = document.getElementById('chart-mag');
//   const elChartQuat  = document.getElementById('chart-quat');   // nový
//   const elChartTemp  = document.getElementById('chart-temp');   // nový

//   // Port labels (optional)
//   const elPortAdc   = document.getElementById('chartPortAdc');
//   const elPortAcc   = document.getElementById('chartPortAcc');
//   const elPortGyro  = document.getElementById('chartPortGyro');
//   const elPortEuler = document.getElementById('chartPortEuler');
//   const elPortGrav  = document.getElementById('chartPortGrav');
//   const elPortMag   = document.getElementById('chartPortMag');
//   const elPortQuat  = document.getElementById('chartPortQuat');
//   const elPortTemp  = document.getElementById('chartPortTemp');

//   const elActivePort = document.getElementById('activePort');

//   // Motor UI
//   const motorForm  = document.querySelector('.motor-panel');
//   const btnSendAll = document.getElementById('btnSendAll');

//   const btnFreeze  = document.getElementById('btnFreeze');

//   // ---------- Stav ----------
//   const devices = new Map();  // port -> stav pre zoznam
//   let activePort = null;      // port vybraného zariadenia (pre grafy)
//   let frozen = false;         // keď true: ignorujeme 'sample' správy

//   // uľahčujúce flagy – zistíme, čo v HTML naozaj je
//   const HAS_EULER = !!elChartEuler;
//   const HAS_GRAV  = !!elChartGrav;
//   const HAS_QUAT  = !!elChartQuat;
//   const HAS_TEMP  = !!elChartTemp;

//   // ak Euler chýba, použijeme pôvodný „Gyroscope“ graf na Pitch/Roll/Yaw
//   const GYRO_MODE = HAS_EULER ? 'gyro' : 'eulerLegacy';

//   // jednorazové hlášky, nech nespamujeme log
//   const once = new Set();
//   function onceLog(tag, msg){ if(once.has(tag)) return; once.add(tag); log(msg); }
//   function onceWarnMissing(id){ onceLog('missing_'+id, `[UI] Pozor: v HTML chýba #${id} – dáta sa vykreslia fallbackom, prípadne sa nevykreslia.`); }

//   // limity bufferov
//   const LEN = 1000;
//   function pushLimited(arr, v){ arr.push(v); if(arr.length>LEN) arr.shift(); }
//   function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

//   // ---- API paths & fingers ----
//   const API_MOTOR_PATH = '/api/haptic';
//   const FINGER_ORDER = ['little','ring','middle','index','thumb'];
//   const FINGER_INDEX = Object.fromEntries(FINGER_ORDER.map((n,i)=>[n,i]));

//   // ---------- Buffre pre jednotlivé zariadenia ----------
//   const adcBufs   = new Map(); // port -> {base,t,m,pr,pro,uk,pa}
//   const accBufs   = new Map(); // port -> {base,t,ax,ay,az}
//   const gyroBufs  = new Map(); // port -> {base,t,gx,gy,gz}  (skutočné gyro)
//   const eulerBufs = new Map(); // port -> {base,t,pitch,roll,yaw}
//   const gravBufs  = new Map(); // port -> {base,t,gx,gy,gz}
//   const magBufs   = new Map(); // port -> {base,t,mx,my,mz}
//   const quatBufs  = new Map(); // port -> {base,t,qw,qx,qy,qz}
//   const tempBufs  = new Map(); // port -> {base,t,temp}

//   function ensureAdcBuf(p){
//     let b=adcBufs.get(p);
//     if(!b){ b={base:null,t:[],m:[],pr:[],pro:[],uk:[],pa:[]}; adcBufs.set(p,b); }
//     return b;
//   }
//   function ensureAccBuf(p){
//     let b=accBufs.get(p);
//     if(!b){ b={base:null,t:[],ax:[],ay:[],az:[]}; accBufs.set(p,b); }
//     return b;
//   }
//   function ensureGyroBuf(p){
//     let b=gyroBufs.get(p);
//     if(!b){ b={base:null,t:[],gx:[],gy:[],gz:[]}; gyroBufs.set(p,b); }
//     return b;
//   }
//   function ensureEulerBuf(p){
//     let b=eulerBufs.get(p);
//     if(!b){ b={base:null,t:[],pitch:[],roll:[],yaw:[]}; eulerBufs.set(p,b); }
//     return b;
//   }
//   function ensureGravBuf(p){
//     let b=gravBufs.get(p);
//     if(!b){ b={base:null,t:[],gx:[],gy:[],gz:[]}; gravBufs.set(p,b); }
//     return b;
//   }
//   function ensureMagBuf(p){
//     let b=magBufs.get(p);
//     if(!b){ b={base:null,t:[],mx:[],my:[],mz:[]}; magBufs.set(p,b); }
//     return b;
//   }
//   function ensureQuatBuf(p){
//     let b=quatBufs.get(p);
//     if(!b){ b={base:null,t:[],qw:[],qx:[],qy:[],qz:[]}; quatBufs.set(p,b); }
//     return b;
//   }
//   function ensureTempBuf(p){
//     let b=tempBufs.get(p);
//     if(!b){ b={base:null,t:[],temp:[]}; tempBufs.set(p,b); }
//     return b;
//   }

//   function relT(buf, t){
//     if(buf.base==null) buf.base = +t;
//     return +t - buf.base;
//   }

//   // ---------- uPlot dátové polia a inštancie ----------
//   let dAdc   = [[],[],[],[],[],[]],  uAdc   = null;
//   let dAcc   = [[],[],[],[]],        uAcc   = null;
//   let dGyro  = [[],[],[],[]],        uGyro  = null;   // podľa GYRO_MODE
//   let dEuler = [[],[],[],[]],        uEuler = null;   // len ak je chart-euler
//   let dGrav  = [[],[],[],[]],        uGrav  = null;   // len ak je chart-grav
//   let dMag   = [[],[],[],[]],        uMag   = null;
//   let dQuat  = [[],[],[],[],[]],     uQuat  = null;   // len ak je chart-quat
//   let dTemp  = [[],[]],              uTemp  = null;   // len ak je chart-temp

//   // ---------- Log helper ----------
//   function log(s){
//     if(!logEl) return;
//     const div=document.createElement('div');
//     div.textContent=s;
//     logEl.prepend(div);
//     if(logEl.childNodes.length>400) logEl.removeChild(logEl.lastChild);
//   }

//   // ---------- Freeze toggle ----------
//   function setFrozen(v){
//     frozen = !!v;
//     if(btnFreeze){
//       btnFreeze.setAttribute('aria-pressed', frozen ? 'true' : 'false');
//       btnFreeze.title = frozen ? 'Obnoviť živé dáta' : 'Pozastaviť živé dáta';
//       btnFreeze.textContent = frozen ? 'Unfreeze' : 'Freeze';
//     }
//     document.body.classList.toggle('is-frozen', frozen);
//     log(frozen ? '[UI] Freeze ON – ignorujem sample správy' : '[UI] Freeze OFF – spracúvam sample správy');
//   }
//   btnFreeze?.addEventListener('click', ()=> setFrozen(!frozen));
//   setFrozen(false);

//   // ---------- REST helper ----------
//   async function apiPost(path, body){
//     const res = await fetch(path, {
//       method:'POST',
//       headers:{'Content-Type':'application/json'},
//       body: JSON.stringify(body||{})
//     });
//     if(!res.ok){
//       const t = await res.text().catch(()=> '');
//       throw new Error(`HTTP ${res.status}: ${t}`);
//     }
//     return res.json().catch(()=> ({}));
//   }

//   // ---------- UI: zariadenia ----------
//   function ensureDeviceEl(port){
//     let el = devicesEl.querySelector(`[data-port="${CSS.escape(port)}"]`);
//     if(!el){
//       el = document.createElement('li');
//       el.className = 'dev';
//       el.dataset.port = port;
//       el.innerHTML = `
//         <div class="top">
//           <div class="port"></div>
//           <span class="badge">—</span>
//         </div>
//         <div class="kv">
//           <span class="key">UID</span><span class="val uid">—</span>
//           <span class="key">FW</span><span class="val fw">—</span>
//           <span class="key">Posledný čas</span><span class="val ts">—</span>
//           <span class="key">ADC</span><span class="val adc" style="font-family:var(--mono)"></span>
//           <span class="key">ACC</span><span class="val acc">—</span>
//           <span class="key">GYRO</span><span class="val gyro">—</span>
//           <span class="key">EULER</span><span class="val euler">—</span>
//           <span class="key">GRAV</span><span class="val grav">—</span>
//           <span class="key">MAG</span><span class="val mag">—</span>
//           <span class="key">QUAT</span><span class="val quat">—</span>
//           <span class="key">TEMP</span><span class="val temp">—</span>
//         </div>
//         <div class="actions">
//           <button class="btn success btnCalib" title="Kalibrácia zariadenia">Calibrate</button>
//           <button class="btn danger btnReboot" title="Reštart zariadenia">Reboot</button>
//         </div>
//       `;

//       el.addEventListener('click', (e)=>{
//         if(e.target.closest('.actions')) return;
//         setActivePort(port);
//       });

//       el.querySelector('.btnCalib').addEventListener('click', async () => {
//         if(!confirm(`Spustiť kalibráciu na ${port}?`)) return;
//         try{
//           await apiPost('/api/calibration', {port});
//           log(`[API] Calibration OK on ${port}`);
//         }catch(e){
//           log(`[API] Calibration FAIL on ${port}: ${e.message}`);
//           alert(`Calibration failed: ${e.message}`);
//         }
//       });
//       el.querySelector('.btnReboot').addEventListener('click', async () => {
//         if(!confirm(`Naozaj reštartovať ${port}?`)) return;
//         try{
//           await apiPost('/api/reboot', {port});
//           log(`[API] Reboot OK on ${port}`);
//         }catch(e){
//           log(`[API] Reboot FAIL on ${port}: ${e.message}`);
//           alert(`Reboot failed: ${e.message}`);
//         }
//       });

//       devicesEl.appendChild(el);
//     }
//     return el;
//   }

//   function renderDevice(port){
//     const d = devices.get(port) || {};
//     const el = ensureDeviceEl(port);
//     el.classList.toggle('online', !!d.online);
//     el.classList.toggle('offline', !d.online);
//     el.classList.toggle('active', port === activePort);
//     el.querySelector('.port').textContent = port;
//     el.querySelector('.badge').textContent = d.online ? 'online' : 'offline';
//     el.querySelector('.uid').textContent = d.uid_hex || '—';
//     el.querySelector('.fw').textContent = (d.fw ?? '—');
//     el.querySelector('.ts').textContent = d.lastTs ? new Date(d.lastTs*1000).toLocaleTimeString() : '—';
//     el.querySelector('.adc').textContent = (d.lastAdc ? d.lastAdc.join(' ') : '');
//     el.querySelector('.acc').textContent = (d.lastAcc ? `[${d.lastAcc.join(', ')}]` : '—');
//     el.querySelector('.gyro').textContent = (d.lastGyro ? `[${d.lastGyro.join(', ')}]` : (d.lastEuler ? `[${d.lastEuler.join(', ')}]` : '—'));
//     el.querySelector('.euler').textContent= (d.lastEuler ? `[${d.lastEuler.join(', ')}]` : '—');
//     el.querySelector('.grav').textContent = (d.lastGrav ? `[${d.lastGrav.join(', ')}]` : '—');
//     el.querySelector('.mag').textContent = (d.lastMag ? `[${d.lastMag.join(', ')}]` : '—');
//     el.querySelector('.quat').textContent= (d.lastQuat ? `[${d.lastQuat.join(', ')}]` : '—');
//     el.querySelector('.temp').textContent= (typeof d.lastTemp==='number' ? `${d.lastTemp} °C` : '—');

//     el.querySelector('.btnCalib').disabled = !d.online;
//     el.querySelector('.btnReboot').disabled = !d.online;
//   }

//   function setActivePort(port){
//     activePort = port;
//     devicesEl.querySelectorAll('.dev').forEach(el=>{
//       el.classList.toggle('active', el.dataset.port === port);
//     });

//     elActivePort && (elActivePort.textContent = port || '—');
//     elPortAdc   && (elPortAdc.textContent   = port || '—');
//     elPortAcc   && (elPortAcc.textContent   = port || '—');
//     elPortGyro  && (elPortGyro.textContent  = port || '—');
//     elPortEuler && (elPortEuler.textContent = port || '—');
//     elPortGrav  && (elPortGrav.textContent  = port || '—');
//     elPortMag   && (elPortMag.textContent   = port || '—');
//     elPortQuat  && (elPortQuat.textContent  = port || '—');
//     elPortTemp  && (elPortTemp.textContent  = port || '—');

//     const bA = ensureAdcBuf(port);
//     dAdc[0]=bA.t; dAdc[1]=bA.m; dAdc[2]=bA.pr; dAdc[3]=bA.pro; dAdc[4]=bA.uk; dAdc[5]=bA.pa;
//     uAdc && uAdc.setData(dAdc);

//     const bC = ensureAccBuf(port);
//     dAcc[0]=bC.t; dAcc[1]=bC.ax; dAcc[2]=bC.ay; dAcc[3]=bC.az;
//     uAcc && uAcc.setData(dAcc);

//     if (GYRO_MODE==='gyro'){
//       const bG = ensureGyroBuf(port);
//       dGyro[0]=bG.t; dGyro[1]=bG.gx; dGyro[2]=bG.gy; dGyro[3]=bG.gz;
//     }else{
//       const bE = ensureEulerBuf(port);
//       dGyro[0]=bE.t; dGyro[1]=bE.pitch; dGyro[2]=bE.roll; dGyro[3]=bE.yaw;
//     }
//     uGyro && uGyro.setData(dGyro);

//     if (HAS_EULER){
//       const bE = ensureEulerBuf(port);
//       dEuler[0]=bE.t; dEuler[1]=bE.pitch; dEuler[2]=bE.roll; dEuler[3]=bE.yaw;
//       uEuler && uEuler.setData(dEuler);
//     }

//     if (HAS_GRAV){
//       const bGr = ensureGravBuf(port);
//       dGrav[0]=bGr.t; dGrav[1]=bGr.gx; dGrav[2]=bGr.gy; dGrav[3]=bGr.gz;
//       uGrav && uGrav.setData(dGrav);
//     }

//     const bM = ensureMagBuf(port);
//     dMag[0]=bM.t; dMag[1]=bM.mx; dMag[2]=bM.my; dMag[3]=bM.mz;
//     uMag && uMag.setData(dMag);

//     if (HAS_QUAT){
//       const bQ = ensureQuatBuf(port);
//       dQuat[0]=bQ.t; dQuat[1]=bQ.qw; dQuat[2]=bQ.qx; dQuat[3]=bQ.qy; dQuat[4]=bQ.qz;
//       uQuat && uQuat.setData(dQuat);
//     }

//     if (HAS_TEMP){
//       const bT = ensureTempBuf(port);
//       dTemp[0]=bT.t; dTemp[1]=bT.temp;
//       uTemp && uTemp.setData(dTemp);
//     }

//     log(`[UI] Aktívne zariadenie: ${port}`);
//     renderDevice(port);
//   }

//   // ---------- uPlot: tvorba grafov ----------
//   function makeAdcPlot(){
//     if(!elChartAdc) return;
//     uAdc = new uPlot({
//       width: elChartAdc.clientWidth, height: 260,
//       scales:{ x:{time:false} },
//       series: [
//         {}, // x
//         {label:'m',          width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'prstenník',  width:2, points:{show:false}, stroke:"#ff7f0e"},
//         {label:'prostredník',width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'ukazovák',   width:2, points:{show:false}, stroke:"#d62728"},
//         {label:'palec',      width:2, points:{show:false}, stroke:"#9467bd"},
//       ],
//       axes:[{},{label:'ADC'}],
//     }, dAdc, elChartAdc);
//     new ResizeObserver(()=> uAdc.setSize({width:elChartAdc.clientWidth,height:260})).observe(elChartAdc);
//   }

//   function makeAccPlot(){
//     if(!elChartAcc) return;
//     uAcc = new uPlot({
//       width: elChartAcc.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'Ax', width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'Ay', width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'Az', width:2, points:{show:false}, stroke:"#d62728"},
//       ],
//       axes:[{},{label:'m/s²'}],
//     }, dAcc, elChartAcc);
//     new ResizeObserver(()=> uAcc.setSize({width:elChartAcc.clientWidth,height:230})).observe(elChartAcc);
//   }

//   function makeGyroPlot(){
//     if(!elChartGyro) return;
//     const labels = (GYRO_MODE==='gyro')
//       ? ['GyroX','GyroY','GyroZ']
//       : ['Pitch','Roll','Yaw'];   // fallback – starý layout bez samostatného Euler grafu

//     if (GYRO_MODE==='eulerLegacy'){
//       onceWarnMissing('chart-euler');
//       onceLog('eulerLegacy', '[UI] Euler (Pitch/Roll/Yaw) sa bude vykresľovať do pôvodného „Gyroscope“ grafu.');
//     }

//     uGyro = new uPlot({
//       width: elChartGyro.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:labels[0], width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:labels[1], width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:labels[2], width:2, points:{show:false}, stroke:"#d62728"},
//       ],
//       axes:[{},{label:'°/s'}],
//     }, dGyro, elChartGyro);
//     new ResizeObserver(()=> uGyro.setSize({width:elChartGyro.clientWidth,height:230})).observe(elChartGyro);
//   }

//   function makeEulerPlot(){
//     if(!HAS_EULER || !elChartEuler) return;
//     uEuler = new uPlot({
//       width: elChartEuler.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'Pitch', width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'Roll',  width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'Yaw',   width:2, points:{show:false}, stroke:"#d62728"},
//       ],
//       axes:[{},{label:'°'}],
//     }, dEuler, elChartEuler);
//     new ResizeObserver(()=> uEuler.setSize({width:elChartEuler.clientWidth,height:230})).observe(elChartEuler);
//   }

//   function makeGravPlot(){
//     if(!HAS_GRAV || !elChartGrav){ onceWarnMissing('chart-grav'); return; }
//     uGrav = new uPlot({
//       width: elChartGrav.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'gravX', width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'gravY', width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'gravZ', width:2, points:{show:false}, stroke:"#d62728"},
//       ],
//       axes:[{},{label:'raw'}],
//     }, dGrav, elChartGrav);
//     new ResizeObserver(()=> uGrav.setSize({width:elChartGrav.clientWidth,height:230})).observe(elChartGrav);
//   }

//   function makeMagPlot(){
//     if(!elChartMag) return;
//     uMag = new uPlot({
//       width: elChartMag.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'Mx', width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'My', width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'Mz', width:2, points:{show:false}, stroke:"#d62728"},
//       ],
//       axes:[{},{label:'µT (raw)'}],
//     }, dMag, elChartMag);
//     new ResizeObserver(()=> uMag.setSize({width:elChartMag.clientWidth,height:230})).observe(elChartMag);
//   }

//   function makeQuatPlot(){
//     if(!HAS_QUAT || !elChartQuat){ onceWarnMissing('chart-quat'); return; }
//     uQuat = new uPlot({
//       width: elChartQuat.clientWidth, height: 230,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'Qw', width:2, points:{show:false}, stroke:"#1f77b4"},
//         {label:'Qx', width:2, points:{show:false}, stroke:"#2ca02c"},
//         {label:'Qy', width:2, points:{show:false}, stroke:"#d62728"},
//         {label:'Qz', width:2, points:{show:false}, stroke:"#9467bd"},
//       ],
//       axes:[{},{label:'raw'}],
//     }, dQuat, elChartQuat);
//     new ResizeObserver(()=> uQuat.setSize({width:elChartQuat.clientWidth,height:230})).observe(elChartQuat);
//   }

//   function makeTempPlot(){
//     if(!HAS_TEMP || !elChartTemp){ onceWarnMissing('chart-temp'); return; }
//     uTemp = new uPlot({
//       width: elChartTemp.clientWidth, height: 200,
//       scales:{ x:{time:false} },
//       series: [{},
//         {label:'°C', width:2, points:{show:false}, stroke:"#1f77b4"},
//       ],
//       axes:[{},{label:'°C'}],
//     }, dTemp, elChartTemp);
//     new ResizeObserver(()=> uTemp.setSize({width:elChartTemp.clientWidth,height:200})).observe(elChartTemp);
//   }

//   // vytvor grafy (prázdne)
//   makeAdcPlot();
//   makeAccPlot();
//   makeGyroPlot();
//   makeEulerPlot();
//   makeGravPlot();
//   makeMagPlot();
//   makeQuatPlot();
//   makeTempPlot();

//   // ---------- Motor: helpers ----------
//   function readFingerValues(finger){
//     const pwm = document.getElementById(`pwm-${finger}`);
//     const dur = document.getElementById(`dur-${finger}`);
//     return {
//       pwm: pwm ? Number(pwm.value) : 0,
//       duration_ms: dur ? Number(dur.value) : 0,
//     };
//   }

//   async function sendFinger(finger){
//     if(!activePort){
//       alert('Najprv vyber zariadenie vľavo.');
//       return;
//     }
//     const {pwm, duration_ms} = readFingerValues(finger);
//     const btn = motorForm?.querySelector(`.finger-group[data-finger="${finger}"] .actions .btn.primary`);
//     if(btn) btn.disabled = true;
//     try{
//       const payload = {
//         port: activePort,
//         finger: (FINGER_INDEX[finger] ?? 0) + 1,
//         pwm,
//         duration_ms
//       };
//       await apiPost(API_MOTOR_PATH, payload);
//       log(`[API] Motor OK (${finger}=${payload.finger}) port=${activePort} pwm=${pwm} dur=${duration_ms}ms`);
//     }catch(e){
//       log(`[API] Motor FAIL (${finger}) on ${activePort}: ${e.message}`);
//       alert(`Odoslanie zlyhalo (${finger}): ${e.message}`);
//     }finally{
//       if(btn) btn.disabled = false;
//     }
//   }

//   async function sendAll(){
//     if(!activePort){
//       alert('Najprv vyber zariadenie vľavo.');
//       return;
//     }
//     if(btnSendAll) btnSendAll.disabled = true;
//     try{
//       for(const finger of FINGER_ORDER){
//         const {pwm, duration_ms} = readFingerValues(finger);
//         const payload = {
//           port: activePort,
//           finger: (FINGER_INDEX[finger] ?? 0) + 1,
//           pwm,
//           duration_ms
//         };
//         await apiPost(API_MOTOR_PATH, payload);
//         log(`[API] Motor OK (${finger}=${payload.finger}) port=${activePort} pwm=${pwm} dur=${duration_ms}ms`);
//       }
//     }catch(e){
//       log(`[API] Motor FAIL (send all) on ${activePort}: ${e.message}`);
//       alert(`Odoslanie na všetky prsty zlyhalo: ${e.message}`);
//     }finally{
//       if(btnSendAll) btnSendAll.disabled = false;
//     }
//   }

//   motorForm?.addEventListener('click', (ev)=>{
//     const btn = ev.target.closest('[data-send]');
//     if(!btn) return;
//     const finger = btn.getAttribute('data-send');
//     if(!finger) return;
//     sendFinger(finger);
//   });
//   btnSendAll?.addEventListener('click', sendAll);

//   // ---------- WebSocket ----------
//   const wsHost = (location.hostname || '127.0.0.1') + (location.port ? ':'+location.port : '');
//   const url = (location.protocol==='https:'?'wss://':'ws://') + wsHost + '/ws';
//   const ws = new WebSocket(url);

//   ws.onopen  = () => { wsState.textContent='WS: connected';    wsState.className='ws ok';  };
//   ws.onclose = () => { wsState.textContent='WS: disconnected'; wsState.className='ws bad'; };
//   ws.onerror = () => { wsState.textContent='WS: error';        wsState.className='ws bad'; };

//   ws.onmessage = (ev) => {
//     let m; try{ m = JSON.parse(ev.data); } catch { return; }
//     if(!m || !m.kind) return;

//     if (frozen && m.kind === 'sample') return;

//     switch(m.kind){

//       case 'device_added':
//         devices.set(m.port,{port:m.port, online:true});
//         renderDevice(m.port);
//         if(!activePort) setActivePort(m.port);
//         log(`[+] ${m.port} pripojené`);
//         break;

//       case 'device_removed':
//         devices.set(m.port,{...(devices.get(m.port)||{}), online:false});
//         renderDevice(m.port);
//         if(activePort === m.port){
//           activePort = null;
//           elActivePort && (elActivePort.textContent = '—');
//           for(const [p,st] of devices){
//             if(st.online){ setActivePort(p); break; }
//           }
//         }
//         log(`[-] ${m.port} odpojené`);
//         break;

//       case 'identifier':
//         devices.set(m.port,{...(devices.get(m.port)||{}), online:true, uid:m.uid, uid_hex:m.uid_hex, fw:m.fw});
//         renderDevice(m.port);
//         log(`[ID] ${m.port} UID=${m.uid_hex} FW=${m.fw}`);
//         break;

//       case 'sample': {
//         const d = devices.get(m.port) || {};
//         d.online = true;

//         const t = m.sys_ts || m.ts || 0;
//         d.lastTs = t;

//         // ---- IMU FULL ----
//         let acc=null, gyro=null, euler=null, grav=null, mag=null, quat=null, temp=null;
//         if (m.imu && typeof m.imu==='object'){
//           const X=m.imu;
//           acc   = [X.linAccX, X.linAccY, X.linAccZ];
//           gyro  = [X.gyroX,   X.gyroY,   X.gyroZ];
//           euler = [X.pitch,   X.roll,    X.yaw];
//           grav  = [X.gravX,   X.gravY,   X.gravZ];
//           mag   = [X.magX,    X.magY,    X.magZ];
//           quat  = [X.quatW,   X.quatX,   X.quatY,   X.quatZ];
//           temp  = X.temp;

//           if (acc.every(v=>Number.isFinite(toNum(v))))   d.lastAcc   = acc;
//           if (gyro.every(v=>Number.isFinite(toNum(v))))  d.lastGyro  = gyro;
//           if (euler.every(v=>Number.isFinite(toNum(v)))) d.lastEuler = euler;
//           if (grav.every(v=>Number.isFinite(toNum(v))))  d.lastGrav  = grav;
//           if (mag.every(v=>Number.isFinite(toNum(v))))   d.lastMag   = mag;
//           if (quat.every(v=>Number.isFinite(toNum(v))))  d.lastQuat  = quat;
//           if (Number.isFinite(toNum(temp)))              d.lastTemp  = toNum(temp);
//         }

//         // ---- ADC ----
//         if (Array.isArray(m.adc)){
//           let arr = m.adc.map(toNum);
//           if (arr.length >= 6) arr = arr.slice(1,6); else arr = arr.slice(0,5);
//           d.lastAdc = arr.slice(0,5);

//           const b = ensureAdcBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.m,  arr[0]??0);
//           pushLimited(b.pr, arr[1]??0);
//           pushLimited(b.pro,arr[2]??0);
//           pushLimited(b.uk, arr[3]??0);
//           pushLimited(b.pa, arr[4]??0);

//           if(m.port===activePort && uAdc){
//             dAdc[0]=b.t; dAdc[1]=b.m; dAdc[2]=b.pr; dAdc[3]=b.pro; dAdc[4]=b.uk; dAdc[5]=b.pa;
//             uAdc.setData(dAdc);
//           }
//         }

//         // ---- ACC ----
//         if (acc && acc.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureAccBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.ax, acc[0]);
//           pushLimited(b.ay, acc[1]);
//           pushLimited(b.az, acc[2]);
//           if(m.port===activePort && uAcc){
//             dAcc[0]=b.t; dAcc[1]=b.ax; dAcc[2]=b.ay; dAcc[3]=b.az;
//             uAcc.setData(dAcc);
//           }
//         }

//         // ---- GYRO/EULER do Gyro grafu (podľa GYRO_MODE) ----
//         if (GYRO_MODE==='gyro' && gyro && gyro.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureGyroBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.gx, gyro[0]);
//           pushLimited(b.gy, gyro[1]);
//           pushLimited(b.gz, gyro[2]);
//           if(m.port===activePort && uGyro){
//             dGyro[0]=b.t; dGyro[1]=b.gx; dGyro[2]=b.gy; dGyro[3]=b.gz;
//             uGyro.setData(dGyro);
//           }
//           onceLog('gyroSeen', '[UI] Prichádza GyroX/Y/Z – vykresľujem do „Gyroscope“.');
//         }
//         if (GYRO_MODE==='eulerLegacy' && euler && euler.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureEulerBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,     tt);
//           pushLimited(b.pitch, euler[0]);
//           pushLimited(b.roll,  euler[1]);
//           pushLimited(b.yaw,   euler[2]);
//           if(m.port===activePort && uGyro){
//             dGyro[0]=b.t; dGyro[1]=b.pitch; dGyro[2]=b.roll; dGyro[3]=b.yaw;
//             uGyro.setData(dGyro);
//           }
//           onceLog('eulerSeen', '[UI] Prichádza Pitch/Roll/Yaw – vykresľujem do „Gyroscope“ (fallback).');
//         }

//         // ---- Samostatný EULER graf (len ak v HTML existuje) ----
//         if (HAS_EULER && euler && euler.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureEulerBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,     tt);
//           pushLimited(b.pitch, euler[0]);
//           pushLimited(b.roll,  euler[1]);
//           pushLimited(b.yaw,   euler[2]);
//           if(m.port===activePort && uEuler){
//             dEuler[0]=b.t; dEuler[1]=b.pitch; dEuler[2]=b.roll; dEuler[3]=b.yaw;
//             uEuler.setData(dEuler);
//           }
//         }

//         // ---- GRAV ----
//         if (grav && grav.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureGravBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.gx, grav[0]);
//           pushLimited(b.gy, grav[1]);
//           pushLimited(b.gz, grav[2]);
//           if(HAS_GRAV && m.port===activePort && uGrav){
//             dGrav[0]=b.t; dGrav[1]=b.gx; dGrav[2]=b.gy; dGrav[3]=b.gz;
//             uGrav.setData(dGrav);
//           }
//           if(!HAS_GRAV) onceWarnMissing('chart-grav');
//         }

//         // ---- MAG ----
//         if (mag && mag.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureMagBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.mx, mag[0]);
//           pushLimited(b.my, mag[1]);
//           pushLimited(b.mz, mag[2]);
//           if(m.port===activePort && uMag){
//             dMag[0]=b.t; dMag[1]=b.mx; dMag[2]=b.my; dMag[3]=b.mz;
//             uMag.setData(dMag);
//           }
//         }

//         // ---- QUAT ----
//         if (quat && quat.every(v=>Number.isFinite(toNum(v)))){
//           const b = ensureQuatBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,  tt);
//           pushLimited(b.qw, quat[0]);
//           pushLimited(b.qx, quat[1]);
//           pushLimited(b.qy, quat[2]);
//           pushLimited(b.qz, quat[3]);
//           if(HAS_QUAT && m.port===activePort && uQuat){
//             dQuat[0]=b.t; dQuat[1]=b.qw; dQuat[2]=b.qx; dQuat[3]=b.qy; dQuat[4]=b.qz;
//             uQuat.setData(dQuat);
//           }
//           if(!HAS_QUAT) onceWarnMissing('chart-quat');
//         }

//         // ---- TEMP ----
//         if (typeof temp !== 'undefined' && Number.isFinite(toNum(temp))){
//           const b = ensureTempBuf(m.port);
//           const tt = relT(b, t);
//           pushLimited(b.t,    tt);
//           pushLimited(b.temp, toNum(temp));
//           if(HAS_TEMP && m.port===activePort && uTemp){
//             dTemp[0]=b.t; dTemp[1]=b.temp;
//             uTemp.setData(dTemp);
//           }
//           if(!HAS_TEMP) onceWarnMissing('chart-temp');
//         }

//         devices.set(m.port, d);
//         renderDevice(m.port);
//         if(!activePort) setActivePort(m.port);
//         break;
//       }
//     }
//   };

// })();


// /static/app.js (výkonová verzia: ring buffer + rAF + throttling)
(function () {
  // =========================
  //   NASTAVENIA / PARAMS
  // =========================
  let TARGET_FPS = 30;                 // <<< nastav si cieľové FPS (15/30/60)
  const HIDDEN_FPS = 2;                // FPS keď je záložka skrytá
  const LEN = 1000;                    // kapacita kruhových bufferov
  const DEVICES_RENDER_INTERVAL = 250; // ms – ako často refreshnúť zoznam zariadení
  const TIME_FORMAT_INTERVAL = 1000;    // ms – ako často formátovať čas do DOM

  // =========================
  //   DOM REFERENCIE
  // =========================
  const wsState   = document.getElementById('wsState');
  const devicesEl = document.getElementById('devices');
  const logEl     = document.getElementById('log');

  // Charts (niektoré môžu v starom HTML chýbať – fallback nižšie)
  const elChartAdc   = document.getElementById('chart-adc');
  const elChartAcc   = document.getElementById('chart-acc');
  const elChartGyro  = document.getElementById('chart-gyro');   // existuje aj v starom HTML
  const elChartEuler = document.getElementById('chart-euler');  // nový
  const elChartGrav  = document.getElementById('chart-grav');   // nový
  const elChartMag   = document.getElementById('chart-mag');
  const elChartQuat  = document.getElementById('chart-quat');   // nový
  const elChartTemp  = document.getElementById('chart-temp');   // nový

  // Port labels (optional)
  const elPortAdc   = document.getElementById('chartPortAdc');
  const elPortAcc   = document.getElementById('chartPortAcc');
  const elPortGyro  = document.getElementById('chartPortGyro');
  const elPortEuler = document.getElementById('chartPortEuler');
  const elPortGrav  = document.getElementById('chartPortGrav');
  const elPortMag   = document.getElementById('chartPortMag');
  const elPortQuat  = document.getElementById('chartPortQuat');
  const elPortTemp  = document.getElementById('chartPortTemp');

  const elActivePort = document.getElementById('activePort');

  // Motor UI
  const motorForm  = document.querySelector('.motor-panel');
  const btnSendAll = document.getElementById('btnSendAll');
  const btnFreeze  = document.getElementById('btnFreeze');

  // =========================
  //   STAV / FLAGS
  // =========================
  const devices = new Map();  // port -> stav pre zoznam
  let activePort = null;      // port vybraného zariadenia (pre grafy)
  let frozen = false;         // keď true: ignorujeme 'sample' správy

  const HAS_EULER = !!elChartEuler;
  const HAS_GRAV  = !!elChartGrav;
  const HAS_QUAT  = !!elChartQuat;
  const HAS_TEMP  = !!elChartTemp;

  // ak Euler chýba, použijeme pôvodný „Gyroscope“ graf na Pitch/Roll/Yaw
  const GYRO_MODE = HAS_EULER ? 'gyro' : 'eulerLegacy';

  // jednorazové hlášky
  const once = new Set();
  function onceLog(tag, msg){ if(once.has(tag)) return; once.add(tag); log(msg); }
  function onceWarnMissing(id){ onceLog('missing_'+id, `[UI] Pozor: v HTML chýba #${id} – dáta sa vykreslia fallbackom, prípadne sa nevykreslia.`); }

  // =========================
  //   RING BUFFER (O(1))
  // =========================
  function makeRing(cap=LEN){ return {a:new Array(cap), i:0, len:0, cap}; }
  function ringPush(rb, v){
    rb.a[rb.i] = v;
    rb.i = (rb.i + 1) % rb.cap;
    if (rb.len < rb.cap) rb.len++;
  }
  // uPlot vyžaduje obyčajné polia – vytvoríme view (kopírovanie len pre aktívny port a len pri kreslení)
  function ringView(rb){
    const out = new Array(rb.len);
    const start = (rb.i - rb.len + rb.cap) % rb.cap;
    for(let k=0;k<rb.len;k++) out[k] = rb.a[(start+k)%rb.cap];
    return out;
  }

  // =========================
  //   HELPERS
  // =========================
  function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

  // Relatívny čas pre jeden buffer
  function relT(buf, t){
    if(buf.base==null) buf.base = +t;
    return +t - buf.base;
  }

  // API + prsty
  const API_MOTOR_PATH = '/api/haptic';
  const FINGER_ORDER = ['little','ring','middle','index','thumb'];
  const FINGER_INDEX = Object.fromEntries(FINGER_ORDER.map((n,i)=>[n,i]));

  // =========================
  //   BUFFRE PER-PORT (RINGY)
  // =========================
  const adcBufs   = new Map(); // port -> {base,t,m,pr,pro,uk,pa}  (t + 5 sérií)
  const accBufs   = new Map(); // port -> {base,t,ax,ay,az}
  const gyroBufs  = new Map(); // port -> {base,t,gx,gy,gz}
  const eulerBufs = new Map(); // port -> {base,t,pitch,roll,yaw}
  const gravBufs  = new Map(); // port -> {base,t,gx,gy,gz}
  const magBufs   = new Map(); // port -> {base,t,mx,my,mz}
  const quatBufs  = new Map(); // port -> {base,t,qw,qx,qy,qz}
  const tempBufs  = new Map(); // port -> {base,t,temp}

  function makeAdcBuf(){   return {base:null,t:makeRing(),m:makeRing(),pr:makeRing(),pro:makeRing(),uk:makeRing(),pa:makeRing()}; }
  function makeAccBuf(){   return {base:null,t:makeRing(),ax:makeRing(),ay:makeRing(),az:makeRing()}; }
  function makeGyroBuf(){  return {base:null,t:makeRing(),gx:makeRing(),gy:makeRing(),gz:makeRing()}; }
  function makeEulerBuf(){ return {base:null,t:makeRing(),pitch:makeRing(),roll:makeRing(),yaw:makeRing()}; }
  function makeGravBuf(){  return {base:null,t:makeRing(),gx:makeRing(),gy:makeRing(),gz:makeRing()}; }
  function makeMagBuf(){   return {base:null,t:makeRing(),mx:makeRing(),my:makeRing(),mz:makeRing()}; }
  function makeQuatBuf(){  return {base:null,t:makeRing(),qw:makeRing(),qx:makeRing(),qy:makeRing(),qz:makeRing()}; }
  function makeTempBuf(){  return {base:null,t:makeRing(),temp:makeRing()}; }

  function ensureAdcBuf(p){ let b=adcBufs.get(p); if(!b){ b=makeAdcBuf(); adcBufs.set(p,b);} return b; }
  function ensureAccBuf(p){ let b=accBufs.get(p); if(!b){ b=makeAccBuf(); accBufs.set(p,b);} return b; }
  function ensureGyroBuf(p){ let b=gyroBufs.get(p); if(!b){ b=makeGyroBuf(); gyroBufs.set(p,b);} return b; }
  function ensureEulerBuf(p){ let b=eulerBufs.get(p); if(!b){ b=makeEulerBuf(); eulerBufs.set(p,b);} return b; }
  function ensureGravBuf(p){ let b=gravBufs.get(p); if(!b){ b=makeGravBuf(); gravBufs.set(p,b);} return b; }
  function ensureMagBuf(p){ let b=magBufs.get(p); if(!b){ b=makeMagBuf(); magBufs.set(p,b);} return b; }
  function ensureQuatBuf(p){ let b=quatBufs.get(p); if(!b){ b=makeQuatBuf(); quatBufs.set(p,b);} return b; }
  function ensureTempBuf(p){ let b=tempBufs.get(p); if(!b){ b=makeTempBuf(); tempBufs.set(p,b);} return b; }

  function purgePortData(port){
    adcBufs.delete(port);
    accBufs.delete(port);
    gyroBufs.delete(port);
    eulerBufs.delete(port);
    gravBufs.delete(port);
    magBufs.delete(port);
    quatBufs.delete(port);
    tempBufs.delete(port);
  }

  // =========================
  //   uPlot DÁTA/INŠTANCIE
  // =========================
  let dAdc   = [[],[],[],[],[],[]],  uAdc   = null;
  let dAcc   = [[],[],[],[]],        uAcc   = null;
  let dGyro  = [[],[],[],[]],        uGyro  = null;   // podľa GYRO_MODE
  let dEuler = [[],[],[],[]],        uEuler = null;   // len ak je chart-euler
  let dGrav  = [[],[],[],[]],        uGrav  = null;   // len ak je chart-grav
  let dMag   = [[],[],[],[]],        uMag   = null;
  let dQuat  = [[],[],[],[],[]],     uQuat  = null;   // len ak je chart-quat
  let dTemp  = [[],[]],              uTemp  = null;   // len ak je chart-temp

  // =========================
  //   LOG + FREEZE
  // =========================
  function log(s){
    if(!logEl) return;
    const div=document.createElement('div');
    div.textContent=s;
    logEl.prepend(div);
    if(logEl.childNodes.length>100) logEl.removeChild(logEl.lastChild); // prísnejší strop
  }

  function setFrozen(v){
    frozen = !!v;
    if(btnFreeze){
      btnFreeze.setAttribute('aria-pressed', frozen ? 'true' : 'false');
      btnFreeze.title = frozen ? 'Obnoviť živé dáta' : 'Pozastaviť živé dáta';
      btnFreeze.textContent = frozen ? 'Unfreeze' : 'Freeze';
    }
    document.body.classList.toggle('is-frozen', frozen);
    log(frozen ? '[UI] Freeze ON – ignorujem sample správy' : '[UI] Freeze OFF – spracúvam sample správy');
  }
  btnFreeze?.addEventListener('click', ()=> setFrozen(!frozen));
  setFrozen(false);

  // =========================
  //   REST helper
  // =========================
  async function apiPost(path, body){
    const res = await fetch(path, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body||{})
    });
    if(!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return res.json().catch(()=> ({}));
  }

  // =========================
  //   UI: ZARIADENIA (cache refs + throttle)
  // =========================
  function ensureDeviceEl(port){
    let el = devicesEl.querySelector(`[data-port="${CSS.escape(port)}"]`);
    if(!el){
      el = document.createElement('li');
      el.className = 'dev';
      el.dataset.port = port;
      el.innerHTML = `
        <div class="top">
          <div class="port"></div>
          <span class="badge">—</span>
        </div>
        <div class="kv">
          <span class="key">UID</span><span class="val uid">—</span>
          <span class="key">FW</span><span class="val fw">—</span>
          <span class="key">Posledný čas</span><span class="val ts">—</span>
          <span class="key">ADC</span><span class="val adc" style="font-family:var(--mono)"></span>
          <span class="key">ACC</span><span class="val acc">—</span>
          <span class="key">GYRO</span><span class="val gyro">—</span>
          <span class="key">EULER</span><span class="val euler">—</span>
          <span class="key">GRAV</span><span class="val grav">—</span>
          <span class="key">MAG</span><span class="val mag">—</span>
          <span class="key">QUAT</span><span class="val quat">—</span>
          <span class="key">TEMP</span><span class="val temp">—</span>
        </div>
        <div class="actions">
          <button class="btn success btnCalib" title="Kalibrácia zariadenia">Calibrate</button>
          <button class="btn danger btnReboot" title="Reštart zariadenia">Reboot</button>
        </div>
      `;

      // cache pod-referencií
      el._refs = {
        port:  el.querySelector('.port'),
        badge: el.querySelector('.badge'),
        uid:   el.querySelector('.uid'),
        fw:    el.querySelector('.fw'),
        ts:    el.querySelector('.ts'),
        adc:   el.querySelector('.adc'),
        acc:   el.querySelector('.acc'),
        gyro:  el.querySelector('.gyro'),
        euler: el.querySelector('.euler'),
        grav:  el.querySelector('.grav'),
        mag:   el.querySelector('.mag'),
        quat:  el.querySelector('.quat'),
        temp:  el.querySelector('.temp'),
        btnCalib: el.querySelector('.btnCalib'),
        btnReboot: el.querySelector('.btnReboot'),
      };

      el.addEventListener('click', (e)=>{
        if(e.target.closest('.actions')) return;
        setActivePort(port);
      });

      el._refs.btnCalib.addEventListener('click', async () => {
        if(!confirm(`Spustiť kalibráciu na ${port}?`)) return;
        try{
          await apiPost('/api/calibration', {port});
          log(`[API] Calibration OK on ${port}`);
        }catch(e){
          log(`[API] Calibration FAIL on ${port}: ${e.message}`);
          alert(`Calibration failed: ${e.message}`);
        }
      });
      el._refs.btnReboot.addEventListener('click', async () => {
        if(!confirm(`Naozaj reštartovať ${port}?`)) return;
        try{
          await apiPost('/api/reboot', {port});
          log(`[API] Reboot OK on ${port}`);
        }catch(e){
          log(`[API] Reboot FAIL on ${port}: ${e.message}`);
          alert(`Reboot failed: ${e.message}`);
        }
      });

      devicesEl.appendChild(el);
    }
    return el;
  }

  // throttling pre render zoznamu
  let devicesDirty = false;
  let lastDevRender = 0;
  let lastTsFormat = 0;

  function scheduleRenderDevices(){ devicesDirty = true; }

  function renderDevice(port, nowTs){
    const d = devices.get(port) || {};
    const el = ensureDeviceEl(port);
    const r = el._refs;

    const isActive = (port === activePort);
    el.classList.toggle('online', !!d.online);
    el.classList.toggle('offline', !d.online);
    el.classList.toggle('active', isActive);

    // vždy udrž názov portu + badge
    if(r.port)  r.port.textContent  = port;
    if(r.badge) r.badge.textContent = d.online ? 'online' : 'offline';

    // Na slabom CPU neprepisuj všetko pri každej vzorke:
    // - detailné polia iba ak je aktívny port
    // - čas formátuj najviac 2× za sekundu
    if (isActive) {
      if (nowTs - lastTsFormat > TIME_FORMAT_INTERVAL) {
        if(r.ts) r.ts.textContent = d.lastTs ? new Date(d.lastTs*1000).toLocaleTimeString() : '—';
        lastTsFormat = nowTs;
      }
      if(r.uid)   r.uid.textContent   = d.uid_hex || '—';
      if(r.fw)    r.fw.textContent    = (d.fw ?? '—');
      if(r.adc)   r.adc.textContent   = (d.lastAdc ? d.lastAdc.join(' ') : '');
      if(r.acc)   r.acc.textContent   = (d.lastAcc ? `[${d.lastAcc.join(', ')}]` : '—');
      if(r.gyro)  r.gyro.textContent  = (d.lastGyro ? `[${d.lastGyro.join(', ')}]` : (d.lastEuler ? `[${d.lastEuler.join(', ')}]` : '—'));
      if(r.euler) r.euler.textContent = (d.lastEuler ? `[${d.lastEuler.join(', ')}]` : '—');
      if(r.grav)  r.grav.textContent  = (d.lastGrav ? `[${d.lastGrav.join(', ')}]` : '—');
      if(r.mag)   r.mag.textContent   = (d.lastMag ? `[${d.lastMag.join(', ')}]` : '—');
      if(r.quat)  r.quat.textContent  = (d.lastQuat ? `[${d.lastQuat.join(', ')}]` : '—');
      if(r.temp)  r.temp.textContent  = (typeof d.lastTemp==='number' ? `${d.lastTemp} °C` : '—');
    }

    if(r.btnCalib)  r.btnCalib.disabled  = !d.online;
    if(r.btnReboot) r.btnReboot.disabled = !d.online;
  }

  function drawDevices(nowTs){
    if(!devicesDirty) return;
    if(nowTs - lastDevRender < DEVICES_RENDER_INTERVAL) return;
    lastDevRender = nowTs;
    devicesDirty = false;

    for(const [port] of devices){
      renderDevice(port, nowTs);
    }
  }

  function setActivePort(port){
    activePort = port;
    devicesEl.querySelectorAll('.dev').forEach(el=>{
      el.classList.toggle('active', el.dataset.port === port);
    });

    elActivePort && (elActivePort.textContent = port || '—');
    elPortAdc   && (elPortAdc.textContent   = port || '—');
    elPortAcc   && (elPortAcc.textContent   = port || '—');
    elPortGyro  && (elPortGyro.textContent  = port || '—');
    elPortEuler && (elPortEuler.textContent = port || '—');
    elPortGrav  && (elPortGrav.textContent  = port || '—');
    elPortMag   && (elPortMag.textContent   = port || '—');
    elPortQuat  && (elPortQuat.textContent  = port || '—');
    elPortTemp  && (elPortTemp.textContent  = port || '—');

    // nevoláme setData tu – kreslí sa iba vo frame slučke
    log(`[UI] Aktívne zariadenie: ${port}`);
    scheduleRenderDevices();
  }

  // =========================
  //   VYTVOR GRAFY
  // =========================
  function makeAdcPlot(){
    if(!elChartAdc) return;
    uAdc = new uPlot({
      width: elChartAdc.clientWidth, height: 260,
      scales:{ x:{time:false} },
      series: [
        {}, // x
        {label:'m',          width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'prstenník',  width:2, points:{show:false}, stroke:"#ff7f0e"},
        {label:'prostredník',width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'ukazovák',   width:2, points:{show:false}, stroke:"#d62728"},
        {label:'palec',      width:2, points:{show:false}, stroke:"#9467bd"},
      ],
      axes:[{},{label:'ADC'}],
    }, dAdc, elChartAdc);
  }

  function makeAccPlot(){
    if(!elChartAcc) return;
    uAcc = new uPlot({
      width: elChartAcc.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:'Ax', width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'Ay', width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'Az', width:2, points:{show:false}, stroke:"#d62728"},
      ],
      axes:[{},{label:'m/s²'}],
    }, dAcc, elChartAcc);
  }

  function makeGyroPlot(){
    if(!elChartGyro) return;
    const labels = (GYRO_MODE==='gyro')
      ? ['GyroX','GyroY','GyroZ']
      : ['Pitch','Roll','Yaw'];   // fallback – starý layout bez samostatného Euler grafu

    if (GYRO_MODE==='eulerLegacy'){
      onceWarnMissing('chart-euler');
      onceLog('eulerLegacy', '[UI] Euler (Pitch/Roll/Yaw) sa bude vykresľovať do pôvodného „Gyroscope“ grafu.');
    }

    uGyro = new uPlot({
      width: elChartGyro.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:labels[0], width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:labels[1], width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:labels[2], width:2, points:{show:false}, stroke:"#d62728"},
      ],
      axes:[{},{label: GYRO_MODE==='gyro' ? '°/s' : '°'}],
    }, dGyro, elChartGyro);
  }

  function makeEulerPlot(){
    if(!HAS_EULER || !elChartEuler) return;
    uEuler = new uPlot({
      width: elChartEuler.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:'Pitch', width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'Roll',  width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'Yaw',   width:2, points:{show:false}, stroke:"#d62728"},
      ],
      axes:[{},{label:'°'}],
    }, dEuler, elChartEuler);
  }

  function makeGravPlot(){
    if(!HAS_GRAV || !elChartGrav){ onceWarnMissing('chart-grav'); return; }
    uGrav = new uPlot({
      width: elChartGrav.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:'gravX', width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'gravY', width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'gravZ', width:2, points:{show:false}, stroke:"#d62728"},
      ],
      axes:[{},{label:'raw'}],
    }, dGrav, elChartGrav);
  }

  function makeMagPlot(){
    if(!elChartMag) return;
    uMag = new uPlot({
      width: elChartMag.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:'Mx', width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'My', width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'Mz', width:2, points:{show:false}, stroke:"#d62728"},
      ],
      axes:[{},{label:'µT (raw)'}],
    }, dMag, elChartMag);
  }

  function makeQuatPlot(){
    if(!HAS_QUAT || !elChartQuat){ onceWarnMissing('chart-quat'); return; }
    uQuat = new uPlot({
      width: elChartQuat.clientWidth, height: 230,
      scales:{ x:{time:false} },
      series: [{},
        {label:'Qw', width:2, points:{show:false}, stroke:"#1f77b4"},
        {label:'Qx', width:2, points:{show:false}, stroke:"#2ca02c"},
        {label:'Qy', width:2, points:{show:false}, stroke:"#d62728"},
        {label:'Qz', width:2, points:{show:false}, stroke:"#9467bd"},
      ],
      axes:[{},{label:'raw'}],
    }, dQuat, elChartQuat);
  }

  function makeTempPlot(){
    if(!HAS_TEMP || !elChartTemp){ onceWarnMissing('chart-temp'); return; }
    uTemp = new uPlot({
      width: elChartTemp.clientWidth, height: 200,
      scales:{ x:{time:false} },
      series: [{},
        {label:'°C', width:2, points:{show:false}, stroke:"#1f77b4"},
      ],
      axes:[{},{label:'°C'}],
    }, dTemp, elChartTemp);
  }

  // vytvor grafy (prázdne)
  makeAdcPlot();
  makeAccPlot();
  makeGyroPlot();
  makeEulerPlot();
  makeGravPlot();
  makeMagPlot();
  makeQuatPlot();
  makeTempPlot();

  // jeden debounced resize namiesto ResizeObserverov
  let resizeTo=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTo);
    resizeTo = setTimeout(()=>{
      if(uAdc)  uAdc.setSize({width:elChartAdc?.clientWidth||0, height:260});
      if(uAcc)  uAcc.setSize({width:elChartAcc?.clientWidth||0, height:230});
      if(uGyro) uGyro.setSize({width:elChartGyro?.clientWidth||0, height:230});
      if(uEuler)uEuler.setSize({width:elChartEuler?.clientWidth||0,height:230});
      if(uGrav) uGrav.setSize({width:elChartGrav?.clientWidth||0, height:230});
      if(uMag)  uMag.setSize({width:elChartMag?.clientWidth||0,  height:230});
      if(uQuat) uQuat.setSize({width:elChartQuat?.clientWidth||0, height:230});
      if(uTemp) uTemp.setSize({width:elChartTemp?.clientWidth||0, height:200});
      scheduleDraw();
    }, 150);
  });

  // =========================
  //   MOTOR: HELPERS
  // =========================
  function readFingerValues(finger){
    const pwm = document.getElementById(`pwm-${finger}`);
    const dur = document.getElementById(`dur-${finger}`);
    return {
      pwm: pwm ? Number(pwm.value) : 0,
      duration_ms: dur ? Number(dur.value) : 0,
    };
  }

  async function sendFinger(finger){
    if(!activePort){
      alert('Najprv vyber zariadenie vľavo.');
      return;
    }
    const {pwm, duration_ms} = readFingerValues(finger);
    const btn = motorForm?.querySelector(`.finger-group[data-finger="${finger}"] .actions .btn.primary`);
    if(btn) btn.disabled = true;
    try{
      const payload = {
        port: activePort,
        finger: (FINGER_INDEX[finger] ?? 0) + 1,
        pwm,
        duration_ms
      };
      await apiPost(API_MOTOR_PATH, payload);
      log(`[API] Motor OK (${finger}=${payload.finger}) port=${activePort} pwm=${pwm} dur=${duration_ms}ms`);
    }catch(e){
      log(`[API] Motor FAIL (${finger}) on ${activePort}: ${e.message}`);
      alert(`Odoslanie zlyhalo (${finger}): ${e.message}`);
    }finally{
      if(btn) btn.disabled = false;
    }
  }

  async function sendAll(){
    if(!activePort){
      alert('Najprv vyber zariadenie vľavo.');
      return;
    }
    if(btnSendAll) btnSendAll.disabled = true;
    try{
      for(const finger of FINGER_ORDER){
        const {pwm, duration_ms} = readFingerValues(finger);
        const payload = {
          port: activePort,
          finger: (FINGER_INDEX[finger] ?? 0) + 1,
          pwm,
          duration_ms
        };
        await apiPost(API_MOTOR_PATH, payload);
        log(`[API] Motor OK (${finger}=${payload.finger}) port=${activePort} pwm=${pwm} dur=${duration_ms}ms`);
      }
    }catch(e){
      log(`[API] Motor FAIL (send all) on ${activePort}: ${e.message}`);
      alert(`Odoslanie na všetky prsty zlyhalo: ${e.message}`);
    }finally{
      if(btnSendAll) btnSendAll.disabled = false;
    }
  }

  motorForm?.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-send]');
    if(!btn) return;
    const finger = btn.getAttribute('data-send');
    if(!finger) return;
    sendFinger(finger);
  });
  btnSendAll?.addEventListener('click', sendAll);

  // =========================
  //   RENDER SLUČKA (rAF)
  // =========================
  let rafId = null;
  let lastDraw = 0;
  function scheduleDraw(){
    if (rafId) return;
    rafId = requestAnimationFrame((ts)=>{
      rafId = null;
      const minDelta = 1000 / (document.hidden ? HIDDEN_FPS : TARGET_FPS);
      if (ts - lastDraw < minDelta) return scheduleDraw();
      lastDraw = ts;
      drawActiveCharts();
      drawDevices(ts);
    });
  }

  function drawActiveCharts(){
    const p = activePort; if(!p) return;

    // ADC
    if(uAdc){
      const bA = adcBufs.get(p);
      if(bA){
        dAdc[0]=ringView(bA.t); dAdc[1]=ringView(bA.m); dAdc[2]=ringView(bA.pr);
        dAdc[3]=ringView(bA.pro); dAdc[4]=ringView(bA.uk); dAdc[5]=ringView(bA.pa);
        uAdc.setData(dAdc);
      }
    }

    // ACC
    if(uAcc){
      const b = accBufs.get(p);
      if(b){
        dAcc[0]=ringView(b.t); dAcc[1]=ringView(b.ax); dAcc[2]=ringView(b.ay); dAcc[3]=ringView(b.az);
        uAcc.setData(dAcc);
      }
    }

    // GYRO/EULER do Gyro grafu
    if(uGyro){
      if (GYRO_MODE==='gyro'){
        const b = gyroBufs.get(p);
        if(b){ dGyro[0]=ringView(b.t); dGyro[1]=ringView(b.gx); dGyro[2]=ringView(b.gy); dGyro[3]=ringView(b.gz); uGyro.setData(dGyro); }
      }else{
        const b = eulerBufs.get(p);
        if(b){ dGyro[0]=ringView(b.t); dGyro[1]=ringView(b.pitch); dGyro[2]=ringView(b.roll); dGyro[3]=ringView(b.yaw); uGyro.setData(dGyro); }
      }
    }

    // samostatný EULER
    if(uEuler && HAS_EULER){
      const b = eulerBufs.get(p);
      if(b){ dEuler[0]=ringView(b.t); dEuler[1]=ringView(b.pitch); dEuler[2]=ringView(b.roll); dEuler[3]=ringView(b.yaw); uEuler.setData(dEuler); }
    }

    // GRAV
    if(uGrav && HAS_GRAV){
      const b = gravBufs.get(p);
      if(b){ dGrav[0]=ringView(b.t); dGrav[1]=ringView(b.gx); dGrav[2]=ringView(b.gy); dGrav[3]=ringView(b.gz); uGrav.setData(dGrav); }
    }

    // MAG
    if(uMag){
      const b = magBufs.get(p);
      if(b){ dMag[0]=ringView(b.t); dMag[1]=ringView(b.mx); dMag[2]=ringView(b.my); dMag[3]=ringView(b.mz); uMag.setData(dMag); }
    }

    // QUAT
    if(uQuat && HAS_QUAT){
      const b = quatBufs.get(p);
      if(b){ dQuat[0]=ringView(b.t); dQuat[1]=ringView(b.qw); dQuat[2]=ringView(b.qx); dQuat[3]=ringView(b.qy); dQuat[4]=ringView(b.qz); uQuat.setData(dQuat); }
    }

    // TEMP
    if(uTemp && HAS_TEMP){
      const b = tempBufs.get(p);
      if(b){ dTemp[0]=ringView(b.t); dTemp[1]=ringView(b.temp); uTemp.setData(dTemp); }
    }
  }

  // adaptívne FPS podľa visibility
  document.addEventListener('visibilitychange', ()=>{
    scheduleDraw(); // prepneme FPS hneď na najbližší frame
  });

  // =========================
  //   WEBSOCKET
  // =========================
  const wsHost = (location.hostname || '127.0.0.1') + (location.port ? ':'+location.port : '');
  const url = (location.protocol==='https:'?'wss://':'ws://') + wsHost + '/ws';
  const ws = new WebSocket(url);

  ws.onopen  = () => { wsState.textContent='WS: connected';    wsState.className='ws ok';  };
  ws.onclose = () => { wsState.textContent='WS: disconnected'; wsState.className='ws bad'; };
  ws.onerror = () => { wsState.textContent='WS: error';        wsState.className='ws bad'; };

  ws.onmessage = (ev) => {
    let m; try{ m = JSON.parse(ev.data); } catch { return; }
    if(!m || !m.kind) return;

    if (frozen && m.kind === 'sample') return;

    switch(m.kind){

      case 'device_added':
        devices.set(m.port,{port:m.port, online:true});
        scheduleRenderDevices();
        if(!activePort) setActivePort(m.port);
        log(`[+] ${m.port} pripojené`);
        break;

      case 'device_removed':
        devices.set(m.port,{...(devices.get(m.port)||{}), online:false});
        scheduleRenderDevices();
        if(activePort === m.port){
          activePort = null;
          elActivePort && (elActivePort.textContent = '—');
          for(const [p,st] of devices){
            if(st.online){ setActivePort(p); break; }
          }
        }
        purgePortData(m.port); // uvoľni pamäť
        log(`[-] ${m.port} odpojené`);
        break;

      case 'identifier': {
        const cur = devices.get(m.port)||{};
        const next = {...cur, online:true, uid:m.uid, uid_hex:m.uid_hex, fw:m.fw};
        devices.set(m.port,next);
        scheduleRenderDevices();
        log(`[ID] ${m.port} UID=${m.uid_hex} FW=${m.fw}`);
        break;
      }

      case 'sample': {
        const d = devices.get(m.port) || {};
        d.online = true;

        const t = m.sys_ts || m.ts || 0;
        d.lastTs = t;

        // ---- IMU FULL (bez zbytočných alokácií) ----
        if (m.imu && typeof m.imu==='object'){
          const X=m.imu;

          // ACC
          const ax=+X.linAccX, ay=+X.linAccY, az=+X.linAccZ;
          if (Number.isFinite(ax) && Number.isFinite(ay) && Number.isFinite(az)){
            const b = ensureAccBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.ax, ax); ringPush(b.ay, ay); ringPush(b.az, az);
            d.lastAcc = [ax,ay,az];
          }

          // GYRO
          const gx=+X.gyroX, gy=+X.gyroY, gz=+X.gyroZ;
          if (Number.isFinite(gx) && Number.isFinite(gy) && Number.isFinite(gz)){
            const b = ensureGyroBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.gx, gx); ringPush(b.gy, gy); ringPush(b.gz, gz);
            d.lastGyro = [gx,gy,gz];
            onceLog('gyroSeen', '[UI] Prichádza GyroX/Y/Z – vykresľujem do „Gyroscope“.');
          }

          // EULER
          const pitch=+X.pitch, roll=+X.roll, yaw=+X.yaw;
          if (Number.isFinite(pitch) && Number.isFinite(roll) && Number.isFinite(yaw)){
            const b = ensureEulerBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.pitch, pitch); ringPush(b.roll, roll); ringPush(b.yaw, yaw);
            d.lastEuler = [pitch,roll,yaw];
            if (GYRO_MODE==='eulerLegacy') onceLog('eulerSeen', '[UI] Prichádza Pitch/Roll/Yaw – vykresľujem do „Gyroscope“ (fallback).');
          }

          // GRAV
          const gvx=+X.gravX, gvy=+X.gravY, gvz=+X.gravZ;
          if (Number.isFinite(gvx) && Number.isFinite(gvy) && Number.isFinite(gvz)){
            const b = ensureGravBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.gx, gvx); ringPush(b.gy, gvy); ringPush(b.gz, gvz);
            d.lastGrav = [gvx,gvy,gvz];
            if(!HAS_GRAV) onceWarnMissing('chart-grav');
          }

          // MAG
          const mx=+X.magX, my=+X.magY, mz=+X.magZ;
          if (Number.isFinite(mx) && Number.isFinite(my) && Number.isFinite(mz)){
            const b = ensureMagBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.mx, mx); ringPush(b.my, my); ringPush(b.mz, mz);
            d.lastMag = [mx,my,mz];
          }

          // QUAT
          const qw=+X.quatW, qx=+X.quatX, qy=+X.quatY, qz=+X.quatZ;
          if ([qw,qx,qy,qz].every(Number.isFinite)){
            const b = ensureQuatBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.qw, qw); ringPush(b.qx, qx); ringPush(b.qy, qy); ringPush(b.qz, qz);
            d.lastQuat = [qw,qx,qy,qz];
            if(!HAS_QUAT) onceWarnMissing('chart-quat');
          }

          // TEMP
          const temp = +X.temp;
          if (Number.isFinite(temp)){
            const b = ensureTempBuf(m.port);
            const tt = relT(b, t);
            ringPush(b.t, tt); ringPush(b.temp, temp);
            d.lastTemp = temp;
            if(!HAS_TEMP) onceWarnMissing('chart-temp');
          }
        }

        // ---- ADC ----
        if (Array.isArray(m.adc)){
          // prichádza 6 hodnôt, prvá je často baseline/index – zachovávam tvoju logiku
          let arr = m.adc;
          // prepočítaj na čísla len raz
          const tmp = new Array(arr.length);
          for (let i=0;i<arr.length;i++) tmp[i]=toNum(arr[i]);
          arr = tmp;

          if (arr.length >= 6) arr = arr.slice(1,6); else arr = arr.slice(0,5);
          // d.lastAdc len 5 kanálov
          d.lastAdc = [arr[0]??0, arr[1]??0, arr[2]??0, arr[3]??0, arr[4]??0];

          const b = ensureAdcBuf(m.port);
          const tt = relT(b, t);
          ringPush(b.t,  tt);
          ringPush(b.m,  d.lastAdc[0]);
          ringPush(b.pr, d.lastAdc[1]);
          ringPush(b.pro,d.lastAdc[2]);
          ringPush(b.uk, d.lastAdc[3]);
          ringPush(b.pa, d.lastAdc[4]);
        }

        devices.set(m.port, d);
        scheduleRenderDevices();
        if(!activePort) setActivePort(m.port);
        scheduleDraw(); // iba naplánuj frame, nie okamžitý setData
        break;
      }
    }
  };

  // prvotný render zariadení (ak niečo príde skôr)
  scheduleRenderDevices();
  scheduleDraw();

  // Export malého hooku na runtime zmenu FPS (ak chceš meniť cez konzolu)
  window.__rehapianoSetFps = (n)=>{
    const v = Number(n);
    if(Number.isFinite(v) && v>0){ TARGET_FPS = v; log(`[UI] TARGET_FPS = ${v}`); }
    else{ console.warn('Invalid FPS'); }
  };

  // =========================
  //   VIRTUAL MODE
  // =========================
  const btnVirtual = document.getElementById('btnVirtual');
  const virtualGuide = document.getElementById('virtualGuide');
  let virtualEnabled = false;

  // Valid keys for virtual mode
  const VIRTUAL_KEYS = new Set(['q','w','e','r','t','y','u','i','o','p']);
  const pressedKeys = new Set();

  // Check initial virtual mode state
  async function checkVirtualState() {
    try {
      const res = await fetch('/api/virtual');
      const data = await res.json();
      if (data.available && data.enabled) {
        setVirtualEnabled(true);
      }
    } catch (e) {
      console.warn('[VIRTUAL] Failed to check state:', e);
    }
  }

  function setVirtualEnabled(enabled) {
    virtualEnabled = enabled;
    if (btnVirtual) {
      btnVirtual.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btnVirtual.title = enabled
        ? 'Vypnúť virtuálny režim'
        : 'Zapnúť virtuálny režim (klávesnica simuluje ruky)';
    }
    if (virtualGuide) {
      virtualGuide.style.display = enabled ? 'block' : 'none';
    }
    document.body.classList.toggle('virtual-mode', enabled);
    log(enabled
      ? '[VIRTUAL] Virtuálny režim ZAPNUTÝ - použi klávesy Q W E R T (ľavá) a Y U I O P (pravá)'
      : '[VIRTUAL] Virtuálny režim VYPNUTÝ');

    // Clear all pressed keys visual state when disabling
    if (!enabled) {
      pressedKeys.clear();
      document.querySelectorAll('.virtual-hand .key.pressed').forEach(el => {
        el.classList.remove('pressed');
      });
    }
  }

  async function toggleVirtual() {
    const newState = !virtualEnabled;
    try {
      const endpoint = newState ? '/api/virtual/enable' : '/api/virtual/disable';
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      setVirtualEnabled(newState);
    } catch (e) {
      log(`[VIRTUAL] Chyba: ${e.message}`);
      alert(`Nepodarilo sa ${newState ? 'zapnúť' : 'vypnúť'} virtuálny režim: ${e.message}`);
    }
  }

  btnVirtual?.addEventListener('click', toggleVirtual);

  // Keyboard handling for virtual mode
  async function sendKeyEvent(key, action) {
    if (!virtualEnabled) return;
    if (!VIRTUAL_KEYS.has(key)) return;

    try {
      await fetch('/api/virtual/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action })
      });
    } catch (e) {
      // Ignore errors in rapid key events
    }
  }

  function updateKeyVisual(key, pressed) {
    const keyEl = document.querySelector(`.virtual-hand .key[data-key="${key}"]`);
    if (keyEl) {
      keyEl.classList.toggle('pressed', pressed);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (!virtualEnabled) return;

    // Ignore if focus is on an input element
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    if (!VIRTUAL_KEYS.has(key)) return;

    // Prevent key repeat
    if (pressedKeys.has(key)) return;

    pressedKeys.add(key);
    updateKeyVisual(key, true);
    sendKeyEvent(key, 'down');
  });

  document.addEventListener('keyup', (e) => {
    if (!virtualEnabled) return;

    const key = e.key.toLowerCase();
    if (!VIRTUAL_KEYS.has(key)) return;

    pressedKeys.delete(key);
    updateKeyVisual(key, false);
    sendKeyEvent(key, 'up');
  });

  // Handle page blur - release all keys
  window.addEventListener('blur', () => {
    if (!virtualEnabled) return;

    for (const key of pressedKeys) {
      updateKeyVisual(key, false);
      sendKeyEvent(key, 'up');
    }
    pressedKeys.clear();
  });

  // Check virtual state on load
  checkVirtualState();

})();
