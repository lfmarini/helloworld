import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import {
  ALTURA_JOGADOR,
  ALTURA_MAPA,
  CAIXA,
  CAIXA_USADA,
  LARGURA_JOGADOR,
  LARGURA_MAPA,
  TAMANHO_INIMIGO,
  bloco,
} from "../../lib/plataforma";
import type { Plataforma } from "../../lib/usePlataforma";
import { DPR, usePageVisible } from "../../lib/usePageVisible";

/**
 * Altura visível, em blocos.
 *
 * A câmera é ortográfica, e não em perspectiva: é o que dá a leitura chapada
 * de um jogo 2D, onde um bloco tem sempre o mesmo tamanho na tela, esteja
 * perto ou longe. O visual continua tridimensional, mas a jogabilidade é
 * plana — que é o que faz um jogo de plataforma ser justo.
 */
const ALTURA_VISIVEL = 13;

const COR_SOLIDO = new THREE.Color("#2a3f63");
const COR_CAIXA = new THREE.Color("#f5d33c");
const COR_CAIXA_USADA = new THREE.Color("#3a4257");

/** Todos os blocos do cenário, desenhados numa só chamada de GPU. */
function Blocos({ jogo }: { jogo: Plataforma }) {
  const malha = useRef<THREE.InstancedMesh>(null);
  const versaoVista = useRef(-1);
  const molde = useMemo(() => new THREE.Object3D(), []);
  const cor = useMemo(() => new THREE.Color(), []);

  // Lista fixa das células ocupadas, montada uma vez. O tipo de cada uma pode
  // mudar durante o jogo (uma caixa vira caixa usada), mas a posição não.
  const celulas = useMemo(() => {
    const lista: { x: number; y: number }[] = [];
    const mapa = jogo.estadoRef.current.fase.mapa;
    for (let y = 0; y < ALTURA_MAPA; y++) {
      for (let x = 0; x < LARGURA_MAPA; x++) {
        if (bloco(mapa, x, y) !== 0) lista.push({ x, y });
      }
    }
    return lista;
  }, [jogo]);

  useFrame(() => {
    const m = malha.current;
    if (!m) return;
    const fx = jogo.efeitosRef.current;
    // Só refaz quando alguma caixa muda de estado — o resto do tempo os
    // blocos são estáticos e não custam nada.
    if (fx.versaoMapa === versaoVista.current) return;
    versaoVista.current = fx.versaoMapa;

    const mapa = jogo.estadoRef.current.mapa;
    celulas.forEach((c, i) => {
      molde.position.set(c.x + 0.5, c.y + 0.5, 0);
      molde.updateMatrix();
      m.setMatrixAt(i, molde.matrix);
      const tipo = bloco(mapa, c.x, c.y);
      cor.copy(
        tipo === CAIXA
          ? COR_CAIXA
          : tipo === CAIXA_USADA
            ? COR_CAIXA_USADA
            : COR_SOLIDO,
      );
      m.setColorAt(i, cor);
    });
    m.count = celulas.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={malha}
      args={[null!, null!, celulas.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial metalness={0.4} roughness={0.5} />
    </instancedMesh>
  );
}

/** Moedas girando. */
function Moedas({ jogo }: { jogo: Plataforma }) {
  const malha = useRef<THREE.InstancedMesh>(null);
  const molde = useMemo(() => new THREE.Object3D(), []);
  const maximo = useMemo(
    () => jogo.estadoRef.current.fase.moedas.length + 40,
    [jogo],
  );
  // O cilindro nasce deitado (eixo em Y). Girado, a face fica de frente para a
  // camera, e ai girar em Y produz o vira-vira classico da moeda.
  const geometria = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 16);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  useFrame((estado) => {
    const m = malha.current;
    if (!m) return;
    const moedas = jogo.estadoRef.current.moedas;
    let n = 0;
    for (const moeda of moedas) {
      if (moeda.pega) continue;
      molde.position.set(moeda.x, moeda.y, 0);
      molde.rotation.y = estado.clock.elapsedTime * 3 + moeda.x;
      molde.scale.setScalar(1);
      molde.updateMatrix();
      m.setMatrixAt(n++, molde.matrix);
      if (n >= maximo) break;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={malha} args={[null!, null!, maximo]} frustumCulled={false}>
      <primitive object={geometria} attach="geometry" />
      <meshStandardMaterial
        color="#ffe57a"
        emissive="#f5d33c"
        emissiveIntensity={1.4}
        metalness={0.7}
        roughness={0.2}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** Inimigos. Achatam ao serem pisados. */
function Inimigos({ jogo }: { jogo: Plataforma }) {
  const grupo = useRef<THREE.Group>(null);
  const maximo = useMemo(() => jogo.estadoRef.current.fase.inimigos.length, [jogo]);

  useFrame(() => {
    const g = grupo.current;
    if (!g) return;
    const inimigos = jogo.estadoRef.current.inimigos;
    g.children.forEach((filho, i) => {
      const inimigo = inimigos[i];
      if (!inimigo) {
        filho.visible = false;
        return;
      }
      // Pisado: some depois de meio segundo achatando.
      filho.visible = inimigo.vivo || inimigo.tempoMorte < 0.5;
      const achatado = inimigo.vivo ? 1 : Math.max(0.12, 1 - inimigo.tempoMorte * 4);
      // A escala encolhe em torno do centro, entao o centro tambem desce —
      // senao o inimigo achatado ficaria boiando acima do chao.
      filho.position.set(inimigo.x, inimigo.y + (TAMANHO_INIMIGO / 2) * achatado, 0);
      filho.scale.set(1, achatado, 1);
    });
  });

  return (
    <group ref={grupo}>
      {Array.from({ length: maximo }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[TAMANHO_INIMIGO, TAMANHO_INIMIGO, TAMANHO_INIMIGO]} />
          <meshStandardMaterial
            color="#f0456e"
            emissive="#f0456e"
            emissiveIntensity={0.6}
            metalness={0.3}
            roughness={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** O personagem. */
function Heroi({ jogo }: { jogo: Plataforma }) {
  const grupo = useRef<THREE.Group>(null);
  const corpo = useRef<THREE.Mesh>(null);

  useFrame((estado, delta) => {
    const g = grupo.current;
    if (!g) return;
    const j = jogo.estadoRef.current.jogador;
    g.position.set(j.x, j.y + ALTURA_JOGADOR / 2, 0);
    // Vira para o lado que está andando.
    const alvo = j.olhando > 0 ? 0.35 : -0.35;
    g.rotation.y += (alvo - g.rotation.y) * Math.min(1, delta * 12);

    if (corpo.current) {
      // Achata um pouco ao pular e estica ao cair: o exagero deixa o
      // movimento legível mesmo num boneco simples.
      const esticar = j.noChao ? 1 : 1 + Math.max(-0.18, Math.min(0.18, j.vy * 0.012));
      corpo.current.scale.set(1 / esticar, esticar, 1);
      // Balanço leve ao correr.
      corpo.current.rotation.z = j.noChao
        ? Math.sin(estado.clock.elapsedTime * 14) * Math.abs(j.vx) * 0.012
        : 0;
    }
  });

  return (
    <group ref={grupo}>
      <mesh ref={corpo}>
        <boxGeometry args={[LARGURA_JOGADOR, ALTURA_JOGADOR, 0.7]} />
        <meshStandardMaterial
          color="#8ff0ff"
          emissive="#22e0f0"
          emissiveIntensity={0.7}
          metalness={0.5}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      {/* Viseira: dá uma frente ao boneco e mostra para onde ele olha. */}
      <mesh position={[0.2, 0.18, 0.36]}>
        <boxGeometry args={[0.3, 0.16, 0.06]} />
        <meshBasicMaterial color="#05060a" toneMapped={false} />
      </mesh>
      <pointLight color="#22e0f0" intensity={6} distance={7} decay={2} />
    </group>
  );
}

/** Bandeira de chegada. */
function Bandeira({ jogo }: { jogo: Plataforma }) {
  const x = jogo.estadoRef.current.fase.bandeira;
  const pano = useRef<THREE.Mesh>(null);

  useFrame((estado) => {
    if (pano.current) {
      pano.current.rotation.y = Math.sin(estado.clock.elapsedTime * 2.5) * 0.35;
    }
  });

  return (
    <group position={[x, 2, 0]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[0.16, 6, 0.16]} />
        <meshStandardMaterial
          color="#e8f6ff"
          emissive="#22e0f0"
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={pano} position={[0.7, 5.2, 0]}>
        <boxGeometry args={[1.3, 0.8, 0.06]} />
        <meshStandardMaterial
          color="#f03ec8"
          emissive="#f03ec8"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Câmera que segue o herói, com tremor nas batidas. */
function Camera({ jogo, reduzido }: { jogo: Plataforma; reduzido: boolean }) {
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    const cam = camera as THREE.OrthographicCamera;
    const j = jogo.estadoRef.current.jogador;
    const fx = jogo.efeitosRef.current;

    // A área visível é sempre a mesma altura em blocos; a largura acompanha o
    // formato da tela. Assim o jogo fica igual no celular deitado e no monitor.
    const proporcao = size.width / Math.max(1, size.height);
    const meiaAltura = ALTURA_VISIVEL / 2;
    const meiaLargura = meiaAltura * proporcao;
    cam.left = -meiaLargura;
    cam.right = meiaLargura;
    cam.top = meiaAltura;
    cam.bottom = -meiaAltura;
    cam.updateProjectionMatrix();

    fx.tremor = Math.max(0, fx.tremor - delta * 2.5);
    const sacode = reduzido ? 0 : fx.tremor * fx.tremor * 0.35;

    // Segue o herói, mas sem passar das bordas da fase.
    const alvoX = Math.max(
      meiaLargura,
      Math.min(LARGURA_MAPA - meiaLargura, j.x + 2),
    );
    // A altura só acompanha em saltos grandes, para a tela não balançar a
    // cada pulinho.
    const alvoY = Math.max(meiaAltura - 2, j.y * 0.35 + 3.5);
    cam.position.x += (alvoX - cam.position.x) * Math.min(1, delta * 8);
    cam.position.y += (alvoY - cam.position.y) * Math.min(1, delta * 5);
    cam.position.x += (Math.random() - 0.5) * sacode;
    cam.position.y += (Math.random() - 0.5) * sacode;
    cam.position.z = 24;
    cam.lookAt(cam.position.x, cam.position.y, 0);
  });

  return null;
}

export default function PlataformaScene({ jogo }: { jogo: Plataforma }) {
  const visivel = usePageVisible();
  const reduzido = useReducedMotion() ?? false;

  return (
    <Canvas
      dpr={DPR}
      frameloop={visivel ? "always" : "never"}
      orthographic
      camera={{ position: [10, 5, 24], zoom: 1, near: 0.1, far: 100 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05060a"]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 14, 12]} intensity={1.5} color="#9fe8ff" />
      <directionalLight position={[-8, 6, 9]} intensity={0.7} color="#ff8ae0" />

      <Camera jogo={jogo} reduzido={reduzido} />
      <Blocos jogo={jogo} />
      <Moedas jogo={jogo} />
      <Inimigos jogo={jogo} />
      <Bandeira jogo={jogo} />
      <Heroi jogo={jogo} />

      {/* multisampling={0} e buffer em byte: sem isso muitas GPUs, sobretudo
          de celular, devolvem a tela inteira preta. */}
      {!reduzido && (
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={0.9} luminanceThreshold={0.3} mipmapBlur radius={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
