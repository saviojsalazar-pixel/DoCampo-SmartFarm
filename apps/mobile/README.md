# Do Campo SmartFarm

Aplicativo Android híbrido com uma central de acesso aos módulos da Do Campo Agronegócios.

## Estrutura atual

- Checklist de lavoura
- Recomendação técnica de pulverização
- Espaços preparados para novos módulos

## Funcionamento offline

- Interface, fontes, ícones e bibliotecas de PDF incluídos no APK.
- Checklist e geração do relatório funcionam sem internet.
- O módulo de recomendação funciona como rascunho profissional offline, com cálculos operacionais automáticos bloqueados para revisão do responsável habilitado.

## Identificação Android

- Nome: `Do Campo SmartFarm`
- Pacote: `br.com.docampo.smartfarm`
- Tecnologia: Capacitor Android

## Compilação

1. Instale Android Studio com Android SDK.
2. Execute `npm install`.
3. Execute `npx cap sync android`.
4. Abra a pasta `android` no Android Studio.
5. Use **Build > Build APK(s)**.

O APK de teste será criado em `android/app/build/outputs/apk/debug/app-debug.apk`.
