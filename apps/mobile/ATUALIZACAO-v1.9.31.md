# Do Campo SmartFarm — versão 1.9.31

Atualização controlada da Interpretação de Solo.

## Base técnica

- Regras centralizadas em `www/solo-rules.js`.
- Classificações, limites, posição dos marcadores e cores derivados da aba validada **Página2 corrigida**.
- Ca, Mg e K continuam mostrando o valor informado pelo laboratório, mas são classificados pela participação na CTC.
- Valores fornecidos pelo laboratório para SB, t, T, V e m são preservados; o cálculo é usado apenas quando o campo estiver ausente.

## Correções visuais

- Cada atributo usa a própria sequência de faixas; não há mais uma barra genérica para todos.
- O marcador preto permanece dentro da cor correspondente à classe calculada.
- S e Fe elevados são apresentados como **Alto**, sem sugerir que valores crescentes sejam sempre melhores.
- Relações Ca/K, Mg/K e Ca/Mg usam **Abaixo do equilíbrio**, **Equilíbrio** e **Acima do equilíbrio**.
- Valor acima do marcador e classe em preto, fora da barra e sem sobreposição.
- Radar e triângulo permanecem separados.
- Legendas explicativas do radar e do triângulo seguem o padrão de caixa verde-clara.
- CTC mantém dois gráficos de pizza, cada um em sua caixa, com rótulos próximos ao setor correspondente e sem linhas longas.
- Foram mantidos o triângulo e o gráfico de pH já validados.

## Exemplos validados

- pH 5,00: Médio, marcador no verde.
- K 142 mg/dm³: classificação pela %CTC e marcador na faixa correspondente.
- Mg 0,60 cmolc/dm³: classificação pela %CTC.
- S 31,30 mg/dm³: Alto, faixa superior alaranjada.
- Fe 80,70 mg/dm³: Alto, faixa superior alaranjada.
- Mn 7,50 e Zn 3,00 mg/dm³: Médio, faixa verde.
- Ca/K 7,71 e Mg/K 1,65: Abaixo do equilíbrio.
- Ca/Mg 4,67: Acima do equilíbrio.
