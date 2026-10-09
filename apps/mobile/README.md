# Do Campo SmartFarm

Aplicativo Android híbrido com uma central de acesso aos módulos da Do Campo Agronegócios.

## Estrutura atual

- Central única de produtores, propriedades, talhões e produtos
- Checklist de lavoura com GPS, câmera, galeria e recuperação de rascunho
- Receituários de pulverização e herbicidas
- Interpretação de análise de solo
- Acompanhamento de produção e produtividade
- Histórico de documentos, lixeira e retenção automática
- Banco local transacional, fila, conflitos e sincronização autenticada

## Funcionamento offline

- Interface, fontes, ícones e bibliotecas de PDF incluídos no APK.
- Cadastros, checklist, receituários, análises e geração de PDF funcionam sem internet.
- Rascunhos e arquivos são gravados antes de abrir o compartilhamento do Android.
- A internet é necessária apenas para o primeiro login e para sincronizar os aparelhos.

## Restauração de fábrica v1.9.46

Esta versão inicia uma geração nova e vazia. Antes de instalar nos dois aparelhos,
leia `supabase/CONFIGURACAO.md` e execute uma única vez o script destrutivo
`supabase/setup-v2.sql`. Depois, importe a planilha oficial em somente um aparelho
e sincronize o segundo.

Backups de gerações anteriores são bloqueados de propósito para impedir que dados
antigos ou duplicados repovoem a base restaurada.

## Identificação Android

- Nome: `Do Campo SmartFarm`
- Pacote: `br.com.docampo.smartfarm`
- Tecnologia: Capacitor Android

## Compilação

1. Instale Android Studio com Android SDK.
2. Execute `npm install`.
3. Execute `npm test`.
4. Execute `npx cap sync android`.
5. Abra a pasta `android` no Android Studio.
6. Use **Build > Build APK(s)**.

O APK de teste será criado em `android/app/build/outputs/apk/debug/app-debug.apk`.
