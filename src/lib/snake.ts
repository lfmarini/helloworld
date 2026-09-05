/**
 * Lógica pura do jogo da cobrinha.
 *
 * De propósito este arquivo não sabe nada de React nem de three.js: ele só
 * manipula números numa grade. Isso deixa a regra do jogo fácil de entender e
 * de testar, e a parte 3D vira só "desenhe este estado".
 */

/** Tamanho do tabuleiro (17 x 17). Ímpar, para a cobra nascer no centro exato. */
export const GRID = 17;

export type Dir = "up" | "down" | "left" | "right";

export interface Vec {
  x: number;
  y: number;
}

/** Quanto cada direção soma na posição. y cresce "para baixo" na grade. */
const DELTA: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export interface SnakeState {
  /** Células ocupadas, da cabeça para a cauda. */
  cells: Vec[];
  /** Onde cada célula estava no passo anterior — usado para interpolar o movimento. */
  prev: Vec[];
  dir: Dir;
  /** Curvas que o jogador pediu e ainda não foram aplicadas. */
  pending: Dir[];
  food: Vec;
  score: number;
  alive: boolean;
}

/** Sorteia uma célula livre para a comida. */
export function randomFood(occupied: Vec[]): Vec {
  const free: Vec[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.some((c) => c.x === x && c.y === y)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

export function createState(): SnakeState {
  const c = Math.floor(GRID / 2);
  const cells: Vec[] = [
    { x: c, y: c },
    { x: c - 1, y: c },
    { x: c - 2, y: c },
  ];
  return {
    cells,
    prev: cells.map((p) => ({ ...p })),
    dir: "right",
    pending: [],
    food: randomFood(cells),
    score: 0,
    alive: true,
  };
}

/**
 * Registra uma curva pedida pelo jogador.
 *
 * A fila existe por um motivo prático: em velocidade alta dá para apertar duas
 * setas dentro do mesmo passo (ex.: "cima" e depois "esquerda"). Sem fila, a
 * segunda apagaria a primeira e a curva em L nunca aconteceria.
 *
 * Comparamos com a última direção *da fila*, não com a direção atual, senão
 * seria possível enfileirar uma meia-volta em dois passos e a cobra entraria
 * em si mesma.
 */
export function turn(s: SnakeState, dir: Dir) {
  const last = s.pending.length ? s.pending[s.pending.length - 1] : s.dir;
  if (dir === last || dir === OPPOSITE[last]) return;
  if (s.pending.length < 2) s.pending.push(dir);
}

export interface StepResult {
  ate: boolean;
  died: boolean;
}

/** Avança o jogo em um passo. Modifica o estado recebido. */
export function step(s: SnakeState): StepResult {
  const queued = s.pending.shift();
  if (queued) s.dir = queued;

  const d = DELTA[s.dir];
  const head: Vec = { x: s.cells[0].x + d.x, y: s.cells[0].y + d.y };

  const hitWall =
    head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  // A cauda é ignorada na colisão: ela sai da célula no mesmo passo em que a
  // cabeça entraria, então encostar nela não é batida.
  const hitSelf = s.cells
    .slice(0, -1)
    .some((c) => c.x === head.x && c.y === head.y);

  if (hitWall || hitSelf) {
    s.alive = false;
    return { ate: false, died: true };
  }

  const ate = head.x === s.food.x && head.y === s.food.y;

  // Guardamos as posições antigas ANTES de mover: é a partir delas que a parte
  // 3D interpola, fazendo a cobra deslizar em vez de pular de célula em célula.
  s.prev = s.cells.map((p) => ({ ...p }));
  s.cells.unshift(head);

  if (ate) {
    s.score += 1;
    // O segmento novo "nasce" onde a cauda estava, e não do nada.
    s.prev.push({ ...s.prev[s.prev.length - 1] });
    s.food = randomFood(s.cells);
  } else {
    s.cells.pop();
  }

  return { ate, died: false };
}

/**
 * Duração de cada passo em milissegundos. Quanto maior a pontuação, menor o
 * intervalo — ou seja, mais rápido. O piso de 75ms evita ficar injogável.
 */
export function tickMs(score: number): number {
  return Math.max(75, 200 - score * 5);
}
