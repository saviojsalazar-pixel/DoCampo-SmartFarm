# DoCampo SmartFarm v1.9.41

- Corrigido o erro `Falha ao enviar: 409` durante a sincronização.
- O reenvio de um evento já recebido pela nuvem agora é tratado como concluído, sem bloquear o restante da fila.
- Importações de backup e interrupções de conexão não devem mais deixar a sincronização presa em um registro duplicado.
- Mensagens futuras de falha passam a mostrar o detalhe devolvido pelo servidor.
- Mantidas todas as correções e funcionalidades das versões anteriores.

Versão Android: `1.9.41` (`versionCode 221`).
