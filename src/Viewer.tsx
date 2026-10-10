import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Box, Maximize, RotateCcw, Layers } from "lucide-react";
export function Viewer({
  source,
  large = false,
}: {
  source?: string;
  large?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [wire, setWire] = useState(false);
  const [info, setInfo] = useState("Procedural example · no Unity validation");
  const [error, setError] = useState("");
  const [clips, setClips] = useState<string[]>([]);
  const [clip, setClip] = useState("");
  const [reset, setReset] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    let alive = true;
    setError("");
    setInfo(
      source ? "Loading GLB…" : "Procedural example · no Unity validation",
    );
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "WebGL is unavailable. Asset metadata and reviews remain available.",
      );
      return;
    }
    const el = ref.current;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1e26");
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(3, 2, 4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.65, 0);
    scene.add(new THREE.HemisphereLight(0xc3d7ff, 0x151923, 3));
    const light = new THREE.DirectionalLight(0xffcb8c, 4);
    light.position.set(3, 5, 2);
    scene.add(light);
    const grid = new THREE.GridHelper(10, 30, 0x3d4656, 0x282f3d);
    scene.add(grid);
    let mixer: THREE.AnimationMixer | undefined;
    let group: THREE.Object3D;
    const materials = new Set<THREE.Material>();
    const inspect = (obj: THREE.Object3D) => {
      let triangles = 0;
      const names = new Set<string>();
      obj.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          triangles +=
            (o.geometry.index?.count ||
              o.geometry.attributes.position?.count ||
              0) / 3;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            names.add(m.name || m.type);
            if ("wireframe" in m)
              (m as THREE.MeshStandardMaterial).wireframe = wire;
          }
        }
      });
      setInfo(
        `${Math.round(triangles).toLocaleString()} triangles · ${names.size} materials · ${[...names].slice(0, 3).join(", ")}`,
      );
    };
    if (source) {
      new GLTFLoader().load(
        source,
        (gltf) => {
          if (!alive) {
            gltf.scene.traverse((o) => {
              if (o instanceof THREE.Mesh) o.geometry.dispose();
            });
            return;
          }
          group = gltf.scene;
          const box = new THREE.Box3().setFromObject(group),
            size = box.getSize(new THREE.Vector3()),
            center = box.getCenter(new THREE.Vector3());
          const max = Math.max(size.x, size.y, size.z);
          if (!Number.isFinite(max) || max === 0) {
            setError("Asset has no renderable geometry");
            return;
          }
          group.scale.multiplyScalar(1.8 / max);
          group.position.sub(center.multiplyScalar(1.8 / max));
          group.position.y += 0.9;
          scene.add(group);
          inspect(group);
          setClips(gltf.animations.map((a) => a.name));
          mixer = new THREE.AnimationMixer(group);
          const animation =
            gltf.animations.find((a) => a.name === clip) || gltf.animations[0];
          if (animation) mixer.clipAction(animation).play();
        },
        undefined,
        () => {
          if (alive)
            setError("Preview failed. Use a self-contained GLB v2 file.");
        },
      );
    } else {
      group = new THREE.Group();
      const body = new THREE.MeshStandardMaterial({
          color: 0x888573,
          roughness: 0.86,
          name: "Canvas",
        }),
        dark = new THREE.MeshStandardMaterial({
          color: 0x333e3e,
          roughness: 0.7,
          name: "Hardware",
        }),
        accent = new THREE.MeshStandardMaterial({
          color: 0xc89051,
          roughness: 0.7,
          name: "Straps",
        });
      const box = (
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
        m: THREE.Material,
      ) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z);
        group.add(mesh);
      };
      box(0.95, 1.25, 0.52, 0, 0.85, 0, body);
      box(1.01, 0.25, 0.56, 0, 1.47, 0, dark);
      box(0.66, 0.52, 0.15, 0, 0.62, 0.33, body);
      for (const x of [-0.29, 0.29]) {
        box(0.09, 1.38, 0.035, x, 0.9, 0.29, accent);
        box(0.16, 0.14, 0.08, x, 0.9, 0.33, dark);
        box(0.12, 0.85, 0.14, x, 1, -0.35, dark);
      }
      box(0.38, 0.09, 0.2, 0, 1.69, 0, dark);
      box(0.24, 0.13, 0.02, 0, 0.55, 0.42, accent);
      scene.add(group);
      group.rotation.y = -0.25;
      inspect(group);
      setClips([]);
    }
    const resize = () => {
      if (!alive) return;
      const width = el.clientWidth,
        height = el.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      if (!alive) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      mixer?.update(clock.getDelta());
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      materials.forEach((m) => {
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [source, wire, clip, reset]);
  return (
    <div className={"viewer " + (large ? "large" : "")}>
      <div ref={ref} className="canvas" />
      {error && <div className="viewer-error">{error}</div>}
      <div className="viewport-label">
        <Box size={12} /> {source ? "ASSET PREVIEW" : "EXAMPLE BLOCKOUT"}{" "}
        <span>Perspective</span>
      </div>
      <div className="viewport-tools">
        <button
          aria-label="Toggle wireframe"
          className={wire ? "active" : ""}
          onClick={() => setWire(!wire)}
        >
          <Layers size={15} />
        </button>
        <button aria-label="Reset camera" onClick={() => setReset(reset + 1)}>
          <RotateCcw size={15} />
        </button>
        <button
          aria-label="Fullscreen viewport"
          onClick={() => ref.current?.parentElement?.requestFullscreen()}
        >
          <Maximize size={15} />
        </button>
      </div>
      {clips.length > 0 && (
        <select
          aria-label="Animation clip"
          className="clip"
          value={clip}
          onChange={(e) => setClip(e.target.value)}
        >
          {clips.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}
      <div className="viewport-meta">
        {info}
        <span>Drag to orbit · scroll to zoom</span>
      </div>
    </div>
  );
}
