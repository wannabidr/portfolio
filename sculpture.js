import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry,
  Float32BufferAttribute, ShaderMaterial, Points, AdditiveBlending
} from './assets/three.module.js';

function mountSculpture(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return; // The static rendering is already visible.
  }

  const art = canvas.closest('.art');
  const slider = art.querySelector('#cohesion');
  const button = art.querySelector('#motion');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, .1, 20);
  camera.position.z = 5.6;

  // Each thread traces a closed path on a twisted ribbon.
  const geometry = new BufferGeometry();
  const positions = [], scatter = [], phases = [];
  let seed = 73;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let thread = 0; thread < 95; thread++) {
    const v = thread / 94 * 2 - 1;
    for (let dot = 0; dot < 340; dot++) {
      const a = (dot + .35 * v) / 340 * Math.PI * 2;
      const twist = a * 2 + .55 * Math.sin(a * 3);
      const radius = 1.13 + .19 * Math.cos(a * 3) + .56 * v * Math.cos(twist);
      positions.push(radius * Math.cos(a), radius * Math.sin(a),
        .5 * Math.sin(a * 3) + .66 * v * Math.sin(twist));
      const drift = a + 1.55 * v + random() * .5;
      const spread = .42 + random() * 1.18;
      scatter.push(spread * Math.cos(drift), spread * Math.sin(drift), (random() - .5) * 1.6);
      phases.push(a, v, random());
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('drift', new Float32BufferAttribute(scatter, 3));
  geometry.setAttribute('phase', new Float32BufferAttribute(phases, 3));
  const uniforms = { cohesion: { value: slider.valueAsNumber / 100 }, pixelScale: { value: 1 } };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: `
      attribute vec3 drift, phase;
      uniform float cohesion, pixelScale;
      varying vec3 tint;
      varying float strength;
      void main() {
        vec3 p = mix(drift, position, cohesion);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((1.1 + phase.z * 1.1) * pixelScale * 5.5 / -view.z, 1.0, 6.0);
        float stripe = .5 + .5 * sin(phase.x * 2.0 + phase.y * 1.7);
        tint = mix(vec3(.49,.34,.96), vec3(.84,.75,1.), stripe);
        tint = mix(tint, vec3(.73,1.,.45), smoothstep(.71,1.,stripe));
        strength = (.31 + .54 * smoothstep(-6.8,-4.0,view.z)) * (.5 + .5*phase.z);
      }`,
    fragmentShader: `
      varying vec3 tint;
      varying float strength;
      void main() {
        float r = length(gl_PointCoord - .5);
        gl_FragColor = vec4(tint, (1.0 - smoothstep(.12,.5,r)) * strength);
      }`
  });
  const ribbon = new Points(geometry, material);
  ribbon.rotation.set(.62, -.23, -.38);
  scene.add(ribbon);
  let playing = !motion.matches, visible = false, frame = 0, last = 0;
  const draw = () => renderer.render(scene, camera);
  function tick(time) {
    if (!last || time-last >= 32) {
      ribbon.rotation.y += last ? Math.min(time-last,80) * .00015 : 0;
      last = time;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    button.setAttribute('aria-pressed', String(playing));
    art.querySelector('#motion-icon').textContent = playing ? 'Ⅱ' : '▷';
    art.querySelector('#motion-text').textContent = playing ? '회전 멈춤' : '회전 시작';
    if (playing && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const {width,height} = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(density);
    renderer.setSize(width,height,false);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    uniforms.pixelScale.value = density * Math.max(.74, Math.min(width,height)/480);
    draw();
    art.classList.add('ready');
  }
  slider.addEventListener('input', () => {
    uniforms.cohesion.value = slider.valueAsNumber / 100;
    draw();
  });
  button.addEventListener('click', () => { playing = !playing; sync(); });
  motion.addEventListener('change', () => { playing = !motion.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(art);
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('webglcontextlost', () => {
    playing = false;
    sync();
    art.classList.remove('ready');
    slider.parentElement.hidden = button.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    slider.parentElement.hidden = button.hidden = false;
    resize();
  });
  slider.parentElement.hidden = button.hidden = false;
  resize();
  sync();
}
mountSculpture(document.querySelector('#sculpture'));

