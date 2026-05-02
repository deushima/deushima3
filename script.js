import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
        import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
        import GUI from 'lil-gui';

        // --- INITIAL CONFIGURATION ---
        // Inline startup SVG avoids file:// loading issues when opening index.html directly.
        const INITIAL_SVG_URL = './deushima.svg.svg'; 
        const INLINE_INITIAL_SVG = document.getElementById('initialSvgData')?.textContent?.trim() || '';
        const workbenchViewport = document.getElementById('workbenchViewport');
        const controlsDrawer = document.getElementById('controlsDrawer');
        const controlsPanel = document.getElementById('controlsPanel');
        const controlsToggle = document.getElementById('controlsToggle');
        const controlsDrawerTitle = document.getElementById('controlsDrawerTitle');
        const toolFiltersRoot = document.getElementById('toolFilters');
        const toolListRoot = document.getElementById('toolList');
        const toolInfoIndex = document.getElementById('toolInfoIndex');
        const toolInfoMeta = document.getElementById('toolInfoMeta');
        const toolInfoTitle = document.getElementById('toolInfoTitle');
        const toolInfoDescription = document.getElementById('toolInfoDescription');
        const hudBrandLogo = document.getElementById('hudBrandLogo');
        const fileInput = document.getElementById('fileInput');
        const textureInput = document.getElementById('textureInput');
        const musicToggle = document.getElementById('musicToggle');
        const musicPlayer = document.getElementById('musicPlayer');
        const musicVolume = document.getElementById('musicVolume');
        const musicVolumeValue = document.getElementById('musicVolumeValue');

        const musicPlaylist = [
            { title: 'Meditation', src: './Song/Meditation.mp3' }
        ];
        let activeMusicTrack = 0;
        let musicVolumeLevel = 0.58;

        document.title = 'Deushima Liquid Metal Workspace';
        document.querySelectorAll('body > .sound-embed, body > .site-footer').forEach((node) => node.remove());
        document.querySelectorAll('.cursor-follower').forEach((node) => node.remove());

        function syncMusicButton() {
            if (!musicToggle || !musicPlayer || !musicPlaylist.length) return;
            const track = musicPlaylist[activeMusicTrack];
            const isPlaying = !musicPlayer.paused;
            musicToggle.classList.toggle('is-playing', isPlaying);
            musicToggle.setAttribute('aria-pressed', String(isPlaying));
            musicToggle.setAttribute('aria-label', isPlaying ? `Pausar ${track.title}` : `Reproducir ${track.title}`);
            musicToggle.title = track.title;
        }

        function syncMusicVolume() {
            if (!musicPlayer) return;
            musicPlayer.volume = musicVolumeLevel;
            if (musicVolume) musicVolume.value = String(Math.round(musicVolumeLevel * 100));
            if (musicVolumeValue) musicVolumeValue.textContent = `${Math.round(musicVolumeLevel * 100)}%`;
        }

        function loadMusicTrack(index) {
            if (!musicPlayer || !musicPlaylist.length) return;
            activeMusicTrack = (index + musicPlaylist.length) % musicPlaylist.length;
            musicPlayer.src = musicPlaylist[activeMusicTrack].src;
            syncMusicVolume();
            syncMusicButton();
        }

        async function toggleMusicPlayback() {
            if (!musicPlayer || !musicPlaylist.length) return;
            if (!musicPlayer.src) loadMusicTrack(activeMusicTrack);

            if (musicPlayer.paused) {
                try {
                    await musicPlayer.play();
                } catch (error) {
                    console.warn('No se pudo reproducir el audio local.', error);
                }
            } else {
                musicPlayer.pause();
            }

            syncMusicButton();
        }

        musicToggle?.addEventListener('click', toggleMusicPlayback);
        musicPlayer?.addEventListener('play', syncMusicButton);
        musicPlayer?.addEventListener('pause', syncMusicButton);
        musicPlayer?.addEventListener('ended', () => {
            loadMusicTrack(activeMusicTrack + 1);
            musicPlayer.play().catch((error) => {
                console.warn('No se pudo continuar la radio local.', error);
                syncMusicButton();
            });
        });
        musicVolume?.addEventListener('input', (event) => {
            musicVolumeLevel = Math.min(1, Math.max(0, Number(event.target.value) / 100));
            syncMusicVolume();
        });
        loadMusicTrack(activeMusicTrack);

        if (hudBrandLogo) {
            hudBrandLogo.innerHTML = INLINE_INITIAL_SVG || `<img src="${INITIAL_SVG_URL}" alt="Deushima">`;
        }

        const getViewportSize = () => ({
            width: Math.max(workbenchViewport?.clientWidth || window.innerWidth, 1),
            height: Math.max(workbenchViewport?.clientHeight || window.innerHeight, 1)
        });
        const compositionSettings = {
            verticalOffset: 3.0,
            logoFitSize: 39,
            cameraDistance: 43
        };

        // --- GLSL NOISE FUNCTION ---
        const simplex3D = `
            vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
            vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
            float snoise(vec3 v){
                const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                vec3 i  = floor(v + dot(v, C.yyy) );
                vec3 x0 = v - i + dot(i, C.xxx) ;
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min( g.xyz, l.zxy );
                vec3 i2 = max( g.xyz, l.zxy );
                vec3 x1 = x0 - i1 + 1.0 * C.xxx;
                vec3 x2 = x0 - i2 + 2.0 * C.xxx;
                vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
                i = mod(i, 289.0 );
                vec4 p = permute( permute( permute(
                           i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                         + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                         + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                float n_ = 1.0/7.0; 
                vec3  ns = n_ * D.wyz - D.xzx;
                vec4 j = p - 49.0 * floor(p * ns.z *ns.z); 
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_ );  
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                vec4 b0 = vec4( x.xy, y.xy );
                vec4 b1 = vec4( x.zw, y.zw );
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                vec3 p0 = vec3(a0.xy,h.x);
                vec3 p1 = vec3(a0.zw,h.y);
                vec3 p2 = vec3(a1.xy,h.z);
                vec3 p3 = vec3(a1.zw,h.w);
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
            }
        `;

        // --- SCENE SETUP ---
        const sceneSettings = { bgColor: '#000000' };
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(sceneSettings.bgColor);

        const initialViewport = getViewportSize();
        const camera = new THREE.PerspectiveCamera(45, initialViewport.width / initialViewport.height, 0.1, 1000);
        camera.position.set(0, 0, compositionSettings.cameraDistance);

        function createRendererWithFallback() {
            const rendererProfiles = [
                { antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' },
                { antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'default' },
                { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }
            ];

            let lastError = null;
            for (const profile of rendererProfiles) {
                try {
                    return new THREE.WebGLRenderer(profile);
                } catch (error) {
                    lastError = error;
                    console.warn('WebGL renderer profile failed, retrying with safer settings.', profile, error);
                }
            }

            const firefoxHint = /firefox/i.test(navigator.userAgent)
                ? ' Firefox suele fallar por aceleracion por hardware, una extension de privacidad/adblock o el driver GPU.'
                : '';
            throw new Error(`No se pudo crear el contexto WebGL.${firefoxHint} ${lastError?.message || ''}`.trim());
        }

        const renderer = createRendererWithFallback();
        renderer.setSize(initialViewport.width, initialViewport.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.autoClear = true;
        renderer.setClearColor(0x000000, 1);
        renderer.setClearAlpha(1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3; 
        renderer.domElement.classList.add('workbench-canvas');
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            throw new Error('WebGL context lost. Revisa Firefox: aceleracion por hardware, extensiones o bloqueo del driver GPU.');
        }, false);
        (workbenchViewport || document.body).appendChild(renderer.domElement);

        const glowSettings = {
            enabled: true,
            strength: 0.16,
            radius: 0.11,
            threshold: 0.47
        };

        const chromaticSettings = {
            enabled: true,
            intensity: 0.0,
            angle: 1.85,
            chromeLevel: 1.84,
            contrast: 1.07,
            whiteExposure: 1.81,
            preset: 'balanced'
        };

        const gradientMapSettings = {
            enabled: false,
            amount: 1.0,
            smoothness: 1.0,
            selectedStopId: 'midtone',
            stops: [
                { id: 'shadow', label: 'Sombra', color: '#000000', position: 0.0 },
                { id: 'midtone', label: 'Medio', color: '#808080', position: 0.5 },
                { id: 'highlight', label: 'Luz', color: '#ffffff', position: 1.0 }
            ]
        };

        const imageFilterPresets = [
            { id: 'neutral-silver', name: 'Neutral Silver', preview: 'linear-gradient(135deg, #050505 0%, #4c4c4c 42%, #f4f4f4 100%)', shadows: '#0b0b0b', midtones: '#9a9a9a', highlights: '#ffffff', contrast: 1.04, saturation: 0.1, exposure: 1.06 },
            { id: 'moon-chrome', name: 'Moon Chrome', preview: 'linear-gradient(135deg, #111217 0%, #b9bdc7 54%, #ffffff 100%)', shadows: '#0f1013', midtones: '#b3b7c2', highlights: '#ffffff', contrast: 1.12, saturation: 0.18, exposure: 1.08 },
            { id: 'soft-graphite', name: 'Soft Graphite', preview: 'linear-gradient(135deg, #000000 0%, #343434 55%, #bdbdbd 100%)', shadows: '#050505', midtones: '#565656', highlights: '#cfcfcf', contrast: 0.92, saturation: 0.0, exposure: 0.96 },
            { id: 'pastel-violet', name: 'Pastel Violet', preview: 'linear-gradient(135deg, #08070c 0%, #777990 50%, #d3d6eb 100%)', shadows: '#08070c', midtones: '#777990', highlights: '#d3d6eb', contrast: 1.05, saturation: 0.32, exposure: 1.05 },
            { id: 'blue-steel', name: 'Blue Steel', preview: 'linear-gradient(135deg, #02050a 0%, #576982 48%, #dbe8f7 100%)', shadows: '#02050a', midtones: '#52667f', highlights: '#dbe8f7', contrast: 1.08, saturation: 0.42, exposure: 1.02 },
            { id: 'warm-pearl', name: 'Warm Pearl', preview: 'linear-gradient(135deg, #0e0b08 0%, #8d8172 50%, #fff3dd 100%)', shadows: '#0e0b08', midtones: '#8d8172', highlights: '#fff3dd', contrast: 0.98, saturation: 0.38, exposure: 1.08 },
            { id: 'ice-mint', name: 'Ice Mint', preview: 'linear-gradient(135deg, #02100d 0%, #74a59b 48%, #e9fff9 100%)', shadows: '#02100d', midtones: '#74a59b', highlights: '#e9fff9', contrast: 1.0, saturation: 0.46, exposure: 1.04 },
            { id: 'noir', name: 'Noir', preview: 'linear-gradient(135deg, #000000 0%, #1d1d1d 48%, #8c8c8c 100%)', shadows: '#000000', midtones: '#2b2b2b', highlights: '#8c8c8c', contrast: 1.35, saturation: 0.0, exposure: 0.88 },
            { id: 'high-key', name: 'High Key', preview: 'linear-gradient(135deg, #292929 0%, #d8d8d8 55%, #ffffff 100%)', shadows: '#292929', midtones: '#d8d8d8', highlights: '#ffffff', contrast: 0.84, saturation: 0.02, exposure: 1.18 },
            { id: 'smoked-glass', name: 'Smoked Glass', preview: 'linear-gradient(135deg, #020202 0%, #454b4f 46%, #d0d7d8 100%)', shadows: '#020202', midtones: '#454b4f', highlights: '#d0d7d8', contrast: 1.18, saturation: 0.12, exposure: 0.98 },
            { id: 'rose-ash', name: 'Rose Ash', preview: 'linear-gradient(135deg, #0a0708 0%, #8a7376 46%, #f2dede 100%)', shadows: '#0a0708', midtones: '#8a7376', highlights: '#f2dede', contrast: 1.0, saturation: 0.34, exposure: 1.02 },
            { id: 'golden-metal', name: 'Golden Metal', preview: 'linear-gradient(135deg, #100b03 0%, #9f8753 50%, #fff1ba 100%)', shadows: '#100b03', midtones: '#9f8753', highlights: '#fff1ba', contrast: 1.09, saturation: 0.55, exposure: 1.07 },
            { id: 'deep-emerald', name: 'Deep Emerald', preview: 'linear-gradient(135deg, #010807 0%, #24564d 48%, #b9f5e3 100%)', shadows: '#010807', midtones: '#24564d', highlights: '#b9f5e3', contrast: 1.16, saturation: 0.58, exposure: 0.98 },
            { id: 'infrared', name: 'Infrared', preview: 'linear-gradient(135deg, #060007 0%, #6e3a68 48%, #ffd5f6 100%)', shadows: '#060007', midtones: '#6e3a68', highlights: '#ffd5f6', contrast: 1.08, saturation: 0.62, exposure: 1.0 },
            { id: 'frosted-ink', name: 'Frosted Ink', preview: 'linear-gradient(135deg, #00030a 0%, #252d37 45%, #edf6ff 100%)', shadows: '#00030a', midtones: '#252d37', highlights: '#edf6ff', contrast: 1.24, saturation: 0.24, exposure: 1.03 },
            { id: 'negative-lime', name: 'Negative Lime', preview: 'linear-gradient(135deg, #d9ff8a 0%, #476b5d 48%, #1b1230 100%)', shadows: '#d9ff8a', midtones: '#476b5d', highlights: '#1b1230', contrast: 1.16, saturation: 0.88, exposure: 1.0 },
            { id: 'negative-coral', name: 'Negative Coral', preview: 'linear-gradient(135deg, #ffb199 0%, #7b6f86 46%, #102331 100%)', shadows: '#ffb199', midtones: '#7b6f86', highlights: '#102331', contrast: 1.12, saturation: 0.76, exposure: 1.02 },
            { id: 'negative-sky', name: 'Negative Sky', preview: 'linear-gradient(135deg, #bde7ff 0%, #6f6aa8 48%, #21102b 100%)', shadows: '#bde7ff', midtones: '#6f6aa8', highlights: '#21102b', contrast: 1.1, saturation: 0.72, exposure: 1.03 },
            { id: 'negative-sand', name: 'Negative Sand', preview: 'linear-gradient(135deg, #ffe6a6 0%, #b58d79 50%, #293144 100%)', shadows: '#ffe6a6', midtones: '#b58d79', highlights: '#293144', contrast: 1.0, saturation: 0.64, exposure: 1.04 },
            { id: 'negative-lilac', name: 'Negative Lilac', preview: 'linear-gradient(135deg, #ead7ff 0%, #9f7fb7 47%, #263746 100%)', shadows: '#ead7ff', midtones: '#9f7fb7', highlights: '#263746', contrast: 1.08, saturation: 0.7, exposure: 1.0 },
            { id: 'negative-mint', name: 'Negative Mint', preview: 'linear-gradient(135deg, #c4ffd8 0%, #72a0a0 46%, #382544 100%)', shadows: '#c4ffd8', midtones: '#72a0a0', highlights: '#382544', contrast: 1.05, saturation: 0.74, exposure: 1.02 },
            { id: 'negative-rose', name: 'Negative Rose', preview: 'linear-gradient(135deg, #ffd7ea 0%, #b16882 48%, #17343a 100%)', shadows: '#ffd7ea', midtones: '#b16882', highlights: '#17343a', contrast: 1.1, saturation: 0.82, exposure: 1.01 },
            { id: 'negative-cyan', name: 'Negative Cyan', preview: 'linear-gradient(135deg, #a9fff8 0%, #5c8aa2 45%, #351733 100%)', shadows: '#a9fff8', midtones: '#5c8aa2', highlights: '#351733', contrast: 1.14, saturation: 0.9, exposure: 1.0 }
        ];

        const imageFilterSettings = {
            enabled: false,
            affectBackground: false,
            amount: 0.85,
            selected: 'neutral-silver'
        };

        const pixelScanIntroSettings = {
            enabled: true,
            delay: 0.12,
            duration: 2.45,
            width: 0.24,
            pixelSize: 11.0,
            intensity: 1.25,
            mode: 0
        };

        const edgeSmoothSettings = {
            enabled: false,
            strength: 0.85
        };

        const export360Settings = {
            duration: 6,
            fps: 30,
            qualityMbps: 12,
            clockwise: true,
            exportVideo: () => { export360Video(); }
        };

        const export360State = {
            active: false,
            startTime: 0,
            durationMs: 6000,
            initialRotationY: 0,
            clockwise: true,
            cameraPosition: new THREE.Vector3(),
            cameraQuaternion: new THREE.Quaternion(),
            controlsTarget: new THREE.Vector3()
        };

        const composer = new EffectComposer(renderer);
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        composer.setSize(initialViewport.width, initialViewport.height);

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(initialViewport.width, initialViewport.height),
            glowSettings.strength,
            glowSettings.radius,
            glowSettings.threshold
        );
        composer.addPass(bloomPass);

        const rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms.amount.value = chromaticSettings.intensity;
        rgbShiftPass.uniforms.angle.value = chromaticSettings.angle;
        composer.addPass(rgbShiftPass);

        const gradePass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uContrast: { value: chromaticSettings.contrast },
                uExposure: { value: chromaticSettings.whiteExposure }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uContrast;
                uniform float uExposure;
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    color.rgb *= uExposure;
                    color.rgb = (color.rgb - 0.5) * uContrast + 0.5;
                    gl_FragColor = color;
                }
            `
        });
        composer.addPass(gradePass);

        const gradientMapPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uAmount: { value: gradientMapSettings.amount },
                uSmoothness: { value: gradientMapSettings.smoothness },
                uStopCount: { value: gradientMapSettings.stops.length },
                uStopColors: { value: Array.from({ length: 8 }, () => new THREE.Color('#000000')) },
                uStopPositions: { value: new Array(8).fill(0) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uAmount;
                uniform float uSmoothness;
                uniform int uStopCount;
                uniform vec3 uStopColors[8];
                uniform float uStopPositions[8];
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

                    vec3 mapped = uStopColors[0];
                    vec3 lastColor = uStopColors[0];
                    float lastPosition = uStopPositions[0];
                    for (int j = 1; j < 8; j++) {
                        if (j >= uStopCount) {
                            break;
                        }
                        lastColor = uStopColors[j];
                        lastPosition = uStopPositions[j];
                    }

                    if (luma <= uStopPositions[0]) {
                        color.rgb = mix(color.rgb, uStopColors[0], uAmount);
                        gl_FragColor = color;
                        return;
                    }

                    if (luma >= lastPosition) {
                        color.rgb = mix(color.rgb, lastColor, uAmount);
                        gl_FragColor = color;
                        return;
                    }

                    for (int i = 0; i < 7; i++) {
                        if (i >= uStopCount - 1) {
                            break;
                        }

                        float left = uStopPositions[i];
                        float right = max(uStopPositions[i + 1], left + 0.0001);
                        if (luma >= left && luma <= right) {
                            float localT = clamp((luma - left) / (right - left), 0.0, 1.0);
                            float smoothT = localT * localT * (3.0 - 2.0 * localT);
                            float finalT = mix(localT, smoothT, uSmoothness);
                            mapped = mix(uStopColors[i], uStopColors[i + 1], finalT);
                            break;
                        }
                    }

                    color.rgb = mix(color.rgb, mapped, uAmount);
                    gl_FragColor = color;
                }
            `
        });
        gradientMapPass.enabled = gradientMapSettings.enabled;
        composer.addPass(gradientMapPass);

        const imageFilterPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uEnabled: { value: imageFilterSettings.enabled ? 1.0 : 0.0 },
                uAffectBackground: { value: imageFilterSettings.affectBackground ? 1.0 : 0.0 },
                uAmount: { value: imageFilterSettings.amount },
                uShadowColor: { value: new THREE.Color('#0b0b0b') },
                uMidColor: { value: new THREE.Color('#9a9a9a') },
                uHighlightColor: { value: new THREE.Color('#ffffff') },
                uContrast: { value: 1.0 },
                uSaturation: { value: 0.0 },
                uExposure: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uEnabled;
                uniform float uAffectBackground;
                uniform float uAmount;
                uniform vec3 uShadowColor;
                uniform vec3 uMidColor;
                uniform vec3 uHighlightColor;
                uniform float uContrast;
                uniform float uSaturation;
                uniform float uExposure;
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    if (uEnabled < 0.5 || uAmount <= 0.001) {
                        gl_FragColor = color;
                        return;
                    }

                    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    vec3 grade = mix(uShadowColor, uMidColor, smoothstep(0.0, 0.58, luma));
                    grade = mix(grade, uHighlightColor, smoothstep(0.42, 1.0, luma));

                    vec3 graded = color.rgb * grade * uExposure;
                    graded = (graded - 0.5) * uContrast + 0.5;
                    float gray = dot(graded, vec3(0.299, 0.587, 0.114));
                    graded = mix(vec3(gray), graded, uSaturation);

                    float subjectMask = smoothstep(0.018, 0.12, luma);
                    float filterMask = mix(subjectMask, 1.0, uAffectBackground);
                    vec3 filtered = mix(color.rgb, clamp(graded, 0.0, 1.0), uAmount);
                    color.rgb = mix(color.rgb, filtered, filterMask);
                    gl_FragColor = color;
                }
            `
        });
        imageFilterPass.enabled = true;
        composer.addPass(imageFilterPass);

        const pixelScanPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uTime: { value: 0 },
                uDelay: { value: pixelScanIntroSettings.delay },
                uDuration: { value: pixelScanIntroSettings.duration },
                uWidth: { value: pixelScanIntroSettings.width },
                uPixelSize: { value: pixelScanIntroSettings.pixelSize },
                uIntensity: { value: pixelScanIntroSettings.intensity },
                uMode: { value: pixelScanIntroSettings.mode },
                uResolution: { value: new THREE.Vector2(initialViewport.width, initialViewport.height) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float uTime;
                uniform float uDelay;
                uniform float uDuration;
                uniform float uWidth;
                uniform float uPixelSize;
                uniform float uIntensity;
                uniform float uMode;
                uniform vec2 uResolution;
                varying vec2 vUv;

                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }

                float scanRange(vec2 uv) {
                    if (uMode < 0.5) {
                        return uv.x;
                    }

                    if (uMode < 1.5) {
                        return 1.0 - uv.y;
                    }

                    vec2 centered = uv - 0.5;
                    centered.x *= uResolution.x / max(uResolution.y, 1.0);
                    return length(centered) * 1.35;
                }

                void main() {
                    vec4 base = texture2D(tDiffuse, vUv);
                    float progress = clamp((uTime - uDelay) / max(uDuration, 0.001), 0.0, 1.0);

                    if (progress >= 0.995) {
                        gl_FragColor = base;
                        return;
                    }

                    float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
                    float subjectMask = smoothstep(0.025, 0.16, luma);
                    vec2 cell = floor(vUv * uResolution / max(uPixelSize, 1.0));
                    float rnd = hash(cell);
                    float range = scanRange(vUv);
                    float jitter = (rnd - 0.5) * uWidth * 0.92;

                    float reveal = 1.0 - smoothstep(progress - uWidth, progress + 0.035, range + jitter);
                    reveal *= subjectMask;

                    float scanCore = 1.0 - smoothstep(0.0, uWidth, abs(range + jitter - progress));
                    float cellBlink = smoothstep(0.42, 0.98, hash(cell + floor(uTime * 18.0)));
                    float pixelEdge = scanCore * subjectMask * (0.55 + rnd * 0.7);

                    vec3 pixelColor = mix(vec3(0.78), vec3(1.0), cellBlink);
                    vec3 color = base.rgb * reveal;
                    color += pixelColor * pixelEdge * uIntensity * (1.0 - reveal * 0.35);

                    gl_FragColor = vec4(color, base.a);
                }
            `
        });
        pixelScanPass.enabled = pixelScanIntroSettings.enabled;
        composer.addPass(pixelScanPass);

        const edgeSmoothPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new THREE.Vector2(1 / initialViewport.width, 1 / initialViewport.height) },
                uStrength: { value: edgeSmoothSettings.strength }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                uniform float uStrength;
                varying vec2 vUv;

                #define FXAA_REDUCE_MIN (1.0 / 128.0)
                #define FXAA_REDUCE_MUL (1.0 / 8.0)
                #define FXAA_SPAN_MAX 8.0

                void main() {
                    vec4 original = texture2D(tDiffuse, vUv);

                    vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * resolution).xyz;
                    vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * resolution).xyz;
                    vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * resolution).xyz;
                    vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * resolution).xyz;
                    vec3 rgbM = original.xyz;
                    vec3 luma = vec3(0.299, 0.587, 0.114);

                    float lumaNW = dot(rgbNW, luma);
                    float lumaNE = dot(rgbNE, luma);
                    float lumaSW = dot(rgbSW, luma);
                    float lumaSE = dot(rgbSE, luma);
                    float lumaM = dot(rgbM, luma);
                    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
                    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

                    vec2 dir;
                    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
                    dir.y = ((lumaNW + lumaSW) - (lumaNE + lumaSE));

                    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
                    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
                    dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * resolution;

                    vec3 rgbA = 0.5 * (
                        texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).xyz +
                        texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).xyz
                    );
                    vec3 rgbB = rgbA * 0.5 + 0.25 * (
                        texture2D(tDiffuse, vUv + dir * -0.5).xyz +
                        texture2D(tDiffuse, vUv + dir * 0.5).xyz
                    );

                    float lumaB = dot(rgbB, luma);
                    vec3 smoothed = (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;
                    gl_FragColor = vec4(mix(original.rgb, smoothed, uStrength), original.a);
                }
            `
        });
        edgeSmoothPass.enabled = edgeSmoothSettings.enabled;
        composer.addPass(edgeSmoothPass);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const textureLoader = new THREE.TextureLoader();
        const roomEnvironment = new RoomEnvironment();
        const defaultEnvironmentTexture = pmremGenerator.fromScene(roomEnvironment).texture;
        scene.environment = defaultEnvironmentTexture;

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
        dirLight1.position.set(10, 20, 10);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xffffff, 1);
        dirLight2.position.set(-10, -10, 10);
        scene.add(dirLight2);

        // --- LIQUID METAL MATERIAL ---
        const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
        dummyTex.needsUpdate = true;

        const liquidMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xeeeeee,       
            metalness: 0.855,
            roughness: 0.369,       
            clearcoat: 0.418,        
            clearcoatRoughness: 0.03,
            iridescence: 0.237,      
            iridescenceIOR: 1.82,   
            iridescenceThicknessRange: [183, 886.5], 
            iridescenceThicknessMap: dummyTex,
            transmission: 0.46,
            thickness: 3.56,
            ior: 2.2,
            reflectivity: 0.59,
            envMapIntensity: 0.0,
            specularIntensity: 1.0,
            attenuationDistance: 0.93,
            attenuationColor: new THREE.Color('#e8fafd'),
            dithering: true // CRITICAL FIX: Eliminates 8-bit color banding/staircasing in subtle gradients!
        });

        const baseMaterialSnapshot = {
            metalness: liquidMaterial.metalness,
            reflectivity: liquidMaterial.reflectivity,
            envMapIntensity: liquidMaterial.envMapIntensity,
            clearcoat: liquidMaterial.clearcoat,
            iridescence: liquidMaterial.iridescence
        };

        const glassSettings = {
            enabled: false,
            transmission: liquidMaterial.transmission,
            thickness: liquidMaterial.thickness,
            ior: liquidMaterial.ior,
            reflectivity: liquidMaterial.reflectivity,
            envMapIntensity: liquidMaterial.envMapIntensity,
            attenuationDistance: liquidMaterial.attenuationDistance,
            attenuationColor: '#e8fafd'
        };

        const structureFillSettings = {
            enabled: false,
            color: '#cfd2d4',
            strength: 0.75
        };

        const bevelSettings = {
            enableBevelDynamics: false,
            bevelSize: 4.6,
            bevelThickness: 2.5,
            bevelSegments: 96,
            bevelFlowInfluence: 1.17
        };

        const environmentTextureSettings = {
            enabled: false,
            affectLogo: false,
            affectBackground: true,
            envIntensity: 1.51,
            uploadTexture: () => { textureInput.click(); },
            clearTexture: () => {
                if (uploadedEnvironmentTexture) {
                    uploadedEnvironmentTexture.dispose();
                    uploadedEnvironmentTexture = null;
                }
                if (uploadedEnvironmentTarget) {
                    uploadedEnvironmentTarget.dispose();
                    uploadedEnvironmentTarget = null;
                }
                environmentTextureSettings.enabled = false;
                environmentTextureSettings.affectLogo = false;
                environmentTextureSettings.affectBackground = false;
                applyEnvironmentTextureState();
                for (const controller of environmentFolder.controllers) {
                    controller.updateDisplay();
                }
            }
        };

        let uploadedEnvironmentTexture = null;
        let uploadedEnvironmentTarget = null;

        function applyEnvironmentTextureState() {
            const hasUploadedEnvironment = Boolean(uploadedEnvironmentTarget);

            if (environmentTextureSettings.enabled && hasUploadedEnvironment) {
                scene.environment = uploadedEnvironmentTarget.texture;
                if (environmentTextureSettings.affectBackground) {
                    scene.background = uploadedEnvironmentTexture;
                } else {
                    scene.background = new THREE.Color(sceneSettings.bgColor);
                }
            } else {
                scene.environment = defaultEnvironmentTexture;
                scene.background = new THREE.Color(sceneSettings.bgColor);
            }

            liquidMaterial.envMapIntensity = glassSettings.enabled
                ? glassSettings.envMapIntensity
                : environmentTextureSettings.envIntensity;

            if (environmentTextureSettings.enabled && environmentTextureSettings.affectLogo && uploadedEnvironmentTexture) {
                liquidMaterial.map = uploadedEnvironmentTexture;
                liquidMaterial.needsUpdate = true;
            } else if (liquidMaterial.map) {
                liquidMaterial.map = null;
                liquidMaterial.needsUpdate = true;
            }
        }

        function loadEnvironmentTextureFromDataUrl(dataUrl) {
            textureLoader.load(dataUrl, (texture) => {
                if (uploadedEnvironmentTexture) {
                    uploadedEnvironmentTexture.dispose();
                }
                if (uploadedEnvironmentTarget) {
                    uploadedEnvironmentTarget.dispose();
                }

                texture.colorSpace = THREE.SRGBColorSpace;
                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.needsUpdate = true;

                uploadedEnvironmentTexture = texture;
                uploadedEnvironmentTarget = pmremGenerator.fromEquirectangular(texture);
                applyEnvironmentTextureState();
            });
        }

        liquidMaterial.userData = {
            uTime: { value: 0 },
            uLoopDuration: { value: 30.0 },
            uSpeed: { value: 0.0 },         
            uScale: { value: 0.0001 },       
            uDistortion: { value: 0.485 },    
            uEdgeProtection: { value: 0.138 }, 
            uShapeReactivity: { value: 0.32 },
            uBevelFlowMix: { value: 0.0 },
            uStructureFillEnabled: { value: 0.0 },
            uStructureFillColor: { value: new THREE.Color(structureFillSettings.color) },
            uStructureFillStrength: { value: structureFillSettings.strength },
            uShapeMask: { value: dummyTex },
            uShapeBounds: { value: new THREE.Vector4(0,0,1,1) }
        };

        const fluidPlaybackSettings = {
            paused: false,
            frame: 0.0
        };
        let fluidRenderTime = 0.0;
        const fluidLoopDuration = liquidMaterial.userData.uLoopDuration.value;

        liquidMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = liquidMaterial.userData.uTime;
            shader.uniforms.uLoopDuration = liquidMaterial.userData.uLoopDuration;
            shader.uniforms.uSpeed = liquidMaterial.userData.uSpeed;
            shader.uniforms.uScale = liquidMaterial.userData.uScale;
            shader.uniforms.uDistortion = liquidMaterial.userData.uDistortion;
            shader.uniforms.uEdgeProtection = liquidMaterial.userData.uEdgeProtection;
            shader.uniforms.uShapeReactivity = liquidMaterial.userData.uShapeReactivity;
            shader.uniforms.uBevelFlowMix = liquidMaterial.userData.uBevelFlowMix;
            shader.uniforms.uStructureFillEnabled = liquidMaterial.userData.uStructureFillEnabled;
            shader.uniforms.uStructureFillColor = liquidMaterial.userData.uStructureFillColor;
            shader.uniforms.uStructureFillStrength = liquidMaterial.userData.uStructureFillStrength;
            shader.uniforms.uShapeMask = liquidMaterial.userData.uShapeMask;
            shader.uniforms.uShapeBounds = liquidMaterial.userData.uShapeBounds;

            shader.vertexShader = `
                varying vec3 vWorldPos;
                varying vec3 vLocalPos;
                varying vec3 vOriginalNormal;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vLocalPos = position;
                vOriginalNormal = normal; 
                `
            );

            shader.fragmentShader = `
                uniform float uTime;
                uniform float uLoopDuration;
                uniform float uSpeed;
                uniform float uScale;
                uniform float uDistortion;
                uniform float uEdgeProtection;
                uniform float uShapeReactivity;
                uniform float uBevelFlowMix;
                uniform float uStructureFillEnabled;
                uniform vec3 uStructureFillColor;
                uniform float uStructureFillStrength;
                
                uniform sampler2D uShapeMask;
                uniform vec4 uShapeBounds;
                
                varying vec3 vWorldPos;
                varying vec3 vLocalPos;
                varying vec3 vOriginalNormal;
                
                float vFluidNoise; 
                
                ${simplex3D}
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_begin>',
                `
                #include <normal_fragment_begin>

                vec2 shapeUV = (vLocalPos.xy - uShapeBounds.xy) / uShapeBounds.zw;
                
                // --- RENDER QUALITY FIX: 5-TAP BLUR FOR SMOOTH DISTANCE FIELD ---
                // By sampling the 8-bit Canvas mask multiple times, we smooth out the quantized "steps" (лесенки)
                // ensuring perfectly smooth normal transitions and iridescence reflections.
                vec2 texEps = vec2(4.0 / 1024.0);
                float maskC = texture2D(uShapeMask, shapeUV).r;
                float maskR = texture2D(uShapeMask, shapeUV + vec2(texEps.x, 0.0)).r;
                float maskL = texture2D(uShapeMask, shapeUV - vec2(texEps.x, 0.0)).r;
                float maskT = texture2D(uShapeMask, shapeUV + vec2(0.0, texEps.y)).r;
                float maskB = texture2D(uShapeMask, shapeUV - vec2(0.0, texEps.y)).r;
                
                float smoothDist = (maskC + maskR + maskL + maskT + maskB) * 0.2;
                float bevelRedirect = 1.0 - smoothstep(0.18, 0.82, smoothDist);
                
                // Smoothed gradient using central difference
                vec2 maskGrad = vec2(maskR - maskL, maskT - maskB) / (2.0 * texEps.x);

                vec3 p = vLocalPos * uScale;
                
                // Shape aware inflation
                p.z += smoothDist * uShapeReactivity * 150.0 * uScale;

                float loopPhase = (uTime / max(uLoopDuration, 0.001)) * 6.28318530718;
                vec2 loopOrbit = vec2(cos(loopPhase), sin(loopPhase));
                vec2 loopOrbitDetail = vec2(cos(loopPhase * 2.0 + 0.9), sin(loopPhase * 2.0 + 0.9));
                vec3 loopVecA = vec3(loopOrbit * 0.95, sin(loopPhase * 2.0) * 0.75);
                vec3 loopVecB = vec3(loopOrbitDetail * 0.8, cos(loopPhase * 2.0 + 1.7) * 0.7);
                
                // Flow along contours
                vec2 contourTangent = vec2(-maskGrad.y, maskGrad.x);
                float contourFlow = 0.5 + bevelRedirect * uBevelFlowMix * 1.6;
                p.xy += contourTangent * (loopOrbit.x * uSpeed * contourFlow * 7.5);
                p.xy += loopOrbitDetail * (uSpeed * 0.75);
                p.y -= loopOrbit.y * uSpeed * 0.85;
                
                // Domain Warping
                vec3 warp;
                warp.x = snoise(p + loopVecA);
                warp.y = snoise(p + vec3(114.5, 22.1, 0.0) + loopVecB);
                warp.z = snoise(p + vec3(233.2, 51.5, 0.0) + vec3(loopOrbit * 0.72, sin(loopPhase * 3.0) * 0.52));
                vec3 warpedP = p + warp * 1.5; 
                
                // Calculate analytical normal
                // Increased epsilon (from 0.01 to 0.03) to average out micro-aliasing on the 3D noise
                float eps = 0.03; 
                float n0 = snoise(warpedP);
                float nx = snoise(warpedP + vec3(eps, 0.0, 0.0));
                float ny = snoise(warpedP + vec3(0.0, eps, 0.0));
                float nz = snoise(warpedP + vec3(0.0, 0.0, eps));
                
                vFluidNoise = n0 + (smoothDist * uShapeReactivity * 2.0); 
                
                vec3 noiseNormal = normalize(vec3(nx - n0, ny - n0, nz - n0));
                vec3 viewNoiseNormal = normalize((viewMatrix * vec4(noiseNormal, 0.0)).xyz);
                
                float isFlatFace = smoothstep(0.1, 0.9, abs(vOriginalNormal.z));
                float edgeMask = mix(1.0, isFlatFace, uEdgeProtection);

                float bevelNormalMix = 1.0 - bevelRedirect * uBevelFlowMix * 0.45;
                normal = normalize(normal + viewNoiseNormal * uDistortion * edgeMask * bevelNormalMix);
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                /texture2D\(\s*iridescenceThicknessMap\s*,\s*vIridescenceThicknessMapUv\s*\)/g,
                'vec4(vFluidNoise * 0.5 + 0.5)' 
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `
                float structureFillMask = clamp(uStructureFillEnabled, 0.0, 1.0);
                float structureDarkness = 1.0 - max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b);
                vec3 structureFill = uStructureFillColor * structureDarkness * uStructureFillStrength;
                outgoingLight = mix(outgoingLight, max(outgoingLight, structureFill), structureFillMask);
                #include <opaque_fragment>
                `
            );
        };

        // --- DYNAMIC SHAPE MASK GENERATOR ---
        function generateShapeMaskTexture(shapes) {
            const bounds = new THREE.Box2();
            for(const shape of shapes) {
                const pts = shape.getPoints();
                for(const pt of pts) bounds.expandByPoint(pt);
            }

            const width = bounds.max.x - bounds.min.x;
            const height = bounds.max.y - bounds.min.y;
            const maxDim = Math.max(width, height);
            
            const pad = maxDim * 0.25; 
            const paddedMinX = bounds.min.x - pad;
            const paddedMinY = bounds.min.y - pad;
            const paddedWidth = width + pad * 2;
            const paddedHeight = height + pad * 2;

            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / paddedWidth;
            const scaleY = canvas.height / paddedHeight;

            ctx.save();
            ctx.filter = 'blur(45px)'; 
            ctx.fillStyle = 'white';
            
            ctx.scale(scaleX, scaleY);
            ctx.translate(-paddedMinX, -paddedMinY);

            ctx.beginPath();
            for(const shape of shapes) {
                const pts = shape.getPoints(100);
                if(pts.length) {
                    ctx.moveTo(pts.x, pts.y);
                    for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                }
                for(const hole of shape.holes) {
                    const hPts = hole.getPoints(100);
                    if(hPts.length) {
                        ctx.moveTo(hPts[0].x, hPts[0].y);
                        for(let i=1; i<hPts.length; i++) ctx.lineTo(hPts[i].x, hPts[i].y);
                    }
                }
            }
            ctx.fill('evenodd'); 
            ctx.restore();

            const tex = new THREE.CanvasTexture(canvas);
            tex.flipY = false; 
            
            liquidMaterial.userData.uShapeMask.value = tex;
            liquidMaterial.userData.uShapeBounds.value.set(paddedMinX, paddedMinY, paddedWidth, paddedHeight);
        }

        // --- SVG HANDLING ---
        const geometrySettings = {
            depth: 200.0,
            bevelEnabled: true,
            bevelSegments: bevelSettings.bevelSegments,
            steps: 2,
            bevelSize: bevelSettings.bevelSize,
            bevelThickness: bevelSettings.bevelThickness
        };

        const svgGroup = new THREE.Group();
        const svgContent = new THREE.Group();
        svgGroup.add(svgContent);
        scene.add(svgGroup);
        const svgLoader = new SVGLoader();
        let currentSVGData = null;

        function downloadDataUrl(dataUrl, filename) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        function downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function getSupportedVideoMimeTypes() {
            return [
                'video/mp4;codecs=avc1.42E01E',
                'video/mp4',
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm'
            ].filter((type) => MediaRecorder.isTypeSupported(type));
        }

        function export360Video() {
            if (export360State.active) return;
            if (!renderer.domElement.captureStream || !window.MediaRecorder) {
                alert('Tu navegador no soporta grabacion de video desde canvas.');
                return;
            }

            const mimeTypes = getSupportedVideoMimeTypes();
            if (!mimeTypes.length) {
                alert('Tu navegador no tiene un formato de video compatible para exportar.');
                return;
            }

            const stream = renderer.domElement.captureStream(export360Settings.fps);
            const chunks = [];
            let mimeType = '';
            let recorder = null;

            for (const candidate of mimeTypes) {
                try {
                    recorder = new MediaRecorder(stream, {
                        mimeType: candidate,
                        videoBitsPerSecond: export360Settings.qualityMbps * 1000000
                    });
                    mimeType = candidate;
                    break;
                } catch (error) {
                    recorder = null;
                }
            }

            if (!recorder) {
                stream.getTracks().forEach((track) => track.stop());
                alert('No se pudo iniciar la grabacion de video en este navegador.');
                return;
            }

            export360State.active = true;
            export360State.startTime = performance.now();
            export360State.durationMs = export360Settings.duration * 1000;
            export360State.initialRotationY = 0;
            export360State.clockwise = export360Settings.clockwise;
            export360State.cameraPosition.copy(camera.position);
            export360State.cameraQuaternion.copy(camera.quaternion);
            export360State.controlsTarget.copy(controls.target);

            svgGroup.rotation.set(0, 0, 0);
            camera.position.set(0, compositionSettings.verticalOffset, compositionSettings.cameraDistance);
            controls.target.set(0, compositionSettings.verticalOffset, 0);
            controls.update();

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                export360State.active = false;
                svgGroup.rotation.y = export360State.initialRotationY;
                camera.position.copy(export360State.cameraPosition);
                camera.quaternion.copy(export360State.cameraQuaternion);
                controls.target.copy(export360State.controlsTarget);
                controls.update();
                stream.getTracks().forEach((track) => track.stop());

                const blob = new Blob(chunks, { type: mimeType });
                const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
                downloadBlob(blob, `deushima-360.${extension}`);
            };

            recorder.start();
            setTimeout(() => {
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }
            }, export360State.durationMs + 120);
        }

        function exportPNG({ transparent = false } = {}) {
            const originalBackground = scene.background;
            const originalClearAlpha = renderer.getClearAlpha();

            if (transparent) {
                scene.background = null;
                renderer.setClearAlpha(0);
            } else {
                scene.background = new THREE.Color(sceneSettings.bgColor);
                renderer.setClearAlpha(1);
            }

            composer.render();

            const suffix = transparent ? 'transparent' : 'background';
            const dataUrl = renderer.domElement.toDataURL('image/png');
            downloadDataUrl(dataUrl, `deushima-${suffix}.png`);

            scene.background = originalBackground;
            renderer.setClearAlpha(originalClearAlpha);
            composer.render();
        }

        function applyChromaticPreset(preset) {
            const presets = {
                subtle: { intensity: 0.0006, angle: 0.0 },
                balanced: { intensity: 0.0021, angle: 1.48 },
                prism: { intensity: 0.0024, angle: 0.8 },
                glitch: { intensity: 0.0042, angle: 1.57 }
            };
            const next = presets[preset] || presets.balanced;
            chromaticSettings.intensity = next.intensity;
            chromaticSettings.angle = next.angle;
            rgbShiftPass.uniforms.amount.value = chromaticSettings.enabled ? next.intensity : 0.0;
            rgbShiftPass.uniforms.angle.value = next.angle;
            for (const controller of chromaticFolder.controllers) {
                controller.updateDisplay();
            }
        }

        function applyGlowState() {
            bloomPass.enabled = glowSettings.enabled;
            bloomPass.strength = glowSettings.enabled ? glowSettings.strength : 0.0;
        }

        function applyChromaticState() {
            rgbShiftPass.enabled = chromaticSettings.enabled;
            rgbShiftPass.uniforms.amount.value = chromaticSettings.enabled ? chromaticSettings.intensity : 0.0;
            rgbShiftPass.uniforms.angle.value = chromaticSettings.angle;
            gradePass.uniforms.uContrast.value = chromaticSettings.contrast;
            gradePass.uniforms.uExposure.value = chromaticSettings.whiteExposure;
        }

        function applyEdgeSmoothState() {
            edgeSmoothPass.enabled = edgeSmoothSettings.enabled;
            edgeSmoothPass.uniforms.uStrength.value = edgeSmoothSettings.strength;
        }

        function applyGradientMapState() {
            const orderedStops = getOrderedGradientStops();

            gradientMapPass.enabled = gradientMapSettings.enabled;
            gradientMapPass.uniforms.uAmount.value = gradientMapSettings.amount;
            gradientMapPass.uniforms.uSmoothness.value = gradientMapSettings.smoothness;
            gradientMapPass.uniforms.uStopCount.value = orderedStops.length;

            for (let i = 0; i < 8; i++) {
                const stop = orderedStops[i] || orderedStops[orderedStops.length - 1] || gradientMapSettings.stops[0];
                gradientMapPass.uniforms.uStopColors.value[i].set(stop.color);
                gradientMapPass.uniforms.uStopPositions.value[i] = stop.position;
            }
        }

        let imageFiltersRoot = null;

        function getImageFilterPreset(presetId = imageFilterSettings.selected) {
            return imageFilterPresets.find((preset) => preset.id === presetId) || imageFilterPresets[0];
        }

        function applyImageFilterState() {
            const preset = getImageFilterPreset();
            imageFilterPass.uniforms.uEnabled.value = imageFilterSettings.enabled ? 1.0 : 0.0;
            imageFilterPass.uniforms.uAffectBackground.value = imageFilterSettings.affectBackground ? 1.0 : 0.0;
            imageFilterPass.uniforms.uAmount.value = imageFilterSettings.amount;
            imageFilterPass.uniforms.uShadowColor.value.set(preset.shadows);
            imageFilterPass.uniforms.uMidColor.value.set(preset.midtones);
            imageFilterPass.uniforms.uHighlightColor.value.set(preset.highlights);
            imageFilterPass.uniforms.uContrast.value = preset.contrast;
            imageFilterPass.uniforms.uSaturation.value = preset.saturation;
            imageFilterPass.uniforms.uExposure.value = preset.exposure;
        }

        function selectImageFilterPreset(presetId) {
            imageFilterSettings.selected = presetId;
            imageFilterSettings.enabled = true;
            applyImageFilterState();
            renderImageFilterPresetsUI();
            for (const controller of imageFiltersFolder.controllers) {
                controller.updateDisplay();
            }
        }

        function renderImageFilterPresetsUI() {
            if (!imageFiltersRoot) return;

            imageFiltersRoot.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'image-filter-grid';

            imageFilterPresets.forEach((preset) => {
                const card = document.createElement('div');
                card.setAttribute('role', 'button');
                card.tabIndex = 0;
                card.className = `image-filter-card${preset.id === imageFilterSettings.selected ? ' is-active' : ''}`;
                card.style.setProperty('--filter-preview', preset.preview);
                card.innerHTML = `
                    <span class="image-filter-preview"></span>
                    <span class="image-filter-name">${preset.name}</span>
                `;
                card.addEventListener('click', () => selectImageFilterPreset(preset.id));
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectImageFilterPreset(preset.id);
                    }
                });
                grid.appendChild(card);
            });

            imageFiltersRoot.appendChild(grid);
        }

        let gradientStopSerial = 0;
        let gradientStopsRoot = null;
        let activeGradientDragId = null;
        let activeInlineColorControl = null;

        function clamp01(value) {
            return Math.min(1, Math.max(0, value));
        }

        function getOrderedGradientStops() {
            return [...gradientMapSettings.stops]
                .sort((a, b) => a.position - b.position)
                .slice(0, 8);
        }

        function getGradientStopById(stopId = gradientMapSettings.selectedStopId) {
            return gradientMapSettings.stops.find((stop) => stop.id === stopId) || null;
        }

        function ensureGradientSelection() {
            const selectedStop = getGradientStopById();
            if (selectedStop) return selectedStop;

            const fallbackStop = getOrderedGradientStops()[0] || null;
            gradientMapSettings.selectedStopId = fallbackStop?.id || null;
            return fallbackStop;
        }

        function formatGradientPercent(position) {
            return `${Math.round(clamp01(position) * 100)}%`;
        }

        function colorToHexString(value) {
            return `#${new THREE.Color(value).getHexString()}`;
        }

        function normalizeHexColor(value, fallback = '#ffffff') {
            try {
                return colorToHexString(value || fallback);
            } catch (error) {
                return fallback;
            }
        }

        function hexToRgb(value) {
            const hex = normalizeHexColor(value).slice(1);
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }

        function rgbToHsv({ r, g, b }) {
            const rr = r / 255;
            const gg = g / 255;
            const bb = b / 255;
            const max = Math.max(rr, gg, bb);
            const min = Math.min(rr, gg, bb);
            const delta = max - min;
            let h = 0;

            if (delta !== 0) {
                if (max === rr) h = ((gg - bb) / delta) % 6;
                else if (max === gg) h = (bb - rr) / delta + 2;
                else h = (rr - gg) / delta + 4;
                h *= 60;
                if (h < 0) h += 360;
            }

            return {
                h,
                s: max === 0 ? 0 : delta / max,
                v: max
            };
        }

        function hsvToHex({ h, s, v }) {
            const c = v * s;
            const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            const m = v - c;
            let rgb = [0, 0, 0];

            if (h < 60) rgb = [c, x, 0];
            else if (h < 120) rgb = [x, c, 0];
            else if (h < 180) rgb = [0, c, x];
            else if (h < 240) rgb = [0, x, c];
            else if (h < 300) rgb = [x, 0, c];
            else rgb = [c, 0, x];

            return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
        }

        function setColorInputValue(input, color, eventType = 'input') {
            input.value = normalizeHexColor(color);
            input.dispatchEvent(new Event(eventType, { bubbles: true }));
        }

        function closeInlineColorPicker() {
            if (!activeInlineColorControl) return;
            activeInlineColorControl.root.classList.remove('is-open');
            activeInlineColorControl.panel.hidden = true;
            activeInlineColorControl = null;
        }

        function syncInlineColorControl(control, color = control.input.value) {
            const hex = normalizeHexColor(color);
            const hsv = rgbToHsv(hexToRgb(hex));
            control.swatch.style.background = hex;
            control.hex.value = hex.toUpperCase();
            control.hue.value = Math.round(hsv.h);
            control.sv.style.setProperty('--picker-hue', `hsl(${hsv.h}, 100%, 50%)`);
            control.svHandle.style.left = `${hsv.s * 100}%`;
            control.svHandle.style.top = `${(1 - hsv.v) * 100}%`;
        }

        function createInlineColorControl(input) {
            if (input.dataset.inlineColorEnhanced === 'true') return null;
            input.dataset.inlineColorEnhanced = 'true';
            input.tabIndex = -1;

            const root = document.createElement('div');
            root.className = 'inline-color-control';
            root.innerHTML = `
                <button type="button" class="inline-color-button" title="Editar color">
                    <span class="inline-color-swatch"></span>
                    <span class="inline-color-value"></span>
                </button>
                <div class="inline-color-panel" hidden>
                    <div class="inline-color-sv"><span class="inline-color-sv-handle"></span></div>
                    <input class="inline-color-hue" type="range" min="0" max="360" step="1" value="0">
                    <input class="inline-color-hex" type="text" maxlength="7" spellcheck="false">
                </div>
            `;

            input.insertAdjacentElement('afterend', root);
            root.appendChild(input);

            const control = {
                input,
                root,
                button: root.querySelector('.inline-color-button'),
                swatch: root.querySelector('.inline-color-swatch'),
                value: root.querySelector('.inline-color-value'),
                panel: root.querySelector('.inline-color-panel'),
                sv: root.querySelector('.inline-color-sv'),
                svHandle: root.querySelector('.inline-color-sv-handle'),
                hue: root.querySelector('.inline-color-hue'),
                hex: root.querySelector('.inline-color-hex')
            };

            control.value.textContent = normalizeHexColor(input.value).toUpperCase();

            const applyFromHsv = (hsv) => {
                const hex = hsvToHex(hsv);
                control.value.textContent = hex.toUpperCase();
                syncInlineColorControl(control, hex);
                setColorInputValue(input, hex);
            };

            const readCurrentHsv = () => rgbToHsv(hexToRgb(input.value));

            control.button.addEventListener('click', (event) => {
                event.stopPropagation();
                if (activeInlineColorControl && activeInlineColorControl !== control) closeInlineColorPicker();
                activeInlineColorControl = control;
                control.root.classList.toggle('is-open');
                control.panel.hidden = !control.root.classList.contains('is-open');
                if (!control.panel.hidden) syncInlineColorControl(control);
            });

            control.hue.addEventListener('input', () => {
                const hsv = readCurrentHsv();
                hsv.h = Number(control.hue.value);
                applyFromHsv(hsv);
            });

            control.hex.addEventListener('input', () => {
                if (!/^#[0-9a-fA-F]{6}$/.test(control.hex.value)) return;
                const hex = normalizeHexColor(control.hex.value);
                control.value.textContent = hex.toUpperCase();
                syncInlineColorControl(control, hex);
                setColorInputValue(input, hex);
            });

            const pickSaturationValue = (event) => {
                const rect = control.sv.getBoundingClientRect();
                const hsv = readCurrentHsv();
                hsv.s = clamp01((event.clientX - rect.left) / Math.max(rect.width, 1));
                hsv.v = 1 - clamp01((event.clientY - rect.top) / Math.max(rect.height, 1));
                applyFromHsv(hsv);
            };

            control.sv.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                pickSaturationValue(event);
                control.sv.setPointerCapture(event.pointerId);
                const onMove = (moveEvent) => pickSaturationValue(moveEvent);
                const onUp = () => {
                    control.sv.removeEventListener('pointermove', onMove);
                    control.sv.removeEventListener('pointerup', onUp);
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                };
                control.sv.addEventListener('pointermove', onMove);
                control.sv.addEventListener('pointerup', onUp);
            });

            input.addEventListener('input', () => {
                const hex = normalizeHexColor(input.value);
                control.value.textContent = hex.toUpperCase();
                syncInlineColorControl(control, hex);
            });

            syncInlineColorControl(control);
            return control;
        }

        function enhanceInlineColorInputs(scope = controlsPanel) {
            scope?.querySelectorAll?.('input[type="color"]:not([data-inline-color-enhanced="true"])')
                .forEach((input) => createInlineColorControl(input));
        }

        function sampleGradientColorAt(position) {
            const orderedStops = getOrderedGradientStops();
            const clampedPosition = clamp01(position);
            if (!orderedStops.length) return '#ffffff';
            if (clampedPosition <= orderedStops[0].position) return colorToHexString(orderedStops[0].color);
            if (clampedPosition >= orderedStops[orderedStops.length - 1].position) return colorToHexString(orderedStops[orderedStops.length - 1].color);

            for (let index = 0; index < orderedStops.length - 1; index += 1) {
                const left = orderedStops[index];
                const right = orderedStops[index + 1];
                if (clampedPosition < left.position || clampedPosition > right.position) continue;

                const localT = clamp01((clampedPosition - left.position) / Math.max(right.position - left.position, 0.0001));
                const smoothT = localT * localT * (3 - 2 * localT);
                const finalT = THREE.MathUtils.lerp(localT, smoothT, gradientMapSettings.smoothness);
                const leftColor = new THREE.Color(left.color);
                const rightColor = new THREE.Color(right.color);
                return `#${leftColor.lerp(rightColor, finalT).getHexString()}`;
            }

            return colorToHexString(orderedStops[orderedStops.length - 1].color);
        }

        function buildGradientPreviewCss() {
            return `linear-gradient(90deg, ${getOrderedGradientStops().map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`).join(', ')})`;
        }

        function selectGradientStop(stopId) {
            gradientMapSettings.selectedStopId = stopId;
            renderGradientStopsUI();
        }

        function addGradientStop(position = 0.5) {
            if (gradientMapSettings.stops.length >= 8) {
                alert('Gradient Map permite hasta 8 colores.');
                return;
            }

            const stopId = `stop-${Date.now()}-${gradientStopSerial++}`;
            gradientMapSettings.stops.push({
                id: stopId,
                label: `Color ${gradientMapSettings.stops.length + 1}`,
                color: sampleGradientColorAt(position),
                position: clamp01(position)
            });
            gradientMapSettings.selectedStopId = stopId;
            renderGradientStopsUI();
            applyGradientMapState();
        }

        function removeGradientStop(stopId) {
            if (gradientMapSettings.stops.length <= 2) return;
            gradientMapSettings.stops = gradientMapSettings.stops.filter((stop) => stop.id !== stopId);
            const fallbackStop = getOrderedGradientStops()[Math.max(0, gradientMapSettings.stops.length - 1)] || gradientMapSettings.stops[0] || null;
            gradientMapSettings.selectedStopId = fallbackStop?.id || null;
            renderGradientStopsUI();
            applyGradientMapState();
        }

        function syncGradientEditorDom() {
            if (!gradientStopsRoot) return;
            const selectedStop = ensureGradientSelection();
            const previewBar = gradientStopsRoot.querySelector('.gradient-editor__bar');
            if (previewBar) previewBar.style.background = buildGradientPreviewCss();

            getOrderedGradientStops().forEach((stop) => {
                const stopButton = gradientStopsRoot.querySelector(`[data-gradient-stop="${stop.id}"]`);
                if (stopButton) {
                    stopButton.style.left = `${stop.position * 100}%`;
                    stopButton.style.setProperty('--stop-color', stop.color);
                    stopButton.classList.toggle('is-active', selectedStop?.id === stop.id);
                    stopButton.title = `${formatGradientPercent(stop.position)} - ${stop.color}`;
                }
            });

            const selectedNumber = gradientStopsRoot.querySelector('.gradient-editor__number');
            const selectedColor = gradientStopsRoot.querySelector('.gradient-editor__color');
            if (selectedStop && selectedNumber && document.activeElement !== selectedNumber) {
                selectedNumber.value = Math.round(selectedStop.position * 100);
            }
            if (selectedStop && selectedColor && selectedColor.value !== selectedStop.color) {
                selectedColor.value = selectedStop.color;
                selectedColor.dispatchEvent(new Event('input', { bubbles: false }));
            }
        }

        function updateGradientStopPosition(stopId, position, { render = true } = {}) {
            const stop = getGradientStopById(stopId);
            if (!stop) return;
            stop.position = clamp01(position);
            applyGradientMapState();
            if (render) renderGradientStopsUI();
            else syncGradientEditorDom();
        }

        function updateGradientStopColor(stopId, color, { render = true } = {}) {
            const stop = getGradientStopById(stopId);
            if (!stop) return;
            stop.color = colorToHexString(color);
            applyGradientMapState();
            if (render) renderGradientStopsUI();
            else syncGradientEditorDom();
        }

        function renderGradientStopsUI() {
            if (!gradientStopsRoot) return;
            ensureGradientSelection();
            const orderedStops = getOrderedGradientStops();
            const selectedStop = ensureGradientSelection();

            gradientStopsRoot.innerHTML = '';

            const editor = document.createElement('div');
            editor.className = 'gradient-editor';

            const editorHeader = document.createElement('div');
            editorHeader.className = 'gradient-editor__header';
            editorHeader.innerHTML = '<span>Editor de degradado</span><span>Click en la barra para agregar</span>';
            editor.appendChild(editorHeader);

            const previewWrap = document.createElement('div');
            previewWrap.className = 'gradient-editor__preview';

            const previewBar = document.createElement('div');
            previewBar.className = 'gradient-editor__bar';
            previewBar.style.background = buildGradientPreviewCss();
            previewBar.addEventListener('click', (event) => {
                if (event.target.closest('.gradient-editor__stop')) return;
                const rect = previewBar.getBoundingClientRect();
                addGradientStop((event.clientX - rect.left) / Math.max(rect.width, 1));
            });

            const stopsLayer = document.createElement('div');
            stopsLayer.className = 'gradient-editor__stops';

            orderedStops.forEach((stop) => {
                const stopButton = document.createElement('button');
                stopButton.type = 'button';
                stopButton.className = `gradient-editor__stop${selectedStop?.id === stop.id ? ' is-active' : ''}`;
                stopButton.dataset.gradientStop = stop.id;
                stopButton.style.left = `${stop.position * 100}%`;
                stopButton.style.setProperty('--stop-color', stop.color);
                stopButton.title = `${formatGradientPercent(stop.position)} - ${stop.color}`;
                stopButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    selectGradientStop(stop.id);
                });
                stopButton.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    activeGradientDragId = stop.id;
                    selectGradientStop(stop.id);
                });
                stopsLayer.appendChild(stopButton);
            });

            previewWrap.appendChild(previewBar);
            previewWrap.appendChild(stopsLayer);
            editor.appendChild(previewWrap);

            if (selectedStop) {
                const selectedPanel = document.createElement('div');
                selectedPanel.className = 'gradient-editor__selected';
                selectedPanel.innerHTML = `
                    <div class="gradient-editor__selected-title">Parada seleccionada</div>
                    <div class="gradient-editor__selected-controls">
                        <label class="gradient-editor__field">
                            <span>Color</span>
                            <input class="gradient-editor__color" type="color" value="${selectedStop.color}" data-inline-color-compact="true">
                        </label>
                        <label class="gradient-editor__field gradient-editor__field--position">
                            <span>Ubicacion</span>
                            <div class="gradient-editor__position-wrap">
                                <input class="gradient-editor__number" type="number" min="0" max="100" step="1" value="${Math.round(selectedStop.position * 100)}">
                                <span>%</span>
                            </div>
                        </label>
                        <button type="button" class="gradient-stop-remove"${gradientMapSettings.stops.length <= 2 ? ' disabled' : ''}>Eliminar</button>
                    </div>
                `;

                selectedPanel.querySelector('.gradient-editor__color').addEventListener('input', (event) => {
                    updateGradientStopColor(selectedStop.id, event.target.value, { render: false });
                });
                selectedPanel.querySelector('.gradient-editor__number').addEventListener('input', (event) => {
                    updateGradientStopPosition(selectedStop.id, Number(event.target.value) / 100);
                });
                selectedPanel.querySelector('.gradient-stop-remove').addEventListener('click', () => {
                    removeGradientStop(selectedStop.id);
                });

                editor.appendChild(selectedPanel);
            }

            const listTitle = document.createElement('div');
            listTitle.className = 'gradient-editor__list-title';
            listTitle.innerHTML = '<span>Paradas de color</span><span>Ordenadas por posicion</span>';
            editor.appendChild(listTitle);

            const list = document.createElement('div');
            list.className = 'gradient-stop-list';

            orderedStops.forEach((stop) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `gradient-stop-item${selectedStop?.id === stop.id ? ' is-active' : ''}`;
                item.innerHTML = `
                    <span class="gradient-stop-item__swatch" style="background:${stop.color}"></span>
                    <span class="gradient-stop-item__hex">${stop.color.toUpperCase()}</span>
                    <span class="gradient-stop-item__pos">${formatGradientPercent(stop.position)}</span>
                    <span class="gradient-stop-item__close">×</span>
                `;
                item.addEventListener('click', () => {
                    selectGradientStop(stop.id);
                });
                item.querySelector('.gradient-stop-item__close').addEventListener('click', (event) => {
                    event.stopPropagation();
                    removeGradientStop(stop.id);
                });
                list.appendChild(item);
            });

            editor.appendChild(list);
            gradientStopsRoot.appendChild(editor);
            enhanceInlineColorInputs(gradientStopsRoot);
        }

        window.addEventListener('pointermove', (event) => {
            if (!activeGradientDragId || !gradientStopsRoot) return;
            const previewBar = gradientStopsRoot.querySelector('.gradient-editor__bar');
            if (!previewBar) return;
            const rect = previewBar.getBoundingClientRect();
            updateGradientStopPosition(activeGradientDragId, (event.clientX - rect.left) / Math.max(rect.width, 1), { render: false });
        });

        window.addEventListener('pointerup', () => {
            if (!activeGradientDragId) return;
            activeGradientDragId = null;
            scheduleHistoryCommit();
        });

        function applyGlassState() {
            if (glassSettings.enabled) {
                liquidMaterial.transmission = glassSettings.transmission;
                liquidMaterial.thickness = glassSettings.thickness;
                liquidMaterial.ior = glassSettings.ior;
                liquidMaterial.reflectivity = glassSettings.reflectivity;
                liquidMaterial.envMapIntensity = glassSettings.envMapIntensity;
                liquidMaterial.attenuationDistance = glassSettings.attenuationDistance;
                liquidMaterial.attenuationColor.set(glassSettings.attenuationColor);
            } else {
                applyChromeLevel();
                applyEnvironmentTextureState();
                liquidMaterial.transmission = 0.0;
                liquidMaterial.thickness = 0.0;
                liquidMaterial.attenuationDistance = 1000;
                liquidMaterial.ior = 1.5;
                liquidMaterial.attenuationColor.set('#ffffff');
            }
            liquidMaterial.needsUpdate = true;
        }

        function applyStructureFillState() {
            liquidMaterial.userData.uStructureFillEnabled.value = structureFillSettings.enabled ? 1.0 : 0.0;
            liquidMaterial.userData.uStructureFillColor.value.set(structureFillSettings.color);
            liquidMaterial.userData.uStructureFillStrength.value = structureFillSettings.strength;
        }

        function applyChromeLevel() {
            const chromeBoost = chromaticSettings.chromeLevel;
            liquidMaterial.metalness = Math.min(1, baseMaterialSnapshot.metalness + chromeBoost * 0.22);
            liquidMaterial.reflectivity = Math.min(1, baseMaterialSnapshot.reflectivity + chromeBoost * 0.16);
            liquidMaterial.envMapIntensity = environmentTextureSettings.enabled
                ? environmentTextureSettings.envIntensity
                : baseMaterialSnapshot.envMapIntensity + chromeBoost * 0.55;
            liquidMaterial.clearcoat = Math.min(1, baseMaterialSnapshot.clearcoat + chromeBoost * 0.18);
            liquidMaterial.iridescence = Math.min(1, baseMaterialSnapshot.iridescence + chromeBoost * 0.16);
        }

        const communityPresets = {
            'deushima-v1': {
                name: 'Deushima v1',
                scene: { bgColor: '#000000' },
                fluid: { scale: 0.00298, shapeReactivity: 0.42, distortion: 0.68, edgeProtection: 1.0 },
                iridescence: { intensity: 0.28, ior: 1.08, thicknessMin: 420, thicknessMax: 560 },
                material: { roughness: 0.18, metalness: 0.18, clearcoat: 0.42 },
                glass: {
                    enabled: true,
                    transmission: 0.72,
                    thickness: 2.4,
                    ior: 1.42,
                    reflectivity: 0.72,
                    envMapIntensity: 1.35,
                    attenuationDistance: 0.65,
                    attenuationColor: '#d3d6eb'
                },
                glow: { enabled: true, strength: 0.14, radius: 0.16, threshold: 0.32 },
                chromatic: { enabled: true, intensity: 0.0021, angle: 1.48, chromeLevel: 0.0, contrast: 1.0, whiteExposure: 1.0, preset: 'balanced' },
                imageFilter: { enabled: false, affectBackground: false, amount: 0.85, selected: 'neutral-silver' },
                structureFill: { enabled: false, color: '#cfd2d4', strength: 0.75 },
                geometry: { depth: 100.0, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 96 },
                bevel: { enableBevelDynamics: false, bevelFlowInfluence: 1.0 },
                environment: { enabled: false, affectLogo: false, affectBackground: false, envIntensity: 1.35 }
            }
        };

        const communityPresetSettings = {
            current: 'Captura inicial',
            applyDeushimaV1: () => { applyCommunityPreset('deushima-v1'); }
        };

        function updateBaseMaterialSnapshotFromCurrent() {
            baseMaterialSnapshot.metalness = liquidMaterial.metalness;
            baseMaterialSnapshot.reflectivity = glassSettings.reflectivity;
            baseMaterialSnapshot.envMapIntensity = glassSettings.envMapIntensity;
            baseMaterialSnapshot.clearcoat = liquidMaterial.clearcoat;
            baseMaterialSnapshot.iridescence = liquidMaterial.iridescence;
        }

        function refreshGuiControllers() {
            if (!gui) return;
            const refreshFolder = (folder) => {
                for (const controller of folder.controllers || []) {
                    controller.updateDisplay();
                }
                const childFolders = Array.isArray(folder.folders) ? folder.folders : Object.values(folder.folders || {});
                for (const childFolder of childFolders) {
                    refreshFolder(childFolder);
                }
            };
            refreshFolder(gui);
        }

        function applyCommunityPreset(presetId) {
            const preset = communityPresets[presetId];
            if (!preset) return;

            sceneSettings.bgColor = preset.scene.bgColor;
            scene.background = new THREE.Color(sceneSettings.bgColor);

            liquidMaterial.userData.uScale.value = preset.fluid.scale;
            liquidMaterial.userData.uShapeReactivity.value = preset.fluid.shapeReactivity;
            liquidMaterial.userData.uDistortion.value = preset.fluid.distortion;
            liquidMaterial.userData.uEdgeProtection.value = preset.fluid.edgeProtection;

            liquidMaterial.iridescence = preset.iridescence.intensity;
            liquidMaterial.iridescenceIOR = preset.iridescence.ior;
            liquidMaterial.iridescenceThicknessRange[0] = preset.iridescence.thicknessMin;
            liquidMaterial.iridescenceThicknessRange[1] = preset.iridescence.thicknessMax;
            if (typeof thicknessProxy !== 'undefined') {
                thicknessProxy.min = preset.iridescence.thicknessMin;
                thicknessProxy.max = preset.iridescence.thicknessMax;
            }

            liquidMaterial.roughness = preset.material.roughness;
            liquidMaterial.metalness = preset.material.metalness;
            liquidMaterial.clearcoat = preset.material.clearcoat;

            Object.assign(glassSettings, preset.glass);
            Object.assign(glowSettings, preset.glow);
            Object.assign(chromaticSettings, preset.chromatic);
            Object.assign(imageFilterSettings, preset.imageFilter || { enabled: false, affectBackground: false, amount: 0.85, selected: 'neutral-silver' });
            Object.assign(structureFillSettings, preset.structureFill || { enabled: false, color: '#cfd2d4', strength: 0.75 });
            Object.assign(bevelSettings, preset.bevel);
            Object.assign(environmentTextureSettings, preset.environment);

            geometrySettings.depth = preset.geometry.depth;
            bevelSettings.bevelSize = preset.geometry.bevelSize;
            bevelSettings.bevelThickness = preset.geometry.bevelThickness;
            bevelSettings.bevelSegments = preset.geometry.bevelSegments;
            liquidMaterial.userData.uBevelFlowMix.value = bevelSettings.enableBevelDynamics ? bevelSettings.bevelFlowInfluence : 0.0;

            updateBaseMaterialSnapshotFromCurrent();
            applyChromeLevel();
            applyGlassState();
            applyStructureFillState();
            applyGlowState();
            applyChromaticState();
            applyImageFilterState();
            applyEnvironmentTextureState();
            rebuildCurrentSVG();
            communityPresetSettings.current = preset.name;
            renderImageFilterPresetsUI();
            refreshGuiControllers();
        }

        const HISTORY_LIMIT = 5;
        const historyUndoStack = [];
        const historyRedoStack = [];
        let historyCurrentSnapshot = null;
        let historyDebounce = null;
        let isRestoringHistory = false;

        function cloneStops(stops) {
            return stops.map((stop) => ({ ...stop }));
        }

        function captureHistorySnapshot() {
            return {
                scene: { bgColor: sceneSettings.bgColor },
                fluid: {
                    paused: fluidPlaybackSettings.paused,
                    frame: fluidPlaybackSettings.frame,
                    scale: liquidMaterial.userData.uScale.value,
                    shapeReactivity: liquidMaterial.userData.uShapeReactivity.value,
                    distortion: liquidMaterial.userData.uDistortion.value,
                    edgeProtection: liquidMaterial.userData.uEdgeProtection.value
                },
                material: {
                    roughness: liquidMaterial.roughness,
                    metalness: liquidMaterial.metalness,
                    clearcoat: liquidMaterial.clearcoat,
                    iridescence: liquidMaterial.iridescence,
                    iridescenceIOR: liquidMaterial.iridescenceIOR,
                    thicknessMin: liquidMaterial.iridescenceThicknessRange[0],
                    thicknessMax: liquidMaterial.iridescenceThicknessRange[1]
                },
                baseMaterial: { ...baseMaterialSnapshot },
                glass: { ...glassSettings },
                glow: { ...glowSettings },
                chromatic: { ...chromaticSettings },
                imageFilter: { ...imageFilterSettings },
                structureFill: { ...structureFillSettings },
                edgeSmooth: { ...edgeSmoothSettings },
                gradientMap: {
                    enabled: gradientMapSettings.enabled,
                    amount: gradientMapSettings.amount,
                    smoothness: gradientMapSettings.smoothness,
                    selectedStopId: gradientMapSettings.selectedStopId,
                    stops: cloneStops(gradientMapSettings.stops)
                },
                geometry: {
                    depth: geometrySettings.depth,
                    bevelSize: bevelSettings.bevelSize,
                    bevelThickness: bevelSettings.bevelThickness,
                    bevelSegments: bevelSettings.bevelSegments
                },
                bevel: {
                    enableBevelDynamics: bevelSettings.enableBevelDynamics,
                    bevelFlowInfluence: bevelSettings.bevelFlowInfluence
                },
                environment: {
                    enabled: environmentTextureSettings.enabled,
                    affectLogo: environmentTextureSettings.affectLogo,
                    affectBackground: environmentTextureSettings.affectBackground,
                    envIntensity: environmentTextureSettings.envIntensity
                }
            };
        }

        function snapshotsMatch(a, b) {
            return JSON.stringify(a) === JSON.stringify(b);
        }

        function pushLimited(stack, snapshot) {
            stack.push(snapshot);
            if (stack.length > HISTORY_LIMIT) {
                stack.shift();
            }
        }

        function commitHistorySnapshot() {
            if (isRestoringHistory || !historyCurrentSnapshot) return;
            const nextSnapshot = captureHistorySnapshot();
            if (snapshotsMatch(historyCurrentSnapshot, nextSnapshot)) return;

            pushLimited(historyUndoStack, historyCurrentSnapshot);
            historyRedoStack.length = 0;
            historyCurrentSnapshot = nextSnapshot;
        }

        function scheduleHistoryCommit() {
            if (isRestoringHistory) return;
            window.clearTimeout(historyDebounce);
            historyDebounce = window.setTimeout(commitHistorySnapshot, 260);
        }

        function flushHistoryCommit() {
            window.clearTimeout(historyDebounce);
            commitHistorySnapshot();
        }

        function restoreHistorySnapshot(snapshot) {
            isRestoringHistory = true;

            sceneSettings.bgColor = snapshot.scene.bgColor;
            scene.background = new THREE.Color(sceneSettings.bgColor);

            fluidPlaybackSettings.paused = snapshot.fluid.paused;
            fluidPlaybackSettings.frame = snapshot.fluid.frame;
            fluidRenderTime = snapshot.fluid.frame;
            liquidMaterial.userData.uTime.value = fluidRenderTime;
            liquidMaterial.userData.uScale.value = snapshot.fluid.scale;
            liquidMaterial.userData.uShapeReactivity.value = snapshot.fluid.shapeReactivity;
            liquidMaterial.userData.uDistortion.value = snapshot.fluid.distortion;
            liquidMaterial.userData.uEdgeProtection.value = snapshot.fluid.edgeProtection;

            Object.assign(baseMaterialSnapshot, snapshot.baseMaterial);
            liquidMaterial.roughness = snapshot.material.roughness;
            liquidMaterial.metalness = snapshot.material.metalness;
            liquidMaterial.clearcoat = snapshot.material.clearcoat;
            liquidMaterial.iridescence = snapshot.material.iridescence;
            liquidMaterial.iridescenceIOR = snapshot.material.iridescenceIOR;
            liquidMaterial.iridescenceThicknessRange[0] = snapshot.material.thicknessMin;
            liquidMaterial.iridescenceThicknessRange[1] = snapshot.material.thicknessMax;
            if (typeof thicknessProxy !== 'undefined') {
                thicknessProxy.min = snapshot.material.thicknessMin;
                thicknessProxy.max = snapshot.material.thicknessMax;
            }

            Object.assign(glassSettings, snapshot.glass);
            Object.assign(glowSettings, snapshot.glow);
            Object.assign(chromaticSettings, snapshot.chromatic);
            Object.assign(imageFilterSettings, snapshot.imageFilter || { enabled: false, affectBackground: false, amount: 0.85, selected: 'neutral-silver' });
            Object.assign(structureFillSettings, snapshot.structureFill);
            Object.assign(edgeSmoothSettings, snapshot.edgeSmooth);
            Object.assign(environmentTextureSettings, snapshot.environment);

            gradientMapSettings.enabled = snapshot.gradientMap.enabled;
            gradientMapSettings.amount = snapshot.gradientMap.amount;
            gradientMapSettings.smoothness = snapshot.gradientMap.smoothness;
            gradientMapSettings.selectedStopId = snapshot.gradientMap.selectedStopId || snapshot.gradientMap.stops?.[0]?.id || null;
            gradientMapSettings.stops = cloneStops(snapshot.gradientMap.stops);

            geometrySettings.depth = snapshot.geometry.depth;
            bevelSettings.bevelSize = snapshot.geometry.bevelSize;
            bevelSettings.bevelThickness = snapshot.geometry.bevelThickness;
            bevelSettings.bevelSegments = snapshot.geometry.bevelSegments;
            bevelSettings.enableBevelDynamics = snapshot.bevel.enableBevelDynamics;
            bevelSettings.bevelFlowInfluence = snapshot.bevel.bevelFlowInfluence;
            liquidMaterial.userData.uBevelFlowMix.value = bevelSettings.enableBevelDynamics ? bevelSettings.bevelFlowInfluence : 0.0;

            applyChromeLevel();
            applyGlassState();
            applyStructureFillState();
            applyGlowState();
            applyChromaticState();
            applyImageFilterState();
            applyEdgeSmoothState();
            applyGradientMapState();
            applyEnvironmentTextureState();
            rebuildCurrentSVG();
            renderGradientStopsUI();
            renderImageFilterPresetsUI();
            refreshGuiControllers();

            isRestoringHistory = false;
        }

        function undoHistory() {
            flushHistoryCommit();
            if (!historyUndoStack.length) return;
            const currentSnapshot = captureHistorySnapshot();
            const previousSnapshot = historyUndoStack.pop();
            pushLimited(historyRedoStack, currentSnapshot);
            restoreHistorySnapshot(previousSnapshot);
            historyCurrentSnapshot = captureHistorySnapshot();
        }

        function redoHistory() {
            flushHistoryCommit();
            if (!historyRedoStack.length) return;
            const currentSnapshot = captureHistorySnapshot();
            const nextSnapshot = historyRedoStack.pop();
            pushLimited(historyUndoStack, currentSnapshot);
            restoreHistorySnapshot(nextSnapshot);
            historyCurrentSnapshot = captureHistorySnapshot();
        }

        function rebuildCurrentSVG() {
            if (currentSVGData) {
                buildSVGFromData(currentSVGData);
            }
        }

        function buildSVGFromData(svgData) {
            currentSVGData = svgData;

            // Reset existing group transformation so scaling math works flawlessly
            svgGroup.position.set(0, 0, 0);
            svgGroup.scale.set(1, 1, 1);
            svgGroup.rotation.set(0, 0, 0);
            svgContent.position.set(0, 0, 0);
            svgContent.scale.set(1, 1, 1);
            svgContent.rotation.set(0, 0, 0);
            svgGroup.updateMatrixWorld();

            while(svgContent.children.length > 0){ 
                const child = svgContent.children[0];
                svgContent.remove(child); 
                if (child.geometry) child.geometry.dispose();
            }

            const extrudeSettings = {
                depth: geometrySettings.depth,
                bevelEnabled: geometrySettings.bevelEnabled,
                bevelSegments: bevelSettings.bevelSegments,
                steps: geometrySettings.steps,
                bevelSize: bevelSettings.bevelSize,
                bevelThickness: bevelSettings.bevelThickness
            };

            const allShapes = [];
            for (const path of svgData.paths) {
                const shapes = SVGLoader.createShapes(path);
                for (const shape of shapes) {
                    allShapes.push(shape);
                    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    const mesh = new THREE.Mesh(geometry, liquidMaterial);
                    svgContent.add(mesh);
                }
            }

            if (allShapes.length > 0) {
                generateShapeMaskTexture(allShapes);
            }

            // --- PERFECT CENTERING FIX ---
            // 1. Calculate proper scale before moving anything
            const box = new THREE.Box3().setFromObject(svgContent);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const rawCenter = box.getCenter(new THREE.Vector3());
            
            if (maxDim > 0) {
                const scale = compositionSettings.logoFitSize / maxDim; 
                svgGroup.scale.set(scale, -scale, scale); 
            }

            // 2. Center the content inside the parent pivot so rotation stays locked
            // to the logo's visual center instead of orbiting around the SVG origin.
            svgContent.position.sub(rawCenter);
            svgGroup.position.y += compositionSettings.verticalOffset;
            controls.target.set(0, compositionSettings.verticalOffset, 0);
            controls.update();
        }

        function loadSVGFromString(svgText) {
            const svgData = svgLoader.parse(svgText);
            buildSVGFromData(svgData);
        }

        function loadSVGFromURL(url) {
            if (!url || url.trim() === '') {
                loadSVGFromString(INLINE_INITIAL_SVG || appleSVG);
                return;
            }
            svgLoader.load(
                url,
                (svgData) => {
                    buildSVGFromData(svgData);
                },
                undefined,
                (error) => {
                    console.error('Error loading SVG from URL. Falling back to embedded default logo.', error);
                    loadSVGFromString(INLINE_INITIAL_SVG || appleSVG);
                }
            );
        }

        // Default Apple SVG with appropriately sized and positioned leaf
        const appleSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <path d="M51.1,38.2 C51.1,28.7 58.8,24 59.2,23.7 C54.8,17.3 47.9,16.3 45.5,16.1 C39.6,15.5 33.9,19.6 30.9,19.6 C27.9,19.6 23.2,16.1 18.2,16.2 C11.6,16.3 5.6,20.1 2.2,26 C-4.8,38 0.4,55.8 7.2,65.6 C10.5,70.4 14.4,75.7 19.5,75.5 C24.4,75.3 26.2,72.3 32,72.3 C37.8,72.3 39.5,75.5 44.7,75.4 C50.1,75.3 53.5,70.6 56.8,65.7 C60.6,59.8 62.1,54.1 62.2,53.8 C62.1,53.7 51.2,49.5 51.1,38.2 Z M39.6,4.5 C41.5,2.2 42.8,-1.0 42.4,-4.2 C39.4,-4.1 36,-2.2 34.1,0.1 C32.3,2.3 30.8,5.6 31.3,8.8 C34.6,9.1 37.7,6.9 39.6,4.5 Z"/>
        </svg>
        `;
        
        // --- INITIAL STARTUP ---
        if (INLINE_INITIAL_SVG) {
            loadSVGFromString(INLINE_INITIAL_SVG);
        } else if (INITIAL_SVG_URL && INITIAL_SVG_URL.trim() !== '') {
            loadSVGFromURL(INITIAL_SVG_URL);
        } else {
            loadSVGFromString(appleSVG);
        }

        // --- GUI SETUP ---
        const gui = new GUI({ title: 'Liquid Metal Settings' });
        
        const sceneFolder = gui.addFolder('Scene');
        sceneFolder.addColor(sceneSettings, 'bgColor').name('Background Color').onChange(v => {
            scene.background.set(v);
        });

        const effectFolder = gui.addFolder('Fluid Dynamics');
        effectFolder.add(fluidPlaybackSettings, 'paused').name('Pause Fluid').onChange((paused) => {
            if (paused) {
                fluidPlaybackSettings.frame = fluidRenderTime;
                fluidFrameController.updateDisplay();
            }
        });
        const fluidFrameController = effectFolder.add(fluidPlaybackSettings, 'frame', 0.0, fluidLoopDuration, 0.01).name('Fluid Frame').onChange((value) => {
            if (fluidPlaybackSettings.paused) {
                fluidRenderTime = value;
                liquidMaterial.userData.uTime.value = value;
            }
        });
        effectFolder.add(liquidMaterial.userData.uScale, 'value', 0.0001, 0.015).name('Ripple Scale');
        effectFolder.add(liquidMaterial.userData.uShapeReactivity, 'value', 0.0, 5.0).name('Shape Reactivity');
        effectFolder.add(liquidMaterial.userData.uDistortion, 'value', 0.0, 5.0).name('Distortion');
        effectFolder.add(liquidMaterial.userData.uEdgeProtection, 'value', 0.0, 1.0).name('Edge Sharpness');
        
        const iridescenceFolder = gui.addFolder('Iridescence (Rainbow)');
        iridescenceFolder.add(liquidMaterial, 'iridescence', 0.0, 1.0).name('Intensity');
        iridescenceFolder.add(liquidMaterial, 'iridescenceIOR', 1.0, 3.0).name('Index of Refraction');
        
        const thicknessProxy = { min: 183, max: 886.5 };
        iridescenceFolder.add(thicknessProxy, 'min', 0, 1500).name('Thickness Min').onChange(v => {
            liquidMaterial.iridescenceThicknessRange[0] = v;
        });
        iridescenceFolder.add(thicknessProxy, 'max', 0, 1500).name('Thickness Max').onChange(v => {
            liquidMaterial.iridescenceThicknessRange[1] = v;
        });

        const materialFolder = gui.addFolder('Base Material');
        materialFolder.add(liquidMaterial, 'roughness', 0.0, 1.0).name('Roughness');
        materialFolder.add(liquidMaterial, 'metalness', 0.0, 1.0).name('Metalness');
        materialFolder.add(liquidMaterial, 'clearcoat', 0.0, 1.0).name('Clearcoat');

        const structureFillFolder = gui.addFolder('Full Structure Color');
        structureFillFolder.add(structureFillSettings, 'enabled').name('Enable Full Color').onChange(() => {
            applyStructureFillState();
        });
        structureFillFolder.addColor(structureFillSettings, 'color').name('Structure Color').onChange(() => {
            applyStructureFillState();
        });
        structureFillFolder.add(structureFillSettings, 'strength', 0.0, 1.5, 0.01).name('Fill Strength').onChange(() => {
            applyStructureFillState();
        });

        const glassFolder = gui.addFolder('Glass Texture');
        glassFolder.add(glassSettings, 'enabled').name('Enable Glass').onChange(() => {
            applyGlassState();
        });
        glassFolder.add(glassSettings, 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.add(glassSettings, 'thickness', 0.0, 8.0, 0.01).name('Glass Thickness').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.add(glassSettings, 'ior', 1.0, 2.5, 0.01).name('Glass IOR').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.add(glassSettings, 'reflectivity', 0.0, 1.0, 0.01).name('Reflectivity').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.add(glassSettings, 'envMapIntensity', 0.0, 3.0, 0.01).name('Env Reflection').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.add(glassSettings, 'attenuationDistance', 0.0, 3.0, 0.01).name('Tint Distance').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });
        glassFolder.addColor(glassSettings, 'attenuationColor').name('Glass Tint').onChange(v => {
            if (glassSettings.enabled) applyGlassState();
        });

        const glowFolder = gui.addFolder('Glow');
        glowFolder.add(glowSettings, 'enabled').name('Enable Glow').onChange(() => {
            applyGlowState();
        });
        glowFolder.add(glowSettings, 'strength', 0.0, 2.5, 0.01).name('Glow Strength').onChange(v => {
            bloomPass.strength = v;
        });
        glowFolder.add(glowSettings, 'radius', 0.0, 1.0, 0.01).name('Glow Radius').onChange(v => {
            bloomPass.radius = v;
        });
        glowFolder.add(glowSettings, 'threshold', 0.0, 1.0, 0.01).name('Glow Threshold').onChange(v => {
            bloomPass.threshold = v;
        });

        const chromaticFolder = gui.addFolder('Chromatic');
        chromaticFolder.add(chromaticSettings, 'enabled').name('Enable Chromatic').onChange(() => {
            applyChromaticState();
        });
        chromaticFolder.add(chromaticSettings, 'intensity', 0.0, 0.01, 0.0001).name('Chromatic FX').onChange(v => {
            rgbShiftPass.uniforms.amount.value = chromaticSettings.enabled ? v : 0.0;
        });
        chromaticFolder.add(chromaticSettings, 'angle', 0.0, 6.2832, 0.01).name('Chromatic Angle').onChange(v => {
            rgbShiftPass.uniforms.angle.value = v;
        });
        chromaticFolder.add(chromaticSettings, 'chromeLevel', 0.0, 2.0, 0.01).name('Chrome Level').onChange(() => {
            applyChromeLevel();
            if (glassSettings.enabled) {
                applyGlassState();
            } else {
                applyEnvironmentTextureState();
            }
        });
        chromaticFolder.add(chromaticSettings, 'contrast', 0.5, 2.0, 0.01).name('Contrast').onChange(v => {
            gradePass.uniforms.uContrast.value = v;
        });
        chromaticFolder.add(chromaticSettings, 'whiteExposure', 0.5, 2.0, 0.01).name('White Exposure').onChange(v => {
            gradePass.uniforms.uExposure.value = v;
        });
        chromaticFolder.add(chromaticSettings, 'preset', ['subtle', 'balanced', 'prism', 'glitch']).name('Variation').onChange(v => {
            applyChromaticPreset(v);
        });

        const imageFiltersFolder = gui.addFolder('Image Filters');
        imageFiltersFolder.add(imageFilterSettings, 'enabled').name('Enable Filters').onChange(() => {
            applyImageFilterState();
            renderImageFilterPresetsUI();
        });
        imageFiltersFolder.add(imageFilterSettings, 'affectBackground').name('Affect Background').onChange(() => {
            applyImageFilterState();
        });
        imageFiltersFolder.add(imageFilterSettings, 'amount', 0.0, 1.0, 0.01).name('Filter Amount').onChange(() => {
            applyImageFilterState();
        });
        imageFiltersRoot = document.createElement('div');
        imageFiltersRoot.className = 'image-filters-ui';
        (imageFiltersFolder.domElement.querySelector('.children') || imageFiltersFolder.domElement).appendChild(imageFiltersRoot);
        renderImageFilterPresetsUI();

        const edgeSmoothFolder = gui.addFolder('Edge Smoothing');
        edgeSmoothFolder.add(edgeSmoothSettings, 'enabled').name('Enable Smoothing').onChange(() => {
            applyEdgeSmoothState();
        });
        edgeSmoothFolder.add(edgeSmoothSettings, 'strength', 0.0, 1.0, 0.01).name('Smoothing Strength').onChange(() => {
            applyEdgeSmoothState();
        });

        const gradientMapFolder = gui.addFolder('Gradient Map');
        gradientMapFolder.add(gradientMapSettings, 'enabled').name('Enable Gradient Map').onChange(() => {
            applyGradientMapState();
        });
        gradientMapFolder.add(gradientMapSettings, 'amount', 0.0, 1.0, 0.01).name('Amount').onChange(() => {
            applyGradientMapState();
        });
        gradientMapFolder.add(gradientMapSettings, 'smoothness', 0.0, 1.0, 0.01).name('Smoothness').onChange(() => {
            applyGradientMapState();
            renderGradientStopsUI();
        });
        gradientStopsRoot = document.createElement('div');
        gradientStopsRoot.className = 'gradient-stops-ui';
        (gradientMapFolder.domElement.querySelector('.children') || gradientMapFolder.domElement).appendChild(gradientStopsRoot);
        renderGradientStopsUI();

        const geometryFolder = gui.addFolder('Geometry');
        geometryFolder.add(geometrySettings, 'depth', 20.0, 1200.0, 10.0).name('Extrude Depth').onChange(() => {
            rebuildCurrentSVG();
        });
        geometryFolder.add(bevelSettings, 'bevelSize', 0.0, 12.0, 0.1).name('Bevel Size').onChange(() => {
            rebuildCurrentSVG();
        });
        geometryFolder.add(bevelSettings, 'bevelThickness', 0.0, 12.0, 0.1).name('Bevel Thickness').onChange(() => {
            rebuildCurrentSVG();
        });
        geometryFolder.add(bevelSettings, 'bevelSegments', 1, 128, 1).name('Bevel Segments').onChange(() => {
            rebuildCurrentSVG();
        });

        const bevelFolder = gui.addFolder('Bevel Dynamics');
        bevelFolder.add(bevelSettings, 'enableBevelDynamics').name('Enable Redirect').onChange((v) => {
            liquidMaterial.userData.uBevelFlowMix.value = v ? bevelSettings.bevelFlowInfluence : 0.0;
        });
        bevelFolder.add(bevelSettings, 'bevelFlowInfluence', 0.0, 3.0, 0.01).name('Redirect Strength').onChange((v) => {
            liquidMaterial.userData.uBevelFlowMix.value = bevelSettings.enableBevelDynamics ? v : 0.0;
        });

        const fileSettings = {
            svgUrl: INITIAL_SVG_URL,
            loadUrl: () => { loadSVGFromURL(fileSettings.svgUrl); },
            uploadSVG: () => { fileInput.click(); },
            exportWithBackground: () => { exportPNG({ transparent: false }); },
            exportTransparent: () => { exportPNG({ transparent: true }); },
            resetDefault: () => { 
                fileSettings.svgUrl = INITIAL_SVG_URL;
                if (INLINE_INITIAL_SVG) {
                    loadSVGFromString(INLINE_INITIAL_SVG);
                } else {
                    loadSVGFromURL(INITIAL_SVG_URL);
                }
            }
        };

        const environmentFolder = gui.addFolder('Environment Texture');
        environmentFolder.add(environmentTextureSettings, 'enabled').name('Enable Texture').onChange(() => {
            applyEnvironmentTextureState();
        });
        environmentFolder.add(environmentTextureSettings, 'affectLogo').name('Affect Logo').onChange(() => {
            applyEnvironmentTextureState();
        });
        environmentFolder.add(environmentTextureSettings, 'affectBackground').name('Affect Background').onChange(() => {
            applyEnvironmentTextureState();
        });
        environmentFolder.add(environmentTextureSettings, 'envIntensity', 0.0, 4.0, 0.01).name('Env Influence').onChange(() => {
            applyEnvironmentTextureState();
        });
        environmentFolder.add(environmentTextureSettings, 'uploadTexture').name('Upload PNG Texture');
        environmentFolder.add(environmentTextureSettings, 'clearTexture').name('Clear Texture');

        const export360Folder = gui.addFolder('Export 360 Video');
        export360Folder.add(export360Settings, 'duration', 2, 20, 1).name('Duration Sec');
        export360Folder.add(export360Settings, 'fps', 24, 60, 1).name('FPS');
        export360Folder.add(export360Settings, 'qualityMbps', 4, 30, 1).name('Quality Mbps');
        export360Folder.add(export360Settings, 'clockwise').name('Clockwise');
        export360Folder.add(export360Settings, 'exportVideo').name('Export 360 MP4');

        const communityFolder = gui.addFolder("Preset's de la comunidad");
        const activePresetController = communityFolder.add(communityPresetSettings, 'current').name('Preset activo');
        if (activePresetController.disable) activePresetController.disable();
        communityFolder.add(communityPresetSettings, 'applyDeushimaV1').name('Deushima v1');
        
        const fileFolder = gui.addFolder('File Management');
        fileFolder.add(fileSettings, 'svgUrl').name('SVG URL');
        fileFolder.add(fileSettings, 'loadUrl').name('Load from URL');
        fileFolder.add(fileSettings, 'uploadSVG').name('Upload Custom SVG');
        fileFolder.add(fileSettings, 'exportWithBackground').name('Export PNG + BG');
        fileFolder.add(fileSettings, 'exportTransparent').name('Export PNG Transparent');
        fileFolder.add(fileSettings, 'resetDefault').name('Reset Logo');

        if (controlsPanel) {
            controlsPanel.appendChild(gui.domElement);
            enhanceInlineColorInputs(controlsPanel);
        }

        document.addEventListener('click', (event) => {
            if (activeInlineColorControl && !activeInlineColorControl.root.contains(event.target)) {
                closeInlineColorPicker();
            }
        });

        const toolCatalog = [
            {
                id: 'scene',
                index: '01',
                title: 'Escena',
                meta: 'Visual · Fondo',
                description: 'Controla el color de fondo de la mesa de trabajo para decidir si el logo vive sobre un negro pleno o sobre una base distinta.',
                categories: ['all', 'visual'],
                folder: sceneFolder
            },
            {
                id: 'fluid',
                index: '02',
                title: 'Dinámica Fluida',
                meta: 'Simulación · Fluido',
                description: 'Define la vibración líquida del metal, cuánto se desplaza la materia sobre la forma y qué tan nítidos se mantienen sus bordes.',
                categories: ['all', 'fluido'],
                folder: effectFolder
            },
            {
                id: 'iridescence',
                index: '03',
                title: 'Iridescencia',
                meta: 'Color · Refracción',
                description: 'Añade el desvío cromático interno del material y regula el espesor que determina cómo aparecen esos matices en la superficie.',
                categories: ['all', 'material', 'color'],
                folder: iridescenceFolder
            },
            {
                id: 'material',
                index: '04',
                title: 'Material Base',
                meta: 'Metal · Superficie',
                description: 'Ajusta el cuerpo principal del logo: rugosidad, nivel metálico y la capa de brillo superior que define su pulido general.',
                categories: ['all', 'material'],
                folder: materialFolder
            },
            {
                id: 'glass',
                index: '05',
                title: 'Textura Glass',
                meta: 'Refracción · Vidrio',
                description: 'Modifica la transparencia, la refracción y el tinte interno para llevar el logo hacia un look de vidrio o cristal líquido.',
                categories: ['all', 'material', 'visual'],
                folder: glassFolder
            },
            {
                id: 'glow',
                index: '06',
                title: 'Glow',
                meta: 'Luz · Halo',
                description: 'Controla el halo alrededor del logo para sumar presencia sin romper la limpieza del diseño. Ideal para dar volumen sutil.',
                categories: ['all', 'luz', 'post'],
                folder: glowFolder
            },
            {
                id: 'chromatic',
                index: '07',
                title: 'Cromático',
                meta: 'Postproceso · Chrome',
                description: 'Define la separación cromática, el contraste y la exposición blanca del render para darle un acabado más editorial o más agresivo.',
                categories: ['all', 'post', 'color'],
                folder: chromaticFolder
            },
            {
                id: 'geometry',
                index: '08',
                title: 'Geometría',
                meta: 'Extrusión · Forma',
                description: 'Aquí decides el volumen real del logo: profundidad, bisel y la lectura general de la pieza en el espacio.',
                categories: ['all', 'geometria'],
                folder: geometryFolder
            },
            {
                id: 'bevel',
                index: '09',
                title: 'Dinámica de Bisel',
                meta: 'Geometría · Flujo',
                description: 'Redirige el comportamiento del fluido hacia el bisel para que la materia siga el contorno de la forma con más intención.',
                categories: ['all', 'geometria', 'fluido'],
                folder: bevelFolder
            },
            {
                id: 'environment',
                index: '10',
                title: 'Entorno',
                meta: 'Iluminación · Textura',
                description: 'Permite cargar una textura de entorno para alterar reflejos, iluminación y, si quieres, la lectura del propio material del logo.',
                categories: ['all', 'entorno', 'visual'],
                folder: environmentFolder
            },
            {
                id: 'files',
                index: '11',
                title: 'Archivos',
                meta: 'Importación · Exportación',
                description: 'Gestiona el SVG, la carga de nuevos assets y la exportación final en PNG con fondo o transparente, sin incluir la esfera ambiental.',
                categories: ['all', 'archivo'],
                folder: fileFolder
            }
        ];

        const filterCatalog = [
            { id: 'all', label: 'Todas' },
            { id: 'visual', label: 'Visual' },
            { id: 'fluido', label: 'Fluido' },
            { id: 'material', label: 'Material' },
            { id: 'post', label: 'Post' },
            { id: 'geometria', label: 'Geometría' },
            { id: 'entorno', label: 'Entorno' },
            { id: 'archivo', label: 'Archivo' }
        ];

        const hudToolCatalog = [
            { id: 'files', index: '01', title: 'Archivos', meta: 'Importacion / Exportacion', description: 'Gestiona el SVG, la carga de nuevos assets y la exportacion final en PNG con fondo o transparente, sin incluir la esfera ambiental.', categories: ['all', 'archivo'], folder: fileFolder, callout: 'probá tu logo' },
            { id: 'scene', index: '02', title: 'Escena', meta: 'Visual / Fondo', description: 'Controla el color de fondo de la mesa de trabajo para decidir si el logo vive sobre un negro pleno o sobre una base distinta.', categories: ['all', 'visual'], folder: sceneFolder },
            { id: 'fluid', index: '03', title: 'Dinamica Fluida', meta: 'Simulacion / Fluido', description: 'Define la vibracion liquida del metal, cuanto se desplaza la materia sobre la forma y que tan nitidos se mantienen sus bordes.', categories: ['all', 'fluido'], folder: effectFolder },
            { id: 'iridescence', index: '04', title: 'Iridescencia', meta: 'Color / Refraccion', description: 'Anade el desvio cromatico interno del material y regula el espesor que determina como aparecen esos matices en la superficie.', categories: ['all', 'material', 'color'], folder: iridescenceFolder },
            { id: 'material', index: '05', title: 'Material Base', meta: 'Metal / Superficie', description: 'Ajusta el cuerpo principal del logo: rugosidad, nivel metalico y la capa de brillo superior que define su pulido general.', categories: ['all', 'material'], folder: materialFolder },
            { id: 'structure-fill', index: '06', title: 'Estructura Completa', meta: 'Color / Relleno', description: 'Rellena las zonas oscuras de la estructura con un color editable. Por defecto usa plateado para que laterales y parte trasera no queden negros.', categories: ['all', 'material', 'visual', 'color'], folder: structureFillFolder },
            { id: 'glass', index: '07', title: 'Textura Glass', meta: 'Refraccion / Vidrio', description: 'Modifica la transparencia, la refraccion y el tinte interno para llevar el logo hacia un look de vidrio o cristal liquido.', categories: ['all', 'material', 'visual'], folder: glassFolder },
            { id: 'glow', index: '08', title: 'Glow', meta: 'Luz / Halo', description: 'Controla el halo alrededor del logo para sumar presencia sin romper la limpieza del diseno. Ideal para dar volumen sutil.', categories: ['all', 'luz', 'post'], folder: glowFolder },
            { id: 'chromatic', index: '09', title: 'Cromatico', meta: 'Postproceso / Chrome', description: 'Define la separacion cromatica, el contraste y la exposicion blanca del render para darle un acabado mas editorial o mas agresivo.', categories: ['all', 'post', 'color'], folder: chromaticFolder },
            { id: 'image-filters', index: '10', title: 'Filtros', meta: 'Color / Presets', description: 'Aplica filtros de imagen con mini previews de material/color. Sirve para probar acabados tonales rapidos sin alterar el material base del logo.', categories: ['all', 'post', 'visual', 'color'], folder: imageFiltersFolder },
            { id: 'edge-smoothing', index: '11', title: 'Suavizar Bordes', meta: 'Postproceso / Anti Alias', description: 'Activa un suavizado final sobre el render para reducir bordes pixelados sin cambiar la forma ni el material del logo.', categories: ['all', 'post', 'visual'], folder: edgeSmoothFolder },
            { id: 'gradient-map', index: '12', title: 'Gradient Map', meta: 'Color / Mapa Tonal', description: 'Aplica un mapa de degradado al render completo, como en Photoshop: las sombras toman un color y las luces otro, mezclandose segun la luminancia.', categories: ['all', 'post', 'color'], folder: gradientMapFolder },
            { id: 'geometry', index: '13', title: 'Geometria', meta: 'Extrusion / Forma', description: 'Aqui decides el volumen real del logo: profundidad, bisel y la lectura general de la pieza en el espacio.', categories: ['all', 'geometria'], folder: geometryFolder },
            { id: 'bevel', index: '14', title: 'Dinamica de Bisel', meta: 'Geometria / Flujo', description: 'Redirige el comportamiento del fluido hacia el bisel para que la materia siga el contorno de la forma con mas intencion.', categories: ['all', 'geometria', 'fluido'], folder: bevelFolder },
            { id: 'environment', index: '15', title: 'Entorno', meta: 'Iluminacion / Textura', description: 'Permite cargar una textura de entorno para alterar reflejos, iluminacion y, si quieres, la lectura del propio material del logo.', categories: ['all', 'entorno', 'visual'], folder: environmentFolder },
            { id: 'export-360', index: '16', title: 'Export 360', meta: 'Video / Rotacion', description: 'Exporta una vuelta completa de 360 grados del logo sobre su eje vertical. El navegador intentara descargar MP4 y usara WebM si MP4 no esta disponible.', categories: ['all', 'archivo'], folder: export360Folder },
            { id: 'community-presets', index: '17', title: "Preset's Comunidad", meta: 'Disenadores / Looks', description: 'Guarda y aplica presets creados por la comunidad. Deushima v1 conserva el look anterior para volver a el cuando quieras.', categories: ['all', 'presets', 'material', 'post'], folder: communityFolder }
        ];

        const hudFilterCatalog = [
            { id: 'all', label: 'Todas' },
            { id: 'visual', label: 'Visual' },
            { id: 'fluido', label: 'Fluido' },
            { id: 'material', label: 'Material' },
            { id: 'post', label: 'Post' },
            { id: 'geometria', label: 'Geometria' },
            { id: 'entorno', label: 'Entorno' },
            { id: 'presets', label: 'Presets' },
            { id: 'archivo', label: 'Archivo' }
        ];

        let activeToolId = 'files';
        let hoveredToolId = null;
        let activeFilterId = 'all';
        let fileCalloutRoot = null;

        function setDrawerState(isOpen) {
            if (!controlsDrawer || !controlsToggle) return;
            controlsDrawer.classList.toggle('is-open', isOpen);
            controlsToggle.setAttribute('aria-expanded', String(isOpen));
        }

        function syncFolderVisibility(selectedId) {
            for (const tool of hudToolCatalog) {
                const isSelected = tool.id === selectedId;
                tool.folder.domElement.style.display = isSelected ? '' : 'none';
                if (isSelected) {
                    tool.folder.open();
                } else {
                    tool.folder.close();
                }
            }
        }

        function renderInfo(tool) {
            if (!tool) return;
            if (toolInfoIndex) toolInfoIndex.textContent = tool.index;
            if (toolInfoMeta) toolInfoMeta.textContent = tool.meta;
            if (toolInfoTitle) toolInfoTitle.textContent = tool.title;
            if (toolInfoDescription) toolInfoDescription.textContent = tool.description;
            if (controlsDrawerTitle) controlsDrawerTitle.textContent = tool.title;
        }

        function ensureFileCallout() {
            if (fileCalloutRoot) return fileCalloutRoot;
            fileCalloutRoot = document.createElement('div');
            fileCalloutRoot.className = 'hud-file-callout';
            fileCalloutRoot.hidden = true;
            fileCalloutRoot.setAttribute('aria-hidden', 'true');
            fileCalloutRoot.innerHTML = `
                <span class="hud-file-callout__line"></span>
                <span class="hud-file-callout__dot"></span>
                <span class="hud-file-callout__text">probá tu logo</span>
            `;
            document.body.appendChild(fileCalloutRoot);
            return fileCalloutRoot;
        }

        function syncFileCallout() {
            if (!toolListRoot) return;
            const callout = ensureFileCallout();
            const card = toolListRoot.querySelector('[data-tool-id="files"]');
            if (!card || card.hidden) {
                callout.hidden = true;
                return;
            }

            const rect = card.getBoundingClientRect();
            callout.style.left = `${Math.round(rect.right - 1)}px`;
            callout.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
            callout.hidden = false;
        }

        function renderToolCards() {
            if (!toolListRoot) return;
            toolListRoot.innerHTML = '';

            for (const tool of hudToolCatalog) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'tool-card';
                if (tool.callout) {
                    card.classList.add('tool-card--callout');
                    card.dataset.callout = tool.callout;
                }
                card.dataset.toolId = tool.id;
                card.innerHTML = `
                    <span class="tool-card__index">${tool.index}</span>
                    <span class="tool-card__content">
                        <span class="tool-card__title">${tool.title}</span>
                        <span class="tool-card__meta">${tool.meta}</span>
                    </span>
                    <span class="tool-card__arrow">↗</span>
                    ${tool.callout ? `<span class="tool-card__callout">${tool.callout}</span>` : ''}
                `;

                card.querySelector('.tool-card__arrow').innerHTML = '&#8599;';

                card.addEventListener('mouseenter', () => {
                    hoveredToolId = tool.id;
                    renderInfo(tool);
                });

                card.addEventListener('mouseleave', () => {
                    hoveredToolId = null;
                    renderInfo(hudToolCatalog.find((entry) => entry.id === activeToolId));
                });

                card.addEventListener('click', () => {
                    activeToolId = tool.id;
                    renderInfo(tool);
                    syncFolderVisibility(tool.id);
                    updateToolCardState();
                    setDrawerState(true);
                });

                toolListRoot.appendChild(card);
            }

            syncFileCallout();
        }

        function renderFilters() {
            if (!toolFiltersRoot) return;
            toolFiltersRoot.innerHTML = '';

            for (const filter of hudFilterCatalog) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'tool-filter';
                button.dataset.filterId = filter.id;
                button.textContent = filter.label;
                button.addEventListener('click', () => {
                    activeFilterId = filter.id;
                    updateFilterState();
                    updateToolCardState();
                });
                toolFiltersRoot.appendChild(button);
            }
        }

        function updateFilterState() {
            if (!toolFiltersRoot) return;
            for (const button of toolFiltersRoot.querySelectorAll('.tool-filter')) {
                button.classList.toggle('is-active', button.dataset.filterId === activeFilterId);
            }
        }

        function updateToolCardState() {
            if (!toolListRoot) return;
            let firstVisibleTool = null;
            for (const card of toolListRoot.querySelectorAll('.tool-card')) {
                const tool = hudToolCatalog.find((entry) => entry.id === card.dataset.toolId);
                const matchesFilter = activeFilterId === 'all' || tool.categories.includes(activeFilterId);
                if (matchesFilter && !firstVisibleTool) {
                    firstVisibleTool = tool;
                }
                card.hidden = !matchesFilter;
                card.classList.toggle('is-active', card.dataset.toolId === activeToolId);
            }

            const activeTool = hudToolCatalog.find((entry) => entry.id === activeToolId);
            const activeMatches = activeTool && (activeFilterId === 'all' || activeTool.categories.includes(activeFilterId));
            if (!activeMatches && firstVisibleTool) {
                activeToolId = firstVisibleTool.id;
                syncFolderVisibility(activeToolId);
                renderInfo(firstVisibleTool);
                for (const card of toolListRoot.querySelectorAll('.tool-card')) {
                    card.classList.toggle('is-active', card.dataset.toolId === activeToolId);
                }
            }

            syncFileCallout();
        }

        controlsToggle?.addEventListener('click', () => {
            setDrawerState(!controlsDrawer.classList.contains('is-open'));
        });
        window.addEventListener('resize', syncFileCallout);
        toolListRoot?.addEventListener('scroll', syncFileCallout, { passive: true });

        renderFilters();
        renderToolCards();
        updateFilterState();
        syncFolderVisibility(activeToolId);
        updateToolCardState();
        renderInfo(hudToolCatalog.find((entry) => entry.id === activeToolId));
        setDrawerState(false);

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => loadSVGFromString(e.target.result);
                reader.readAsText(file);
            }
            event.target.value = '';
        });

        textureInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => loadEnvironmentTextureFromDataUrl(e.target.result);
                reader.readAsDataURL(file);
            }
            event.target.value = '';
        });

        applyChromeLevel();
        applyGlassState();
        applyStructureFillState();
        applyGlowState();
        applyChromaticState();
        applyImageFilterState();
        applyEdgeSmoothState();
        applyGradientMapState();
        applyEnvironmentTextureState();
        historyCurrentSnapshot = captureHistorySnapshot();

        controlsPanel?.addEventListener('input', scheduleHistoryCommit, true);
        controlsPanel?.addEventListener('change', scheduleHistoryCommit, true);
        controlsPanel?.addEventListener('click', scheduleHistoryCommit, true);
        controlsPanel?.addEventListener('dragend', scheduleHistoryCommit, true);
        window.addEventListener('keydown', (event) => {
            if (!event.ctrlKey || event.altKey || event.metaKey) return;

            const key = event.key.toLowerCase();
            if (key === 'z' && event.shiftKey) {
                event.preventDefault();
                redoHistory();
            } else if (key === 'z') {
                event.preventDefault();
                undoHistory();
            }
        });

        // --- ANIMATION LOOP ---
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            const elapsedTime = clock.getElapsedTime();
            if (fluidPlaybackSettings.paused) {
                fluidRenderTime = fluidPlaybackSettings.frame;
            } else {
                fluidRenderTime = elapsedTime % fluidLoopDuration;
                fluidPlaybackSettings.frame = fluidRenderTime;
                fluidFrameController.updateDisplay();
            }
            liquidMaterial.userData.uTime.value = fluidRenderTime;
            if (pixelScanPass.enabled) {
                pixelScanPass.uniforms.uTime.value = elapsedTime;
                if (elapsedTime > pixelScanIntroSettings.delay + pixelScanIntroSettings.duration + 0.35) {
                    pixelScanPass.enabled = false;
                }
            }

            if (export360State.active) {
                const elapsed = performance.now() - export360State.startTime;
                const progress = Math.min(elapsed / export360State.durationMs, 1);
                const direction = export360State.clockwise ? 1 : -1;
                svgGroup.rotation.y = export360State.initialRotationY + direction * progress * Math.PI * 2;
            }

            renderer.setClearColor(0x000000, 1);
            renderer.clear(true, true, true);
            composer.render();
        }

        function resizeWorkbench() {
            const { width, height } = getViewportSize();
            const pixelRatio = Math.min(window.devicePixelRatio, 2);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(width, height);
            renderer.setViewport(0, 0, width, height);
            composer.setSize(width, height);
            composer.setPixelRatio(pixelRatio);
            bloomPass.setSize(width, height);
            pixelScanPass.uniforms.uResolution.value.set(width, height);
            edgeSmoothPass.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
        }

        window.addEventListener('resize', resizeWorkbench);
        window.visualViewport?.addEventListener('resize', resizeWorkbench);
        window.visualViewport?.addEventListener('scroll', resizeWorkbench);
        if (window.ResizeObserver && workbenchViewport) {
            const resizeObserver = new ResizeObserver(() => resizeWorkbench());
            resizeObserver.observe(workbenchViewport);
        }
        resizeWorkbench();

        animate();
