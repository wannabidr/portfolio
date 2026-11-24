// Native scrolling determines the composition, including on initial anchor visits.
(() => {
  const hero = document.querySelector('.hero');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const sections = [...document.querySelectorAll('#method, #work, #career, #notes')];
  const rows = [...document.querySelectorAll('.timeline li')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width:749px)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let pending = false;
  function update() {
    pending = false;
    const height = window.innerHeight;
    const width = document.documentElement.clientWidth;
    const bounds = chapters.map(el => el.getBoundingClientRect());
    const centers = bounds.map(r => r.top + r.height/2);
    const index = centers.reduce((closest, center, i) =>
      Math.abs(center-height/2) < Math.abs(centers[closest]-height/2) ? i : closest, 0);
    if (hero.dataset.chapter !== String(index)) {
      hero.dataset.chapter = String(index);
      hero.dispatchEvent(new Event('chapterchange'));
    }
    if (reduce.matches) return;
    const progress = clamp((height/2-centers[0])/(centers[2]-centers[0]),0,1);
    const crossing = Math.sin(Math.PI*progress)**2;
    hero.style.setProperty('--art-x', (112*(1-crossing))+'%');
    hero.style.setProperty('--stage-y', (-24*Math.sin(2*Math.PI*progress))+'px');
    hero.style.setProperty('--stage-scale', (1+.12*Math.sin(2*Math.PI*progress)).toFixed(3));
    const blend = clamp((progress-.52)/.35,0,1);
    const color = [220,222,240].map((channel,i)=>Math.round(channel+( [38,41,64][i]-channel)*blend));
    hero.style.setProperty('--mobile-stage','rgb('+color.join(',')+')');
    chapters.forEach((chapter,i)=>{
      const offset=clamp((centers[i]-height/2)/height,-1,1);
      chapter.style.setProperty('--copy-x', (offset*(i===1?-1:1)*Math.min(width*.09,115))+'px');
      chapter.style.setProperty('--copy-y', (offset*height*.09)+'px');
    });
    for (const section of sections) {
      const r = section.getBoundingClientRect();
      if (r.top > height+100 || r.bottom < -100) continue;
      const entry=clamp(r.top/height,-.5,1);
      section.style.setProperty('--title-shift',(-entry*Math.min(width*.13,150))+'px');
      section.style.setProperty('--body-shift',(entry*height*.09)+'px');
      section.style.setProperty('--corner',(Math.max(0,entry)*54)+'px');
      if (section.id === 'work') {
        const reveal=clamp(entry,0,1);
        section.style.setProperty('--case-tilt',(reveal*14)+'deg');
        section.style.setProperty('--case-scale',String(1-reveal*.12));
      }
    }
    for(const row of rows){
      // offsetTop is unaffected by the horizontal transform.
      const y=row.getBoundingClientRect().top;
      const entry=clamp((y/height-.58)/.42,0,1);
      row.style.setProperty('--row-shift',(entry*(narrow.matches?32:90))+'px');
    }
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update)}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('pageshow',schedule);
  reduce.addEventListener('change',schedule);
  new ResizeObserver(schedule).observe(document.body);
  update();
})();
