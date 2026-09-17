# Do Campo SmartFarm v1.9.42 — limpeza estrutural

## Objetivo

Eliminar divergências entre telas, falhas intermitentes de PDF e conflitos silenciosos entre dois celulares, sem alterar o desenho aprovado dos módulos.

## Alterações

- O cadastro-base de fazendas, talhões e produtos foi retirado da leitura dinâmica do HTML e isolado em `www/seed-data.json`.
- `registry-loader.js` é a fonte comum de leitura para os módulos; edições e dados sincronizados continuam prevalecendo sobre a base inicial.
- O checklist passa a carregar primeiro o cadastro central. As cópias antigas do `localStorage` ficam apenas como recuperação quando a base central não estiver disponível.
- O módulo de herbicidas não volta a mesclar cadastros legados depois de carregar a base central.
- A sincronização recebe eventos em ordem estável por data e identificador e deduplica cada evento pelo ID.
- Uma edição pendente no aparelho não é sobrescrita silenciosamente pelo outro celular; ela é registrada como conflito para resolução.
- Sem edição local pendente, prevalece a alteração mais recente.
- Pulverização, herbicidas e acompanhamento da produção usam o mesmo gerador central de PDF.
- O gerador bloqueia tentativas simultâneas, aguarda fontes e layout, valida o PDF e repete a geração com menor consumo de memória quando necessário.
- Versão Android: `1.9.42` (`versionCode 222`).

## Validação executada

- Reconciliação de fazendas, áreas e produtos.
- Compatibilidade de backup.
- Inclusão de produto pelos receituários.
- Política de conflito entre dois aparelhos e idempotência de eventos.
- Retenção de documentos.
- Auditoria da interpretação de solo.
- Auditoria estrutural para impedir banco de dados lido diretamente de HTML e geradores paralelos de PDF.
- Sintaxe dos JavaScript externos e scripts internos dos quatro módulos alterados.
- Igualdade entre `www` e a cópia embarcada no Android.

## Observação operacional

Nos dois celulares, instale a mesma versão e execute **Sincronizar online** antes de iniciar uma visita e novamente ao concluí-la. Se os dois aparelhos alterarem o mesmo registro enquanto estiverem offline, o aplicativo preservará as duas intenções como conflito em vez de apagar uma delas.
