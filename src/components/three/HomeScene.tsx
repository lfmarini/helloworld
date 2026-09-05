import { useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { DPR, usePageVisible } from "../../lib/usePageVisible";

/** Nuvem de pontos que flutua devagar e se inclina seguindo o mouse. */
function Starfield({ count = 1400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  // useMemo: as posicoes sao geradas uma unica vez, nao a cada quadro.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribuicao numa casca esferica, pra nuvem ficar em volta da camera.
      const r = 6 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.02;
    // state.pointer vai de -1 a 1 nos dois eixos: e o mouse normalizado.
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      state.pointer.y * 0.25,
      0.03,
    );
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#7fe9f5"
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Nucleo de arame no centro: gira sozinho e reage ao mouse. */
function Core(props: ThreeElements["group"]) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    // lerp = interpolacao suave. Em vez de "colar" o objeto no mouse, ele
    // persegue a posicao alvo, o que da a sensacao de peso/inercia.
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      state.pointer.x * 0.6,
      0.04,
    );
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -state.pointer.y * 0.4,
      0.04,
    );
    if (inner.current) {
      inner.current.rotation.x += delta * 0.18;
      inner.current.rotation.z -= delta * 0.12;
    }
  });

  return (
    <group ref={group} {...props}>
      <mesh ref={inner}>
        <icosahedronGeometry args={[2.1, 1]} />
        <meshBasicMaterial color="#22e0f0" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh scale={0.62}>
        <icosahedronGeometry args={[2.1, 0]} />
        <meshBasicMaterial color="#f03ec8" wireframe transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

export default function HomeScene() {
  const visible = usePageVisible();
  const reduced = useReducedMotion();

  return (
    <Canvas
      dpr={DPR}
      // frameloop="never" congela a renderizacao quando a aba perde o foco.
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 0, 8], fov: 55 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05060a"]} />
      <Starfield count={reduced ? 500 : 1400} />
      <Core />
      {/* Bloom e o que da o brilho neon: pixels claros "vazam" luz pra fora.
          Com movimento reduzido, cortamos o pos-processamento inteiro. */}
      {!reduced && (
        <EffectComposer>
          <Bloom intensity={1.5} luminanceThreshold={0.15} mipmapBlur radius={0.75} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
