/* FitRoom 3D —— 静态数据与人物体型参数 */

export const CATS = [
  {key:'top', label:'上装'}, {key:'bottom', label:'下装'},
  {key:'dress', label:'连衣裙'}, {key:'shoes', label:'鞋子'}
];

export const BARE = {top:null, bottom:null, dress:null, shoes:null};

export const GARMENTS = [
  {id:'g1', cat:'top', name:'白色衬衫', color:'#f1f1ec', color2:'#d8d8d0', pattern:'solid', sleeve:'long'},
  {id:'g2', cat:'top', name:'黑色T恤', color:'#24272c', color2:'#30343b', pattern:'solid', sleeve:'short'},
  {id:'g3', cat:'top', name:'米色针织衫', color:'#d8c29f', color2:'#c6ab82', pattern:'solid', sleeve:'long'},
  {id:'g4', cat:'top', name:'条纹海魂衫', color:'#2e4d80', color2:'#e9edf3', pattern:'stripe', sleeve:'short'},
  {id:'g5', cat:'bottom', name:'直筒牛仔裤', color:'#3f5b87', color2:'#33496c', pattern:'solid', form:'pants'},
  {id:'g6', cat:'bottom', name:'黑色A字裙', color:'#1e2026', color2:'#2b2e36', pattern:'solid', form:'skirt'},
  {id:'g7', cat:'bottom', name:'卡其休闲裤', color:'#b1946b', color2:'#9a7b5b', pattern:'solid', form:'pants'},
  {id:'g8', cat:'dress', name:'红色连衣裙', color:'#c22f45', color2:'#a12539', pattern:'solid', sleeve:'short'},
  {id:'g9', cat:'dress', name:'波点连衣裙', color:'#e29ab6', color2:'#5b2b3a', pattern:'dot', sleeve:'long'},
  {id:'g10', cat:'shoes', name:'白色运动鞋', color:'#edf0f5', color2:'#d6dbe3', pattern:'solid', form:'sneaker'},
  {id:'g11', cat:'shoes', name:'黑色马丁靴', color:'#1b1c21', color2:'#282a31', pattern:'solid', form:'boot'}
];

/* 预置人物：fig 为体型参数（身高/肩宽/胸/腰/臀/四肢粗细系数） */
export const PERSONS = [
  {id:'p1', name:'小雅', tags:'女 · 标准体型', skin:'#f0c8a8', hair:'#3a2b20', style:'bob',
   fig:{h:1.66, sw:0.163, chest:0.112, waist:0.092, hip:0.124, limb:0.98}},
  {id:'p2', name:'阿哲', tags:'男 · 高挑', skin:'#e6b189', hair:'#1e1a16', style:'short',
   fig:{h:1.80, sw:0.196, chest:0.130, waist:0.112, hip:0.116, limb:1.16}},
  {id:'p3', name:'可可', tags:'女 · 丰满', skin:'#8d5a3b', hair:'#241a12', style:'long',
   fig:{h:1.64, sw:0.172, chest:0.130, waist:0.108, hip:0.143, limb:1.20}}
];

export const GEN_STEPS = ['素材预处理 · 自动抠图', '人体解析 · 分割', '姿态估计 · DWPose', '服装融合 · 试穿生成', '画质增强 · 输出'];

export function figParams(p){
  if(p && p.fig) return p.fig;
  const b = (p && p.build) || 1;
  return { h: 1.66 + (b-1)*0.5, sw: 0.165*b, chest: 0.115*b, waist: 0.096*b, hip: 0.127*b, limb: b };
}
