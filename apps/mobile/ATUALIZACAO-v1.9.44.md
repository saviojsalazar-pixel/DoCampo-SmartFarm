# Do Campo SmartFarm v1.9.44

## Estabilidade de dados e dois aparelhos

- UUID compativel com WebViews Android antigos.
- Consolidacao de varias edicoes pendentes do mesmo registro em um unico evento.
- Reducao da duplicacao de fotos do checklist no armazenamento local.
- Exclusoes tratadas como tombstones: copias antigas do outro celular nao ressuscitam registros.
- Sincronizacao enviada em lotes menores, com diagnostico isolado de erros 400/409.
- Mesclagem automatica de talhoes diferentes adicionados simultaneamente a mesma visita.
- Compactacao segura do historico tecnico de eventos para impedir crescimento indefinido.

## PDFs

- Gerador central aguarda fontes e imagens e possui limite de tempo por tentativa.
- Botao de salvar bloqueia toques duplicados durante a geracao.
- Relatorio de acompanhamento dividido em tres paginas reais.
- Producao e produtividade possuem paginas e graficos dedicados.
- Barras numeradas, valores alternados, escalas arredondadas e legendas com nome e valor.
- Linha da media identificada fora das barras.
- Paginacao corrigida para 3 paginas e legenda nunca dividida entre paginas.

## Compatibilidade

- Cadastros, backups e documentos existentes permanecem compativeis.
- Versao Android 1.9.44, codigo 224.
