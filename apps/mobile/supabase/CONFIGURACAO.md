# Configuração da sincronização Do Campo SmartFarm 1.9.46

Esta versão usa uma base nova (`v2`) e uma geração exclusiva. Isso impede que um
celular com uma versão antiga republique produtores, propriedades, talhões ou
produtos que foram removidos na restauração de fábrica.

## Ordem obrigatória da implantação

1. Confirme que existe um backup fora do aplicativo, se houver qualquer dado que
   ainda precise ser preservado.
2. No Supabase, abra **SQL Editor**.
3. Execute **uma única vez** o arquivo `setup-v2.sql` inteiro. Ele cria as
   tabelas, aplica as políticas, confirma a geração e somente então esvazia os
   registros `v2`. O arquivo é destrutivo e não deve ser repetido após o uso.
4. Em **Authentication > Users**, confirme as contas de Sávio e Gláucio.
5. Em **Storage > docampo-documents**, exclua manualmente eventuais PDFs antigos.
   Não exclua diretamente linhas de `storage.objects` no SQL.
6. Confirme a Project URL e a chave pública em `www/supabase-config.js`. Nunca
   coloque a chave `service_role` dentro do aplicativo.
7. Instale o APK 1.9.46 nos dois aparelhos. A primeira abertura apaga a base
   empresarial antiga de cada aparelho e cria uma identidade nova para ele.
8. Entre na conta de sincronização nos dois celulares.
9. Em apenas um aparelho, importe a planilha oficial. Sincronize esse aparelho
    até a fila ficar zerada; depois sincronize o segundo.

## Contas autorizadas no script

- `saviojsalazar@gmail.com`
- `glaucio.luciano.araujo@gmail.com`

Se o e-mail real de Gláucio for diferente, substitua todas as ocorrências no
`setup-v2.sql` antes de executá-lo. Um e-mail diferente será recusado pelas
políticas de segurança.

## Validação obrigatória com os dois aparelhos

- criar um produtor no aparelho A e recebê-lo no B;
- editar o mesmo talhão nos dois aparelhos e resolver o conflito exibido;
- trabalhar offline, fechar o aplicativo e confirmar a recuperação do rascunho;
- tirar duas fotos pela câmera, fechar o aplicativo e confirmar que continuam;
- gerar, abrir e compartilhar um PDF em cada aparelho;
- mover um PDF para a lixeira, restaurá-lo e esvaziar a lixeira;
- confirmar arquivamento automático após 7 dias e exclusão definitiva após 30;
- verificar que a fila pendente chega a zero e que não aparece erro 409.

O aplicativo continua salvando primeiro no aparelho. A sincronização replica os
registros depois, mas não substitui o armazenamento local nem deve ser usada
como confirmação de que um formulário ainda não gravado foi concluído.
