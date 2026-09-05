# HelloWorld

Dois brinquedos que rodam inteiramente dentro do navegador: um **jogo da
cobrinha em 3D** e um **afinador de violão** que escuta pelo microfone.

É um PWA — dá para instalar no celular ou no computador e usar sem internet.

🔗 **No ar:** https://helloworld-one-drab.vercel.app

---

## Rodando na sua máquina

Você vai precisar do [Node.js](https://nodejs.org/en/download) versão 20.19 ou
mais nova (a versão LTS serve).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal — normalmente
`http://localhost:5173`.

### Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento, com recarga automática |
| `npm run build` | Gera a versão de produção na pasta `dist/` |
| `npm run preview` | Serve a pasta `dist/` para conferir a build final |
| `npm run lint` | Procura problemas no código |

> **Sobre o microfone:** navegadores só liberam o microfone em `https://` ou em
> `localhost`. No `npm run dev` funciona porque é localhost. Se você abrir o
> site pelo IP da máquina na rede local (algo como `192.168.0.10:5173`), o
> afinador não vai conseguir ligar o microfone.

---

## O que tem dentro

```
src/
├─ pages/
│  ├─ Home.tsx           tela inicial, com o fundo 3D que segue o mouse
│  ├─ Snake.tsx          jogo: placar, controles e telas de pausa/fim
│  └─ Tuner.tsx          afinador: leitura, instruções e erros de microfone
├─ components/
│  ├─ three/             tudo que desenha em 3D (three.js)
│  ├─ DPad.tsx           cruz direcional para telas de toque
│  └─ Fretboard.tsx      diagrama do braço do violão, em SVG
└─ lib/
   ├─ snake.ts           regras do jogo, sem React e sem 3D
   ├─ useSnakeGame.ts    relógio do jogo, pontuação e recorde
   ├─ pitch.ts           detecção de altura (algoritmo YIN)
   ├─ useTuner.ts        microfone, filtros e estabilização da leitura
   └─ tunings.ts         afinações padrão, Drop D e meio tom abaixo
```

### Ferramentas

Vite · React · TypeScript · Tailwind CSS · three.js (react-three-fiber) ·
framer-motion · vite-plugin-pwa. Não existe servidor: tudo acontece no
navegador, e nada é enviado para lugar nenhum.

---

## Duas decisões que valem explicação

### Por que a cobra desliza em vez de pular

O jogo avança em passos de tempo fixos (200 ms no começo, acelerando até
75 ms). Se cada passo desenhasse a cobra na célula nova, o movimento ficaria
aos trancos. Então guardamos também **onde cada segmento estava no passo
anterior** e, a cada quadro, desenhamos num ponto intermediário entre as duas
posições. O jogo pensa em células; a tela mostra movimento contínuo.

### Por que o afinador não usa FFT

O caminho óbvio seria pegar o pico da FFT, mas a FFT divide o espectro em
faixas de largura fixa. Com 2048 pontos a 22 kHz, cada faixa tem cerca de
10,8 Hz — perto do mi grave (82,41 Hz) isso é um erro de mais de 200 cents,
dois semitons inteiros. Para afinar é preciso acertar na casa de 1 cent.

Por isso usamos o **YIN**, que trabalha no tempo: procura o atraso que faz a
onda coincidir consigo mesma e depois refina esse valor com interpolação
parabólica. Medindo com sinais sintéticos, o erro nas seis cordas ficou entre
**0,03 e 0,18 cents**.

Antes da análise o sinal passa por um filtro que corta abaixo de 55 Hz (ronco
elétrico) e acima de 1 kHz (chiado). E leituras com pouca confiança são
descartadas em vez de exibidas — mais vale não mostrar nada do que mostrar a
nota errada.

---

## Publicação

O site é publicado na Vercel a partir deste repositório:

```bash
npm run build
npx vercel --prod
```
