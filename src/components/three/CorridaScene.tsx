import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import {
  COMPRIMENTO,
  FAIXAS,
  LARGURA_FAIXA,
  alturaDoChao,
  type Pista,
} from "../../lib/motocross";
import { enquadramento } from "../../lib/cameraCorrida";
import type { Corrida } from "../../lib/useCorrida";
import { DPR, usePageVisible } from "../../lib/usePageVisible";

/** Posição no eixo Z de cada faixa. A faixa 0 é a mais distante da câmera. */
function zDaFaixa(faixa: number) {
  return (faixa - (FAIXAS - 1) / 2) * LARGURA_FAIXA;
}

/** De quanto em quanto metro o relevo da pista é amostrado para virar geometria. */
const PASSO_MALHA = 0.5;

/**
 * Constrói a fita de terreno de uma faixa, seguindo o relevo.
 *
 * É montada uma única vez e nunca mais mexida: são milhares de vértices, e
 * recalcular isso a cada quadro derrubaria o desempenho sem nenhum ganho.
 */
function criarFaixa(pista: Pista, faixa: number) {
  const pontos = Math.ceil(COMPRIMENTO / PASSO_MALHA) + 1;
  const posicoes = new Float32Array(pontos * 2 * 3);
  const indices: number[] = [];
  const meiaLargura = LARGURA_FAIXA / 2 - 0.08;
  const z = zDaFaixa(faixa);

  for (let i = 0; i < pontos; i++) {
    const x = i * PASSO_MALHA;
    const altura = alturaDoChao(pista, x, faixa);
    posicoes[i * 6] = x;
    posicoes[i * 6 + 1] = altura;
    posicoes[i * 6 + 2] = z - meiaLargura;
    posicoes[i * 6 + 3] = x;
    posicoes[i * 6 + 4] = altura;
    posicoes[i * 6 + 5] = z + meiaLargura;

    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return geometria;
}

/** Retângulo deitado no chão, usado para lama e resfriadores. */
function criarPlaca(x: number, comprimento: number, faixa: number) {
  const geometria = new THREE.PlaneGeometry(comprimento, LARGURA_FAIXA - 0.2);
  geometria.rotateX(-Math.PI / 2);
  geometria.translate(x + comprimento / 2, 0.02, zDaFaixa(faixa));
  return geometria;
}

function Terreno({ pista }: { pista: Pista }) {
  const faixas = useMemo(
    () => Array.from({ length: FAIXAS }, (_, f) => criarFaixa(pista, f)),
    [pista],
  );
  const lamas = useMemo(
    () =>
      pista.lamas.length
        ? mesclar(pista.lamas.map((l) => criarPlaca(l.x, l.comprimento, l.faixa)))
        : null,
    [pista],
  );
  const resfriadores = useMemo(
    () =>
      pista.resfriadores.length
        ? mesclar(
            pista.resfriadores.map((r) =>
              criarPlaca(r.x, r.comprimento, r.faixa),
            ),
          )
        : null,
    [pista],
  );

  return (
    <group>
      {faixas.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial
            color={i % 2 === 0 ? "#1b2740" : "#141d31"}
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Faixas divisórias brilhando entre as pistas */}
      {Array.from({ length: FAIXAS + 1 }, (_, i) => (
        <mesh
          key={`div${i}`}
          position={[COMPRIMENTO / 2, 0.01, zDaFaixa(i - 0.5)]}
        >
          <boxGeometry args={[COMPRIMENTO, 0.02, 0.09]} />
          <meshBasicMaterial color="#2f6f9e" toneMapped={false} />
        </mesh>
      ))}

      {lamas && (
        <mesh geometry={lamas}>
          <meshStandardMaterial color="#6b4a1e" roughness={1} />
        </mesh>
      )}
      {resfriadores && (
        <mesh geometry={resfriadores}>
          <meshBasicMaterial color="#0e5f74" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Junta várias geometrias numa só, para desenhar tudo numa chamada de GPU. */
function mesclar(geometrias: THREE.BufferGeometry[]) {
  const total = geometrias.reduce(
    (soma, g) => soma + g.getAttribute("position").count,
    0,
  );
  const posicoes = new Float32Array(total * 3);
  const indices: number[] = [];
  let deslocamento = 0;

  for (const g of geometrias) {
    const p = g.getAttribute("position");
    posicoes.set(p.array as Float32Array, deslocamento * 3);
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + deslocamento);
      }
    }
    deslocamento += p.count;
    g.dispose();
  }

  const juntas = new THREE.BufferGeometry();
  juntas.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  juntas.setIndex(indices);
  juntas.computeVertexNormals();
  return juntas;
}

/** Linhas de largada e chegada. */
function Portais() {
  return (
    <group>
      {[
        { x: 0, cor: "#22e0f0" },
        { x: COMPRIMENTO, cor: "#f03ec8" },
      ].map((p) => (
        <group key={p.x} position={[p.x, 0, 0]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.5, 0.06, FAIXAS * LARGURA_FAIXA]} />
            <meshBasicMaterial color={p.cor} toneMapped={false} />
          </mesh>
          {[-1, 1].map((lado) => (
            <mesh
              key={lado}
              position={[0, 2.2, (lado * FAIXAS * LARGURA_FAIXA) / 2]}
            >
              <boxGeometry args={[0.35, 4.4, 0.35]} />
              <meshStandardMaterial
                color="#0d1422"
                emissive={p.cor}
                emissiveIntensity={0.8}
                toneMapped={false}
              />
            </mesh>
          ))}
          <mesh position={[0, 4.3, 0]}>
            <boxGeometry args={[0.35, 0.35, FAIXAS * LARGURA_FAIXA + 0.35]} />
            <meshStandardMaterial
              color="#0d1422"
              emissive={p.cor}
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A moto e o piloto. */
function Moto({ corrida }: { corrida: Corrida }) {
  const grupo = useRef<THREE.Group>(null);
  const corpo = useRef<THREE.Group>(null);
  const rodaTras = useRef<THREE.Mesh>(null);
  const rodaFrente = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const g = grupo.current;
    if (!g) return;
    const e = corrida.estadoRef.current;

    g.position.set(e.x, e.y + 0.38, zDaFaixa(e.faixaVisual));

    // Capotada: a moto tomba de lado, em vez de continuar de pé.
    const tombo = e.capotado ? 1.35 : 0;
    if (corpo.current) {
      corpo.current.rotation.z += (e.inclinacao - corpo.current.rotation.z) * Math.min(1, delta * 14);
      corpo.current.rotation.x += (tombo - corpo.current.rotation.x) * Math.min(1, delta * 10);
    }

    // As rodas giram conforme a velocidade (raio 0,38 m).
    const giro = (e.velocidade / 0.38) * delta;
    if (rodaTras.current) rodaTras.current.rotation.z -= giro;
    if (rodaFrente.current) rodaFrente.current.rotation.z -= giro;
  });

  return (
    <group ref={grupo}>
      <group ref={corpo}>
        {[
          { ref: rodaTras, x: -0.55 },
          { ref: rodaFrente, x: 0.55 },
        ].map((r, i) => (
          <mesh key={i} ref={r.ref} position={[r.x, 0, 0]}>
            <torusGeometry args={[0.38, 0.09, 8, 20]} />
            <meshStandardMaterial
              color="#dff7ff"
              emissive="#22e0f0"
              emissiveIntensity={0.7}
              metalness={0.6}
              roughness={0.3}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Quadro */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.15, 0.26, 0.3]} />
          <meshStandardMaterial
            color="#f03ec8"
            emissive="#f03ec8"
            emissiveIntensity={0.55}
            metalness={0.7}
            roughness={0.25}
            toneMapped={false}
          />
        </mesh>
        {/* Guidão */}
        <mesh position={[0.5, 0.55, 0]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.12, 0.5, 0.42]} />
          <meshStandardMaterial color="#8fe6f2" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Piloto, bem esquemático */}
        <mesh position={[-0.05, 0.72, 0]} rotation={[0, 0, -0.25]}>
          <capsuleGeometry args={[0.17, 0.42, 4, 8]} />
          <meshStandardMaterial color="#e8f6ff" metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0.18, 1.02, 0]}>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#22e0f0"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
      </group>

      <pointLight color="#22e0f0" intensity={9} distance={9} decay={2} position={[0, 1, 0]} />
    </group>
  );
}

/** Câmera lateral que persegue a moto, com tremor nas batidas. */
function Camera({ corrida, reduzido }: { corrida: Corrida; reduzido: boolean }) {
  const { camera, size } = useThree();
  const alvo = useMemo(() => new THREE.Vector3(), []);

  const posicionar = useCallback(
    (sacode: number) => {
      const e = corrida.estadoRef.current;
      const q = enquadramento(size.width, size.height, e.x, e.y);
      camera.position.set(
        q.posicao[0] + (Math.random() - 0.5) * sacode,
        q.posicao[1] + (Math.random() - 0.5) * sacode,
        q.posicao[2],
      );
      alvo.set(q.mira[0], q.mira[1], q.mira[2]);
      camera.lookAt(alvo);
    },
    [camera, corrida, size.width, size.height, alvo],
  );

  // Posiciona a câmera já na montagem. Sem isto, o primeiro quadro sai com a
  // câmera onde o react-three-fiber a deixou — olhando para a origem — e a
  // pista aparece fugindo na diagonal em vez de correr de lado.
  useLayoutEffect(() => posicionar(0), [posicionar]);

  useFrame((_, delta) => {
    const fx = corrida.efeitosRef.current;
    fx.tremor = Math.max(0, fx.tremor - delta * 2.2);
    posicionar(reduzido ? 0 : fx.tremor * fx.tremor * 0.5);
  });

  return null;
}

export default function CorridaScene({ corrida }: { corrida: Corrida }) {
  const visivel = usePageVisible();
  const reduzido = useReducedMotion() ?? false;

  return (
    <Canvas
      dpr={DPR}
      frameloop={visivel ? "always" : "never"}
      camera={{ position: [7, 4.4, 22], fov: 42, far: 400 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      // Sem isto, o primeiro quadro sai com a camera olhando para a origem, e
      // a pista aparece fugindo na diagonal ate o laco assumir o controle.
      onCreated={({ camera }) => camera.lookAt(7, 1.5, 0)}
    >
      <color attach="background" args={["#05060a"]} />
      {/* A névoa esconde o fim da pista ao longe, e some antes de alcançar a
          moto — a distância da câmera aqui é fixa, então dá para usar números
          fixos com segurança. */}
      <fog attach="fog" args={["#05060a", 60, 190]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[-20, 30, 25]} intensity={1.4} color="#9fe8ff" />
      <directionalLight position={[30, 20, -18]} intensity={0.9} color="#ff8ae0" />

      <Camera corrida={corrida} reduzido={reduzido} />
      <Terreno pista={corrida.pista} />
      <Portais />
      <Moto corrida={corrida} />

      {/* multisampling={0} e buffer em byte: sem isso muitas GPUs, sobretudo
          de celular, devolvem a tela inteira preta. */}
      {!reduzido && (
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom intensity={1} luminanceThreshold={0.25} mipmapBlur radius={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
