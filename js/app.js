/* FitRoom 3D —— 应用主模块：状态、UI 渲染、交互、持久化 */
import { CATS, BARE, GARMENTS, PERSONS, GEN_STEPS, figParams } from './data.js';
import { stage3d, initStage, snapshot } from './stage.js';

const root = document.getElementById('fitroom-proto');
const $ = id => root.querySelector('#'+id);
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORAGE_KEY = 'fitroom:state:v1';

/* ================= 状态 ================= */
const S = {
  tab:'top',
  sel:{top:null, bottom:null, dress:null, shoes:null},
  applied:{top:null, bottom:null, dress:null, shoes:null},
  person:PERSONS[0],
  customG:[], customP:[],
  angle:0, zoom:1, auto:false,
  looks:[], lookSeq:0,
  generating:false,
  compare:false, picks:[]
};
const allGarments = () => GARMENTS.concat(S.customG);
const findG = id => allGarments().find(g=>g.id===id) || null;
const allPersons = () => PERSONS.concat(S.customP);
const cloneWorn = w => ({top:w.top, bottom:w.bottom, dress:w.dress, shoes:w.shoes});
const anySel = () => CATS.some(c=>S.sel[c.key]);
const wornCount = w => CATS.filter(c=>w[c.key]).length;
const pendingList = () => CATS.filter(c=>S.sel[c.key] && (!S.applied[c.key] || S.applied[c.key].id!==S.sel[c.key].id)).map(c=>S.sel[c.key]);

/* ================= 渲染 ================= */
let UID = 0;
function refreshIcons(){ if(window.lucide) window.lucide.createIcons({attrs:{width:16, height:16}}); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const ICON_PATH = {
  top:'M17,6 L7,12 L3,23 l7,3 2,-6 1,21 h20 l1,-21 2,6 7,-3 -4,-11 -10,-6 q-5,5 -11,0 z',
  pants:'M15,4 h18 l4,40 h-9 l-4,-25 -4,25 h-9 z',
  skirt:'M17,6 h14 l9,32 q-16,6 -32,0 z',
  dress:'M17,4 l-3,5 -7,7 5,6 4,-4 1,11 -7,21 h34 l-7,-21 1,-11 4,4 5,-6 -7,-7 -3,-5 q-7,6 -14,0 z',
  shoes:'M8,20 q0,-7 9,-8 l9,-2 q5,-1 8,3 l7,4 q5,2 5,6 q0,4 -5,4 h-28 q-5,0 -5,-4 z'
};
function patDef(g, u){
  if(g.pattern==='stripe') return `<pattern id="${u}s" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${g.color}"/><rect width="4" height="8" fill="${g.color2}"/></pattern>`;
  if(g.pattern==='dot') return `<pattern id="${u}s" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${g.color}"/><circle cx="5" cy="5" r="1.7" fill="${g.color2}"/></pattern>`;
  return '';
}
function garmentIcon(g, size){
  const u = 'u'+(++UID)+'_';
  const key = g.cat==='bottom' ? (g.form==='skirt'?'skirt':'pants') : g.cat;
  const d = ICON_PATH[key] || ICON_PATH.top;
  const vb = g.cat==='shoes' ? '0 0 48 32' : (key==='skirt' ? '0 0 48 44' : '0 0 48 48');
  const def = patDef(g, u);
  const f = g.pattern==='solid' ? g.color : `url(#${u}s)`;
  return `<svg viewBox="${vb}" width="${size}" height="${size*0.85}" aria-hidden="true">${def?`<defs>${def}</defs>`:''}<path d="${d}" fill="${f}" stroke="${g.color2}" stroke-width="1"/></svg>`;
}

function renderTabs(){
  $('fr-tabs').innerHTML = CATS.map(c=>{
    const n = allGarments().filter(g=>g.cat===c.key).length;
    return `<button class="fr-tab" role="tab" data-tab="${c.key}" aria-selected="${S.tab===c.key}">${c.label}<span style="font-size:10px;opacity:.7"> ${n}</span></button>`;
  }).join('');
}
function renderGarments(){
  const list = allGarments().filter(g=>g.cat===S.tab);
  $('fr-gcount').textContent = '类目自动识别';
  $('fr-ggrid').innerHTML = list.map(g=>{
    const sel = S.sel[g.cat] && S.sel[g.cat].id===g.id;
    const catLabel = CATS.find(c=>c.key===g.cat).label;
    return `<button class="fr-gcard${sel?' sel':''}" data-g="${g.id}" aria-pressed="${sel}">
      <span class="ck"><i data-lucide="check" aria-hidden="true"></i></span>
      <span class="sw">${garmentIcon(g, 40)}</span>
      <span class="nm"><span class="dot" style="background:${g.color}"></span>${esc(g.name)}${g.uploaded?'<span style="color:var(--brand);font-size:10px">上传</span>':''}</span>
      <span class="ct">${catLabel}</span>
    </button>`;
  }).join('') + `<button class="fr-up" id="fr-gup"><i data-lucide="image-plus" aria-hidden="true"></i><span><b>上传衣物图片</b><small>自动抠图 · 提取主色（演示）</small></span></button>`;
  refreshIcons();
}
function renderPersons(){
  $('fr-pgrid').innerHTML = allPersons().map(p=>{
    const sel = S.person && S.person.id===p.id;
    const av = (p.custom && p.thumbURL) ? `<img src="${p.thumbURL}" alt="">` : `<img src="${snapshot(p, BARE, 'bust')}" alt="${esc(p.name)}">`;
    return `<button class="fr-pcard${sel?' sel':''}" data-p="${p.id}" aria-pressed="${sel}">
      <span class="ck"><i data-lucide="check" aria-hidden="true"></i></span>
      <span class="av">${av}</span><b>${esc(p.name)}</b><small>${esc(p.tags||'自定义人物')}</small>
    </button>`;
  }).join('') + `
    <button class="fr-tile" id="fr-pup"><i data-lucide="image-plus" aria-hidden="true"></i><b>上传照片</b><span>自定义图片人物</span></button>
    <button class="fr-tile" id="fr-cam-open"><i data-lucide="camera" aria-hidden="true"></i><b>现场拍摄</b><span>真人摄像头</span></button>`;
  refreshIcons();
}
function lookLabel(w, p){
  return CATS.filter(c=>w[c.key]).map(c=>w[c.key].name).join(' + ') + ' · ' + (p ? p.name : '');
}
function renderLooks(){
  const box = $('fr-looks');
  if(!S.looks.length){
    box.innerHTML = `<div class="fr-empty">还没有保存的穿搭<br>生成试穿效果后点击「保存」</div>`;
    return;
  }
  box.innerHTML = `<div class="fr-looks">` + S.looks.map(l=>{
    const pi = S.picks.indexOf(l.id);
    return `<div class="fr-look${pi>-1?' pick':''}" data-l="${l.id}" role="button" aria-label="${esc(lookLabel(l.worn, l.person))}">
      <span class="pickn">${pi>-1 ? pi+1 : ''}</span>
      <button class="del" data-act="del" data-l="${l.id}" aria-label="删除"><i data-lucide="x" aria-hidden="true"></i></button>
      <span class="th"><img src="${snapshot(l.person, l.worn, 'body')}" alt="${esc(l.label)}"></span>
      <span class="cap">${esc(l.label.split(' · ')[0])}</span>
    </div>`;
  }).join('') + `</div>`;
  refreshIcons();
}
function renderChips(){
  const wornChips = CATS.filter(c=>S.applied[c.key]).map(c=>`<span class="fr-chip"><span class="dot" style="background:${S.applied[c.key].color}"></span>${esc(S.applied[c.key].name)}</span>`);
  const pend = pendingList();
  const pendChips = pend.map(g=>`<span class="fr-chip pend"><span class="dot" style="background:${g.color}"></span>${esc(g.name)} 待生成</span>`);
  $('fr-chips').innerHTML =
    `<span class="fr-chiplabel">已上身</span>` + (wornChips.length ? wornChips.join('') : `<span class="fr-chip">3D 模特</span>`) +
    (pendChips.length ? `<span class="fr-chiplabel">待生成</span>` + pendChips.join('') : '');
}
function renderPersonChip(){
  const p = S.person;
  const av = (p.custom && p.thumbURL) ? `<img src="${p.thumbURL}" alt="">` : `<img src="${snapshot(p, BARE, 'bust')}" alt="">`;
  $('fr-pchip').innerHTML = `${av}<span>${esc(p.name)} <span class="tag">· ${esc(p.tags||'自定义人物')}</span></span>`;
}
function renderSteps(){
  const anyPending = pendingList().length > 0;
  const st = (el, cls)=>{ el.className = 'fr-step ' + cls; };
  st($('fs1'), anySel() ? 'done' : 'active');
  st($('fs2'), 'done');
  st($('fs3'), S.generating ? 'active' : (anyPending ? 'active' : (wornCount(S.applied) ? 'done' : '')));
  st($('fs4'), (!anyPending && wornCount(S.applied)) ? 'active' : '');
}
function renderActions(){
  const pend = pendingList().length;
  const btn = $('fr-generate');
  if(S.generating){ btn.disabled = true; btn.innerHTML = `<i data-lucide="sparkles" class="spin" aria-hidden="true"></i>生成中…`; }
  else if(pend){ btn.disabled = false; btn.innerHTML = `<i data-lucide="sparkles" aria-hidden="true"></i>开始试穿<span class="fr-badge">${pend}</span>`; }
  else if(wornCount(S.applied)){ btn.disabled = true; btn.innerHTML = `<i data-lucide="check" aria-hidden="true"></i>已上身 · 可继续添加`; }
  else { btn.disabled = true; btn.innerHTML = `<i data-lucide="sparkles" aria-hidden="true"></i>请先选择衣物`; }
  $('fr-save').disabled = !wornCount(S.applied) || S.generating;
  $('fr-share').disabled = !wornCount(S.applied) || S.generating;
  refreshIcons();
}
function syncStage(){ stage3d.setFigure(S.person, S.applied); }
function renderAll(){
  renderTabs(); renderGarments(); renderPersons(); renderLooks();
  renderChips(); renderPersonChip(); renderSteps(); renderActions(); syncStage();
}

/* ================= 视角 / 缩放控件 ================= */
function nearestPreset(deg){
  return [0, 90, 180, 270].reduce((a, b)=>
    Math.abs(((b - deg + 540) % 360) - 180) < Math.abs(((a - deg + 540) % 360) - 180) ? b : a);
}
stage3d.onAngle = deg=>{
  S.angle = deg;
  $('fr-angle').textContent = Math.round(deg) + '°';
  const np = nearestPreset(deg);
  root.querySelectorAll('.fr-view').forEach(b=>b.setAttribute('aria-pressed', String(Number(b.dataset.ang) === np)));
};
stage3d.onZoom = z=>{
  S.zoom = Math.min(1.4, Math.max(0.6, z));
  $('fr-zoom').value = Math.round(S.zoom*100);
  persist();
};
root.querySelectorAll('.fr-view').forEach(b=>b.addEventListener('click', ()=>stage3d.tweenTheta(Number(b.dataset.ang))));
function setAuto(on){
  S.auto = on;
  stage3d.setAuto(on);
  $('fr-rot').innerHTML = `<i data-lucide="${S.auto?'pause':'play'}" aria-hidden="true"></i>`;
  $('fr-rot').setAttribute('aria-pressed', S.auto ? 'true' : 'false');
  refreshIcons();
}
$('fr-rot').addEventListener('click', ()=>setAuto(!S.auto));
function applyZoom(z){
  S.zoom = Math.min(1.4, Math.max(0.6, z));
  $('fr-zoom').value = Math.round(S.zoom*100);
  stage3d.setZoom(S.zoom);
}
$('fr-zoom').addEventListener('input', e=>applyZoom(e.target.value/100));
$('fr-zoom').addEventListener('change', persist);
$('fr-zin').addEventListener('click', ()=>{ applyZoom(S.zoom + 0.1); persist(); });
$('fr-zout').addEventListener('click', ()=>{ applyZoom(S.zoom - 0.1); persist(); });

/* ================= 交互：衣物 / 人物 ================= */
$('fr-tabs').addEventListener('click', e=>{
  const b = e.target.closest('.fr-tab'); if(!b) return;
  S.tab = b.dataset.tab; renderTabs(); renderGarments();
});
$('fr-ggrid').addEventListener('click', e=>{
  if(e.target.closest('#fr-gup')){ $('fr-gfile').click(); return; }
  const c = e.target.closest('.fr-gcard'); if(!c) return;
  const g = findG(c.dataset.g); if(!g) return;
  if(S.sel[g.cat] && S.sel[g.cat].id===g.id){ S.sel[g.cat] = null; }
  else{
    S.sel[g.cat] = g;
    if(g.cat==='dress'){ S.sel.top = null; S.sel.bottom = null; }
    if(g.cat==='top' || g.cat==='bottom'){ S.sel.dress = null; }
  }
  renderGarments(); renderChips(); renderSteps(); renderActions(); persist();
});
$('fr-pgrid').addEventListener('click', e=>{
  if(e.target.closest('#fr-pup')){ $('fr-pfile').click(); return; }
  if(e.target.closest('#fr-cam-open')){ openCam(); return; }
  const c = e.target.closest('.fr-pcard'); if(!c) return;
  const p = allPersons().find(x=>x.id===c.dataset.p); if(!p) return;
  S.person = p;
  renderPersons(); renderPersonChip(); syncStage(); persist();
});

/* ================= 上传：主色提取 ================= */
function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return '#' + ((1<<24) + (f(n>>16)<<16) + (f(n>>8&255)<<8) + f(n&255)).toString(16).slice(1);
}
function dominantColor(img){
  try{
    const cv = document.createElement('canvas'); cv.width = cv.height = 24;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 24, 24);
    const d = cx.getImageData(0, 0, 24, 24).data;
    const buckets = {};
    for(let i=0;i<d.length;i+=4){
      if(d[i+3] < 128) continue;
      const k = (d[i]>>4) + ',' + (d[i+1]>>4) + ',' + (d[i+2]>>4);
      (buckets[k] = buckets[k] || {c:0, r:0, g:0, b:0});
      buckets[k].c++; buckets[k].r += d[i]; buckets[k].g += d[i+1]; buckets[k].b += d[i+2];
    }
    let best = null;
    Object.values(buckets).forEach(v=>{ if(!best || v.c > best.c) best = v; });
    if(!best) return '#7a8290';
    const h = v => v.toString(16).padStart(2, '0');
    return '#' + h(Math.round(best.r/best.c)>>4<<4) + h(Math.round(best.g/best.c)>>4<<4) + h(Math.round(best.b/best.c)>>4<<4);
  }catch(err){ return '#7a8290'; }
}
$('fr-gfile').addEventListener('change', e=>{
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{
    const color = dominantColor(img);
    URL.revokeObjectURL(url);
    const cat = S.tab;
    const g = {id:'cg'+(++S.lookSeq), cat, name:f.name.replace(/\.[^.]+$/,'').slice(0,8) || '自定义衣物', color, color2:shade(color,-26), pattern:'solid',
      sleeve: cat==='top'||cat==='dress' ? 'short' : undefined, form: cat==='bottom' ? 'pants' : cat==='shoes' ? 'sneaker' : undefined, uploaded:true};
    S.customG.push(g);
    S.sel[cat] = g;
    if(cat==='dress'){ S.sel.top = null; S.sel.bottom = null; }
    if(cat==='top' || cat==='bottom'){ S.sel.dress = null; }
    renderTabs(); renderGarments(); renderChips(); renderSteps(); renderActions();
    toast('已添加并选中（演示：正式版为 AI 抠图 + 类目识别）');
    persist();
  };
  img.onerror = ()=>toast('图片读取失败，请换一张试试');
  img.src = url;
});
$('fr-pfile').addEventListener('change', e=>{
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = ()=>{
    const base = PERSONS[0];
    const p = {id:'cp'+(++S.lookSeq)+'_'+Date.now()%997, name:'自定义人物', tags:'照片人物', custom:true, thumbURL:url,
      skin:base.skin, hair:base.hair, style:base.style, fig:{...base.fig}};
    S.customP.push(p); S.person = p;
    renderPersons(); renderPersonChip(); syncStage();
    toast('已选用照片人物（演示：正式版由 AI 保持脸部与体型一致）');
    persist();
  };
  img.onerror = ()=>toast('图片读取失败，请换一张试试');
  img.src = url;
});

/* ================= 摄像头（模拟） ================= */
let camToken = 0;
function openCam(){
  $('fr-cam').hidden = false;
  $('fr-cam-sil').innerHTML = `<img src="${snapshot(PERSONS[1], BARE, 'body')}" alt="">`;
  refreshIcons();
}
function closeCam(){ $('fr-cam').hidden = true; $('fr-cam-count').hidden = true; $('fr-cam-card').classList.remove('flash'); camToken++; }
$('fr-cam-x').addEventListener('click', closeCam);
$('fr-cam-cancel').addEventListener('click', closeCam);
$('fr-cam-shot').addEventListener('click', ()=>{
  const token = ++camToken;
  const cnt = $('fr-cam-count'); cnt.hidden = false;
  let n = 3; cnt.textContent = n;
  const iv = setInterval(()=>{
    if(token !== camToken){ clearInterval(iv); return; }
    n--;
    if(n > 0){ cnt.textContent = n; return; }
    clearInterval(iv);
    cnt.hidden = true; $('fr-cam-card').classList.add('flash');
    setTimeout(()=>{
      if(token !== camToken) return;
      const base = PERSONS[1 + Math.floor(Math.random()*2)];
      const p = {id:'cp'+(++S.lookSeq)+'_'+Date.now()%991, name:'现场拍摄', tags:'真人 · 摄像头', custom:true, cam:true,
        skin:base.skin, hair:base.hair, style:base.style, fig:{...base.fig}};
      S.customP.push(p); S.person = p;
      closeCam();
      renderPersons(); renderPersonChip(); syncStage();
      toast('拍摄完成，已选用真人形象（演示）');
      persist();
    }, RM ? 60 : 480);
  }, RM ? 80 : 700);
});

/* ================= 生成流水线（模拟） ================= */
$('fr-generate').addEventListener('click', ()=>{
  const snap = cloneWorn(S.sel);
  if(!wornCount(snap)) return;
  S.generating = true;
  $('fr-gen').hidden = false;
  $('fr-gsteps').innerHTML = GEN_STEPS.map(s=>`<li><span class="ic"></span>${s}</li>`).join('');
  const lis = [...$('fr-gsteps').children];
  const marks = [.1, .32, .55, .8, .96];
  const t0 = performance.now(), dur = RM ? 600 : 2600;
  renderSteps(); renderActions();
  (function tick(){
    const k = Math.min((performance.now() - t0)/dur, 1);
    const pct = Math.round(k*100);
    $('fr-gbar').style.width = pct + '%';
    $('fr-gpct').textContent = pct + '%';
    $('fr-gprog').setAttribute('aria-valuenow', pct);
    lis.forEach((li, i)=>{
      li.className = k >= marks[i] ? 'done' : (i > 0 && k >= marks[i-1] ? 'doing' : '');
    });
    if(k < 1){ setTimeout(tick, 60); return; }
    setTimeout(()=>{
      S.applied = snap; S.generating = false; $('fr-gen').hidden = true;
      syncStage();
      const cv = $('fr-stage').querySelector('canvas');
      if(cv){ cv.classList.remove('flash'); void cv.offsetWidth; cv.classList.add('flash'); }
      renderChips(); renderSteps(); renderActions();
      toast(`试穿完成（演示用时 ${(dur/1000).toFixed(1)}s · 正式版为真实上身图）`);
      persist();
    }, 260);
  })();
});

/* ================= 保存 / 对比 / 分享 / 重置 ================= */
$('fr-save').addEventListener('click', ()=>{
  if(!wornCount(S.applied)) return;
  S.looks.unshift({id:'l'+(++S.lookSeq), worn:cloneWorn(S.applied), person:S.person, label:lookLabel(S.applied, S.person)});
  if(S.looks.length > 9) S.looks.pop();
  renderLooks();
  toast('已保存到「我的试衣间」');
  persist();
});
$('fr-share').addEventListener('click', ()=>toast('分享海报已生成（原型演示）'));
$('fr-looks').addEventListener('click', e=>{
  const del = e.target.closest('.del');
  const item = e.target.closest('.fr-look'); if(!item) return;
  const id = item.dataset.l;
  if(del){
    S.looks = S.looks.filter(l=>l.id !== id);
    S.picks = S.picks.filter(x=>x !== id);
    renderLooks();
    if(S.picks.length === 2) openCompare(); else $('fr-compare').hidden = true;
    persist(); return;
  }
  if(S.compare){
    const i = S.picks.indexOf(id);
    if(i > -1) S.picks.splice(i, 1);
    else{ if(S.picks.length >= 2) S.picks.shift(); S.picks.push(id); }
    renderLooks();
    if(S.picks.length === 2) openCompare(); else $('fr-compare').hidden = true;
  }else{
    const l = S.looks.find(x=>x.id===id); if(!l) return;
    S.sel = cloneWorn(l.worn); S.applied = cloneWorn(l.worn); S.person = l.person;
    renderGarments(); renderPersons(); renderChips(); renderPersonChip(); renderSteps(); renderActions(); syncStage();
    toast('已恢复该穿搭');
    persist();
  }
});
$('fr-cmp-toggle').addEventListener('click', ()=>{
  S.compare = !S.compare; S.picks = [];
  $('fr-cmp-toggle').setAttribute('aria-pressed', S.compare ? 'true' : 'false');
  if(!S.compare) $('fr-compare').hidden = true;
  renderLooks();
  toast(S.compare ? (S.looks.length >= 2 ? '对比模式：请在试衣间点选两套穿搭' : '对比模式：至少需要两套穿搭') : '已退出对比模式');
});
function openCompare(){
  const picks = S.picks.map(id=>S.looks.find(l=>l.id===id)).filter(Boolean);
  if(picks.length < 2) return;
  $('fr-cmp-grid').innerHTML = picks.map((l, i)=>`
    <div class="fr-compare-item">
      <div class="lab"><b>${esc(l.label.split(' · ')[0])}</b>${esc(' · ' + l.person.name)} · 方案 ${String.fromCharCode(65+i)}</div>
      <img src="${snapshot(l.person, l.worn, 'body')}" alt="${esc(l.label)}">
    </div>`).join('');
  $('fr-compare').hidden = false;
}
$('fr-cmp-close').addEventListener('click', ()=>{ $('fr-compare').hidden = true; });
$('fr-reset').addEventListener('click', ()=>{
  S.sel = {top:null, bottom:null, dress:null, shoes:null};
  S.applied = {top:null, bottom:null, dress:null, shoes:null};
  S.person = PERSONS[0]; S.picks = [];
  setAuto(false);
  stage3d.resetView();
  renderGarments(); renderPersons(); renderChips(); renderPersonChip(); renderSteps(); renderActions(); syncStage();
  toast('已重置（保留已上传素材与试衣间）');
  persist();
});

/* ================= Toast ================= */
let toastT = 0;
function toast(msg){
  const t = $('fr-toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ================= 持久化（localStorage） ================= */
let persistT = 0;
function persist(){
  clearTimeout(persistT);
  persistT = setTimeout(()=>{
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tab:S.tab,
        sel:mapWorn(S.sel), applied:mapWorn(S.applied),
        person:S.person.id, looks:S.looks.map(l=>({id:l.id, label:l.label, worn:mapWorn(l.worn), person:l.person.id, personSnap:l.person})),
        angle:Math.round(S.angle), zoom:S.zoom, lookSeq:S.lookSeq,
        customG:S.customG,
        customP:S.customP.map(p=>({id:p.id, name:p.name, tags:p.tags, custom:true, skin:p.skin, hair:p.hair, style:p.style, fig:p.fig, build:p.build}))
      }));
    }catch(e){}
  }, 250);
}
function mapWorn(w){
  const o = {}; CATS.forEach(c=>o[c.key] = w[c.key] ? w[c.key].id : null); return o;
}
function applySnap(snap){
  try{
    if(!snap) return;
    if(Array.isArray(snap.customG)) S.customG = snap.customG.filter(g=>g && g.id && g.color);
    if(Array.isArray(snap.customP)) S.customP = snap.customP;
    if(typeof snap.lookSeq === 'number') S.lookSeq = snap.lookSeq;
    const resolve = w=>{ const o = {top:null, bottom:null, dress:null, shoes:null};
      CATS.forEach(c=>o[c.key] = w && w[c.key] ? findG(w[c.key]) : null); return o; };
    if(snap.sel) S.sel = resolve(snap.sel);
    if(snap.applied) S.applied = resolve(snap.applied);
    S.person = allPersons().find(p=>p.id === snap.person) || PERSONS[0];
    if(Array.isArray(snap.looks)){
      S.looks = snap.looks.map(l=>({id:l.id || 'l'+Math.random(), label:l.label || '穿搭', worn:resolve(l.worn),
        person:allPersons().find(p=>p.id === l.person) || l.personSnap || PERSONS[0]})).filter(l=>wornCount(l.worn));
    }
    if(typeof snap.angle === 'number') S.angle = snap.angle;
    if(typeof snap.zoom === 'number') S.zoom = Math.min(1.4, Math.max(0.6, snap.zoom));
    $('fr-zoom').value = Math.round(S.zoom*100);
    if(snap.tab && CATS.some(c=>c.key === snap.tab)) S.tab = snap.tab;
    renderAll();
  }catch(e){}
}

/* ================= 启动 ================= */
try{
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) applySnap(JSON.parse(saved));
}catch(e){}

let stageOK = false;
try{
  initStage($('fr-stage'));
  stageOK = true;
}catch(e){ stageOK = false; }

if(stageOK){
  stage3d.initView(S.angle, S.zoom);
  stage3d.setFigure(S.person, S.applied);
}else{
  $('fr-stagerr').hidden = false;
}
renderAll();
refreshIcons();
