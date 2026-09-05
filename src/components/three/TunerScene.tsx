import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { DPR, usePageVisible } from "../../lib/usePageVisible";
import type { Tuner } from "../../lib/useTuner";

/** Desvio, em cents, que leva a agulha até a ponta da escala. */
const RANGE_CENTS = 50;
/** Abertura do mostrador: 60° para cada lado. */
const RANGE_ANGLE = Math.PI / 3;
/** Dentro desta faixa a corda é considerada afinada. */
export const IN_TUNE_CENTS = 5;

const VERDE = new THREE.Color("#3ce88a");
const AMARELO = new THREE.Color("#f5d33c");
const VERMELHO = new THREE.Color("#f0456e");
const APAGADO = new THREE.Color("#2a3550");

/** Converte um desvio em cents no ângulo da agulha. */
function anguloDe(cents: number) {
  const limitado = Math.max(-RANGE_CENTS * 1.2, Math.min(RANGE_CENTS * 1.2, cents));
  // Sinal negativo porque, em three.js, girar no eixo Z no sentido positivo
  // leva para a esquerda — e "sustenido" (cents positivo) deve ir para a direita.
  return -(limitado / RANGE_CENTS) * RANGE_ANGLE;
}

/**
 * Escolhe a cor conforme a distância do alvo, com transição contínua: verde
 * afinado, amarelo perto, vermelho longe. Interpolar (em vez de trocar de cor
 * de uma vez) evita o efeito de "pisca-pisca" quando o valor fica na fronteira.
 */
function corPara(cents: number, destino: THREE.Color) {
  const d = Math.abs(cents);
  if (d <= IN_TUNE_CENTS) {
    destino.copy(VERDE);
  } else if (d <= 20) {
    destino.copy(VERDE).lerp(AMARELO, (d - IN_TUNE_CENTS) / (20 - IN_TUNE_CENTS));
  } else {
    destino.copy(AMARELO).lerp(VERMELHO, Math.min((d - 20) / 25, 1));
  }
  return destino;
}

/** Arco de fundo e marcações da escala. */
function Mostrador() {
  const marcas = useMemo(() => {
    const lista: { angulo: number; grande: boolean }[] = [];
    for (let c = -RANGE_CENTS; c <= RANGE_CENTS; c += 10) {
      lista.push({ angulo: anguloDe(c), grande: c === 0 || Math.abs(c) === RANGE_CENTS });
    }
    return lista;
  }, []);

  return (
    <group>
      {/* Trilho do mostrador. O torus nasce começando no eixo X, então giramos
          para que o arco fique centrado apontando para cima. */}
      <mesh rotation={[0, 0, Math.PI / 2 - RANGE_ANGLE]}>
        <torusGeometry args={[2.55, 0.02, 8, 96, RANGE_ANGLE * 2]} />
        <meshBasicMaterial color="#22304d" toneMapped={false} />
      </mesh>

      {/* Faixa verde do centro: a zona de "afinado". */}
      <mesh
        rotation={[0, 0, Math.PI / 2 - (RANGE_ANGLE * IN_TUNE_CENTS) / RANGE_CENTS]}
      >
        <torusGeometry
          args={[2.55, 0.045, 8, 24, (RANGE_ANGLE * IN_TUNE_CENTS * 2) / RANGE_CENTS]}
        />
        <meshBasicMaterial color="#3ce88a" toneMapped={false} />
      </mesh>

      {marcas.map((m, i) => (
        <group key={i} rotation={[0, 0, m.angulo]}>
          <mesh position={[0, m.grande ? 2.32 : 2.4, 0]}>
            <boxGeometry args={[m.grande ? 0.055 : 0.03, m.grande ? 0.34 : 0.18, 0.03]} />
            <meshBasicMaterial
              color={m.grande ? "#7ea6d8" : "#3d5580"}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A agulha propriamente dita. */
function Agulha({ tuner }: { tuner: Tuner }) {
  const grupo = useRef<THREE.Group>(null);
  const corpo = useRef<THREE.MeshBasicMaterial>(null);
  const ponta = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.PointLight>(null);
  const cor = useMemo(() => new THREE.Color(), []);
  const atual = useMemo(() => new THREE.Color(APAGADO), []);

  useFrame((_, delta) => {
    const g = grupo.current;
    if (!g) return;

    const cents = tuner.centsRef.current;
    const ativo = tuner.activeRef.current;

    // Sem nota, a agulha volta devagar para o centro em vez de travar torta.
    const alvo = ativo ? anguloDe(cents) : 0;
    g.rotation.z += (alvo - g.rotation.z) * Math.min(1, delta * 9);

    // A cor também é interpolada, para a transição não ser um corte seco.
    corPara(cents, cor);
    if (!ativo) cor.copy(APAGADO);
    atual.lerp(cor, Math.min(1, delta * 6));

    if (corpo.current) corpo.current.color.copy(atual);
    if (ponta.current) ponta.current.color.copy(atual);
    if (halo.current) {
      halo.current.color.copy(atual);
      halo.current.intensity = ativo ? 9 : 2;
    }
  });

  return (
    <group ref={grupo}>
      {/* Cilindro afunilado: grosso na base, fino na ponta. */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.025, 0.11, 2.2, 16]} />
        <meshBasicMaterial ref={corpo} color="#2a3550" toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial ref={ponta} color="#2a3550" toneMapped={false} />
      </mesh>
      <pointLight ref={halo} position={[0, 2.25, 0.6]} distance={5} decay={2} />
    </group>
  );
}

/** Base circular de onde a agulha sai. */
function Eixo() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 32]} />
        <meshStandardMaterial
          color="#101827"
          metalness={0.8}
          roughness={0.25}
          emissive="#16406b"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.015, 8, 48]} />
        <meshBasicMaterial color="#2b4066" toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function TunerScene({ tuner }: { tuner: Tuner }) {
  const visible = usePageVisible();
  const reduced = useReducedMotion() ?? false;

  return (
    <Canvas
      dpr={DPR}
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 1.15, 6.4], fov: 42 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05060a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.2} color="#9fe8ff" />

      <Mostrador />
      <Eixo />
      <Agulha tuner={tuner} />

      {/* multisampling={0}: com MSAA ligado, várias GPUs devolvem tela preta. */}
      {!reduced && (
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={1.2} luminanceThreshold={0.25} mipmapBlur radius={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
