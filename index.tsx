import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';

// --- AUDIO SYSTEM (Procedural) ---
class SoundManager {
    ctx: AudioContext | null = null;
    masterGain: GainNode | null = null;
    rainGain: GainNode | null = null;
    volume: number = 0.5;

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = this.volume;
        }
        if(this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val: number) {
        this.volume = val;
        if (this.masterGain) this.masterGain.gain.value = val;
    }

    playSwitch() {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.02);
        
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.05);
    }

    playPlayerFootstep() {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        
        // Louder footsteps
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.15);
    }

    playFredbearFootstep(distance: number) {
        if (!this.ctx || !this.masterGain) return;
        let vol = 1 - (distance / 25);
        if (vol < 0) return;
        
        const t = this.ctx.currentTime;
        
        // Heavy Thud
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(40, t);
        osc1.frequency.exponentialRampToValueAtTime(10, t + 0.3);
        gain1.gain.setValueAtTime(vol * 1.0, t);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        // Metallic Clank
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        const filter2 = this.ctx.createBiquadFilter();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, t); // Metallic resonance
        osc2.frequency.linearRampToValueAtTime(100, t + 0.1);
        filter2.type = 'highpass';
        filter2.frequency.value = 500;
        
        gain2.gain.setValueAtTime(vol * 0.4, t);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);

        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(this.masterGain);

        osc1.start(t);
        osc1.stop(t + 0.4);
        osc2.start(t);
        osc2.stop(t + 0.2);
    }

    playJumpscare() {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        osc.frequency.linearRampToValueAtTime(100, t + 1.5);

        // Modulator for scream texture
        const lfo = this.ctx.createOscillator();
        lfo.type = 'triangle';
        lfo.frequency.value = 80;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 800;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + 2);

        gain.gain.setValueAtTime(1, t);
        gain.gain.linearRampToValueAtTime(0, t + 2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 2);
    }

    playRain() {
        if (!this.ctx || !this.masterGain) return null;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; 
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0; // Start silent, controlled by proximity

        noise.connect(filter);
        filter.connect(this.rainGain);
        this.rainGain.connect(this.masterGain);
        noise.start();
        return { noise, gain: this.rainGain };
    }

    updateRainVolume(volume: number) {
        if(this.rainGain) {
            this.rainGain.gain.setTargetAtTime(volume, this.ctx!.currentTime, 0.1);
        }
    }

    playStatic() {
        if (!this.ctx || !this.masterGain) return;
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 500;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.1;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
        return { noise, gain };
    }
}

const soundManager = new SoundManager();

// --- STYLES ---
const styles = {
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    backgroundColor: 'black',
    fontFamily: '"Courier New", Courier, monospace',
    zIndex: 10,
    textAlign: 'center' as const,
    userSelect: 'none' as const,
  },
  hud: {
    position: 'absolute' as const,
    top: '20px',
    left: '20px',
    color: 'white',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '32px',
    zIndex: 5,
    pointerEvents: 'none' as const,
    textShadow: '0 0 5px white',
    fontWeight: 'bold',
  },
  button: {
    padding: '15px 30px',
    fontSize: '24px',
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid white',
    cursor: 'pointer',
    marginTop: '20px',
    fontFamily: 'inherit',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    transition: 'all 0.3s',
    textShadow: '0 0 5px white',
  },
  title: {
    fontSize: '80px',
    color: 'white',
    textShadow: '2px 2px 0px #ff0000, -2px -2px 0px #0000ff',
    marginBottom: '10px',
    fontWeight: 'bold',
    fontFamily: 'Impact, sans-serif',
    letterSpacing: '5px',
  },
  scanline: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.3))',
    backgroundSize: '100% 4px',
    zIndex: 11,
    pointerEvents: 'none' as const,
  },
  staticNoise: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.08,
    zIndex: 12,
    pointerEvents: 'none' as const,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'1\'/%3E%3C/svg%3E")',
  },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '400px',
    marginBottom: '20px',
    fontSize: '24px',
    alignItems: 'center'
  },
  inputRange: {
      cursor: 'pointer',
      width: '200px',
      accentColor: 'white'
  },
  nightTitle: {
      fontSize: '60px',
      color: 'white',
      fontFamily: '"Courier New", Courier, monospace',
      marginBottom: '20px'
  }
};

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'start' | 'settings' | 'night_intro' | 'playing' | 'jumpscare' | 'gameover' | 'win'>('start');
  const [msg, setMsg] = useState("");
  const [gameTime, setGameTime] = useState(0); // 0 to 720 (12 mins)
  const [isFlashlightOn, setIsFlashlightOn] = useState(true);
  const [glitchOffset, setGlitchOffset] = useState({x: 0, y:0});
  const [enemyStatus, setEnemyStatus] = useState("");
  
  // Settings
  const [volume, setVolume] = useState(0.5);
  const [sensitivity, setSensitivity] = useState(0.002);
  
  // Scene Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerRef = useRef<{ position: THREE.Vector3 }>({
    position: new THREE.Vector3(12, 1.5, 4),
  });
  const playerHeadBobTimerRef = useRef(0);

  const fredbearRef = useRef<THREE.Group | null>(null);
  const fredbearAI = useRef({
      state: 'patrol' as 'patrol' | 'chase',
      targetRotation: 0,
      changeDirTimer: 0,
      eyeLights: [] as THREE.SpotLight[],
      jumpscareTimer: 0,
      footstepTimer: 0
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const flashlightRef = useRef<THREE.SpotLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const wallsRef = useRef<THREE.Mesh[]>([]);
  const propsRef = useRef<THREE.Object3D[]>([]); // Arcade machines, tables
  const windowsRef = useRef<THREE.Vector3[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  
  const isFlashlightOnRef = useRef(true);
  const staticSoundRef = useRef<{noise: AudioBufferSourceNode, gain: GainNode} | null>(null);
  const rainSoundRef = useRef<{noise: AudioBufferSourceNode, gain: GainNode} | null>(null);
  const playerStepTimerRef = useRef(0);
  
  const PLAYER_SPEED = 0.15;
  const FREDBEAR_PATROL_SPEED = 0.08;
  const FREDBEAR_CHASE_SPEED = 0.18; 
  const MAP_SCALE = 4;
  const GAME_DURATION_SECONDS = 720; // 12 minutes

  // Glitch Effect Loop
  useEffect(() => {
      const interval = setInterval(() => {
          if(gameState === 'start') {
              if(Math.random() < 0.1) {
                setGlitchOffset({ x: (Math.random()-0.5)*10, y: (Math.random()-0.5)*5 });
              } else {
                  setGlitchOffset({x:0, y:0});
              }
          }
      }, 100);
      return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
      const initAudio = () => soundManager.init();
      window.addEventListener('click', initAudio, { once: true });
      return () => window.removeEventListener('click', initAudio);
  }, []);

  useEffect(() => {
      soundManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if ((gameState === 'start' || gameState === 'settings' || gameState === 'gameover' || gameState === 'win') && !staticSoundRef.current) {
        soundManager.init();
        if(soundManager.ctx) {
            staticSoundRef.current = soundManager.playStatic() || null;
        }
        // Stop rain if menu
        if(rainSoundRef.current) {
            rainSoundRef.current.noise.stop();
            rainSoundRef.current = null;
        }
    } else if (gameState === 'playing' || gameState === 'jumpscare' || gameState === 'night_intro') {
        if (staticSoundRef.current) {
            staticSoundRef.current.noise.stop();
            staticSoundRef.current = null;
        }
        if(!rainSoundRef.current) {
             rainSoundRef.current = soundManager.playRain() || null;
        }
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        keysRef.current[e.code] = true;
        if (e.code === 'KeyF' && gameState === 'playing') {
            isFlashlightOnRef.current = !isFlashlightOnRef.current;
            setIsFlashlightOn(isFlashlightOnRef.current);
            soundManager.playSwitch();
        }
        if (e.code === 'Escape' && gameState === 'playing') {
             document.exitPointerLock();
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keysRef.current[e.code] = false;
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Timer Logic
  useEffect(() => {
      let interval: any;
      if (gameState === 'playing') {
          interval = setInterval(() => {
              setGameTime(prev => {
                  if (prev >= GAME_DURATION_SECONDS) {
                      setGameState('win');
                      setMsg("Geceyi Sağ Sağlim Atlattın.");
                      document.exitPointerLock();
                      return prev;
                  }
                  return prev + 1;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [gameState]);

  const startGameSequence = () => {
      setGameState('night_intro');
      setTimeout(() => {
          restartGame();
      }, 3000);
  };

  const getHourString = () => {
      const ratio = gameTime / GAME_DURATION_SECONDS; // 0 to 1
      const hour = Math.floor(ratio * 6); // 0 to 5
      const displayHour = hour === 0 ? 12 : hour;
      return `${displayHour} AM`;
  }

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010101);
    scene.fog = new THREE.FogExp2(0x050505, 0.08); 
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    cameraRef.current = camera;
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x020202); 
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const flashlight = new THREE.SpotLight(0xffffff, 80); 
    flashlight.angle = 0.5;
    flashlight.penumbra = 0.5;
    flashlight.decay = 2;
    flashlight.distance = 40;
    flashlight.castShadow = true;
    flashlight.position.set(0.3, -0.2, 0.1); 
    flashlight.target.position.set(0, 0, -1); 
    camera.add(flashlight);
    camera.add(flashlight.target); 
    flashlightRef.current = flashlight;

    // Particles (Dust)
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 2000;
    const posArray = new Float32Array(particleCount * 3);
    for(let i=0; i<particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x555555,
        transparent: true,
        opacity: 0.3
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 3. Map
    const map = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1], 
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    // --- NORMAL MAP GENERATOR ---
    const generateNormalMap = (canvas: HTMLCanvasElement) => {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        if(!ctx) return new THREE.Texture();
        
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = width;
        normalCanvas.height = height;
        const normalCtx = normalCanvas.getContext('2d');
        if(!normalCtx) return new THREE.Texture();
        const normalImgData = normalCtx.createImageData(width, height);
        const normalData = normalImgData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const h = data[idx] / 255.0; // Height from red channel

                const x1 = x > 0 ? x - 1 : x;
                const x2 = x < width - 1 ? x + 1 : x;
                const y1 = y > 0 ? y - 1 : y;
                const y2 = y < height - 1 ? y + 1 : y;

                const hL = data[(y * width + x1) * 4] / 255.0;
                const hR = data[(y * width + x2) * 4] / 255.0;
                const hU = data[(y1 * width + x) * 4] / 255.0;
                const hD = data[(y2 * width + x) * 4] / 255.0;

                const dx = (hL - hR) * 2.0; 
                const dy = (hU - hD) * 2.0; 
                const dz = 1.0;

                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                const nx = (dx / len) * 0.5 + 0.5;
                const ny = (dy / len) * 0.5 + 0.5;
                const nz = (dz / len) * 0.5 + 0.5;

                normalData[idx] = nx * 255;
                normalData[idx+1] = ny * 255;
                normalData[idx+2] = nz * 255;
                normalData[idx+3] = 255;
            }
        }
        normalCtx.putImageData(normalImgData, 0, 0);
        return new THREE.CanvasTexture(normalCanvas);
    };

    const createFnafWallTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = '#666'; 
            ctx.fillRect(0,0,512,512);
            // Grime
            for(let i=0; i<5000; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#555' : '#444';
                const s = Math.random() * 3;
                ctx.fillRect(Math.random()*512, Math.random()*512, s, s);
            }
            const stripHeight = 150;
            const startY = 512 - stripHeight;
            const checkSize = 50;
            ctx.fillStyle = '#600'; 
            ctx.fillRect(0, startY - 10, 512, 10);
            for(let y=startY; y<512; y+=checkSize) {
                for(let x=0; x<512; x+=checkSize) {
                    const isWhite = ((x/checkSize) + (y/checkSize)) % 2 === 0;
                    ctx.fillStyle = isWhite ? '#ccc' : '#111';
                    ctx.fillRect(x, Math.floor(y), checkSize, checkSize);
                    
                    // Add noise to tiles
                    ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
                    ctx.fillRect(x, Math.floor(y), checkSize, checkSize);
                }
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        const normal = generateNormalMap(canvas);
        return { map: tex, normalMap: normal };
    };

    const wallTex = createFnafWallTexture();
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        map: wallTex.map,
        normalMap: wallTex.normalMap,
        roughness: 0.6,
        metalness: 0.1
    });
    
    const createWoodTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = '#2d1b15'; 
            ctx.fillRect(0,0,512,512);
            ctx.strokeStyle = '#1a0f0c'; 
            ctx.lineWidth = 4;
            ctx.beginPath();
            for(let i=0; i<512; i+=64) {
                ctx.moveTo(0, i);
                ctx.lineTo(512, i);
            }
            ctx.stroke();
            for(let i=0; i<3000; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#1a0f0c' : '#3e2723';
                ctx.fillRect(Math.random()*512, Math.random()*512, 2, 12);
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        const normal = generateNormalMap(canvas);
        return { map: tex, normalMap: normal };
    };

    const floorTex = createWoodTexture();
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: floorTex.map,
        normalMap: floorTex.normalMap,
        roughness: 0.8,
        metalness: 0.05,
        color: 0x666666
    });
    floorMaterial.map!.wrapS = THREE.RepeatWrapping;
    floorMaterial.map!.wrapT = THREE.RepeatWrapping;
    floorMaterial.map!.repeat.set(12, 12);
    floorMaterial.normalMap!.wrapS = THREE.RepeatWrapping;
    floorMaterial.normalMap!.wrapT = THREE.RepeatWrapping;
    floorMaterial.normalMap!.repeat.set(12, 12);

    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floor = new THREE.Mesh(floorGeo, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(30, 0, 30);
    scene.add(floor);

    const ceil = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(30, 4, 30);
    scene.add(ceil);

    wallsRef.current = [];
    propsRef.current = [];
    windowsRef.current = [];

    const createWindowDecor = (x: number, z: number, rotationY: number) => {
        const group = new THREE.Group();
        group.position.set(x, 2, z);
        group.rotation.y = rotationY;

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d271e, roughness: 0.8 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x050510, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.9 });
        const curtainMat = new THREE.MeshStandardMaterial({ color: 0x4B0082, side: THREE.DoubleSide, roughness: 1.0 });

        // Frame
        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), frameMat);
        topFrame.position.set(0, 0.75, 0);
        group.add(topFrame);
        
        const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.15), frameMat); // Sill
        bottomFrame.position.set(0, -0.75, 0.02);
        group.add(bottomFrame);

        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), frameMat);
        leftFrame.position.set(-0.75, 0, 0);
        group.add(leftFrame);

        const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), frameMat);
        rightFrame.position.set(0.75, 0, 0);
        group.add(rightFrame);

        // Mullions (Cross)
        const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.05), frameMat);
        group.add(vMullion);
        const hMullion = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), frameMat);
        group.add(hMullion);

        // Glass
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glassMat);
        glass.position.z = -0.02;
        group.add(glass);

        // Curtains (More Voxel-y and draped)
        const leftCurtainGroup = new THREE.Group();
        leftCurtainGroup.position.set(-0.6, 0, 0.1);
        const lc1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.1), curtainMat);
        const lc2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.1), curtainMat);
        lc2.position.set(0.2, 0, 0.05); lc2.rotation.y = -0.3;
        leftCurtainGroup.add(lc1); leftCurtainGroup.add(lc2);
        group.add(leftCurtainGroup);

        const rightCurtainGroup = new THREE.Group();
        rightCurtainGroup.position.set(0.6, 0, 0.1);
        const rc1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.1), curtainMat);
        const rc2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.1), curtainMat);
        rc2.position.set(-0.2, 0, 0.05); rc2.rotation.y = 0.3;
        rightCurtainGroup.add(rc1); rightCurtainGroup.add(rc2);
        group.add(rightCurtainGroup);

        const topValance = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.15), curtainMat);
        topValance.position.set(0, 0.8, 0.15);
        group.add(topValance);
        
        // Save window position for audio
        windowsRef.current.push(new THREE.Vector3(x, 2, z));
        return group;
    };

    // PROPS
    const createArcadeMachine = (x: number, z: number, rot: number) => {
        const group = new THREE.Group();
        group.position.set(x, 0, z); // Grounded
        group.rotation.y = rot;
        const matBody = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
        const matSide = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
        const matScreen = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.8 });
        const matControls = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const matButtonRed = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x550000 });
        const matButtonBlue = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x000055 });
        const matMarquee = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });

        // Main Cabinet
        const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), matBody);
        body.position.y = 1;
        body.castShadow = true;
        group.add(body);

        // Side Panels (visual detail)
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 1.05), matSide);
        sideL.position.set(-0.52, 1, 0);
        group.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 1.05), matSide);
        sideR.position.set(0.52, 1, 0);
        group.add(sideR);
        
        // Screen Recess
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), matScreen);
        screen.position.set(0, 1.3, 0.45);
        screen.rotation.x = -0.2;
        group.add(screen);

        // Control Panel
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4), matControls);
        panel.position.set(0, 0.95, 0.6);
        panel.rotation.x = 0.2;
        group.add(panel);

        // Joystick
        const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15), matControls);
        stickBase.position.set(-0.25, 1.05, 0.6); stickBase.rotation.x = 0.2;
        group.add(stickBase);
        const stickBall = new THREE.Mesh(new THREE.SphereGeometry(0.04), matButtonRed);
        stickBall.position.set(-0.25, 1.12, 0.58);
        group.add(stickBall);

        // Buttons
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02), matButtonBlue);
        b1.position.set(0.1, 1.02, 0.62); b1.rotation.x = 0.2; group.add(b1);
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02), matButtonBlue);
        b2.position.set(0.25, 1.02, 0.62); b2.rotation.x = 0.2; group.add(b2);

        // Marquee
        const marquee = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.1), matMarquee);
        marquee.position.set(0, 1.85, 0.52);
        marquee.rotation.x = 0.1;
        group.add(marquee);

        scene.add(group);

        // Collision Box
        const collisionBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 1.2));
        collisionBox.position.set(x, 1, z);
        collisionBox.rotation.y = rot;
        collisionBox.visible = false;
        collisionBox.updateMatrixWorld();
        propsRef.current.push(collisionBox);
    };

    const createTable = (x: number, z: number) => {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        
        const matWood = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7 });
        const matChair = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8 });
        const matPizzaBox = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

        // Table Leg
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        leg.position.y = 0.5;
        group.add(leg);
        
        // Table Top
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), matWood);
        top.position.y = 1;
        group.add(top);

        // Pizza Box on top
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), matPizzaBox);
        box.position.set(0, 1.05, 0);
        box.rotation.y = 0.2;
        group.add(box);

        // Chairs
        const createChair = (cx: number, cz: number, rot: number) => {
             const cGroup = new THREE.Group();
             cGroup.position.set(cx, 0, cz);
             cGroup.rotation.y = rot;
             
             // Seat
             const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), matChair);
             seat.position.y = 0.5;
             cGroup.add(seat);
             // Legs
             const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshStandardMaterial({color: 0x222})); l1.position.set(-0.15, 0.25, -0.15); cGroup.add(l1);
             const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshStandardMaterial({color: 0x222})); l2.position.set(0.15, 0.25, -0.15); cGroup.add(l2);
             const l3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshStandardMaterial({color: 0x222})); l3.position.set(-0.15, 0.25, 0.15); cGroup.add(l3);
             const l4 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshStandardMaterial({color: 0x222})); l4.position.set(0.15, 0.25, 0.15); cGroup.add(l4);
             // Backrest
             const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.05), matChair);
             back.position.set(0, 0.8, -0.18);
             cGroup.add(back);

             group.add(cGroup);
        };
        createChair(0, 0.9, 0);
        createChair(0, -0.9, Math.PI);

        // Party Hats
        for(let i=0; i<3; i++) {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 8), new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0xff0000 : 0x0000ff }));
            hat.position.set(Math.cos(i*2)*0.4, 1.2, Math.sin(i*2)*0.4);
            group.add(hat);
        }
        scene.add(group);

        // Collider
        const collider = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6));
        collider.position.set(x, 0.5, z);
        collider.visible = false;
        propsRef.current.push(collider);
    };

    const emptySpots: {x: number, z: number}[] = [];

    for(let z=0; z<map.length; z++) {
      for(let x=0; x<map[z].length; x++) {
        if(map[z][x] === 1) {
          const wallGeo = new THREE.BoxGeometry(MAP_SCALE, 4, MAP_SCALE);
          const wall = new THREE.Mesh(wallGeo, wallMaterial);
          wall.position.set(x * MAP_SCALE, 2, z * MAP_SCALE);
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);
          wallsRef.current.push(wall);
          if(Math.random() < 0.2) {
              // Window
              const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
              for(let d of dirs) {
                  const nz = z + d[1];
                  const nx = x + d[0];
                  if(nz >= 0 && nz < map.length && nx >= 0 && nx < map[0].length && map[nz][nx] === 0) {
                      let rot = 0;
                      if(d[0] === 1) rot = Math.PI / 2; if(d[0] === -1) rot = -Math.PI / 2;
                      if(d[1] === 1) rot = 0; if(d[1] === -1) rot = Math.PI;
                      scene.add(createWindowDecor(x * MAP_SCALE + d[0]*2.01, z * MAP_SCALE + d[1]*2.01, rot));
                      break; 
                  }
              }
          }
        } else {
            emptySpots.push({x: x*MAP_SCALE, z: z*MAP_SCALE});
        }
      }
    }

    // Place Props
    emptySpots.forEach(spot => {
        if(Math.abs(spot.x - 12) < 5 && Math.abs(spot.z - 4) < 5) return; // Spawn area protection
        if(Math.random() < 0.1) createTable(spot.x, spot.z);
        else if (Math.random() < 0.05) createArcadeMachine(spot.x + (Math.random()-0.5)*2, spot.z + (Math.random()-0.5)*2, Math.random()*Math.PI);
    });

    const createPosterTexture = (type: 'celebrate' | 'wanted' | 'fredbear') => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 340;
        const ctx = canvas.getContext('2d');
        if(!ctx) return new THREE.CanvasTexture(canvas);
        ctx.fillStyle = '#111';
        ctx.fillRect(0,0,256,340);
        if(type === 'celebrate') {
            ctx.lineWidth = 10; ctx.strokeStyle = '#555'; ctx.strokeRect(5,5,246,330);
            ctx.fillStyle = 'white'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText("CELEBRATE!", 128, 50);
            ctx.fillStyle = '#8B4513'; ctx.fillRect(40, 100, 50, 60);
            ctx.fillStyle = '#5D3FD3'; ctx.fillRect(100, 100, 50, 60);
            ctx.fillStyle = '#FFD700'; ctx.fillRect(160, 100, 50, 60);
            for(let i=0; i<50; i++) { ctx.fillStyle = `hsl(${Math.random()*360}, 100%, 50%)`; ctx.fillRect(Math.random()*256, Math.random()*340, 4, 4); }
        } else if (type === 'wanted') {
             ctx.fillStyle = '#eee'; ctx.fillRect(10,10,236,320);
             ctx.fillStyle = 'black'; ctx.font = 'bold 28px Courier'; ctx.textAlign = 'center'; ctx.fillText("HELP WANTED", 128, 60);
             ctx.font = '12px Courier'; ctx.fillText("Night Guard", 128, 140);
             ctx.fillStyle = '#333'; ctx.fillRect(80, 190, 96, 100);
        } else if (type === 'fredbear') {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,256,340);
            ctx.fillStyle = '#E6C200'; ctx.fillRect(50, 100, 156, 140);
            ctx.fillStyle = 'black'; ctx.fillRect(70, 130, 40, 40); ctx.fillRect(146, 130, 40, 40);
            ctx.fillStyle = 'white'; ctx.fillRect(88, 148, 4, 4); ctx.fillRect(164, 148, 4, 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center'; ctx.fillText("IT'S ME", 128, 300);
        }
        return new THREE.CanvasTexture(canvas);
    };

    const posterMats = [
        new THREE.MeshBasicMaterial({ map: createPosterTexture('celebrate') }),
        new THREE.MeshBasicMaterial({ map: createPosterTexture('wanted') }),
        new THREE.MeshBasicMaterial({ map: createPosterTexture('fredbear') }),
    ];

    const placePosterOnWall = (gx: number, gz: number, direction: 'N'|'S'|'E'|'W') => {
        const mat = posterMats[Math.floor(Math.random() * posterMats.length)];
        const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), mat);
        const x = gx * MAP_SCALE;
        const z = gz * MAP_SCALE;
        const offset = 2.05;

        poster.position.set(x, 2.5, z);
        
        if (direction === 'N') { poster.position.z -= offset; poster.rotation.y = Math.PI; } // Back
        if (direction === 'S') { poster.position.z += offset; poster.rotation.y = 0; } // Front
        if (direction === 'E') { poster.position.x += offset; poster.rotation.y = -Math.PI/2; } // Right
        if (direction === 'W') { poster.position.x -= offset; poster.rotation.y = Math.PI/2; } // Left
        
        scene.add(poster);
    };

    // Ensure posters are placed on actual walls
    if(map[1][0] === 1) placePosterOnWall(0, 1, 'E'); // Left side wall facing inward
    if(map[0][7] === 1) placePosterOnWall(7, 0, 'S'); // Top wall facing down
    if(map[8][14] === 1) placePosterOnWall(14, 8, 'W'); // Right wall facing inward
    if(map[4][4] === 1) placePosterOnWall(4, 4, 'N');

    // --- FREDBEAR ---
    const createVoxelFredbear = () => {
      const group = new THREE.Group();
      const matGold = new THREE.MeshStandardMaterial({ color: 0xE6C200, roughness: 0.6 });
      const matBelly = new THREE.MeshStandardMaterial({ color: 0xF7E78C, roughness: 0.6 });
      const matPurple = new THREE.MeshStandardMaterial({ color: 0x5D3FD3, roughness: 0.8 });
      const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const matMetal = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });

      const createBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, name?: string) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        if(name) mesh.name = name;
        parent.add(mesh);
        return mesh;
      };

      const bodyGroup = new THREE.Group();
      bodyGroup.name = 'body';
      group.add(bodyGroup);
      createBox(1.1, 0.4, 0.7, matGold, 0, 0.8, 0, bodyGroup);
      createBox(1.2, 0.5, 0.8, matGold, 0, 1.25, 0, bodyGroup);
      createBox(0.9, 0.4, 0.1, matBelly, 0, 1.25, 0.41, bodyGroup);
      createBox(1.5, 0.7, 0.9, matGold, 0, 1.85, 0, bodyGroup);
      createBox(0.5, 0.25, 0.1, matPurple, 0, 2.1, 0.5, bodyGroup); 

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 2.3, 0); 
      bodyGroup.add(headGroup);
      createBox(1.2, 0.9, 0.95, matGold, 0, 0.45, 0, headGroup);
      createBox(0.7, 0.35, 0.4, matBelly, 0, 0.35, 0.65, headGroup);
      createBox(0.2, 0.15, 0.1, matBlack, 0, 0.5, 0.85, headGroup);

      const jawGroup = new THREE.Group();
      jawGroup.name = 'jaw';
      jawGroup.position.set(0, 0.1, 0.2);
      headGroup.add(jawGroup);
      createBox(0.8, 0.2, 0.75, matGold, 0, 0, 0.1, jawGroup);
      createBox(0.1, 0.1, 0.05, matWhite, -0.25, 0.15, 0.45, jawGroup);
      createBox(0.1, 0.1, 0.05, matWhite, 0.25, 0.15, 0.45, jawGroup);

      createBox(0.25, 0.25, 0.1, matWhite, -0.28, 0.6, 0.48, headGroup);
      createBox(0.25, 0.25, 0.1, matWhite, 0.28, 0.6, 0.48, headGroup);
      createBox(0.08, 0.08, 0.12, matBlack, -0.28, 0.6, 0.49, headGroup);
      createBox(0.08, 0.08, 0.12, matBlack, 0.28, 0.6, 0.49, headGroup);
      
      createBox(0.1, 0.2, 0.1, matMetal, -0.45, 0.95, 0, headGroup); 
      createBox(0.35, 0.35, 0.1, matGold, -0.55, 1.15, 0, headGroup);
      createBox(0.1, 0.2, 0.1, matMetal, 0.45, 0.95, 0, headGroup);
      createBox(0.35, 0.35, 0.1, matGold, 0.55, 1.15, 0, headGroup);
      createBox(0.7, 0.1, 0.7, matPurple, 0, 0.95, 0, headGroup); 
      createBox(0.45, 0.6, 0.45, matPurple, 0, 1.3, 0, headGroup); 

      const eyeLightL = new THREE.SpotLight(0xffffff, 50, 25, 0.4, 0.5, 1);
      eyeLightL.position.set(-0.25, 0.6, 0.6); eyeLightL.target.position.set(-0.25, 0.6, 10);
      headGroup.add(eyeLightL); headGroup.add(eyeLightL.target);
      const eyeLightR = new THREE.SpotLight(0xffffff, 50, 25, 0.4, 0.5, 1);
      eyeLightR.position.set(0.25, 0.6, 0.6); eyeLightR.target.position.set(0.25, 0.6, 10);
      headGroup.add(eyeLightR); headGroup.add(eyeLightR.target);
      fredbearAI.current.eyeLights = [eyeLightL, eyeLightR];

      const leftArmGroup = new THREE.Group();
      leftArmGroup.name = 'armL';
      leftArmGroup.position.set(-0.8, 2.0, 0); 
      bodyGroup.add(leftArmGroup);
      createBox(0.4, 0.6, 0.4, matGold, -0.2, -0.3, 0, leftArmGroup); 
      createBox(0.38, 0.6, 0.38, matGold, -0.2, -1.0, 0, leftArmGroup); 

      const rightArmGroup = new THREE.Group();
      rightArmGroup.name = 'armR';
      rightArmGroup.position.set(0.8, 2.0, 0); 
      bodyGroup.add(rightArmGroup);
      createBox(0.4, 0.6, 0.4, matGold, 0.2, -0.3, 0, rightArmGroup); 
      createBox(0.38, 0.6, 0.38, matGold, 0.2, -1.0, 0, rightArmGroup); 

      const leftLegGroup = new THREE.Group();
      leftLegGroup.name = 'legL';
      leftLegGroup.position.set(-0.35, 0.6, 0);
      bodyGroup.add(leftLegGroup);
      createBox(0.45, 0.5, 0.45, matGold, 0, -0.25, 0, leftLegGroup); 
      createBox(0.42, 0.5, 0.42, matGold, 0, -0.95, 0, leftLegGroup); 
      createBox(0.45, 0.2, 0.55, matGold, 0, -1.3, 0.1, leftLegGroup); 

      const rightLegGroup = new THREE.Group();
      rightLegGroup.name = 'legR';
      rightLegGroup.position.set(0.35, 0.6, 0);
      bodyGroup.add(rightLegGroup);
      createBox(0.45, 0.5, 0.45, matGold, 0, -0.25, 0, rightLegGroup); 
      createBox(0.42, 0.5, 0.42, matGold, 0, -0.95, 0, rightLegGroup);
      createBox(0.45, 0.2, 0.55, matGold, 0, -1.3, 0.1, rightLegGroup);

      bodyGroup.position.y = 0.8;
      
      // FIXED: Lowering Y significantly to ensure feet are grounded
      group.position.set(50, -0.8, 40); 
      scene.add(group);
      return group;
    };
    fredbearRef.current = createVoxelFredbear();

    const handleMouseMove = (e: MouseEvent) => {
        if (document.pointerLockElement === document.body && gameState === 'playing') {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= e.movementX * sensitivity;
            euler.x -= e.movementY * sensitivity;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            camera.quaternion.setFromEuler(euler);
        }
    };
    const handleMouseDown = () => {
        if(gameState === 'playing' && document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
            soundManager.init();
        }
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('click', handleMouseDown);

    // Collision Helper
    const checkCollision = (position: THREE.Vector3) => {
        const playerBox = new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(0.8, 2, 0.8));
        
        // Walls
        for(let wall of wallsRef.current) {
            if (wall.position.distanceTo(position) < 6) {
                const wallBox = new THREE.Box3().setFromObject(wall);
                if(playerBox.intersectsBox(wallBox)) return true;
            }
        }
        // Props
        for(let prop of propsRef.current) {
            if (prop.position.distanceTo(position) < 4) {
                const propBox = new THREE.Box3().setFromObject(prop);
                // Increase prop box logic was faulty, now relying on explicit larger collision meshes
                if(playerBox.intersectsBox(propBox)) return true;
            }
        }
        return false;
    }

    let animationId: number;
    let particleTime = 0;
    let thunderTimer = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (renderer && scene && camera) {
        
        particleTime += 0.005;
        if(particles) {
            particles.rotation.y = particleTime * 0.2;
            particles.position.y = Math.sin(particleTime) * 0.5;
        }

        // Thunder Effect
        thunderTimer--;
        if(thunderTimer < 0) {
            if(Math.random() < 0.005) {
                thunderTimer = 20; // flash duration
            }
        }
        if(thunderTimer > 0 && ambientLightRef.current) {
            ambientLightRef.current.intensity = 2.0 + Math.random(); // Bright flash
        } else if(ambientLightRef.current) {
            ambientLightRef.current.intensity = 0.1; // Dark
        }

        if (gameState === 'playing') {
            const player = playerRef.current;
            const fredbear = fredbearRef.current;
            const keys = keysRef.current;

            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            right.y = 0; right.normalize();

            const moveDir = new THREE.Vector3();
            if (keys['KeyW']) moveDir.add(forward);
            if (keys['KeyS']) moveDir.sub(forward);
            if (keys['KeyA']) moveDir.sub(right);
            if (keys['KeyD']) moveDir.add(right);

            if (moveDir.length() > 0) {
                moveDir.normalize().multiplyScalar(PLAYER_SPEED);
                
                // Sliding Collision Logic: Try Moving X, then Z independently
                const originalPos = player.position.clone();
                
                // Attempt X movement
                const nextPosX = originalPos.clone();
                nextPosX.x += moveDir.x;
                if(!checkCollision(nextPosX)) {
                    player.position.x = nextPosX.x;
                }

                // Attempt Z movement
                const nextPosZ = player.position.clone(); // use potentially updated X
                nextPosZ.z += moveDir.z;
                if(!checkCollision(nextPosZ)) {
                    player.position.z = nextPosZ.z;
                }

                // Footsteps
                playerStepTimerRef.current++;
                if (playerStepTimerRef.current > 30) {
                    soundManager.playPlayerFootstep();
                    playerStepTimerRef.current = 0;
                }

                // HEAD BOBBING
                playerHeadBobTimerRef.current += 0.2;
                camera.position.y = 1.5 + Math.sin(playerHeadBobTimerRef.current) * 0.08;

            } else {
                playerStepTimerRef.current = 30; // Reset so sound plays immediately on move
                
                // Reset Head Bob gently or instantly
                camera.position.y = 1.5;
                playerHeadBobTimerRef.current = 0;
            }

            camera.position.x = player.position.x;
            camera.position.z = player.position.z;

            // Update Audio Rain Volume based on window proximity
            let minWinDist = 999;
            for(let w of windowsRef.current) {
                const d = player.position.distanceTo(w);
                if(d < minWinDist) minWinDist = d;
            }
            // Max volume at 2 units, 0 volume at 15 units
            let rainVol = 1 - ((minWinDist - 2) / 13);
            if(rainVol < 0) rainVol = 0;
            if(rainVol > 1) rainVol = 1;
            soundManager.updateRainVolume(rainVol * 0.5);

            if (flashlightRef.current) {
                if (isFlashlightOnRef.current) {
                    if (Math.random() < 0.02) flashlightRef.current.intensity = 0;
                    else flashlightRef.current.intensity = 80;
                } else {
                    flashlightRef.current.intensity = 0;
                }
            }

            if (fredbear) {
                const ai = fredbearAI.current;
                const dirToPlayer = new THREE.Vector3().subVectors(player.position, fredbear.position);
                
                // IMPORTANT: Calculate 2D distance for gameplay logic (ignoring height difference)
                const distToPlayer2D = Math.sqrt(dirToPlayer.x * dirToPlayer.x + dirToPlayer.z * dirToPlayer.z);
                
                // Use 3D distance for audio volume
                const distToPlayer3D = dirToPlayer.length();
                
                const rayOrigin = fredbear.position.clone().add(new THREE.Vector3(0, 2.5, 0)); 
                const rayDir = dirToPlayer.clone().normalize();
                
                raycasterRef.current.set(rayOrigin, rayDir);
                const intersects = raycasterRef.current.intersectObjects(wallsRef.current);
                
                let isPlayerVisible = true;
                if (intersects.length > 0 && intersects[0].distance < distToPlayer3D) isPlayerVisible = false;
                
                const fredbearForward = new THREE.Vector3(0,0,1).applyQuaternion(fredbear.quaternion);
                const angle = fredbearForward.angleTo(rayDir);
                if (angle > 1.2 && distToPlayer2D > 3) isPlayerVisible = false;

                if (isPlayerVisible) {
                    ai.state = 'chase';
                    setEnemyStatus("!"); // Minimal debug or hidden
                    ai.eyeLights.forEach(l => l.color.setHex(0xff0000));
                } else {
                    if (ai.state === 'chase') {
                         ai.state = 'patrol';
                         setEnemyStatus("?");
                         ai.eyeLights.forEach(l => l.color.setHex(0xffffff));
                    }
                }

                let moving = false;
                let speed = 0;

                if (ai.state === 'chase') {
                    // Look at player flat (ignore Y)
                    fredbear.lookAt(player.position.x, fredbear.position.y, player.position.z);
                    
                    if (distToPlayer2D > 1.2) { // Allow getting closer before jumpscare
                        speed = FREDBEAR_CHASE_SPEED;
                        const moveVec = dirToPlayer.normalize().multiplyScalar(speed);
                        // Only move X/Z
                        fredbear.position.x += moveVec.x;
                        fredbear.position.z += moveVec.z;
                        moving = true;
                    } else {
                        // JUMPSCARE TRIGGER
                        soundManager.playJumpscare();
                        setGameState('jumpscare');
                        document.exitPointerLock();
                    }
                } else {
                    setEnemyStatus("");
                    speed = FREDBEAR_PATROL_SPEED;
                    const forwardRayOrigin = fredbear.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                    const forwardRayDir = new THREE.Vector3(0,0,1).applyQuaternion(fredbear.quaternion);
                    raycasterRef.current.set(forwardRayOrigin, forwardRayDir);
                    const wallIntersects = raycasterRef.current.intersectObjects(wallsRef.current);
                    
                    let obstacleAhead = false;
                    if (wallIntersects.length > 0 && wallIntersects[0].distance < 3.0) obstacleAhead = true;

                    ai.changeDirTimer -= 1;
                    if (obstacleAhead || ai.changeDirTimer <= 0) {
                        const randomAngle = (Math.random() - 0.5) * Math.PI; 
                        const rotationAmount = obstacleAhead ? (Math.PI / 2 + Math.random()) : randomAngle;
                        fredbear.rotation.y += rotationAmount;
                        ai.changeDirTimer = 100 + Math.random() * 200; 
                    }
                    fredbear.translateZ(speed);
                    moving = true;
                }
                
                // Ensure Y remains grounded during movement (fix for floating)
                fredbear.position.y = -0.8;

                const body = fredbear.getObjectByName('body');
                const legL = body?.getObjectByName('legL');
                const legR = body?.getObjectByName('legR');
                const armL = body?.getObjectByName('armL');
                const armR = body?.getObjectByName('armR');

                if (moving && legL && legR && armL && armR) {
                    const time = Date.now() * 0.01;
                    legL.rotation.x = Math.sin(time) * 0.6;
                    legR.rotation.x = Math.sin(time + Math.PI) * 0.6;
                    armL.rotation.x = Math.sin(time + Math.PI) * 0.6;
                    armR.rotation.x = Math.sin(time) * 0.6;

                    ai.footstepTimer++;
                    if(ai.footstepTimer > (25 / (speed * 10))) { 
                         soundManager.playFredbearFootstep(distToPlayer3D);
                         ai.footstepTimer = 0;
                    }
                }
            }
        } else if (gameState === 'jumpscare') {
            if (fredbearRef.current && cameraRef.current) {
                const fredbear = fredbearRef.current;
                const offset = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5); 
                fredbear.position.copy(camera.position).add(offset);
                fredbear.position.y = camera.position.y - 1.8; 
                fredbear.lookAt(camera.position);
                camera.position.x += (Math.random() - 0.5) * 1.5;
                camera.position.y += (Math.random() - 0.5) * 1.5;
                
                const body = fredbear.getObjectByName('body');
                const jaw = body?.getObjectByName('jaw');
                if (jaw) jaw.rotation.x = -Math.abs(Math.sin(Date.now() * 0.05)) * 1.5; 

                fredbearAI.current.eyeLights.forEach(l => {
                    l.color.setHex(0xff0000);
                    l.intensity = 1000;
                });
                
                fredbearAI.current.jumpscareTimer += 1;
                if(fredbearAI.current.jumpscareTimer > 120) { 
                    setGameState('gameover');
                    setMsg("Fredbear seni yakaladı!");
                }
            }
        } 
        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
        if(cameraRef.current && renderer) {
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('click', handleMouseDown);
      cancelAnimationFrame(animationId);
      if(mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [gameState, sensitivity]); 

  const restartGame = () => {
    setGameState('playing');
    setGameTime(0);
    isFlashlightOnRef.current = true;
    setIsFlashlightOn(true);
    fredbearAI.current.jumpscareTimer = 0;
    playerStepTimerRef.current = 0;
    playerHeadBobTimerRef.current = 0;
    
    if(playerRef.current) playerRef.current.position.set(12, 1.5, 4);
    if(fredbearRef.current) {
        fredbearRef.current.position.set(50, -0.8, 40); // Reset position (Grounded)
        fredbearRef.current.rotation.set(0,0,0);
        fredbearAI.current.state = 'patrol';
        fredbearAI.current.eyeLights.forEach(l => l.color.setHex(0xffffff));
    }
    
    setTimeout(() => {
        document.body.requestPointerLock();
    }, 100);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'black' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={styles.scanline}></div>
      <div style={styles.staticNoise}></div>
      
      {gameState === 'playing' && (
        <>
            <div style={styles.hud}>
                {getHourString()} {enemyStatus && <span style={{color: 'red', marginLeft: '20px'}}>{enemyStatus}</span>}
            </div>
        </>
      )}

      {gameState === 'start' && (
        <div style={styles.overlay}>
          <h1 style={{...styles.title, transform: `translate(${glitchOffset.x}px, ${glitchOffset.y}px)`}}>FrediBeardan Kaç</h1>
          <button style={styles.button} onClick={startGameSequence}>OYUNA BAŞLA</button>
          <button style={styles.button} onClick={() => setGameState('settings')}>AYARLAR</button>
        </div>
      )}

      {gameState === 'night_intro' && (
          <div style={styles.overlay}>
              <h1 style={styles.nightTitle}>12:00 AM</h1>
              <h2 style={styles.nightTitle}>GECE 1</h2>
          </div>
      )}

      {gameState === 'settings' && (
        <div style={styles.overlay}>
          <h1 style={styles.title}>AYARLAR</h1>
          <div style={styles.settingRow}>
             <span>SES</span>
             <input type="range" min="0" max="1" step="0.1" value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))} style={styles.inputRange}/>
          </div>
          <div style={styles.settingRow}>
             <span>HASSASİYET</span>
             <input type="range" min="0.001" max="0.01" step="0.001" value={sensitivity} 
                onChange={(e) => setSensitivity(parseFloat(e.target.value))} style={styles.inputRange}/>
          </div>
          <button style={styles.button} onClick={() => setGameState('start')}>GERİ DÖN</button>
        </div>
      )}

      {gameState === 'jumpscare' && (<div style={{...styles.overlay, backgroundColor: 'transparent', pointerEvents: 'none'}}></div>)}

      {gameState === 'gameover' && (
        <div style={styles.overlay}>
            <h1 style={{...styles.title, color: 'red'}}>YAKALANDIN</h1>
            <p style={{fontSize: '24px'}}>{msg}</p>
            <button style={styles.button} onClick={() => setGameState('start')}>MENÜYE DÖN</button>
        </div>
      )}

      {gameState === 'win' && (
        <div style={styles.overlay}>
            <h1 style={{...styles.title, color: '#0f0'}}>6:00 AM</h1>
            <p style={{fontSize: '24px'}}>{msg}</p>
            <button style={styles.button} onClick={() => setGameState('start')}>TEKRAR OYNA</button>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);