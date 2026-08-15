# Do Campo SmartFarm 1.9.22

## Visitas compartilhadas

- O checklist em andamento é salvo como uma visita sincronizável.
- Ao selecionar a mesma fazenda no segundo aparelho, o aplicativo oferece a continuação da visita encontrada.
- O conteúdo local só é substituído depois da confirmação em **Continuar esta visita**.
- Alterações simultâneas continuam protegidas pelo mecanismo de conflitos do banco local.

## Checklist de campo

- Observação de cada talhão ampliada e com crescimento automático.
- Novo campo opcional de observações gerais da propriedade.
- Localizações GPS continuam opcionais e são convertidas em links clicáveis no relatório.

## Relatório PDF

- Novo desenho A4 em retrato.
- Cada talhão possui resumo técnico, tarefas recomendadas com caixas para marcação, observação própria e localizações.
- Tarefas curtas são organizadas em duas colunas; tarefas longas ocupam a largura disponível.
- Talhões sem observação exibem apenas a confirmação compacta “Sem observações adicionais”.
- Observações gerais aparecem no final somente quando preenchidas.
- Arquivo do checklist: `Relatorio_Campo_Propriedade_Produtor_Data_Codigo.pdf`.

## Identificação documental

- Códigos independentes por módulo e responsável: `CHK`, `PUL`, `HER`, `SOL` e `FOL`.
- Identificadores `SAV` e `GLA` evitam colisão entre os dois aparelhos durante o trabalho offline.
- A pré-visualização não consome numeração; o código definitivo nasce somente ao gerar o documento.
- Receituários, interpretações e checklist passam a usar produtor, data e código no nome do arquivo.

## Validação

- Scripts JavaScript verificados sintaticamente.
- Conteúdo web espelhado nos recursos Android.
- O APK final continua sendo produzido pelo fluxo já configurado no GitHub Actions.
