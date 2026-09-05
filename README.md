# HelloWorld

Brinquedos que rodam dentro do navegador — um **jogo da cobrinha em 3D**, uma
**corrida de motocross** de rolagem lateral e um **afinador de violão** que
escuta pelo microfone — mais um **mural de recados** e um **ranking**
compartilhados entre quem visita.

É um PWA: dá para instalar no celular ou no computador. O jogo e o afinador
funcionam sem internet; mural e ranking, naturalmente, precisam de conexão.

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
│  ├─ Corrida.tsx        motocross: painel, controles e aviso de girar a tela
│  └─ Tuner.tsx          afinador: leitura, instruções e erros de microfone
├─ components/
│  ├─ three/             tudo que desenha em 3D (three.js)
│  ├─ DPad.tsx           cruz direcional para telas de toque
│  └─ Fretboard.tsx      diagrama do braço do violão, em SVG
├─ lib/
│  ├─ snake.ts           regras do jogo, sem React e sem 3D
│  ├─ useSnakeGame.ts    relógio do jogo, pontuação e recorde
│  ├─ motocross.ts       física da corrida e geração da pista
│  ├─ useCorrida.ts      relógio da corrida e melhor tempo
│  ├─ cameraCorrida.ts   enquadramento lateral da corrida
│  ├─ pitch.ts           detecção de altura (algoritmo YIN)
│  ├─ useTuner.ts        microfone, filtros e estabilização da leitura
│  └─ tunings.ts         afinações padrão, Drop D e meio tom abaixo
└─ (api/ fica na raiz)

api/
├─ _armazem.ts           lê e grava no Vercel Blob, com escrita condicional
├─ recados.ts            GET e POST do mural
└─ ranking.ts            GET e POST do ranking
```

> Os arquivos em `api/` só rodam publicados na Vercel. Com `npm run dev` o
> mural e o ranking não respondem — para testá-los na sua máquina use
> `npx vercel dev`, que sobe o site e as funções juntos.

### Ferramentas

Vite · React · TypeScript · Tailwind CSS · three.js (react-three-fiber) ·
framer-motion · vite-plugin-pwa · Vercel Blob.

O jogo e o afinador acontecem inteiramente no navegador — o som do microfone
nunca sai do aparelho. Só o mural e o ranking conversam com o servidor, e o
que trafega é apenas o que aparece na tela: nome, texto e pontuação.

---

## Três decisões que valem explicação

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

### Por que gravar exige uma etiqueta de versão

Mural e ranking ficam cada um num arquivo JSON no Vercel Blob. Blob guarda
arquivos, não é banco de dados: para adicionar um recado é preciso ler o
arquivo inteiro, mexer e gravar de volta. Se duas pessoas fizessem isso ao
mesmo tempo, as duas leriam a mesma lista e a segunda gravação apagaria a
primeira.

Por isso toda leitura traz uma **etiqueta de versão** (ETag), e a gravação diz
"só grave se o arquivo ainda estiver nesta versão". Se alguém tiver escrito no
meio do caminho, a gravação é recusada e o servidor lê de novo e refaz a
alteração por cima do dado novo.

Um detalhe custou tempo e vale registrar: quando o arquivo cresce, a resposta
passa a vir comprimida e a etiqueta muda de forma — vira `W/"abc"` em vez de
`"abc"`. A gravação condicional só aceita a segunda forma, então **tudo parava
de gravar depois que os dados cresciam**, enquanto funcionava perfeitamente com
os arquivos ainda pequenos. O código remove esse prefixo antes de comparar.

---

## Publicação

O site é publicado na Vercel a partir deste repositório:

```bash
npm run build
npx vercel --prod
```
