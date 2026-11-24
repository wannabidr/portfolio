import * as T from './assets/three.module.js';

const hero = document.querySelector('.hero');
const art = hero.querySelector('.art');
const stage = art.querySelector('.art-stage');
const canvas = stage.querySelector('canvas');
const choices = [...art.querySelectorAll('.views button')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');

// A panoramic studio light rig supplies reflections without external textures.
function studio(renderer) {
  const width = 256, height = 128;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width, v = y / height;
      const light = v > .58 ? .53 : .09;
      const panel = (u > .09 && u < .22 && v > .40 && v < .89)
        || (u > .54 && u < .64 && v > .24 && v < .70) || v > .91;
      const strip = u > .82 && u < .87 && v > .25;
      pixels.set([light + (panel ? 5 : 0), light + (panel ? 5 : 0) + (strip ? 1.9 : 0),
        light * 1.3 + (panel ? 5.4 : 0) + (strip ? 4 : 0), 1], (y * width + x) * 4);
    }
  }
  const map = new T.DataTexture(pixels,width,height,undefined,T.FloatType);
  map.mapping = T.EquirectangularReflectionMapping;
  map.needsUpdate = true;
  const bake = new T.PMREMGenerator(renderer);
  const target = bake.fromEquirectangular(map);
  map.dispose();
  bake.dispose();
  return target;
}

function mount() {
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:true}); }
  catch { return; }
  const scene = new T.Scene();
  const lighting = studio(renderer);
  scene.environment = lighting.texture;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const camera = new T.PerspectiveCamera(34,1,.1,30);
  camera.position.z = 7;
  const model = new T.Group();
  scene.add(model);
  const material = (color, metalness, roughness) => new T.MeshStandardMaterial({color,metalness,roughness,side:T.DoubleSide});
  const steel = material(0xbec6d4, .96, .16);
  const bright = material(0xeaf0ff, 1, .105);
  const enamel = material(0x5254d6, .64, .21);
  const detail = material(0xa0ce5b, .55, .23);
  function ring(profile, finish) {
    const points = [...profile,profile[0]].map(([r,h])=>new T.Vector2(r,h));
    const mesh = new T.Mesh(new T.LatheGeometry(points,160),finish);
    model.add(mesh);
    return mesh;
  }
  const outer = ring([[1.25,-.24],[1.48,-.24],[1.54,-.18],[1.54,.17],[1.48,.24],
    [1.25,.24],[1.22,.19],[1.22,.12],[1.27,.06],[1.29,0],[1.27,-.06],[1.22,-.12],[1.22,-.19]],steel);
  const inner = ring([[.57,-.24],[.75,-.24],[.80,-.19],[.80,-.12],[.75,-.06],[.735,0],
    [.75,.06],[.80,.12],[.80,.19],[.75,.24],[.57,.24],[.53,.19],[.53,-.19]],bright);
  const seal = ring([[.82,0],[1.19,0],[1.20,.025],[1.17,.046],[.85,.046],[.82,.025]],enamel);
  function bead(radius, thickness, finish, parent, height) {
    const mesh = new T.Mesh(new T.TorusGeometry(radius,thickness,8,160),finish);
    mesh.rotation.x = Math.PI/2;
    mesh.position.y = height;
    parent.add(mesh);
  }
  bead(1.39,.009,bright,outer,.244);
  bead(.91,.012,detail,seal,.051);
  bead(1.12,.013,bright,seal,.05);
  const balls = new T.Group();
  const sphere = new T.SphereGeometry(.245,36,24);
  for (let i=0; i<12; i++) {
    const a = i*Math.PI/6;
    const mesh = new T.Mesh(sphere,bright);
    mesh.position.set(1.012*Math.cos(a),0,1.012*Math.sin(a));
    balls.add(mesh);
  }
  model.add(balls);

  const views = [
    {shell:0,core:0,cover:.32,tilt:.80,roll:-.41,zoom:1.05},
    {shell:-.67,core:.51,cover:1.10,tilt:.49,roll:-.39,zoom:.90},
    {shell:-.19,core:.14,cover:.96,tilt:.92,roll:.09,zoom:1.09}
  ];
  let selected = 0, values = {...views[0]}, yaw = 0, aim = 0, pitch = 0, aimPitch = 0;
  let frame = 0, onScreen = true, lost = false;
  function draw() {
    frame = 0;
    if (!onScreen || document.hidden || lost) return;
    const speed = motion.matches ? 1 : .09;
    let delta = 0;
    for (const key of Object.keys(values)) {
      values[key] += (views[selected][key]-values[key])*speed;
      delta += Math.abs(views[selected][key]-values[key]);
    }
    yaw += (aim-yaw)*speed;
    pitch += (aimPitch-pitch)*speed;
    model.rotation.set(values.tilt+pitch,yaw,values.roll);
    model.scale.setScalar(values.zoom);
    outer.position.y = values.shell;
    inner.position.y = values.core;
    seal.position.y = values.cover;
    // Cut away the dust shield to expose the ball and groove at the inspection stage.
    seal.visible = selected !== 2;
    balls.children[2].material = selected === 2 ? detail : bright;
    renderer.render(scene,camera);
    if (delta+Math.abs(aim-yaw)+Math.abs(aimPitch-pitch)>.001) requestDraw();
  }
  function requestDraw(){ if (!frame && onScreen && !document.hidden && !lost) frame=requestAnimationFrame(draw); }
  function setView(index) {
    selected=index;
    choices.forEach((btn,i)=>btn.setAttribute('aria-pressed',String(i===index)));
    requestDraw();
  }
  choices.forEach((button,index)=>button.addEventListener('click',()=>setView(index)));
  let drag=null;
  stage.addEventListener('pointerdown',e=>{
    if (!e.isPrimary || e.button!==0) return;
    drag={x:e.clientX,y:e.clientY,angle:aim,pitch:aimPitch};
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove',e=>{
    if(!drag || !e.isPrimary) return;
    aim=drag.angle+(e.clientX-drag.x)*.012;
    aimPitch=Math.max(-.5,Math.min(.5,drag.pitch+(e.clientY-drag.y)*.005));
    requestDraw();
  });
  stage.addEventListener('lostpointercapture',()=>{drag=null});
  stage.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault(); aim+=e.key==='ArrowLeft'?-.24:.24;requestDraw();
  });
  function resize(){
    const {width,height}=stage.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.position.z = Math.max(6.5,6.1/camera.aspect);
    camera.updateProjectionMatrix();requestDraw();
  }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;requestDraw()}).observe(art);
  document.addEventListener('visibilitychange',requestDraw);

  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;hero.classList.remove('live');stage.tabIndex=-1});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;hero.classList.add('live');stage.tabIndex=0;resize()});
  hero.classList.add('live');
  stage.tabIndex=0;
  setView(0);resize();
}
mount();

