import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GRID, type Vec } from "../../lib/snake";
import type { Game } from "../../lib/useSnakeGame";
import { DPR, usePageVisible } from "../../lib/usePageVisible";

/** Metade do tabuleiro: converte coordenada de célula em coordenada do mundo. */
const H = (GRID - 1) / 2;
const MAX_SEGMENTS = GRID * GRID;

/** Cores do gradiente do corpo: ciano na cabeça, magenta na cauda. */
const HEAD_COLOR = new THREE.Color("#22e0f0");
const TAIL_COLOR = new THREE.Color("#f03ec8");

const lerp = THREE.MathUtils.lerp;

/**
 * Interpola a posição de um segmento entre onde ele estava e onde está.
 * É isso que faz a cobra deslizar em vez de teletransportar de célula em célula.
 */
function segmentPos(prev: Vec | undefined, cur: Vec, t: number) {
  const a = prev ?? cur;
  return { x: lerp(a.x, cur.x, t) - H, z: lerp(a.y, cur.y, t) - H };
}

/** Corpo da cobra, sem a cabeça. */
function Body({ game }: { game: Game }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  // Cubo com cantos arredondados: bem mais bonito que um cubo seco.
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.2), []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const s = game.stateRef.current;
    const t = game.progressRef.current;

    // Um único InstancedMesh desenha todos os segmentos numa só chamada de
    // GPU. Com um mesh por segmento, uma cobra longa derrubaria o desempenho.
    const total = s.cells.length - 1; // a cabeça é desenhada à parte
    for (let i = 0; i < total; i++) {
      const idx = i + 1;
      const p = segmentPos(s.prev[idx], s.cells[idx], t);
      // A cauda afina de leve, dando forma ao corpo.
      const shrink = Math.min(i / Math.max(total, 1), 1) * 0.18;
      dummy.position.set(p.x, 0.5, p.z);
      dummy.scale.setScalar(0.86 - shrink);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.copy(HEAD_COLOR).lerp(TAIL_COLOR, Math.min(i / 14, 1));
      mesh.setColorAt(i, color);
    }

    mesh.count = total;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[null!, null!, MAX_SEGMENTS]}
      frustumCulled={false}
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        metalness={0.65}
        roughness={0.22}
        emissive="#0b6b78"
        emissiveIntensity={0.35}
      />
    </instancedMesh>
  );
}

/** Cabeça: maior, mais brilhante e carregando a própria luz. */
function Head({ game }: { game: Game }) {
  const ref = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 3, 0.2), []);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = game.stateRef.current;
    const p = segmentPos(s.prev[0], s.cells[0], game.progressRef.current);
    g.position.set(p.x, 0.5, p.z);
  });

  return (
    <group ref={ref}>
      <mesh scale={0.96}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color="#a8f7ff"
          metalness={0.5}
          roughness={0.15}
          emissive="#22e0f0"
          emissiveIntensity={1.1}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#22e0f0" intensity={14} distance={7} decay={2} />
    </group>
  );
}

/** Comida: gira no próprio eixo, pulsa e ilumina o tabuleiro em volta. */
function Food({ game }: { game: Game }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const f = game.stateRef.current.food;
    g.position.set(f.x - H, 0.55, f.y - H);
    g.rotation.y += delta * 1.6;
    g.rotation.x += delta * 0.9;
    // Respiração: escala oscilando devagar com o relógio da cena.
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.09;
    g.scale.setScalar(pulse);
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.36, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#f03ec8"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#f03ec8" intensity={12} distance={6} decay={2} />
    </group>
  );
}

const PARTICLES = 70;
const PARTICLE_LIFE = 0.75;

/** Explosão de partículas disparada toda vez que a cobra come. */
function EatBurst({ game }: { game: Game }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const seen = useRef(0);
  const life = useRef(0);

  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);
  const velocities = useMemo(() => new Float32Array(PARTICLES * 3), []);

  useFrame((_, delta) => {
    const fx = game.fxRef.current;

    // A cena não é avisada por evento: ela compara o contador de comidas com
    // o último que viu. Assim o React nunca precisa re-renderizar por causa
    // de um efeito visual.
    if (fx.eatSeq !== seen.current) {
      seen.current = fx.eatSeq;
      const at = fx.eatAt;
      if (at) {
        for (let i = 0; i < PARTICLES; i++) {
          positions[i * 3] = at.x - H;
          positions[i * 3 + 1] = 0.55;
          positions[i * 3 + 2] = at.y - H;
          // Direção aleatória numa esfera, com um empurrão para cima.
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = 1.6 + Math.random() * 2.6;
          velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
          velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * speed * 0.8 + 0.6;
          velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
        }
        life.current = PARTICLE_LIFE;
      }
    }

    if (life.current <= 0) {
      if (material.current && material.current.opacity !== 0) {
        material.current.opacity = 0;
      }
      return;
    }

    life.current = Math.max(0, life.current - delta);
    for (let i = 0; i < PARTICLES; i++) {
      velocities[i * 3 + 1] -= delta * 5.5; // gravidade
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
    }

    if (points.current) {
      points.current.geometry.getAttribute("position").needsUpdate = true;
    }
    if (material.current) {
      material.current.opacity = life.current / PARTICLE_LIFE;
    }
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={0.16}
        color="#ffb3ec"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/** Chão, linhas da grade e as paredes que matam. */
function Board() {
  const wallGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edge = H + 0.5 + 0.15;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GRID, GRID]} />
        <meshStandardMaterial color="#080b14" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* gridHelper com 17 divisões cai exatamente entre as células. */}
      <gridHelper
        args={[GRID, GRID, "#1e3350", "#152134"]}
        position={[0, 0.015, 0]}
      />

      {/* Quatro paredes luminosas marcando o limite do tabuleiro. */}
      {[
        { pos: [0, 0.25, -edge], scale: [GRID + 0.9, 0.5, 0.3] },
        { pos: [0, 0.25, edge], scale: [GRID + 0.9, 0.5, 0.3] },
        { pos: [-edge, 0.25, 0], scale: [0.3, 0.5, GRID + 0.9] },
        { pos: [edge, 0.25, 0], scale: [0.3, 0.5, GRID + 0.9] },
      ].map((w, i) => (
        <mesh
          key={i}
          geometry={wallGeo}
          position={w.pos as [number, number, number]}
          scale={w.scale as [number, number, number]}
        >
          <meshStandardMaterial
            color="#0d2740"
            emissive="#1d8fb0"
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * De onde a câmera olha. Em tela deitada, bem inclinada, para dar profundidade.
 * Em tela em pé, mais de cima: com a inclinação forte o tabuleiro vira um
 * trapézio muito exagerado num celular.
 */
const DIR_DEITADA = new THREE.Vector3(0, 15.5, 12.5).normalize();
const DIR_EM_PE = new THREE.Vector3(0, 16, 7).normalize();

function direcaoPara(aspect: number) {
  return aspect < 1 ? DIR_EM_PE : DIR_DEITADA;
}

/**
 * Descobre a que distância a câmera precisa ficar para o tabuleiro inteiro
 * caber na tela.
 *
 * Chutar valores fixos não funciona: o mesmo número que enquadra bem num
 * monitor deixa metade do tabuleiro de fora num celular em pé. Aqui fazemos
 * uma busca binária — testamos uma distância, verificamos se os oito cantos
 * do tabuleiro caem dentro do campo de visão, e vamos ajustando.
 */
function fitDistance(fov: number, aspect: number, dir: THREE.Vector3): number {
  const half = H + 1.2; // metade do tabuleiro + as paredes + uma folga
  const corners: THREE.Vector3[] = [];
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      for (const y of [0, 1]) corners.push(new THREE.Vector3(x, y, z));
    }
  }

  const vFov = THREE.MathUtils.degToRad(fov) / 2;
  const hFov = Math.atan(Math.tan(vFov) * aspect);
  const probe = new THREE.PerspectiveCamera(fov, aspect, 0.1, 300);
  const tmp = new THREE.Vector3();

  const cabe = (dist: number) => {
    probe.position.copy(dir).multiplyScalar(dist);
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld(true);
    return corners.every((c) => {
      tmp.copy(c);
      probe.worldToLocal(tmp);
      const depth = -tmp.z; // no espaço da câmera, o que está à frente tem z negativo
      if (depth <= 0.1) return false;
      return (
        Math.abs(tmp.x) <= depth * Math.tan(hFov) &&
        Math.abs(tmp.y) <= depth * Math.tan(vFov)
      );
    });
  };

  let perto = 8;
  let longe = 140;
  for (let i = 0; i < 30; i++) {
    const meio = (perto + longe) / 2;
    if (cabe(meio)) longe = meio;
    else perto = meio;
  }
  return longe;
}

/**
 * Distância da câmera para a tela atual.
 *
 * Vira um hook próprio porque a névoa também precisa desse número: numa tela
 * estreita (celular em pé) a câmera recua bastante, e uma névoa com distâncias
 * fixas engoliria o tabuleiro inteiro — foi exatamente esse o bug que deixava
 * a tela preta no celular enquanto funcionava no computador.
 */
function useCameraPlacement() {
  const { camera, size } = useThree();
  return useMemo(() => {
    const aspect = size.width / size.height;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    const dir = direcaoPara(aspect);
    // 3% de margem para o brilho das paredes não encostar na borda da tela.
    const dist = fitDistance(fov, aspect, dir) * 1.03;
    return { dist, base: dir.clone().multiplyScalar(dist) };
  }, [size.width, size.height, camera]);
}

/** Posiciona a câmera e aplica o tremor de tela. */
function Rig({
  game,
  reduced,
  base,
}: {
  game: Game;
  reduced: boolean;
  base: THREE.Vector3;
}) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const fx = game.fxRef.current;
    // O tremor decai sozinho a cada quadro.
    fx.shake = Math.max(0, fx.shake - delta * 2.4);
    const amount = reduced ? 0 : fx.shake * fx.shake * 0.6;
    camera.position.set(
      base.x + (Math.random() - 0.5) * amount,
      base.y + (Math.random() - 0.5) * amount,
      base.z + (Math.random() - 0.5) * amount,
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/** Conteúdo da cena. Fica dentro do Canvas para poder medir o tamanho da tela. */
function Scene({ game, reduced }: { game: Game; reduced: boolean }) {
  const { dist, base } = useCameraPlacement();

  return (
    <>
      {/* A névoa começa depois do tabuleiro e termina bem além dele. Amarrar
          esses números à distância da câmera é o que faz a cena funcionar
          igualmente no monitor deitado e no celular em pé. */}
      <fog attach="fog" args={["#05060a", dist * 0.95, dist * 2.4]} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[-6, 12, 6]} intensity={1.5} color="#8ff0ff" />
      <directionalLight position={[7, 9, -5]} intensity={1.1} color="#ff8ae0" />

      <Rig game={game} reduced={reduced} base={base} />
      <Board />
      <Body game={game} />
      <Head game={game} />
      <Food game={game} />
      <EatBurst game={game} />
    </>
  );
}

export default function SnakeScene({ game }: { game: Game }) {
  const visible = usePageVisible();
  const reduced = useReducedMotion() ?? false;

  return (
    <Canvas
      dpr={DPR}
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 15.5, 12.5], fov: 45 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05060a"]} />
      <Scene game={game} reduced={reduced} />

      {/* multisampling={0}: com MSAA ligado, várias GPUs devolvem tela preta.
          UnsignedByteType: muitas GPUs de celular não escrevem em buffers de
          ponto flutuante, que é o padrão aqui — e falham em silêncio. */}
      {!reduced && (
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={1.1} luminanceThreshold={0.2} mipmapBlur radius={0.65} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
