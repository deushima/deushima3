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

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 55);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3; 
        document.body.appendChild(renderer.domElement);

        const glowSettings = {
            enabled: true,
            strength: 0.14,
            radius: 0.16,
            threshold: 0.32
        };

        const chromaticSettings = {
            enabled: true,
            intensity: 0.0021,
            angle: 1.48,
            chromeLevel: 0.87,
            preset: 'balanced'
        };

        const composer = new EffectComposer(renderer);
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        composer.setSize(window.innerWidth, window.innerHeight);

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            glowSettings.strength,
            glowSettings.radius,
            glowSettings.threshold
        );
        composer.addPass(bloomPass);

        const rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms.amount.value = chromaticSettings.intensity;
        rgbShiftPass.uniforms.angle.value = chromaticSettings.angle;
        composer.addPass(rgbShiftPass);

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
            metalness: 0.18,
            roughness: 0.18,       
            clearcoat: 0.42,        
            clearcoatRoughness: 0.03,
            iridescence: 0.28,      
            iridescenceIOR: 1.08,   
            iridescenceThicknessRange: [420, 560], 
            iridescenceThicknessMap: dummyTex,
            transmission: 0.72,
            thickness: 2.4,
            ior: 1.42,
            reflectivity: 0.72,
            envMapIntensity: 1.35,
            specularIntensity: 1.0,
            attenuationDistance: 0.65,
            attenuationColor: new THREE.Color('#d3d6eb'),
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
            enabled: true,
            transmission: liquidMaterial.transmission,
            thickness: liquidMaterial.thickness,
            ior: liquidMaterial.ior,
            reflectivity: liquidMaterial.reflectivity,
            envMapIntensity: liquidMaterial.envMapIntensity,
            attenuationDistance: liquidMaterial.attenuationDistance,
            attenuationColor: '#d3d6eb'
        };

        const bevelSettings = {
            enableBevelDynamics: false,
            bevelSize: 2.5,
            bevelThickness: 2.5,
            bevelSegments: 96,
            bevelFlowInfluence: 1.0
        };

        const environmentTextureSettings = {
            enabled: false,
            affectLogo: false,
            affectBackground: false,
            envIntensity: liquidMaterial.envMapIntensity,
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

            liquidMaterial.envMapIntensity = environmentTextureSettings.envIntensity;

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
            uSpeed: { value: 0.0 },         
            uScale: { value: 0.00298 },       
            uDistortion: { value: 0.68 },    
            uEdgeProtection: { value: 1.0 }, 
            uShapeReactivity: { value: 0.42 },
            uBevelFlowMix: { value: 0.0 },
            uShapeMask: { value: dummyTex },
            uShapeBounds: { value: new THREE.Vector4(0,0,1,1) }
        };

        liquidMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = liquidMaterial.userData.uTime;
            shader.uniforms.uSpeed = liquidMaterial.userData.uSpeed;
            shader.uniforms.uScale = liquidMaterial.userData.uScale;
            shader.uniforms.uDistortion = liquidMaterial.userData.uDistortion;
            shader.uniforms.uEdgeProtection = liquidMaterial.userData.uEdgeProtection;
            shader.uniforms.uShapeReactivity = liquidMaterial.userData.uShapeReactivity;
            shader.uniforms.uBevelFlowMix = liquidMaterial.userData.uBevelFlowMix;
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
                uniform float uSpeed;
                uniform float uScale;
                uniform float uDistortion;
                uniform float uEdgeProtection;
                uniform float uShapeReactivity;
                uniform float uBevelFlowMix;
                
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
                
                // Flow along contours
                vec2 contourTangent = vec2(-maskGrad.y, maskGrad.x);
                float contourFlow = 0.5 + bevelRedirect * uBevelFlowMix * 1.6;
                p.xy += contourTangent * (uTime * uSpeed * contourFlow);
                p.y -= uTime * uSpeed * 0.1;
                
                // Domain Warping
                vec3 warp;
                warp.x = snoise(p + vec3(0.0, 0.0, uTime * 0.1));
                warp.y = snoise(p + vec3(114.5, 22.1, uTime * 0.1));
                warp.z = snoise(p + vec3(233.2, 51.5, uTime * 0.1));
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
            depth: 100.0,
            bevelEnabled: true,
            bevelSegments: bevelSettings.bevelSegments,
            steps: 2,
            bevelSize: bevelSettings.bevelSize,
            bevelThickness: bevelSettings.bevelThickness
        };

        const svgGroup = new THREE.Group();
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
        }

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
                liquidMaterial.transmission = 0.0;
                liquidMaterial.thickness = 0.0;
                liquidMaterial.attenuationDistance = 1000;
            }
            liquidMaterial.needsUpdate = true;
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
            svgGroup.updateMatrixWorld();

            while(svgGroup.children.length > 0){ 
                const child = svgGroup.children[0];
                svgGroup.remove(child); 
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
                    svgGroup.add(mesh);
                }
            }

            if (allShapes.length > 0) {
                generateShapeMaskTexture(allShapes);
            }

            // --- PERFECT CENTERING FIX ---
            // 1. Calculate proper scale before moving anything
            const box = new THREE.Box3().setFromObject(svgGroup);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (maxDim > 0) {
                const scale = 25 / maxDim; 
                svgGroup.scale.set(scale, -scale, scale); 
            }

            // 2. Recalculate bounding box AFTER scale is applied
            svgGroup.updateMatrixWorld();
            const scaledBox = new THREE.Box3().setFromObject(svgGroup);
            const finalCenter = scaledBox.getCenter(new THREE.Vector3());
            
            // 3. Move group into absolute center of the camera view
            svgGroup.position.sub(finalCenter);
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
            document.body.style.backgroundColor = v;
        });

        const effectFolder = gui.addFolder('Fluid Dynamics');
        effectFolder.add(liquidMaterial.userData.uScale, 'value', 0.0001, 0.015).name('Ripple Scale');
        effectFolder.add(liquidMaterial.userData.uShapeReactivity, 'value', 0.0, 5.0).name('Shape Reactivity');
        effectFolder.add(liquidMaterial.userData.uDistortion, 'value', 0.0, 5.0).name('Distortion');
        effectFolder.add(liquidMaterial.userData.uEdgeProtection, 'value', 0.0, 1.0).name('Edge Sharpness');
        
        const iridescenceFolder = gui.addFolder('Iridescence (Rainbow)');
        iridescenceFolder.add(liquidMaterial, 'iridescence', 0.0, 1.0).name('Intensity');
        iridescenceFolder.add(liquidMaterial, 'iridescenceIOR', 1.0, 3.0).name('Index of Refraction');
        
        const thicknessProxy = { min: 420, max: 560 };
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

        const glassFolder = gui.addFolder('Glass Texture');
        glassFolder.add(glassSettings, 'enabled').name('Enable Glass').onChange(() => {
            applyGlassState();
        });
        glassFolder.add(glassSettings, 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(v => {
            liquidMaterial.transmission = v;
        });
        glassFolder.add(glassSettings, 'thickness', 0.0, 8.0, 0.01).name('Glass Thickness').onChange(v => {
            liquidMaterial.thickness = v;
        });
        glassFolder.add(glassSettings, 'ior', 1.0, 2.5, 0.01).name('Glass IOR').onChange(v => {
            liquidMaterial.ior = v;
        });
        glassFolder.add(glassSettings, 'reflectivity', 0.0, 1.0, 0.01).name('Reflectivity').onChange(v => {
            liquidMaterial.reflectivity = v;
        });
        glassFolder.add(glassSettings, 'envMapIntensity', 0.0, 3.0, 0.01).name('Env Reflection').onChange(v => {
            liquidMaterial.envMapIntensity = v;
        });
        glassFolder.add(glassSettings, 'attenuationDistance', 0.0, 3.0, 0.01).name('Tint Distance').onChange(v => {
            liquidMaterial.attenuationDistance = v;
        });
        glassFolder.addColor(glassSettings, 'attenuationColor').name('Glass Tint').onChange(v => {
            liquidMaterial.attenuationColor.set(v);
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
        });
        chromaticFolder.add(chromaticSettings, 'preset', ['subtle', 'balanced', 'prism', 'glitch']).name('Variation').onChange(v => {
            applyChromaticPreset(v);
        });

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

        const fileInput = document.getElementById('fileInput');
        const textureInput = document.getElementById('textureInput');
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
        
        const fileFolder = gui.addFolder('File Management');
        fileFolder.add(fileSettings, 'svgUrl').name('SVG URL');
        fileFolder.add(fileSettings, 'loadUrl').name('Load from URL');
        fileFolder.add(fileSettings, 'uploadSVG').name('Upload Custom SVG');
        fileFolder.add(fileSettings, 'exportWithBackground').name('Export PNG + BG');
        fileFolder.add(fileSettings, 'exportTransparent').name('Export PNG Transparent');
        fileFolder.add(fileSettings, 'resetDefault').name('Reset Logo');

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
        applyGlowState();
        applyChromaticState();

        // --- ANIMATION LOOP ---
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            liquidMaterial.userData.uTime.value = clock.getElapsedTime();
            composer.render();
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
            bloomPass.setSize(window.innerWidth, window.innerHeight);
        });

        // --- CURSOR FOLLOWER ---
        if (window.matchMedia('(pointer: fine)').matches) {
            const followerEl = document.createElement('div');
            followerEl.className = 'cursor-follower';
            document.body.appendChild(followerEl);

            const pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
            const follower = { x: pointer.x, y: pointer.y };

            const setXY = (el, x, y, scale = 1) => {
                el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
            };

            window.addEventListener('pointermove', (event) => {
                pointer.x = event.clientX;
                pointer.y = event.clientY;
                followerEl.style.opacity = '0.7';
            });

            window.addEventListener('pointerleave', () => {
                followerEl.style.opacity = '0';
            });

            window.addEventListener('pointerenter', () => {
                followerEl.style.opacity = '0.7';
            });

            function animateCursor() {
                follower.x += (pointer.x - follower.x) * 0.055;
                follower.y += (pointer.y - follower.y) * 0.055;
                setXY(followerEl, follower.x, follower.y, 1);

                requestAnimationFrame(animateCursor);
            }

            animateCursor();
        }

        animate();
