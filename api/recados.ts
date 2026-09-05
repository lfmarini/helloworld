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

const ARQUIVO = "recados.json";

/** Quantos recados o mural guarda. Os mais antigos vão saindo. */
const LIMITE = 100;
const NOME_MAX = 20;
const TEXTO_MAX = 280;
/** Intervalo mínimo entre dois recados da mesma origem. */
const ESPERA_MS = 15_000;

export interface Recado {
  id: string;
  nome: string;
  texto: string;
  em: number;
}

interface Mural extends ComEspera {
  itens: Recado[];
}

const VAZIO: Mural = { itens: [] };

/** O mapa de esperas é detalhe interno: nunca sai para o navegador. */
function paraOCliente(mural: Mural) {
  return { itens: mural.itens };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A lista muda a toda hora; guardar em cache só faria o usuário ver recados
  // velhos depois de enviar o dele.
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const mural = await lerColecao<Mural>(ARQUIVO, VAZIO);
      return res.status(200).json(paraOCliente(mural));
    }

    if (req.method === "POST") {
      const corpo = (req.body ?? {}) as Record<string, unknown>;
      const nome = limpaTexto(corpo.nome, NOME_MAX);
      const texto = limpaTexto(corpo.texto, TEXTO_MAX);

      if (!nome) {
        return res.status(400).json({ erro: "Escreva seu nome." });
      }
      if (!texto) {
        return res.status(400).json({ erro: "Escreva um recado." });
      }

      const marca = marcaDeOrigem(req.headers as Record<string, unknown>);
      let recusa: string | null = null;

      const mural = await atualizar<Mural>(ARQUIVO, VAZIO, (atual) => {
        if (!podeEnviar(atual, marca, ESPERA_MS)) {
          recusa = "Espere alguns segundos antes de mandar outro recado.";
          return atual;
        }
        // Barra o mesmo recado repetido em sequência, que é o formato mais
        // comum de bagunça num mural aberto.
        const repetido = atual.itens
          .slice(0, 3)
          .some((r) => r.nome === nome && r.texto === texto);
        if (repetido) {
          recusa = "Esse recado já está no mural.";
          return atual;
        }

        registraEnvio(atual, marca);
        const novo: Recado = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          nome,
          texto,
          em: Date.now(),
        };
        return { ...atual, itens: [novo, ...atual.itens].slice(0, LIMITE) };
      });

      if (recusa) return res.status(429).json({ erro: recusa });
      return res.status(201).json(paraOCliente(mural));
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ConflitoDemais) {
      return res.status(503).json({ erro: e.message });
    }
    console.error("Falha no mural de recados:", e);
    return res
      .status(500)
      .json({ erro: "Não foi possível acessar o mural agora." });
  }
}
