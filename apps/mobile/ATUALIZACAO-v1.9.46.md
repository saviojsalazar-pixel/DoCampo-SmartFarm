# Do Campo SmartFarm v1.9.46

## Finalidade desta versão

Esta é uma restauração de fábrica planejada. Produtores, propriedades, talhões,
produtos, visitas, recomendações e documentos antigos não são carregados na nova
geração. O cadastro deverá nascer da planilha oficial revisada.

## Correções estruturais

- Um único banco local transacional (`IndexedDB`) abastece todos os módulos.
- Removidos catálogo de herbicidas, sementes e SQLs paralelos antigos.
- Eliminado o gerenciador antigo do checklist que removia apenas da tela e fazia
  propriedades ou talhões reaparecerem.
- Diário local protege gravações que ocorram imediatamente antes de o Android
  suspender a tela.
- Atualização parcial de uma visita não pode apagar a lista já preenchida.
- Rascunhos de pulverização, herbicida e produção ficam exclusivos do aparelho e
  não poluem a fila compartilhada.

## Sincronização de dois aparelhos

- Protocolo: receber, mesclar, enviar sem confirmar, reler a ordem oficial e só
  então retirar eventos da fila.
- Reenvios usam o mesmo identificador e são idempotentes.
- Exclusões usam lápides; itens apagados não ressurgem por causa de uma cópia
  antiga do outro celular.
- Conflitos bloqueiam somente o registro afetado e permanecem disponíveis para
  decisão humana.
- Conta de sincronização e responsável técnico do aparelho são independentes.

## Planilha oficial

- O arquivo baixado já vem preenchido com produtores, propriedades, talhões,
  áreas, quantidade de pés de café e produtos existentes.
- Uma única importação pode atualizar cadastros e produtos.
- Propriedade, talhão ou produto repetido aparece para decisão; nada é resolvido
  silenciosamente.
- Talhão atual ausente da planilha pergunta se deve ser mantido ou enviado para a
  lixeira.
- Toda a importação é transacional: erro em um registro cancela o lote inteiro.

## Checklist, fotos e memória

- Botões separados para câmera e galeria.
- Foto comprimida nativamente para JPEG, limite de 1080 px e qualidade 68%.
- Arquivo privado persistente; o banco guarda somente metadados e caminho.
- Substituição e exclusão gravam o novo estado antes de remover o arquivo antigo.
- Checklist, rascunho, GPS e referência da foto sobrevivem ao fechamento do app.

## PDFs e documentos

- Uma geração por vez em cada aparelho.
- No Android, a conversão não é abandonada por timeout enquanto ainda consome RAM.
- PDF é gravado no armazenamento privado e registrado no banco antes de abrir o
  compartilhamento.
- Falha ao abrir o compartilhamento não apaga o documento.
- Um upload com erro não impede os outros PDFs pendentes de serem tentados.
- Documentos com 7 dias vão para a lixeira; exclusão definitiva ocorre após 30
  dias. Há restauração e botão **Esvaziar lixeira**.

## Acompanhamento de produção

- Gráficos dedicados ao PDF, sem reaproveitar captura comprimida da tela.
- Números acima das barras permanecem inclinados.
- Título do eixo Y fica vertical e totalmente visível.
- Legenda numerada permanece abaixo dos gráficos para evitar sobreposição.

## Implantação obrigatória

1. Confirme qualquer backup necessário fora do aplicativo.
2. No Supabase, execute uma única vez `supabase/setup-v2.sql`.
3. Instale o APK v1.9.46 nos dois aparelhos.
4. Selecione o responsável correto em cada celular.
5. Entre na conta de sincronização.
6. Importe a planilha oficial em apenas um aparelho.
7. Sincronize o primeiro até a fila zerar e depois sincronize o segundo.

Não importe backup de versão anterior nesta geração.
