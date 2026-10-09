(function () {
  'use strict';

  /*
   * Registro oficial do aplicativo.
   * Não existe fallback para seed-data, listas dos HTMLs ou catálogos antigos:
   * se o banco está vazio, as telas devem mostrar uma lista vazia.
   */
  async function all() {
    if (!window.DoCampoDB || !window.DoCampoData) throw new Error('O banco central de cadastros não foi carregado.');
    await DoCampoDB.ready();
    return DoCampoData.read();
  }

  async function defaults() {
    return { farms: [], products: {} };
  }

  window.DoCampoRegistry = { all, defaults };
})();
