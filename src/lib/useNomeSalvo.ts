import { useCallback, useState } from "react";

const CHAVE = "helloworld:nome";

/**
 * Guarda o nome que a pessoa usou da última vez, para ela não precisar
 * digitar de novo no mural e no ranking.
 */
export function useNomeSalvo() {
  const [nome, definirNome] = useState(() => {
    // localStorage pode estourar em aba anônima ou com cookies bloqueados.
    try {
      return localStorage.getItem(CHAVE) ?? "";
    } catch {
      return "";
    }
  });

  const salvar = useCallback((valor: string) => {
    definirNome(valor);
    try {
      localStorage.setItem(CHAVE, valor);
    } catch {
      /* sem nome guardado, tudo continua funcionando */
    }
  }, []);

  return [nome, salvar] as const;
}
