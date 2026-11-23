// Render a ribbed trefoil tube. The HTML poster covers devices without WebGL.
(() => {
  const canvas = document.querySelector('#sculpture');
  const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
  if (!gl) return;

  const vertexSource = `
    attribute vec3 position, normal;
    attribute float phase;
    uniform vec2 fit;
    uniform float angle;
    varying vec3 vNormal;
    varying float vPhase;
    vec3 rotateMesh(vec3 p) {
      float c=cos(angle), s=sin(angle);
      vec3 a=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      return vec3(a.x,.91*a.y-.415*a.z,.415*a.y+.91*a.z);
    }
    void main() {
      vec3 p=rotateMesh(position);
      float w=1.0-p.z/6.0;
      gl_Position=vec4(fit*p.xy,-p.z*.18,w);
      vNormal=rotateMesh(normal);
      vPhase=phase;
    }`;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vNormal;
    varying float vPhase;
    void main() {
      vec3 n=normalize(vNormal);
      vec3 key=normalize(vec3(-.55,.8,.7));
      float lit=max(0.0,dot(n,key));
      float rim=pow(1.0-abs(n.z),2.2);
      float t=sin(vPhase*2.0 + n.y*2.4+n.x*.85);
      vec3 paint=mix(vec3(.47,.28,.85),vec3(.75,.65,.99),smoothstep(-.9,.5,t));
      paint=mix(paint,vec3(.74,.94,.46),smoothstep(.72,.98,t));
      float ribs=cos(vPhase*140.0);
      float grooves=1.0-.26*smoothstep(.20,.98,ribs);
      float gloss=pow(max(0.0,dot(n,normalize(vec3(-.38,.53,.78)))),18.0);
      float reflected=pow(max(0.0,dot(n,normalize(vec3(.75,-.35,.55)))),14.0);
      vec3 color=paint*(.30+.83*lit)*grooves + vec3(.67,.61,.75)*gloss
                 + vec3(.37,.33,.57)*reflected + vec3(.22,.19,.31)*rim;
      gl_FragColor=vec4(color,1.0);
    }`;
  function compile(type, source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    return shader;
  }
  const program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const unit=v=>v.map(value=>value/Math.hypot(...v));
  const cross=([x,y,z],[a,b,c])=>[y*c-z*b,z*a-x*c,x*b-y*a];
  const center=t=>{
    const r=1.05+.50*Math.cos(3*t);
    return [r*Math.cos(2*t),r*Math.sin(2*t),.68*Math.sin(3*t)];
  };
  const rings=320, sides=44, vertices=[], triangles=[];
  for (let i=0;i<=rings;i++) {
    const t=2*Math.PI*i/rings;
    const p=center(t);
    const tangent=unit(center(t+.0001).map((v,k)=>v-p[k]));
    const n=unit(cross(tangent,[0,0,1])), b=cross(tangent,n);
    const r=.285+.055*Math.cos(3*t+.4);
    for (let j=0;j<=sides;j++) {
      const a=2*Math.PI*j/sides;
      const normal=n.map((v,k)=>v*Math.cos(a)+b[k]*Math.sin(a));
      vertices.push(...p.map((v,k)=>v+r*normal[k]),...normal,t);
      if (i<rings && j<sides) {
        const start=i*(sides+1)+j, next=start+sides+1;
        triangles.push(start,next,start+1,next,next+1,start+1);
      }
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  for (const [name,size,offset] of [['position',3,0],['normal',3,12],['phase',1,24]]) {
    const location=gl.getAttribLocation(program,name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,size,gl.FLOAT,false,28,offset);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triangles),gl.STATIC_DRAW);
  const fitUniform=gl.getUniformLocation(program,'fit');
  const angleUniform=gl.getUniformLocation(program,'angle');
  gl.enable(gl.DEPTH_TEST);
  const art=canvas.closest('.art'), control=document.querySelector('#motion');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let playing=!motion.matches,visible=false,angle=.21,frame=0,last=0;

  function draw(){
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(angleUniform,angle);
    gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_SHORT,0);
  }
  function resize(){
    const bounds=canvas.getBoundingClientRect();
    const density=Math.min(devicePixelRatio||1,2);
    const w=canvas.width=Math.max(1,Math.round(bounds.width*density));
    const h=canvas.height=Math.max(1,Math.round(bounds.height*density));
    const scale=Math.min(w/4.05,h/4.05);
    gl.viewport(0,0,w,h);gl.uniform2f(fitUniform,2*scale/w,2*scale/h);
    draw();art.classList.add('ready');
  }
  function tick(now){
    if (!last || now-last>=32) {
      angle+=last?Math.min(now-last,100)*.00013:0;
      last=now;draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);last=0;
    document.querySelector('#motion-icon').textContent=playing?'Ⅱ':'▷';
    document.querySelector('#motion-text').textContent=playing?'회전 멈춤':'회전 시작';
    control.setAttribute('aria-pressed',String(playing));
    if (playing && visible && !document.hidden) frame=requestAnimationFrame(tick);
  }
  control.hidden=false;
  control.addEventListener('click',()=>{playing=!playing;sync()});
  motion.addEventListener('change',()=>{playing=!motion.matches;sync()});
  document.addEventListener('visibilitychange',sync);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()}).observe(art);
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('webglcontextlost',()=>{
    cancelAnimationFrame(frame);playing=false;control.hidden=true;art.classList.remove('ready');
  });
  resize();sync();
})();
