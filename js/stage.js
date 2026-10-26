/* FitRoom 3D —— Three.js 渲染引擎：参数化人体建模 + 服装外壳 + 相机交互 + 快照 */
import * as THREE from './vendor/three.module.js';
import { CATS, BARE, figParams } from './data.js';

/* ================= 工具 ================= */
function profileSample(pts, n){
  const cur = new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0], p[1], 0)));
  return cur.getPoints(n).map(v=>[Math.max(0.001, v.x), v.y]);
}
function lathe(pts){
  return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0], p[1])), 48);
}
function garmentMaterial(g, repeatY){
  if(!g || g.pattern==='solid')
    return new THREE.MeshStandardMaterial({color:new THREE.Color(g ? g.color : '#888'), roughness:0.85});
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = g.color; c.fillRect(0,0,64,64);
  if(g.pattern==='stripe'){ c.fillStyle = g.color2; c.fillRect(0,0,64,32); }
  else{
    c.fillStyle = g.color2;
    for(let j=0;j<4;j++) for(let i=0;i<4;i++){
      const x = 4 + i*16 + ((j%2)?8:0), y = 4 + j*16;
      c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI*2); c.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(g.pattern==='stripe' ? 1 : 2, repeatY || 6);
  return new THREE.MeshStandardMaterial({map:tex, roughness:0.85});
}
function disposeGroup(gr){
  gr.traverse(o=>{
    if(o.isMesh){
      o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m=>{ if(m && m.map) m.map.dispose(); if(m) m.dispose(); });
    }
  });
}
function parseColor(c){
  if(!c) return '#888888';
  c = String(c).trim();
  const ld = c.match(/^light-dark\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/);
  if(ld) c = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? ld[2] : ld[1];
  if(c[0] === '#') return c;
  const m = c.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/);
  if(m) return '#' + [1,2,3].map(i=>(+m[i]).toString(16).padStart(2,'0')).join('');
  return '#888888';
}
function shadeHex(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return '#' + ((1<<24) + (f(n>>16)<<16) + (f(n>>8&255)<<8) + f(n&255)).toString(16).slice(1);
}

/* 四肢连续轮廓（肩→腕 / 髋→踝）：单一车削曲面，无关节球拼接。升序 y 与躯干一致，保证法线朝外 */
function armProfile(aR){
  return [
    [0.001, -0.60], [aR*0.40, -0.565], [aR*0.52, -0.52], [aR*0.64, -0.44],
    [aR*0.70, -0.35], [aR*0.76, -0.30], [aR*0.92, -0.24], [aR*1.00, -0.13],
    [aR*0.95, -0.07], [aR*0.72, -0.005], [0.001, 0.01]
  ];
}
function legProfile(tR, cR){
  return [
    [0.001, -0.79], [cR*0.74, -0.73], [cR*0.88, -0.66], [cR*1.10, -0.56],
    [cR*1.04, -0.47], [tR*0.72, -0.40], [tR*0.88, -0.32], [tR*0.97, -0.22],
    [tR*1.00, -0.10], [tR*0.92, -0.01], [0.001, 0.02]
  ];
}

/* ================= 人体 + 服装建模 ================= */
export function buildFigure(person, worn){
  const F = figParams(person), H = F.h, L = F.limb;
  const g = new THREE.Group();
  const skinM = new THREE.MeshStandardMaterial({color:new THREE.Color(person.skin||'#f0c8a8'), roughness:0.55});
  const hairM = new THREE.MeshStandardMaterial({color:new THREE.Color(person.hair||'#3a2b20'), roughness:0.45});
  const add = (mesh, parent)=>{ mesh.castShadow = true; (parent||g).add(mesh); return mesh; };
  const sph = (r, mat, sx=1, sy=1, sz=1)=>{ const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat); m.scale.set(sx, sy, sz); return m; };
  const cap = (r, len, mat)=>new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 18), mat);
  const cyl = (rt, rb, h, mat)=>new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 28, 1), mat);

  const yHip = 0.505*H, yWaist = 0.625*H, yChest = 0.72*H, yShoul = 0.815*H;

  // 躯干（车削曲面，椭圆截面；肩颈斜方肌连续过渡）
  const torsoPts = [
    [0.001, 0.40*H], [F.hip*0.80, 0.46*H], [F.hip, yHip], [F.waist, yWaist],
    [F.chest, yChest], [F.chest*0.96, 0.775*H],
    [F.sw*0.60, 0.795*H], [F.sw*0.92, 0.815*H], [F.sw*0.66, 0.840*H],
    [0.058, 0.862*H], [0.048, 0.872*H]
  ];
  const torso = new THREE.Mesh(lathe(profileSample(torsoPts, 48)), skinM);
  torso.scale.z = 0.62; add(torso);

  // 颈 + 头（无五官模特风）
  const neck = cyl(0.046, 0.052, 0.10, skinM); neck.position.y = 0.875*H; add(neck);
  const head = sph(0.085, skinM, 0.96, 1.08, 1.0); head.position.y = 0.918*H; add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 24, 0, Math.PI*2, 0, 1.3), hairM);
  hairCap.position.set(0, 0.918*H + 0.004, -0.006); hairCap.rotation.x = -0.10; add(hairCap);
  if(person.style==='bob' || person.style==='long'){
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 24, Math.PI*0.75, Math.PI*1.5, 0, Math.PI*0.62), hairM);
    shell.position.set(0, 0.905*H, -0.012); shell.scale.set(1, 1.05, 1); add(shell);
  }
  if(person.style==='long'){
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.096, 32, 24, Math.PI*0.85, Math.PI*1.3, 0, Math.PI*0.85), hairM);
    back.position.set(0, 0.86*H, -0.02); back.scale.set(1.02, 1.9, 0.9); add(back);
  }

  // 手臂（单一车削曲面：肩→腕连续变径，自肩部斜方肌下方自然伸出）
  const aR = 0.040*L;
  const armGroup = {};
  for(const s of [1, -1]){
    const arm = new THREE.Group();
    arm.position.set(s*F.sw*0.72, yShoul - 0.018, 0);
    arm.rotation.z = s*0.13; g.add(arm);
    add(new THREE.Mesh(lathe(profileSample(armProfile(aR), 28)), skinM), arm);
    const hand = sph(0.042, skinM, 0.75, 1.25, 0.55);
    hand.position.y = -0.615; add(hand, arm);
    armGroup[s] = arm;
  }

  // 腿（单一车削曲面：髋→踝连续变径，膝部平滑过渡）+ 脚
  const tR = 0.068*L, cR = 0.050*L;
  const legGroup = {};
  for(const s of [1, -1]){
    const leg = new THREE.Group();
    leg.position.set(s*0.070, yHip, 0);
    leg.rotation.z = -s*0.012; g.add(leg);
    add(new THREE.Mesh(lathe(profileSample(legProfile(tR, cR), 32)), skinM), leg);
    const foot = sph(0.05, skinM, 0.85, 0.7, 2.0);
    foot.position.set(0, -0.795, 0.05); add(foot, leg);
    legGroup[s] = leg;
  }

  // ---------- 服装（身体外壳网格） ----------
  const w = worn || BARE;
  function sleeves(gar, mat){
    if(!gar.sleeve || gar.sleeve==='none') return;
    const prof = armProfile(aR).map(([r, y]) => [r*1.28 + 0.012, y]);
    for(const s of [1, -1]){
      if(gar.sleeve==='long'){
        add(new THREE.Mesh(lathe(profileSample(prof, 24)), mat), armGroup[s]);
      }else{
        const cut = prof.filter(p => p[1] >= -0.33);
        add(new THREE.Mesh(lathe(profileSample(cut, 20)), mat), armGroup[s]);
      }
    }
  }
  if(w.top){
    const m = garmentMaterial(w.top, 7);
    const pts = [
      [F.hip*1.06 + 0.014, 0.50*H], [F.hip*1.02 + 0.012, 0.55*H], [F.waist*1.09 + 0.012, yWaist],
      [F.chest*1.10 + 0.012, yChest], [F.chest*1.04 + 0.012, 0.775*H],
      [F.sw*0.72 + 0.012, 0.795*H], [F.sw*1.02 + 0.012, 0.815*H], [F.sw*0.80 + 0.012, 0.835*H],
      [F.sw*0.46 + 0.012, 0.838*H], [0.072, 0.845*H]
    ];
    const shell = new THREE.Mesh(lathe(profileSample(pts, 36)), m);
    shell.scale.z = 0.64; add(shell);
    sleeves(w.top, m);
  }
  if(w.dress){
    const m = garmentMaterial(w.dress, 6);
    const pts = [
      [F.hip*1.30 + 0.026, 0.50*H], [F.hip*1.10 + 0.014, 0.56*H],
      [F.waist*1.07 + 0.012, yWaist], [F.chest*1.10 + 0.012, yChest],
      [F.chest*1.02 + 0.012, 0.775*H], [F.sw*0.70 + 0.012, 0.795*H],
      [F.sw*1.00 + 0.012, 0.815*H], [F.sw*0.78 + 0.012, 0.835*H],
      [F.sw*0.44 + 0.012, 0.838*H], [0.072, 0.845*H]
    ];
    const shell = new THREE.Mesh(lathe(profileSample(pts, 44)), m);
    shell.scale.z = 0.64; add(shell);
    sleeves(w.dress, m);
  }
  if(w.bottom){
    const b = w.bottom, m = garmentMaterial(b, b.form==='skirt' ? 4 : 12);
    if(b.form === 'skirt'){
      const pts = [
        [F.waist*1.08 + 0.012, 0.65*H], [F.hip*1.05 + 0.014, 0.585*H],
        [F.hip*1.28 + 0.028, 0.52*H], [F.hip*1.42 + 0.05, 0.465*H]
      ];
      const sk = new THREE.Mesh(lathe(profileSample(pts, 28)), m);
      sk.scale.z = 0.72; add(sk);
    }else{
      const pelvis = new THREE.Mesh(lathe(profileSample([
        [0.075, 0.42*H], [F.hip*0.92 + 0.010, 0.49*H], [F.hip*1.00 + 0.008, 0.525*H],
        [F.hip*0.90 + 0.008, 0.56*H], [F.waist*0.98 + 0.008, 0.63*H], [F.waist*0.94 + 0.008, 0.665*H]
      ], 28)), m);
      pelvis.scale.z = 0.64; add(pelvis);
      const legProf = legProfile(tR, cR).map(([r, y]) => [r*1.14 + 0.010, y]);
      for(const s of [1, -1]){
        add(new THREE.Mesh(lathe(profileSample(legProf, 28)), m), legGroup[s]);
      }
    }
  }
  if(w.shoes){
    const sh = w.shoes, m = garmentMaterial(sh, 3);
    const m2 = new THREE.MeshStandardMaterial({color:new THREE.Color(sh.color2||'#333'), roughness:0.8});
    for(const s of [1, -1]){
      add(sph(0.05, m, 1.5, 0.9, 2.6), legGroup[s]).position.set(0, -0.80, 0.055);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.024, 0.26), m2);
      sole.position.set(0, -0.835, 0.055); add(sole, legGroup[s]);
      if(sh.form === 'boot'){
        const shaft = cyl(0.058*L + 0.012, 0.064*L + 0.012, 0.20, m);
        shaft.position.set(0, -0.70, 0.004); add(shaft, legGroup[s]);
      }
    }
  }
  return g;
}

/* ================= 快照（头像 / 缩略图 / 对比图） ================= */
const snapCache = new Map();
let thumb = null;
function ensureThumb(){
  if(thumb) return true;
  try{
    const r = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
    r.setSize(240, 320);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.2, 3.6, 2.6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-2.6, 1.8, 1.8); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(-0.6, 2.6, -3); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 240/320, 0.05, 60);
    thumb = {r, scene, cam};
    return true;
  }catch(e){ return false; }
}
export function snapshot(person, worn, kind){
  if(!stage3d.ready || !ensureThumb()) return '';
  const F = figParams(person);
  const key = kind + '|' + (person.id||'?') + '|' + CATS.map(c=>{
    const g = worn && worn[c.key]; return g ? (g.id + g.color) : '-';
  }).join('|');
  if(snapCache.has(key)) return snapCache.get(key);
  const fig = buildFigure(person, worn || BARE);
  thumb.scene.add(fig);
  if(kind === 'bust'){
    thumb.cam.position.set(0.40, 0.945*F.h, 0.60);
    thumb.cam.lookAt(0, 0.90*F.h, 0);
  }else{
    thumb.cam.position.set(0, 0.88*F.h, 3.75);
    thumb.cam.lookAt(0, 0.845*F.h, 0);
  }
  thumb.r.render(thumb.scene, thumb.cam);
  const url = thumb.r.domElement.toDataURL('image/png');
  thumb.scene.remove(fig); disposeGroup(fig);
  snapCache.set(key, url);
  return url;
}

/* ================= 主舞台 ================= */
export const stage3d = {
  ready:false,
  setFigure(){}, setZoom(){}, tweenTheta(){}, setAuto(){}, resetView(){}, initView(){},
  onAngle: ()=>{}, onZoom: ()=>{}
};

export function initStage(stg){
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stg.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const rig = {theta: 0, phi: 1.45, radius: 4.15, target: new THREE.Vector3(0, 0.83, 0)};

  scene.add(new THREE.HemisphereLight(0xffffff, 0x707a86, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2.2, 3.6, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left:-1.6, right:1.6, top:2.4, bottom:-0.4});
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-2.6, 1.8, 1.8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-0.6, 2.6, -3); scene.add(rim);

  const rootEl = document.getElementById('fitroom-proto');
  const floorColor = shadeHex(parseColor(getComputedStyle(rootEl).getPropertyValue('--panel2')), -10);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 64).rotateX(-Math.PI/2),
    new THREE.MeshStandardMaterial({color:new THREE.Color(floorColor), roughness:0.95})
  );
  disc.receiveShadow = true; scene.add(disc);
  const catcher = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 48).rotateX(-Math.PI/2),
    new THREE.ShadowMaterial({opacity:0.20})
  );
  catcher.receiveShadow = true; scene.add(catcher);

  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  darkMQ.addEventListener?.('change', ()=>{
    disc.material.color = new THREE.Color(shadeHex(parseColor(getComputedStyle(rootEl).getPropertyValue('--panel2')), -10));
  });

  function resize(){
    const w = stg.clientWidth || 600, h = stg.clientHeight || 500;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }

  let figure = null;
  function setFigure(person, worn){
    if(figure){ scene.remove(figure); disposeGroup(figure); }
    figure = buildFigure(person, worn);
    scene.add(figure);
    invalidate();
  }

  // 按需渲染：交互驱动 + RAF/定时器双通道调度（后台标签页 RAF 可能被深度节流）
  const cv = renderer.domElement;
  let dragging = false, lx = 0, ly = 0, tween = null, auto = false, lastDeg = -1, lastZ = 0;
  let scheduled = false, lastT = 0, lastW = 0, lastH = 0;
  function applyCam(){
    const sp = Math.sin(rig.phi), cp = Math.cos(rig.phi);
    camera.position.set(
      rig.target.x + rig.radius*sp*Math.sin(rig.theta),
      rig.target.y + rig.radius*cp,
      rig.target.z + rig.radius*sp*Math.cos(rig.theta)
    );
    camera.lookAt(rig.target);
  }
  function emitAngle(){
    const deg = ((rig.theta*180/Math.PI) % 360 + 360) % 360;
    if(Math.round(deg) !== Math.round(lastDeg)){ lastDeg = deg; stage3d.onAngle(deg); }
  }
  function tick(now){
    if(stg.clientWidth !== lastW || stg.clientHeight !== lastH){
      lastW = stg.clientWidth; lastH = stg.clientHeight;
      resize();
    }
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    let active = false;
    if(tween){
      const k = Math.min((now - tween.t0)/tween.dur, 1);
      const e = 1 - Math.pow(1-k, 3);
      rig.theta = tween.th0 + tween.dTh*e;
      rig.phi = tween.ph0 + tween.dPh*e;
      rig.radius = tween.r0 + tween.dR*e;
      if(k >= 1) tween = null; else active = true;
    }else if(auto && !dragging){
      rig.theta += RM ? 0 : 0.00055*dt;
      active = true;
    }
    applyCam();
    renderer.render(scene, camera);
    emitAngle();
    if(active) schedule();
  }
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(t => { scheduled = false; tick(t || performance.now()); });
    setTimeout(() => { if(scheduled){ scheduled = false; tick(performance.now()); } }, 120);
  }
  function invalidate(){ schedule(); }
  new ResizeObserver(()=>{ resize(); invalidate(); }).observe(stg);
  resize();
  cv.addEventListener('pointerdown', e=>{
    dragging = true; lx = e.clientX; ly = e.clientY; tween = null;
    cv.classList.add('dragging');
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e=>{
    if(!dragging) return;
    rig.theta -= (e.clientX - lx)*0.008;
    rig.phi = Math.min(1.60, Math.max(1.18, rig.phi + (e.clientY - ly)*0.004));
    lx = e.clientX; ly = e.clientY;
    invalidate();
  });
  ['pointerup','pointercancel'].forEach(ev=>cv.addEventListener(ev, ()=>{
    dragging = false; cv.classList.remove('dragging');
  }));
  cv.addEventListener('wheel', e=>{
    e.preventDefault();
    rig.radius = Math.min(6.2, Math.max(2.7, rig.radius * (e.deltaY > 0 ? 1.08 : 0.925)));
    const z = 3.8/rig.radius;
    if(Math.abs(z - lastZ) > 0.005){ lastZ = z; stage3d.onZoom(Math.min(1.4, Math.max(0.6, z))); }
    invalidate();
  }, {passive:false});

  function tweenTheta(deg){
    if(RM){ rig.theta = deg*Math.PI/180; invalidate(); return; }
    const target = deg*Math.PI/180;
    let d = ((target - rig.theta) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
    if(d > Math.PI) d -= Math.PI*2;
    tween = {t0: performance.now(), dur: 520, th0: rig.theta, dTh: d, ph0: rig.phi, dPh: 0, r0: rig.radius, dR: 0};
    invalidate();
  }
  function resetView(){
    const target = 0;
    let d = ((target - rig.theta) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
    if(d > Math.PI) d -= Math.PI*2;
    tween = {t0: performance.now(), dur: 520, th0: rig.theta, dTh: d, ph0: rig.phi, dPh: 1.45 - rig.phi, r0: rig.radius, dR: 3.8 - rig.radius};
    invalidate();
  }

  stage3d.ready = true;
  stage3d.setFigure = setFigure;
  stage3d.setZoom = z => { rig.radius = 3.8/Math.min(1.4, Math.max(0.6, z)); invalidate(); };
  stage3d.tweenTheta = tweenTheta;
  stage3d.setAuto = on => { auto = on && !RM; if(auto){ tween = null; invalidate(); } };
  stage3d.resetView = resetView;
  stage3d.initView = (deg, zoom) => {
    rig.theta = (deg||0)*Math.PI/180;
    rig.radius = 3.8/Math.min(1.4, Math.max(0.6, zoom||1));
    resize(); invalidate();
  };
  invalidate();
}
