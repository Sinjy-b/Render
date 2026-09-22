import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const loadingLabel = document.querySelector('#loading-label');
const loadingProgress = document.querySelector('#loading-progress');
const ui = {
  mode: document.querySelector('#hud-mode'),
  altitude: document.querySelector('#hud-altitude'),
  weather: document.querySelector('#weather-readout'),
  weatherLevel: document.querySelector('#weather-level'),
  sunAngle: document.querySelector('#sun-angle'),
  sound: document.querySelector('#sound-toggle'),
  tip: document.querySelector('#movement-tip'),
  sceneNote: document.querySelector('#scene-note'),
  info: document.querySelector('#info-dialog')
};

const SITE = {
  lat: 0.04413,
  lon: 36.37047,
  extent: 640,
  grid: 129,
  waterfall: new THREE.Vector3(12, 0, -38),
  drop: 74
};

let renderer, scene, camera, clock;
let terrainData;
let terrainMesh;
let waterfallMaterial;
let rain;
let rainVelocity;
let mist;
let sunLight;
let ambientLight;
let currentMode = 'fly';
let currentWeather = 'clear';
let yaw = 0;
let pitch = -0.2;
let pointerDragging = false;
let lastPointer = { x: 0, y: 0 };
const keys = new Set();
const diagnostics = { terrainVertices: 0, trees: 0, rocks: 0, rainParticles: 0, mistParticles: 0, warnings: [] };

const weatherProfiles = {
  clear: { fog: 0.0008, rain: 0, mist: 0.18, light: 1.18, sky: new THREE.Color('#83b9c6') },
  mist:  { fog: 0.006, rain: 0, mist: 0.78, light: 0.82, sky: new THREE.Color('#8da9a5') },
  rain:  { fog: 0.004, rain: 1, mist: 0.55, light: 0.55, sky: new THREE.Color('#415c5c') },
  fog:   { fog: 0.012, rain: 0, mist: 0.92, light: 0.48, sky: new THREE.Color('#9aaba5') }
};

start().catch((error) => {
  console.error(error);
  loadingLabel.textContent = 'The scene could not be assembled.';
  loadingProgress.style.width = '100%';
  loadingProgress.style.background = '#ef7b63';
  diagnostics.warnings.push(error.message);
});

async function start() {
  if (!webglAvailable()) {
    document.querySelector('#webgl-error').hidden = false;
    loading.classList.add('done');
    return;
  }
  setupRenderer();
  setLoading('Loading satellite imagery…', 28);
  const [elevationBuffer, satelliteTexture] = await Promise.all([
    fetch('./assets/elevation.f32').then(r => {
      if (!r.ok) throw new Error('Elevation grid unavailable');
      return r.arrayBuffer();
    }),
    new THREE.TextureLoader().loadAsync('./assets/satellite.jpg')
  ]);
  terrainData = new Float32Array(elevationBuffer);
  satelliteTexture.colorSpace = THREE.SRGBColorSpace;
  satelliteTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  setLoading('Shaping the gorge…', 51);
  buildTerrain(satelliteTexture);
  await buildVegetation(satelliteTexture.image);
  setLoading('Adding water and atmosphere…', 74);
  buildWater();
  buildManmadeFeatures();
  buildAtmosphere();
  bindControls();
  setWeather('clear');
  resetCamera();
  setLoading('Calibrating navigation…', 92);
  runSelfCheck();
  animate();
  await new Promise(resolve => setTimeout(resolve, 450));
  loading.classList.add('done');
  window.__THOMSONS_READY = true;
  window.__THOMSONS_DIAGNOSTICS = diagnostics;
}

function webglAvailable() {
  try {
    const test = document.createElement('canvas');
    return !!(test.getContext('webgl2') || test.getContext('webgl'));
  } catch { return false; }
}

function setLoading(label, progress) {
  loadingLabel.textContent = label;
  loadingProgress.style.width = `${progress}%`;
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#83b9c6');
  scene.fog = new THREE.FogExp2(scene.background, 0.0008);
  camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.12, 1800);
  camera.rotation.order = 'YXZ';
  clock = new THREE.Clock();
  ambientLight = new THREE.HemisphereLight('#c8e8ea', '#243524', 1.15);
  scene.add(ambientLight);
  sunLight = new THREE.DirectionalLight('#fff4d2', 3.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 650;
  scene.add(sunLight);
}

function buildTerrain(texture) {
  const segments = SITE.grid - 1;
  const geometry = new THREE.PlaneGeometry(SITE.extent, SITE.extent, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, modeledHeight(x, z));
  }
  geometry.computeVertexNormals();
  diagnostics.terrainVertices = p.count;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0,
    color: '#d9e3d0'
  });
  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(450, 450, 72, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1b291f', roughness: 1, side: THREE.DoubleSide })
  );
  skirt.rotation.y = Math.PI / 4;
  skirt.position.y = -78;
  scene.add(skirt);
}

function sourceHeight(x, z) {
  if (!terrainData) return 0;
  const gx = THREE.MathUtils.clamp((x / SITE.extent + 0.5) * (SITE.grid - 1), 0, SITE.grid - 1);
  const gy = THREE.MathUtils.clamp((z / SITE.extent + 0.5) * (SITE.grid - 1), 0, SITE.grid - 1);
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const x1 = Math.min(SITE.grid - 1, x0 + 1), y1 = Math.min(SITE.grid - 1, y0 + 1);
  const fx = gx - x0, fy = gy - y0;
  const h00 = terrainData[y0 * SITE.grid + x0];
  const h10 = terrainData[y0 * SITE.grid + x1];
  const h01 = terrainData[y1 * SITE.grid + x0];
  const h11 = terrainData[y1 * SITE.grid + x1];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h00, h10, fx), THREE.MathUtils.lerp(h01, h11, fx), fy);
}

function riverX(z) {
  return 12 + Math.sin((z + 28) * 0.017) * 7 + (z > 20 ? (z - 20) * 0.055 : 0);
}

function modeledHeight(x, z) {
  const base = sourceHeight(x, z);
  const downstream = THREE.MathUtils.smoothstep(-z, 20, 130);
  const gorgeAxis = riverX(z);
  const channel = Math.exp(-Math.pow(x - gorgeAxis, 2) / (2 * 39 * 39));
  const gorge = -38 * downstream * channel;
  const lipCut = -13 * THREE.MathUtils.smoothstep(-z, 28, 48) * Math.exp(-Math.pow(x - 12, 2) / 520);
  return base + gorge + lipCut;
}

async function buildVegetation(image) {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 512;
  sampleCanvas.height = 512;
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 512, 512);
  const rgb = ctx.getImageData(0, 0, 512, 512).data;
  const random = mulberry32(440413);
  const accepted = [];
  let attempts = 0;
  while (accepted.length < 790 && attempts++ < 19000) {
    const x = (random() - 0.5) * 620;
    const z = (random() - 0.5) * 620;
    const px = Math.max(0, Math.min(511, Math.floor((x / SITE.extent + 0.5) * 512)));
    const py = Math.max(0, Math.min(511, Math.floor((z / SITE.extent + 0.5) * 512)));
    const k = (py * 512 + px) * 4;
    const r = rgb[k], g = rgb[k + 1], b = rgb[k + 2];
    const green = g - (r * 0.50 + b * 0.50);
    const bright = (r + g + b) / 3;
    const nearRiver = Math.abs(x - riverX(z)) < (z < 15 ? 18 : 10);
    const lookout = Math.hypot(x - 34, z + 18) < 18;
    const probability = THREE.MathUtils.clamp((green + 4) / 28, 0, 0.92) * (bright < 142 ? 1 : .3);
    if (!nearRiver && !lookout && random() < probability) accepted.push({ x, z, bright, r, g, b, random: random() });
  }

  const trunkGeo = new THREE.CylinderGeometry(.35, .58, 5, 5);
  const crownGeo = new THREE.ConeGeometry(2.45, 10, 7);
  const broadGeo = new THREE.IcosahedronGeometry(2.8, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#493627', roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: '#244d2d', roughness: .96 });
  const broadMat = new THREE.MeshStandardMaterial({ color: '#315f35', roughness: .96 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, accepted.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, accepted.length);
  const broad = new THREE.InstancedMesh(broadGeo, broadMat, accepted.length);
  trunks.castShadow = crowns.castShadow = broad.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = broad.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let coniferCount = 0, broadCount = 0;
  accepted.forEach((t, i) => {
    const height = 7 + t.random * 12;
    const baseY = modeledHeight(t.x, t.z);
    position.set(t.x, baseY + height * .19, t.z);
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.random * Math.PI * 2);
    scale.set(.7 + t.random * .55, height / 5, .7 + t.random * .55);
    matrix.compose(position, rotation, scale);
    trunks.setMatrixAt(i, matrix);
    const conifer = t.random > .32;
    position.y = baseY + height * .67;
    scale.set(.75 + t.random * .55, height / 10, .75 + t.random * .55);
    matrix.compose(position, rotation, scale);
    if (conifer) {
      crowns.setMatrixAt(coniferCount++, matrix);
    } else {
      broad.setMatrixAt(broadCount++, matrix);
    }
  });
  crowns.count = coniferCount;
  broad.count = broadCount;
  scene.add(trunks, crowns, broad);
  diagnostics.trees = accepted.length;

  const rockGeo = new THREE.DodecahedronGeometry(2, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4b5045', roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 118);
  for (let i = 0; i < 118; i++) {
    const z = -20 - random() * 185;
    const side = random() > .5 ? 1 : -1;
    const x = riverX(z) + side * (15 + random() * 35);
    const y = modeledHeight(x, z) + .5;
    position.set(x, y, z);
    rotation.setFromEuler(new THREE.Euler(random(), random() * Math.PI, random()));
    const s = .45 + random() * 2.3;
    scale.set(s * (1 + random()), s, s * (.7 + random()));
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(i, matrix);
  }
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);
  diagnostics.rocks = 118;
}

function buildWater() {
  const topY = modeledHeight(SITE.waterfall.x, SITE.waterfall.z + 17) + 1.5;
  SITE.waterfall.y = topY;
  const riverMaterial = new THREE.MeshPhysicalMaterial({
    color: '#2b7774', roughness: .16, metalness: .03, transmission: .12,
    transparent: true, opacity: .87, side: THREE.DoubleSide
  });
  scene.add(makeRiverRibbon(-25, 160, 9, (z) => Math.max(topY + .15, modeledHeight(riverX(z), z) + .55), riverMaterial));
  scene.add(makeRiverRibbon(-215, -56, 10, (z) => modeledHeight(riverX(z), z) + .45, riverMaterial));

  const rows = 44, cols = 12;
  const verts = [], uvs = [], indices = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const u = x / cols, v = y / rows;
      const width = 17 - v * 3.5;
      verts.push(SITE.waterfall.x + (u - .5) * width, topY - v * SITE.drop, SITE.waterfall.z - Math.sin(v * Math.PI) * 1.8);
      uvs.push(u, v);
    }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = y * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const fallGeo = new THREE.BufferGeometry();
  fallGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  fallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  fallGeo.setIndex(indices);
  fallGeo.computeVertexNormals();
  waterfallMaterial = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { time: { value: 0 }, opacity: { value: .88 } },
    vertexShader: `
      uniform float time; varying vec2 vUv; varying float foam;
      void main(){
        vUv=uv; vec3 p=position;
        float wave=sin(uv.y*92.0-time*7.0+uv.x*12.0)*0.34 + sin(uv.y*41.0-time*4.0)*0.2;
        p.z += wave; foam = smoothstep(.35,.95,abs(sin(uv.y*72.0-time*5.0+uv.x*9.0)));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float opacity; varying vec2 vUv; varying float foam;
      void main(){
        float edge=smoothstep(0.0,.12,vUv.x)*smoothstep(0.0,.12,1.0-vUv.x);
        vec3 water=mix(vec3(.20,.63,.65),vec3(.88,.96,.93),foam*.72+vUv.y*.22);
        gl_FragColor=vec4(water,opacity*edge*(.68+foam*.3));
      }`
  });
  const fall = new THREE.Mesh(fallGeo, waterfallMaterial);
  fall.renderOrder = 4;
  scene.add(fall);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(28, 56), riverMaterial.clone());
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(riverX(-67), topY - SITE.drop + .7, -70);
  scene.add(pool);

  const measureMat = new THREE.LineBasicMaterial({ color: '#e7ffb4', transparent: true, opacity: .72 });
  const measure = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(SITE.waterfall.x - 12, topY, SITE.waterfall.z - 2),
    new THREE.Vector3(SITE.waterfall.x - 12, topY - SITE.drop, SITE.waterfall.z - 2)
  ]);
  scene.add(new THREE.Line(measure, measureMat));
}

function makeRiverRibbon(zStart, zEnd, width, heightFn, material) {
  const steps = 80, vertices = [], uvs = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const x = riverX(z);
    const w = width * (.84 + Math.sin(t * 8) * .11);
    vertices.push(x - w / 2, heightFn(z), z, x + w / 2, heightFn(z), z);
    uvs.push(0, t * 8, 1, t * 8);
    if (i < steps) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; return mesh;
}

function buildManmadeFeatures() {
  const wood = new THREE.MeshStandardMaterial({ color: '#6f4b2c', roughness: .85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#2d342f', roughness: .62, metalness: .5 });
  const deckY = modeledHeight(34, -18) + 1.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, .65, 7), wood);
  deck.position.set(34, deckY, -18); deck.rotation.y = -.18; deck.castShadow = deck.receiveShadow = true; scene.add(deck);
  const railGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.35,6), steel);
    post.position.set(28 + i * 1.72, deckY + .72, -21.4 + i * -.31);
    railGroup.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,13.2,8), steel);
  rail.rotation.z = Math.PI / 2; rail.rotation.y = -.18; rail.position.set(34, deckY + 1.35, -22.5); railGroup.add(rail);
  scene.add(railGroup);
  const pathMat = new THREE.MeshStandardMaterial({ color: '#8b7658', roughness: 1 });
  [[39, 12, 8, 39], [39, 29, 8, 19], [36, -2, 7, 18]].forEach(([x,z,w,d],i) => {
    const path = new THREE.Mesh(new THREE.BoxGeometry(w,.18,d), pathMat);
    path.position.set(x, modeledHeight(x,z)+.13, z); path.rotation.y = i===2 ? -.15 : 0; path.receiveShadow = true; scene.add(path);
  });
}

function buildAtmosphere() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color('#447d8f') }, bottom: { value: new THREE.Color('#dbe2c9') } },
      vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 bottom; void main(){float h=clamp(normalize(p).y*.5+.5,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,.72)),1.0);}'
    })
  );
  scene.add(sky);

  const rainCount = 4200;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  rainVelocity = new Float32Array(rainCount);
  const random = mulberry32(1707);
  for (let i=0;i<rainCount;i++) {
    rainPos[i*3]=(random()-.5)*520; rainPos[i*3+1]=random()*210-20; rainPos[i*3+2]=(random()-.5)*520;
    rainVelocity[i]=40+random()*36;
  }
  rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  rain = new THREE.Points(rainGeo,new THREE.PointsMaterial({color:'#b7d7de',size:.22,transparent:true,opacity:0,depthWrite:false}));
  scene.add(rain); diagnostics.rainParticles=rainCount;

  const mistCount=760;
  const mistPos=new Float32Array(mistCount*3);
  for(let i=0;i<mistCount;i++){
    const a=random()*Math.PI*2, radius=Math.pow(random(),.62)*48;
    mistPos[i*3]=SITE.waterfall.x+Math.cos(a)*radius;
    mistPos[i*3+1]=SITE.waterfall.y-SITE.drop+random()*55;
    mistPos[i*3+2]=SITE.waterfall.z-16+Math.sin(a)*radius;
  }
  const mistGeo=new THREE.BufferGeometry(); mistGeo.setAttribute('position',new THREE.BufferAttribute(mistPos,3));
  mist=new THREE.Points(mistGeo,new THREE.PointsMaterial({color:'#dff5ee',size:5.4,transparent:true,opacity:.2,depthWrite:false,sizeAttenuation:true}));
  scene.add(mist); diagnostics.mistParticles=mistCount;
}

function bindControls() {
  document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  document.querySelectorAll('.weather-button').forEach(button => button.addEventListener('click', () => setWeather(button.dataset.weather)));
  ui.weatherLevel.addEventListener('input', () => setWeather(currentWeather));
  ui.sunAngle.addEventListener('input', updateSun);
  document.querySelector('#reset-view').addEventListener('click', resetCamera);
  document.querySelector('#open-info').addEventListener('click', () => ui.info.showModal());
  ui.sound.addEventListener('click', toggleSound);
  addEventListener('keydown', e => {
    if (!['INPUT','BUTTON'].includes(document.activeElement.tagName)) keys.add(e.code);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('pointerdown', e => { pointerDragging=true; lastPointer={x:e.clientX,y:e.clientY}; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if(!pointerDragging) return;
    const dx=e.clientX-lastPointer.x, dy=e.clientY-lastPointer.y; lastPointer={x:e.clientX,y:e.clientY};
    yaw-=dx*.0032; pitch=THREE.MathUtils.clamp(pitch-dy*.0028,-1.45,1.35);
  });
  canvas.addEventListener('pointerup', e => { pointerDragging=false; canvas.classList.remove('dragging'); canvas.releasePointerCapture(e.pointerId); });
  canvas.addEventListener('wheel', e => { camera.fov=THREE.MathUtils.clamp(camera.fov+Math.sign(e.deltaY)*2,38,75); camera.updateProjectionMatrix(); }, {passive:true});
  addEventListener('resize', () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
}

function setMode(mode) {
  currentMode=mode;
  document.querySelectorAll('.mode-button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  ui.mode.textContent=mode.toUpperCase();
  ui.tip.textContent=mode==='walk' ? 'Drag to look · WASD to move · Shift to jog' : 'Drag to look · WASD to move · R/F for altitude · Shift to boost';
  if(mode==='walk') camera.position.y=modeledHeight(camera.position.x,camera.position.z)+1.72;
}

function setWeather(type) {
  currentWeather=type;
  const profile=weatherProfiles[type];
  const intensity=Number(ui.weatherLevel.value)/100;
  document.querySelectorAll('.weather-button').forEach(b=>b.classList.toggle('active',b.dataset.weather===type));
  ui.weather.textContent=type[0].toUpperCase()+type.slice(1);
  scene.fog.density=THREE.MathUtils.lerp(.00065,profile.fog,intensity);
  scene.background.copy(profile.sky);
  rain.material.opacity=profile.rain*(.18+.55*intensity);
  rain.visible=profile.rain>0;
  mist.material.opacity=profile.mist*(.11+.39*intensity);
  sunLight.intensity=profile.light*2.65;
  ambientLight.intensity=.55+profile.light*.45;
  if(audioState) updateAudio();
}

function updateSun() {
  const hour=Number(ui.sunAngle.value);
  const angle=(hour-6)/12*Math.PI;
  sunLight.position.set(Math.cos(angle)*310,Math.max(24,Math.sin(angle)*330),-180);
  const warm=Math.abs(hour-12)/6;
  sunLight.color.set(warm>.62?'#ffd0a1':'#fff4d7');
}

function resetCamera() {
  if(currentMode==='fly') {
    camera.position.set(150,68,145); yaw=-2.43; pitch=-.28;
  } else {
    camera.position.set(64,modeledHeight(64,32)+1.72,32); yaw=-2.55; pitch=-.06;
  }
  camera.fov=58; camera.updateProjectionMatrix();
  updateCameraRotation();
}

function updateCameraRotation(){ camera.rotation.set(pitch,yaw,0); }

function updateMovement(dt) {
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?(currentMode==='fly'?56:8):(currentMode==='fly'?22:3.6);
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const vertical=(keys.has('KeyR')||keys.has('Space')?1:0)-(keys.has('KeyF')||keys.has('ControlLeft')?1:0);
  const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  camera.position.addScaledVector(f,forward*speed*dt).addScaledVector(r,strafe*speed*dt);
  if(currentMode==='fly') camera.position.y+=vertical*speed*dt;
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-304,304);
  camera.position.z=THREE.MathUtils.clamp(camera.position.z,-304,304);
  const ground=modeledHeight(camera.position.x,camera.position.z);
  camera.position.y=currentMode==='walk'?ground+1.72:THREE.MathUtils.clamp(camera.position.y,ground+2.4,260);
  updateCameraRotation();
  ui.altitude.textContent=`${Math.max(0,camera.position.y-ground).toFixed(1)} m`;
}

function updateWeatherParticles(dt, elapsed) {
  if(rain.visible){
    const p=rain.geometry.attributes.position.array;
    for(let i=0;i<rainVelocity.length;i++){
      p[i*3+1]-=rainVelocity[i]*dt;
      p[i*3]-=6*dt;
      if(p[i*3+1]<modeledHeight(p[i*3],p[i*3+2])){ p[i*3+1]=185; p[i*3]=camera.position.x+(Math.random()-.5)*480; p[i*3+2]=camera.position.z+(Math.random()-.5)*480; }
    }
    rain.geometry.attributes.position.needsUpdate=true;
  }
  const mp=mist.geometry.attributes.position.array;
  for(let i=0;i<mp.length/3;i++){
    mp[i*3]+=Math.sin(elapsed*.24+i)*dt*.42;
    mp[i*3+1]+=dt*(.45+(i%7)*.06);
    if(mp[i*3+1]>SITE.waterfall.y-8) mp[i*3+1]=SITE.waterfall.y-SITE.drop+Math.random()*8;
  }
  mist.geometry.attributes.position.needsUpdate=true;
}

function animate() {
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05), elapsed=clock.elapsedTime;
  updateMovement(dt);
  updateWeatherParticles(dt,elapsed);
  if(waterfallMaterial) waterfallMaterial.uniforms.time.value=elapsed;
  updateSceneNote();
  renderer.render(scene,camera);
}

function updateSceneNote(){
  const point=SITE.waterfall.clone().project(camera);
  const visible=point.z<1&&Math.abs(point.x)<.8&&Math.abs(point.y)<.75&&camera.position.distanceTo(SITE.waterfall)<360;
  ui.sceneNote.classList.toggle('hidden',!visible);
}

function runSelfCheck() {
  updateSun();
  const checks = [
    ['terrain vertices', diagnostics.terrainVertices >= 16000],
    ['waterfall drop', SITE.drop === 74],
    ['vegetation cover', diagnostics.trees >= 450],
    ['camera clearance', camera.position.y > modeledHeight(camera.position.x,camera.position.z)],
    ['extent', SITE.extent === 640]
  ];
  checks.forEach(([label,ok])=>{ if(!ok) diagnostics.warnings.push(label); });
  diagnostics.passed = checks.length - diagnostics.warnings.length;
  diagnostics.total = checks.length;
  console.info('Thomson’s Falls scene check', diagnostics);
}

let audioState=null;
function toggleSound(){
  const on=ui.sound.getAttribute('aria-checked')!=='true';
  ui.sound.setAttribute('aria-checked',String(on));
  if(on) startAudio(); else stopAudio();
}

function startAudio(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx) return;
  const ctx=new AudioCtx();
  const seconds=2, buffer=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),data=buffer.getChannelData(0);
  let last=0;
  for(let i=0;i<data.length;i++){ const white=Math.random()*2-1; last=(last+.02*white)/1.02; data[i]=last*3.2; }
  const source=ctx.createBufferSource(); source.buffer=buffer; source.loop=true;
  const low=ctx.createBiquadFilter(); low.type='lowpass'; low.frequency.value=920;
  const waterGain=ctx.createGain(); waterGain.gain.value=.18;
  const rainFilter=ctx.createBiquadFilter(); rainFilter.type='highpass'; rainFilter.frequency.value=1800;
  const rainGain=ctx.createGain(); rainGain.gain.value=0;
  source.connect(low).connect(waterGain).connect(ctx.destination);
  source.connect(rainFilter).connect(rainGain).connect(ctx.destination);
  source.start();
  audioState={ctx,source,waterGain,rainGain}; updateAudio();
}

function updateAudio(){
  if(!audioState)return;
  const rainy=currentWeather==='rain';
  audioState.rainGain.gain.setTargetAtTime(rainy?.08:0,audioState.ctx.currentTime,.4);
  audioState.waterGain.gain.setTargetAtTime(currentWeather==='fog'?.14:.19,audioState.ctx.currentTime,.4);
}

function stopAudio(){ if(audioState){ audioState.source.stop(); audioState.ctx.close(); audioState=null; } }

function mulberry32(seed){ return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
