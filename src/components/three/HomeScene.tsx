import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { DPR, usePageVisible } from "../../lib/usePageVisible";
import { usePointer } from "../../lib/usePointer";

type Pointer = ReturnType<typeof usePointer>;

/** Nuvem de pontos que flutua devagar e se inclina seguindo o mouse. */
function Starfield({ count, pointer }: { count: number; pointer: Pointer }) {
  const ref = useRef<THREE.Points>(null);

  // useMemo: as posicoes sao geradas uma unica vez, nao a cada quadro.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribuicao numa casca esferica, pra nuvem envolver a camera.
      const r = 7 + Math.random() * 13;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.015;
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      pointer.current.y * 0.18,
      0.03,
    );
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#8fe6f2"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Nucleo de arame. Fica deslocado pra direita e pro fundo de proposito, pra
 * servir de moldura da composicao em vez de passar por cima do titulo.
 */
function Core({ pointer }: { pointer: Pointer }) {
  const group = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  // Em tela deitada (desktop) o núcleo fica à direita, servindo de moldura
  // pro texto. Em tela em pé (celular) não cabe na lateral, então ele vai pro
  // centro, atrás do conteúdo, e diminui um pouco.
  const portrait = useThree((state) => state.size.height > state.size.width);
  const position: [number, number, number] = portrait
    ? [0, 1.6, -3.5]
    : [3.5, 1.2, -2.5];

  useFrame((_, delta) => {
    if (!group.current) return;
    // lerp = interpolacao suave. Em vez de "colar" o objeto na posicao do
    // mouse, ele persegue o alvo — o que da sensacao de peso e inercia.
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.current.x * 0.5,
      0.045,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -pointer.current.y * 0.35,
      0.045,
    );
    if (outer.current) outer.current.rotation.y += delta * 0.06;
    if (inner.current) {
      inner.current.rotation.x += delta * 0.16;
      inner.current.rotation.z -= delta * 0.1;
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={outer}>
        <icosahedronGeometry args={[2.4, 1]} />
        <meshBasicMaterial color="#22e0f0" wireframe transparent opacity={0.32} />
      </mesh>
      <mesh ref={inner} scale={0.55}>
        <icosahedronGeometry args={[2.4, 0]} />
        <meshBasicMaterial color="#f03ec8" wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export default function HomeScene() {
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const pointer = usePointer();

  return (
    <Canvas
      dpr={DPR}
      // frameloop="never" congela a renderizacao quando a aba perde o foco.
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 0, 8], fov: 55 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05060a"]} />
      <Starfield count={reduced ? 450 : 1300} pointer={pointer} />
      <Core pointer={pointer} />
      {/* Bloom e o que da o brilho neon: os pixels claros "vazam" luz pra fora.
          multisampling={0} e obrigatorio aqui — com o anti-aliasing por
          multiamostragem ligado, varias GPUs devolvem a tela inteira preta.
          Com "movimento reduzido" ligado no sistema, cortamos o efeito todo. */}
      {!reduced && (
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={1.35} luminanceThreshold={0.12} mipmapBlur radius={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
