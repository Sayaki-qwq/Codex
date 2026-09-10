import * as THREE from "./three.module.min.js";

let userPaused = false;

export function createNebula(home) {
    const host = home.querySelector(".home-cosmos__media");
    const button = home.querySelector(".home-motion");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const events = new AbortController();
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: "low-power" });
    renderer.setClearColor(0x050709);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    host.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.z = 16;
    const galaxy = new THREE.Group();
    galaxy.rotation.set(0.72, -0.2, -0.35);
    scene.add(galaxy);

    // Seeded particles keep the composition stable across reloads and fallback captures.
    let seed = 2026;
    const random = () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const count = matchMedia("(max-width: 760px)").matches ? 12500 : 24000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const dust = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const radius = Math.pow(random(), 1.25) * 5.5 + 0.03;
        const arm = (i % 4) * Math.PI / 2;
        const spread = random() + random() + random() - 1.5;
        const angle = arm + radius * 1.15 + spread * (i % 5 === 0 ? 2.8 : 0.38);
        positions.set([radius, angle, (random() - 0.5) * (0.2 + radius * 0.12)], i * 3);
        const warm = random() > 0.79;
        const core = Math.exp(-radius * 0.6);
        colors.set(warm ? [1, 0.72 + core * 0.2, 0.5 + core * 0.4] : [0.65 + core * 0.35, 0.82 + core * 0.18, 1], i * 3);
        dust[i] = random() < 0.24 ? 1 : 0;
        sizes[i] = dust[i] ? 14 + random() * 26 : (random() > 0.97 ? 9 + random() * 6 : 1.6 + random() * 3.1);
        phases[i] = random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aDust", new THREE.BufferAttribute(dust, 1));
    const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } };
    const material = new THREE.ShaderMaterial({
        uniforms, vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
            uniform float uTime;
            uniform float uPixelRatio;
            attribute float aSize;
            attribute float aPhase;
            attribute float aDust;
            varying vec3 vColor;
            varying float vDust;
            varying float vLight;
            void main() {
                float r = position.x;
                float t = uTime;
                float a = position.y + t * (0.065 + 0.15 / (r + 1.0));
                float wave = sin(r * 1.8 - t * 0.35 + position.y * 2.0);
                r += wave * 0.15 * smoothstep(0.2, 2.0, r);
                a += sin(t * 0.22 + r * 1.3) * 0.09;
                vec3 p = vec3(cos(a) * r, sin(a) * r, position.z);
                p.z += sin(a * 3.0 + r - t * 0.3) * r * 0.085;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp(aSize * uPixelRatio * 12.0 / -mv.z, 1.0, 48.0);
                vColor = color;
                vDust = aDust;
                vLight = 0.72 + 0.28 * sin(aPhase + t * 0.65);
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vDust;
            varying float vLight;
            void main() {
                float r = length(gl_PointCoord - 0.5) * 2.0;
                if (r > 1.0) discard;
                float glow = exp(-r * r * 5.0) * (1.0 - smoothstep(0.65, 1.0, r));
                float alpha = mix(0.9, 0.016, vDust) * glow * vLight;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // Positions are polar coordinates until the vertex shader runs.
    galaxy.add(points);
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
        const x = random() * 2 - 1;
        // A loose diagonal star stream adds depth to the otherwise empty margins.
        const y = i % 3 === 0 ? Math.sin(x * 2.4) * 0.45 + (random() - 0.5) * 0.65 : random() * 2 - 1;
        starPositions.set([x, y, -8 - random() * 6], i * 3);
        starColors.set(random() > 0.8 ? [1, 0.8, 0.6] : [0.64, 0.79, 1], i * 3);
        starSizes[i] = random() > 0.985 ? 5 + random() * 3 : 0.8 + random() * 1.7;
        starPhases[i] = random() * Math.PI * 2;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(starPhases, 1));
    const starMaterial = new THREE.ShaderMaterial({
        uniforms, vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
            uniform float uTime;
            uniform float uPixelRatio;
            attribute float aSize;
            attribute float aPhase;
            varying vec3 vColor;
            varying float vLight;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uPixelRatio;
                vColor = color;
                vLight = 0.32 + 0.2 * sin(aPhase + uTime * 0.35);
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vLight;
            void main() {
                vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
                float r = length(p);
                if (r > 1.0) discard;
                float light = exp(-r * r * 6.0);
                light += 0.15 * exp(-min(p.x, p.y) * 24.0) * (1.0 - r);
                gl_FragColor = vec4(vColor, light * vLight);
            }
        `,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    let frame = null;
    let previousTime = 0;
    let visible = true;
    let contextLost = false;
    let disposed = false;
    const pointer = new THREE.Vector2();
    const shouldAnimate = () => !userPaused && !reduced.matches && visible && !document.hidden && !contextLost && !disposed;
    const draw = () => renderer.render(scene, camera);
    const tick = now => {
        frame = null;
        if (!shouldAnimate()) return;
        const elapsed = previousTime ? Math.min((now - previousTime) / 1000, 0.08) : 0;
        previousTime = now;
        uniforms.uTime.value += elapsed;
        galaxy.rotation.x += (0.72 + pointer.y * 0.18 - galaxy.rotation.x) * 0.035;
        galaxy.rotation.y += (-0.2 + pointer.x * 0.2 - galaxy.rotation.y) * 0.035;
        draw();
        frame = requestAnimationFrame(tick);
    };
    const syncMotion = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        previousTime = 0;
        const label = userPaused ? "播放星云动画" : "暂停星云动画";
        button.setAttribute("aria-pressed", String(userPaused));
        button.setAttribute("aria-label", label);
        button.title = label;
        if (shouldAnimate()) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const scale = Math.min(1, camera.aspect * 1.02);
        const spread = THREE.MathUtils.smoothstep(camera.aspect, 0.8, 1.7);
        galaxy.scale.set(scale * (1 + spread * 0.24), scale * (1 + spread * 0.04), scale);
        galaxy.position.y = camera.aspect < 1 ? -0.25 : -0.8;
        const backgroundHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 30;
        stars.scale.set(backgroundHeight * camera.aspect, backgroundHeight, 1);
        if (!contextLost) draw();
    };
    button.hidden = false;
    button.addEventListener("click", () => { userPaused = !userPaused; syncMotion(); }, { signal: events.signal });
    home.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse" || !shouldAnimate()) return;
        const rect = home.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
    }, { signal: events.signal });
    home.addEventListener("pointerleave", () => pointer.set(0, 0), { signal: events.signal });
    reduced.addEventListener("change", syncMotion, { signal: events.signal });
    document.addEventListener("visibilitychange", syncMotion, { signal: events.signal });
    renderer.domElement.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        contextLost = true;
        renderer.domElement.style.visibility = "hidden";
        button.hidden = true;
        syncMotion();
    }, { signal: events.signal });
    renderer.domElement.addEventListener("webglcontextrestored", () => {
        contextLost = false;
        renderer.domElement.style.visibility = "";
        button.hidden = false;
        resize();
        syncMotion();
    }, { signal: events.signal });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const visibilityObserver = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        syncMotion();
    });
    visibilityObserver.observe(home);
    resize();
    syncMotion();

    return () => {
        disposed = true;
        if (frame !== null) cancelAnimationFrame(frame);
        events.abort();
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        geometry.dispose();
        material.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
    };
}
