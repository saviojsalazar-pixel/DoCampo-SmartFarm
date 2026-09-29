# Do Campo SmartFarm v1.9.45

## Correções

- O botão **Tirar foto** usa diretamente a câmera nativa do Android.
- **Escolher da galeria** permanece como ação separada.
- Fotos do checklist são gravadas imediatamente como arquivos privados, fora do `localStorage`.
- Fotos antigas em Base64 são migradas automaticamente, sem apagar visitas.
- Fotos são reidratadas ao reabrir a visita e antes de gerar o PDF.
- Cada foto possui identificador e caminho remoto próprios para sincronização entre aparelhos.
- O backup v2 inclui também os arquivos de foto disponíveis no aparelho.
- A configuração do Supabase aceita `image/jpeg` no armazenamento privado; as políticas continuam limitadas às contas de Sávio e Gláucio.
- O banco local deixa de duplicar o conteúdo Base64 das imagens.
- Mensagens de limite do banco local deixam de afirmar incorretamente que a memória física do celular acabou.
- A legenda do eixo Y dos gráficos de produção e produtividade fica vertical e inteiramente visível.
- Valores numéricos acima das barras permanecem inclinados, conforme validado.

## Compatibilidade

- Dados da v1.9.44 são preservados.
- A migração das fotos ocorre na primeira abertura do checklist correspondente.
- PDFs continuam armazenados como arquivos privados e os registros permanecem no banco unificado.

## Ativação da sincronização de fotos

Após subir esta versão, execute uma vez o arquivo `supabase-documentos.sql` no SQL Editor do Supabase. A instrução apenas amplia o bucket privado existente para aceitar JPEG e recria as mesmas políticas restritas.
