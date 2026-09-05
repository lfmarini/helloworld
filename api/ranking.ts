import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  atualizar,
  lerColecao,
  limpaTexto,
  marcaDeOrigem,
  podeEnviar,
  registraEnvio,
  type ComEspera,
  ConflitoDemais,
} from "./_armazem";

const ARQUIVO = "ranking.json";

/** Quantas posições o ranking guarda. */
const LIMITE = 20;
const NOME_MAX = 20;
/**
 * Pontuação máxima possível: o tabuleiro tem 17x17 casas e a cobra começa com
 * 3 segmentos, então não existe partida acima disso. Serve para barrar valores
 * inventados.
 */
const PONTOS_MAX = 17 * 17 - 3;
const ESPERA_MS = 10_000;

export interface Pontuacao {
  id: string;
  nome: string;
  pontos: number;
  em: number;
}

interface Ranking extends ComEspera {
  itens: Pontuacao[];
}

const VAZIO: Ranking = { itens: [] };

function paraOCliente(ranking: Ranking) {
  return { itens: ranking.itens };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const ranking = await lerColecao<Ranking>(ARQUIVO, VAZIO);
      return res.status(200).json(paraOCliente(ranking));
    }

    if (req.method === "POST") {
      const corpo = (req.body ?? {}) as Record<string, unknown>;
      const nome = limpaTexto(corpo.nome, NOME_MAX);
      const pontos = Number(corpo.pontos);

      if (!nome) {
        return res.status(400).json({ erro: "Escreva seu nome." });
      }
      if (!Number.isInteger(pontos) || pontos < 1 || pontos > PONTOS_MAX) {
        return res.status(400).json({ erro: "Pontuação inválida." });
      }

      const marca = marcaDeOrigem(req.headers as Record<string, unknown>);
      let recusa: string | null = null;

      const ranking = await atualizar<Ranking>(ARQUIVO, VAZIO, (atual) => {
        if (!podeEnviar(atual, marca, ESPERA_MS)) {
          recusa = "Espere alguns segundos antes de enviar de novo.";
          return atual;
        }
        registraEnvio(atual, marca);

        // Um nome ocupa uma linha só, com a melhor marca dele. Sem isso, quem
        // jogasse muito encheria o ranking inteiro sozinho.
        const chave = nome.toLowerCase();
        const outros = atual.itens.filter((p) => p.nome.toLowerCase() !== chave);
        const anterior = atual.itens.find((p) => p.nome.toLowerCase() === chave);
        const melhor = Math.max(pontos, anterior?.pontos ?? 0);

        const registro: Pontuacao = {
          id: anterior?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          nome,
          pontos: melhor,
          // Guarda a data da melhor marca: se empatar, quem chegou antes fica na frente.
          em: melhor === anterior?.pontos ? anterior.em : Date.now(),
        };

        const itens = [...outros, registro]
          .sort((a, b) => b.pontos - a.pontos || a.em - b.em)
          .slice(0, LIMITE);

        return { ...atual, itens };
      });

      if (recusa) return res.status(429).json({ erro: recusa });
      return res.status(201).json(paraOCliente(ranking));
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ConflitoDemais) {
      return res.status(503).json({ erro: e.message });
    }
    console.error("Falha no ranking:", e);
    return res
      .status(500)
      .json({ erro: "Não foi possível acessar o ranking agora." });
  }
}
