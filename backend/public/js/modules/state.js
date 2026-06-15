// ===== COMÉRCIO BES — ESTADO GLOBAL =====
// Único objeto mutável compartilhado entre módulos.
// Importar { state } onde precisar ler/escrever estado da aplicação.

export const state = {
  /** Lista de comércios carregada da API ou data.json */
  comercios: [],
  /** Categoria ativa no filtro */
  categoriaAtiva: 'todos',
  /** Instância do mapa Leaflet */
  mapa: null,
  /** Página atual na paginação */
  paginaAtual: 1,
  /** true após conexão bem-sucedida com a API REST */
  apiDisponivel: false,
  /** Comércio aberto no modal de perfil */
  comercioAtual: null
};
