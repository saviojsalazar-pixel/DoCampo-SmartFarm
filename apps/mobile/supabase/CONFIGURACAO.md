# Configuração da sincronização Do Campo SmartFarm

O aplicativo permanece totalmente funcional sem esta configuração. A nuvem é usada somente para sincronizar os dois celulares.

1. Criar um projeto gratuito em Supabase.
2. Abrir o SQL Editor e executar `setup.sql`.
3. Cadastrar Sávio e Glaucio no Supabase Auth.
4. Executar `ativar-seguranca.sql` para limitar leitura e escrita aos dois usuários.
5. Copiar a Project URL e a chave pública `publishable` para `www/supabase-config.js`.
6. Alterar `configured` para `true`.
7. Gerar novamente o APK e testar primeiro com registros fictícios.

Não publique a chave `service_role` no aplicativo. Ela concede privilégios administrativos e deve permanecer somente no servidor.

Antes da liberação definitiva, validar:

- envio e recebimento nos dois aparelhos;
- operação completamente offline;
- fila após perda de sinal;
- conflitos simultâneos;
- restauração de exclusões;
- separação dos dados da empresa por políticas RLS.
