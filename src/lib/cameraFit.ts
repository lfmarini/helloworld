import * as THREE from "three";
import { GRID } from "./snake";

/**
 * Enquadramento da câmera do jogo.
 *
 * Isto vive num arquivo separado (e sem nada de React) de propósito: é a parte
 * que já causou um bug sério — no celular em pé o tabuleiro sumia no preto — e
 * assim dá para testá-la direto no Node, sem navegador e sem placa de vídeo.
 */

/** Metade do tabuleiro, mais as paredes e uma folga. */
const HALF = (GRID - 1) / 2 + 1.2;

/**
 * De onde a câmera olha. Em tela deitada, bem inclinada, para dar profundidade.
 * Em tela em pé, mais de cima: com a inclinação forte o tabuleiro vira um
 * trapézio muito exagerado num celular.
 */
const DIR_DEITADA = new THREE.Vector3(0, 15.5, 12.5).normalize();
const DIR_EM_PE = new THREE.Vector3(0, 16, 7).normalize();

export function directionFor(aspect: number): THREE.Vector3 {
  return aspect < 1 ? DIR_EM_PE : DIR_DEITADA;
}

/**
 * A que distância a câmera precisa ficar para o tabuleiro inteiro caber.
 *
 * Chutar um valor fixo não funciona: o número que enquadra bem num monitor
 * deixa metade do tabuleiro de fora num celular em pé. Aqui fazemos uma busca
 * binária — testamos uma distância, verificamos se os oito cantos do tabuleiro
 * caem dentro do campo de visão, e vamos ajustando.
 */
export function fitDistance(
  fov: number,
  aspect: number,
  dir: THREE.Vector3,
): number {
  const corners: THREE.Vector3[] = [];
  for (const x of [-HALF, HALF]) {
    for (const z of [-HALF, HALF]) {
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

export interface CameraPlacement {
  dist: number;
  base: THREE.Vector3;
  /** Início e fim da névoa, em distância da câmera. */
  fog: [number, number];
}

/**
 * Posição da câmera e faixa da névoa para um tamanho de tela.
 *
 * A névoa precisa acompanhar a distância da câmera. Com valores fixos, numa
 * tela estreita (onde a câmera recua bastante) o tabuleiro inteiro cairia
 * depois do fim da névoa e viraria fundo preto — foi exatamente esse o bug
 * que fazia o jogo não aparecer no celular.
 */
export function cameraPlacement(
  fov: number,
  width: number,
  height: number,
): CameraPlacement {
  const aspect = width / height;
  const dir = directionFor(aspect);
  // 3% de margem para o brilho das paredes não encostar na borda da tela.
  const dist = fitDistance(fov, aspect, dir) * 1.03;
  return {
    dist,
    base: dir.clone().multiplyScalar(dist),
    fog: [dist * 0.95, dist * 2.4],
  };
}
