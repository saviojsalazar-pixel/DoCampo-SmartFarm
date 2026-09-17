# Do Campo SmartFarm v1.9.43

## Importação oficial com revisão

- A planilha passa a substituir os talhões somente das propriedades presentes nela.
- Talhões antigos ausentes na planilha exigem a escolha entre manter ou enviar para a lixeira.
- Duplicidades por acento, espaço, maiúsculas e pontuação são apresentadas antes da importação.
- Áreas iguais a zero exigem decisão explícita.
- A confirmação permanece bloqueada enquanto houver decisão pendente ou erro.
- Propriedades que não constam na planilha não são alteradas.
- As decisões e o arquivo de origem ficam registrados no histórico da importação.
- Inclusões, alterações e exclusões recebem o mesmo identificador de lote para sincronização entre aparelhos.

## Caso real validado

A planilha `Cadastros Do Campo SmartFarm(1).xlsx` apresentou corretamente:

- duplicidade `3.2 Dom Corrêa` / `3.2 Dom Correa`;
- duplicidade existente de `7.4 Maria Januária` quando simulada no cadastro atual;
- quatro talhões com área zero em `Propriedades Gabriel e Thalys`;
- nenhuma falha estrutural de leitura.
