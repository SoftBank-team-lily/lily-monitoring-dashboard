'use client';

import { useI18n } from "@/lib/i18n/provider";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OBSERVATION_POINTS, type PanelId } from '@/lib/flower-particles';
import { ControlGuide } from './ControlGuide';
import s from './dashboard.module.css';
export type { PanelId } from '@/lib/flower-particles';

type SceneControls = { update: (panel: PanelId | null) => void; reset: () => void; resetPanels: () => void };
interface Props { labels?: Partial<Record<PanelId, string>>; app: string; active: PanelId | null; panels: Record<PanelId, ReactNode>; onSelect: (panel: PanelId) => void; onReset: () => void; }
const PANEL_PLACES: Record<PanelId, { position: [number, number, number]; width: number }> = {
  metrics: { position: [-3.4207, 1.8558, .6922], width: 420 },
  compare: { position: [3.5505, 1.7524, -.0738], width: 430 },
  servers: { position: [-3.7213, -1.4524, 1.2127], width: 420 },
  logs: { position: [4.4824, -1.2001, .8666], width: 440 },
  trends: { position: [2.5659, -3.501, 2.1882], width: 440 },
  traffic: { position: [-2.1234, -3.6142, 2.1252], width: 440 },
};
const PANEL_SCALE = .01;

/** Flower, stars, connections and HTML panels share one Three.js scene and one camera. */
export default function ParticleStage({ app, active, panels, onSelect, onReset, labels }: Props) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const htmlHost = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const controls = useRef<SceneControls | null>(null);
  const activeRef = useRef(active);
  const selectRef = useRef(onSelect);
  const [available, setAvailable] = useState(true);
  const [mounts, setMounts] = useState<{ id: PanelId; element: HTMLDivElement }[]>([]);
  useEffect(() => { activeRef.current = active; controls.current?.update(active); }, [active]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (available || !active) return;
    const panel = root.current?.querySelector<HTMLElement>(`[data-panel="${active}"]`);
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [available, active]);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let disposeScene: (() => void) | undefined;
    async function setup() {
      const [THREE, { buildFlowerParticles, loadFlowerMask, FLOWER_SCALE }, { CSS3DRenderer, CSS3DObject }, { OrbitControls }] = await Promise.all([
        import('three'), import('@/lib/flower-particles'), import('three/addons/renderers/CSS3DRenderer.js'), import('three/addons/controls/OrbitControls.js'),
      ]);
      const attributes = buildFlowerParticles(await loadFlowerMask());
      const observationPoints = OBSERVATION_POINTS.map((point) => ({ ...point, position: attributes.attachments[point.id] }));
      if (disposed || !host.current || !htmlHost.current) return;
      const container = host.current;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
      catch { setAvailable(false); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);
      const htmlRenderer = new CSS3DRenderer();
      htmlRenderer.domElement.className = s.cssSpace;
      htmlHost.current.appendChild(htmlRenderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(43, 1, .1, 90);
      camera.position.set(.3, 2.35, 13.7);
      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.target.set(0, -.35, .4);
      orbit.enableDamping = !reduce.matches; orbit.dampingFactor = .07;
      orbit.minDistance = 8; orbit.maxDistance = 23;
      orbit.minPolarAngle = 0; orbit.maxPolarAngle = Math.PI;
      orbit.minAzimuthAngle = -Infinity; orbit.maxAzimuthAngle = Infinity;
      orbit.rotateSpeed = .55; orbit.panSpeed = .55;
      orbit.update();
      const initialCamera = camera.position.clone(), initialTarget = orbit.target.clone();
      const overviewDirection = initialCamera.clone().sub(initialTarget).normalize();
      const initialOrientationInverse = camera.quaternion.clone().invert();
      const layoutRotation = new THREE.Quaternion();
      const cameraFacing = new THREE.Vector3();
      const flower = new THREE.Group();
      flower.quaternion.copy(camera.quaternion);
      flower.position.set(0, .5, 0).applyQuaternion(camera.quaternion);
      scene.add(flower);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(attributes.positions, 3));
      geometry.setAttribute('aColor', new THREE.BufferAttribute(attributes.colors, 3));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(attributes.sizes, 1));
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(attributes.phases, 1));
      geometry.setAttribute('aAlpha', new THREE.BufferAttribute(attributes.alphas, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, pixelScale: { value: 400 }, motion: { value: reduce.matches ? 0 : 1 } },
        vertexShader: `
          attribute vec3 aColor; attribute float aSize; attribute float aPhase; attribute float aAlpha;
          uniform float time; uniform float pixelScale; uniform float motion;
          varying vec3 vColor; varying float vAlpha;
          void main() {
            float rand = aPhase / 6.28318530718;
            vec3 p = position;
            p.x += sin(time * .6 + rand * 40.0) * .0055 * motion;
            p.y += cos(time * .5 + rand * 33.0) * .0055 * motion;
            p.z += sin(time * .4 + rand * 21.0) * .00875 * motion;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * pixelScale / -mv.z;
            vColor = aColor;
            vAlpha = aAlpha * (.62 + .38 * sin(time * (1.2 + rand * 3.0) + rand * 60.0));
          }`,
        fragmentShader: `
          varying vec3 vColor; varying float vAlpha;
          void main() {
            float r = length(gl_PointCoord - .5);
            if (r > .5) discard;
            gl_FragColor = vec4(vColor, smoothstep(.5, 0.0, r) * vAlpha);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      flower.add(new THREE.Points(geometry, material));
      // Stars occupy several depths, so camera movement creates real parallax.
      let seed = 8;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const starCount = 2400;
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);
      const starSizes = new Float32Array(starCount);
      const starPhases = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (random() - .5) * 60;
        starPositions[i * 3 + 1] = (random() - .5) * 36;
        starPositions[i * 3 + 2] = (random() - .5) * 90;
        const warmth = random(), brightness = .4 + random() * .6;
        starColors[i * 3] = brightness * (.78 + warmth * .22);
        starColors[i * 3 + 1] = brightness * .85;
        starColors[i * 3 + 2] = brightness * (1 - warmth * .18);
        starSizes[i] = random() > .96 ? .12 : .035 + random() * .045;
        starPhases[i] = random() * Math.PI * 2;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
      starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
      starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
      const starMaterial = new THREE.ShaderMaterial({
        uniforms: { pixelScale: { value: 400 } },
        vertexShader: `
          attribute vec3 aColor; attribute float aSize;
          uniform float pixelScale; varying vec3 vColor;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(aSize * pixelScale / -mv.z, 1.0, 8.0);
            vColor = aColor;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - vec2(.5)) * 2.0;
            if (d > 1.0) discard;
            gl_FragColor = vec4(vColor, pow(1.0 - d, 1.3) * .88);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(starGeometry, starMaterial));
      const panelObjects = observationPoints.map(({ id }) => {
        const place = PANEL_PLACES[id];
        const element = document.createElement('div');
        element.className = s.cssObject;
        element.style.width = `${place.width}px`;
        element.dataset.spaceObject = id;
        const object = new CSS3DObject(element);
        object.position.set(...place.position); object.quaternion.copy(camera.quaternion);
        object.scale.setScalar(PANEL_SCALE); scene.add(object);
        const offset = object.position.clone().sub(initialTarget);
        return { id, object, element, offset, defaultOffset: offset.clone() };
      });
      setMounts(panelObjects.map(({ id, element }) => ({ id, element })));
      const connectionMaterial = new THREE.LineBasicMaterial({ color: '#c68ba5', transparent: true, opacity: .5 });
      const connections = observationPoints.map(() => {
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        const line = new THREE.Line(lineGeometry, connectionMaterial.clone());
        line.frustumCulled = false;
        scene.add(line); return line;
      });
      const projected = new THREE.Vector3(), startPoint = new THREE.Vector3(), endPoint = new THREE.Vector3();
      const edge = new THREE.Vector3(), midpoint = new THREE.Vector3();
      const panelInverse = new THREE.Matrix4();
      const dragDelta = new THREE.Vector3(), dragDepth = new THREE.Vector3();
      const dragInverse = new THREE.Quaternion();
      const normal = new THREE.Vector3();
      const raycaster = new THREE.Raycaster(); raycaster.params.Points.threshold = .18;
      const targets = new THREE.BufferGeometry();
      targets.setAttribute('position', new THREE.Float32BufferAttribute(observationPoints.flatMap((p) => [...p.position]), 3));
      const targetMaterial = new THREE.PointsMaterial({ size: .085, color: '#ffd7a0', transparent: true, opacity: .9, depthWrite: false });
      const targetPoints = new THREE.Points(targets, targetMaterial); flower.add(targetPoints);
      const screenPointer = new THREE.Vector2();
      const cameraDestination = initialCamera.clone(), targetDestination = initialTarget.clone();
      let selected = activeRef.current, travelling = false, width = 1, height = 1, frame = 0, closed = false, inViewport = true;
      let last = performance.now(); const started = last;
      let savedCamera = initialCamera.clone(), savedTarget = initialTarget.clone();
      let dragging: { id: PanelId; pointerId: number; handle: HTMLElement; x: number; y: number } | null = null;

      function movePanel(id: PanelId, dx: number, dy: number) {
        const panel = panelObjects.find((item) => item.id === id);
        if (!panel || selected || travelling) return;
        const bounds = container.getBoundingClientRect();
        const rect = panel.element.getBoundingClientRect();
        // Keep the panel reachable, allowing an initially clipped card to move inward.
        dx = THREE.MathUtils.clamp(dx, Math.min(0, bounds.left + 12 - rect.left), Math.max(0, bounds.right - 12 - rect.right));
        dy = THREE.MathUtils.clamp(dy, Math.min(0, bounds.top + 132 - rect.top), Math.max(0, bounds.bottom - 56 - rect.bottom));
        const depth = -dragDepth.copy(panel.object.position).applyMatrix4(camera.matrixWorldInverse).z;
        const unitsPerPixel = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
        const overviewScale = camera.position.distanceTo(orbit.target) / initialCamera.distanceTo(initialTarget);
        dragInverse.copy(camera.quaternion).multiply(initialOrientationInverse).invert();
        // Store the movement in layout coordinates; the render loop owns CSS transforms.
        dragDelta.set(dx, -dy, 0).multiplyScalar(unitsPerPixel / overviewScale)
          .applyQuaternion(camera.quaternion).applyQuaternion(dragInverse);
        panel.offset.add(dragDelta);
        connectionDirty = true;
        wake();
      }
      function finishDrag() {
        if (!dragging) return;
        const previous = dragging;
        dragging = null;
        previous.handle.removeAttribute('data-dragging');
        if (previous.handle.hasPointerCapture(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
        orbit.enabled = selected === null && !travelling;
        if (!closed) wake();
      }
      function dragHandle(target: EventTarget | null) {
        return target instanceof Element ? target.closest<HTMLElement>('[data-panel-drag]') : null;
      }
      function startDrag(event: PointerEvent) {
        const handle = dragHandle(event.target);
        if (!handle || event.button !== 0 || !event.isPrimary || selected || travelling || dragging) return;
        const id = handle.dataset.panelDrag as PanelId;
        if (!panelObjects.some((panel) => panel.id === id)) return;
        event.preventDefault(); event.stopPropagation();
        handle.focus({ preventScroll: true });
        dragging = { id, pointerId: event.pointerId, handle, x: event.clientX, y: event.clientY };
        handle.setAttribute('data-dragging', 'true');
        handle.setPointerCapture(event.pointerId);
        orbit.enabled = false;
      }
      function dragMove(event: PointerEvent) {
        if (!dragging || event.pointerId !== dragging.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const { id, x, y } = dragging;
        dragging.x = event.clientX; dragging.y = event.clientY;
        movePanel(id, event.clientX - x, event.clientY - y);
      }
      function dragEnd(event: PointerEvent) {
        if (!dragging || event.pointerId !== dragging.pointerId) return;
        event.stopPropagation(); finishDrag();
      }
      function dragKey(event: KeyboardEvent) {
        const handle = dragHandle(event.target);
        if (!handle || selected || travelling) return;
        const step = event.shiftKey ? 48 : 16;
        const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (!delta[event.key]) return;
        event.preventDefault(); event.stopPropagation();
        movePanel(handle.dataset.panelDrag as PanelId, ...delta[event.key]);
      }
      function travel(panel: PanelId | null) {
        finishDrag();
        if (panel && !selected) { savedCamera.copy(camera.position); savedTarget.copy(orbit.target); }
        selected = panel;
        panelObjects.forEach(({ id, element, object }) => {
          element.style.width = `${id === panel ? 760 : PANEL_PLACES[id].width}px`;
          element.style.height = id === panel ? '540px' : 'auto';
          if (id === panel) object.scale.setScalar(PANEL_SCALE);
        });
        if (panel) {
          const object = panelObjects.find((p) => p.id === panel)!.object;
          targetDestination.copy(object.position);
          normal.set(0, 0, 1).applyQuaternion(object.quaternion);
          const fovPixels = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          const distance = Math.max(760 * PANEL_SCALE * fovPixels / (width * .78), 540 * PANEL_SCALE * fovPixels / (height * .83));
          cameraDestination.copy(object.position).addScaledVector(normal, distance);
        } else { cameraDestination.copy(savedCamera); targetDestination.copy(savedTarget); }
        orbit.minDistance = .1; orbit.maxDistance = 80;
        travelling = true; orbit.enabled = false; wake();
      }
      function updatePanels() {
        let moved = false;
        layoutRotation.copy(camera.quaternion).multiply(initialOrientationInverse);
        const overviewScale = camera.position.distanceTo(orbit.target) / initialCamera.distanceTo(initialTarget);
        panelObjects.forEach(({ object, offset }) => {
          if (!selected && !travelling) {
            projected.copy(offset).applyQuaternion(layoutRotation).multiplyScalar(overviewScale).add(orbit.target);
            if (object.position.distanceToSquared(projected) > 1e-12 || Math.abs(object.scale.x - PANEL_SCALE * overviewScale) > 1e-9) moved = true;
            object.position.copy(projected); object.scale.setScalar(PANEL_SCALE * overviewScale);
          }
          if (object.quaternion.angleTo(camera.quaternion) > 1e-7) moved = true;
          object.quaternion.copy(camera.quaternion);
        });
        if (moved) connectionDirty = true;
      }
      function updateConnections() {
        flower.updateMatrixWorld();
        cameraFacing.set(0, 0, 1).applyQuaternion(camera.quaternion);
        observationPoints.forEach((anchor, i) => {
          const { object, element } = panelObjects[i];
          if (!element.offsetWidth || !element.offsetHeight) return;
          object.updateMatrixWorld();
          startPoint.set(anchor.position[0], anchor.position[1], anchor.position[2]).applyMatrix4(flower.matrixWorld);
          edge.copy(flower.position).applyMatrix4(panelInverse.copy(object.matrixWorld).invert());
          const factor = Math.min(element.offsetWidth / (2 * Math.max(Math.abs(edge.x), 1e-9)), element.offsetHeight / (2 * Math.max(Math.abs(edge.y), 1e-9)));
          if (Math.abs(edge.x) + Math.abs(edge.y) < 1e-9) edge.set(0, element.offsetHeight / 2, 0);
          else edge.set(edge.x * factor, edge.y * factor, 0);
          element.style.setProperty('--connection-x', `${50 + edge.x / element.offsetWidth * 100}%`);
          element.style.setProperty('--connection-y', `${50 - edge.y / element.offsetHeight * 100}%`);
          endPoint.copy(edge).applyMatrix4(object.matrixWorld);
          midpoint.copy(startPoint).lerp(endPoint, .5).addScaledVector(cameraFacing, .35);
          const line = connections[i];
          const vertices = line.geometry.getAttribute('position');
          for (let j = 0; j <= 24; j++) {
            const t = j / 24, u = 1 - t;
            vertices.setXYZ(j, u * u * startPoint.x + 2 * u * t * midpoint.x + t * t * endPoint.x, u * u * startPoint.y + 2 * u * t * midpoint.y + t * t * endPoint.y, u * u * startPoint.z + 2 * u * t * midpoint.z + t * t * endPoint.z);
          }
          vertices.needsUpdate = true;
          line.material.opacity = selected && selected !== anchor.id ? .08 : selected ? .8 : .5;
        });
      }
      let connectionDirty = true;
      function draw(now: number) {
        const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
        if (travelling) {
          const blend = reduce.matches ? 1 : 1 - Math.exp(-dt * 5.5);
          camera.position.lerp(cameraDestination, blend); orbit.target.lerp(targetDestination, blend);
          if (camera.position.distanceTo(cameraDestination) < .01 && orbit.target.distanceTo(targetDestination) < .01) {
            camera.position.copy(cameraDestination); orbit.target.copy(targetDestination); travelling = false; orbit.enabled = selected === null;
            if (!selected) { orbit.minDistance = 8; orbit.maxDistance = Math.max(23, initialCamera.distanceTo(initialTarget) * 1.7); }
          }
        }
        if (!dragging) orbit.update();
        camera.updateMatrixWorld(); flower.updateMatrixWorld();
        updatePanels();
        material.uniforms.time.value = reduce.matches ? 0 : (now - started) / 1000;
        material.uniforms.motion.value = reduce.matches ? 0 : FLOWER_SCALE;
        if (connectionDirty) { updateConnections(); connectionDirty = false; }
        renderer.render(scene, camera); htmlRenderer.render(scene, camera);
        const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[data-anchor]');
        observationPoints.forEach((anchor, i) => {
          projected.set(anchor.position[0], anchor.position[1], anchor.position[2]).applyMatrix4(flower.matrixWorld).project(camera);
          const button = buttons?.[i];
          if (button) { button.style.left = `${(projected.x * .5 + .5) * width}px`; button.style.top = `${(-projected.y * .5 + .5) * height}px`; }
        });
        root.current?.setAttribute('data-camera-distance', camera.position.distanceTo(orbit.target).toFixed(3));
        root.current?.setAttribute('data-camera-position', camera.position.toArray().map((v) => v.toFixed(3)).join(','));
        root.current?.setAttribute('data-camera-azimuth', orbit.getAzimuthalAngle().toFixed(4));
        root.current?.setAttribute('data-camera-polar', orbit.getPolarAngle().toFixed(4));
        root.current?.setAttribute('data-particle-count', String(attributes.sizes.length));
      }
      function animate(now: number) {
        if (closed) return;
        if (inViewport && !document.hidden) draw(now); else last = now;
        if (!reduce.matches || travelling) frame = requestAnimationFrame(animate);
      }
      function wake() { cancelAnimationFrame(frame); connectionDirty = true; draw(performance.now()); if (!reduce.matches || travelling) frame = requestAnimationFrame(animate); }
      controls.current = {
        update(panel) { travel(panel); },
        reset() { savedCamera.copy(initialCamera); savedTarget.copy(initialTarget); if (!selected) travel(null); },
        resetPanels() {
          if (selected || travelling) return;
          finishDrag();
          panelObjects.forEach(({ offset, defaultOffset }) => offset.copy(defaultOffset));
          wake();
        },
      };
      const resize = new ResizeObserver(() => {
        width = container.clientWidth; height = container.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height); htmlRenderer.setSize(width, height);
        camera.aspect = width / height; camera.updateProjectionMatrix();
        // Keep the overview inside the viewport without resetting the user's orbit or zoom.
        const previousDistance = initialCamera.distanceTo(initialTarget);
        const fovPixels = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        const fitDepth = Math.max(13.3, 15.8 * fovPixels / (width * .96));
        initialCamera.copy(overviewDirection).multiplyScalar(fitDepth / overviewDirection.z).add(initialTarget);
        const fitRatio = initialCamera.distanceTo(initialTarget) / previousDistance;
        savedCamera.sub(savedTarget).multiplyScalar(fitRatio).add(savedTarget);
        if (!selected) camera.position.sub(orbit.target).multiplyScalar(fitRatio).add(orbit.target);
        if (!selected && travelling) cameraDestination.copy(savedCamera);
        if (!selected && !travelling) orbit.maxDistance = Math.max(23, initialCamera.distanceTo(initialTarget) * 1.7);
        material.uniforms.pixelScale.value = (height / 900 * 20 + 4) * renderer.getPixelRatio() * FLOWER_SCALE;
        starMaterial.uniforms.pixelScale.value = height * renderer.getPixelRatio() * 1.65;
        if (selected) travel(selected); else wake();
      });
      resize.observe(container);
      // Portal content can arrive after the renderer, and filtering can change panel height.
      const panelResize = new ResizeObserver(() => { connectionDirty = true; if (reduce.matches) draw(performance.now()); });
      panelObjects.forEach(({ element }) => panelResize.observe(element));
      const intersection = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; });
      intersection.observe(container);
      function changed() { if (reduce.matches && !travelling) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { connectionDirty = true; draw(performance.now()); }); } }
      function motionChanged() { orbit.enableDamping = !reduce.matches; wake(); }
      let downX = 0, downY = 0;
      const canvas = renderer.domElement;
      const panelLayer = htmlRenderer.domElement;
      function down(e: PointerEvent) { downX = e.clientX; downY = e.clientY; }
      function up(e: PointerEvent) {
        if (selected || Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
        const rect = container.getBoundingClientRect();
        screenPointer.set((e.clientX - rect.left) / width * 2 - 1, -(e.clientY - rect.top) / height * 2 + 1);
        raycaster.setFromCamera(screenPointer, camera);
        const index = raycaster.intersectObject(targetPoints)[0]?.index;
        if (index !== undefined && observationPoints[index]) selectRef.current(observationPoints[index].id);
      }
      function lost(e: Event) { e.preventDefault(); finishDrag(); cancelAnimationFrame(frame); setAvailable(false); }
      panelLayer.addEventListener('pointerdown', startDrag);
      panelLayer.addEventListener('pointermove', dragMove);
      panelLayer.addEventListener('pointerup', dragEnd);
      panelLayer.addEventListener('pointercancel', dragEnd);
      panelLayer.addEventListener('lostpointercapture', dragEnd);
      panelLayer.addEventListener('keydown', dragKey);
      window.addEventListener('blur', finishDrag);
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('webglcontextlost', lost);
      orbit.addEventListener('change', changed); reduce.addEventListener('change', motionChanged); document.addEventListener('visibilitychange', wake);
      wake();
      if (selected) travel(selected);
      disposeScene = () => {
        closed = true; controls.current = null; cancelAnimationFrame(frame); resize.disconnect(); panelResize.disconnect(); intersection.disconnect();
        finishDrag();
        panelLayer.removeEventListener('pointerdown', startDrag);
        panelLayer.removeEventListener('pointermove', dragMove);
        panelLayer.removeEventListener('pointerup', dragEnd);
        panelLayer.removeEventListener('pointercancel', dragEnd);
        panelLayer.removeEventListener('lostpointercapture', dragEnd);
        panelLayer.removeEventListener('keydown', dragKey);
        window.removeEventListener('blur', finishDrag);
        reduce.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', wake);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('webglcontextlost', lost);
        orbit.removeEventListener('change', changed); orbit.dispose();
        geometry.dispose(); material.dispose(); starGeometry.dispose(); starMaterial.dispose(); targets.dispose(); targetMaterial.dispose();
        connectionMaterial.dispose(); connections.forEach((line) => { line.geometry.dispose(); line.material.dispose(); });
        panelObjects.forEach(({ object }) => scene.remove(object));
        renderer.dispose(); canvas.remove(); htmlRenderer.domElement.remove();
      };
    }
    void setup().catch(() => setAvailable(false));
    return () => { disposed = true; disposeScene?.(); };
  }, []);

  return <div className={s.particleStage} ref={root} data-active={active ?? 'overview'} data-webgl={available ? mounts.length ? 'ready' : 'loading' : 'unavailable'}>
    <div className={s.particleCanvas} ref={host} aria-hidden="true" />
    <div className={s.htmlSpaceHost} ref={htmlHost} />
    {available && mounts.map(({ id, element }) => {
      const point = OBSERVATION_POINTS.find((p) => p.id === id)!;
      return createPortal(<div id={id} className={s.scenePanel} data-panel={id} data-selected={active === id || undefined} tabIndex={-1} inert={active !== null && active !== id} aria-hidden={active !== null && active !== id || undefined} aria-label={`${labels?.[id] ?? t(point.label)}${active === id ? t(" 상세 보기") : ''}`}>
        <div className={s.bubbleControl}>
          <button type="button" className={s.panelDrag} data-panel-drag={id} disabled={active !== null}
            aria-label={t("{{value0}} 패널 이동", { value0: labels?.[id] ?? t(point.label) })}
            title={t("드래그하거나 방향키로 패널을 이동하세요. Shift를 누르면 더 크게 이동해요.")}>
            <span aria-hidden="true">⠿</span>{point.number} / {labels?.[id] ?? t(point.label)}
          </button>
          <button type="button" aria-label={active === id ? t("{{value0}} 상세 보기 닫기", { value0: labels?.[id] ?? t(point.label) }) : t("{{value0}} 패널 확대", { value0: labels?.[id] ?? t(point.label) })} aria-expanded={active === id} onClick={() => active === id ? onReset() : onSelect(id)}>{active === id ? t("전체 공간 ↙") : t("상세 ↗")}</button>
        </div>
        <div className={s.bubbleContent}>{panels[id]}</div>
      </div>, element, id);
    })}
    {!available && <div className={s.spaceFallback}>{OBSERVATION_POINTS.map(({ id }) => <div key={id} className={s.scenePanel} data-panel={id} data-selected={active === id || undefined} tabIndex={-1}>{panels[id]}</div>)}</div>}
    {available && !mounts.length && <p className={s.spaceLoading} role="status">{t("3D 관측 공간을 준비하고 있어요…")}</p>}
    {available && OBSERVATION_POINTS.map((anchor) => <button key={anchor.id} type="button" className={s.particleAnchor} data-anchor={anchor.id} tabIndex={active && active !== anchor.id ? -1 : 0} aria-label={t("{{value0}} 입자 확대", { value0: labels?.[anchor.id] ?? t(anchor.label) })} aria-controls={anchor.id} aria-pressed={active === anchor.id} onClick={() => onSelect(anchor.id)}><span>{anchor.number}</span></button>)}
    <div className={s.sceneIdentity}><span className={s.eyebrow}>LILY / OBSERVATORY</span><strong>{app}</strong><span>{t("3D 관측 공간 · 관측점 5개")}</span></div>
    <div className={s.sceneActions}>{active ? <button type="button" className={s.sceneReset} onClick={onReset}>{t("← 전체 공간 보기")}{" "}<kbd>Esc</kbd></button> : <>
      {available && mounts.length > 0 && <button type="button" className={s.sceneReset} onClick={() => controls.current?.resetPanels()}>{t("패널 배치 초기화")}</button>}
      <button type="button" className={s.sceneReset} onClick={() => controls.current?.reset()}>{t("시점 초기화")}</button>
    </>}</div>
    {available && !active && <ControlGuide />}
    {(!available || active) && <p className={s.particleHelp}>{available ? t("선택한 패널 앞으로 이동했어요") : t("3D를 사용할 수 없어 정보 패널을 표시합니다")}</p>}
  </div>;
}
