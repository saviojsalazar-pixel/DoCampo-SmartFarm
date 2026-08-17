# Do Campo SmartFarm — versão 1.9.30

## Motor único da interpretação de solo

- Todas as fórmulas, limites, classificações, posições e paletas foram centralizados em `www/solo-rules.js`.
- A fonte oficial é a aba **Página2 corrigida** da planilha de validação.
- Barras, radar, ocupação da CTC, triângulo Ca-Mg-K e textos consomem o mesmo objeto de interpretação.
- Ca, Mg e K exibem o valor informado pelo laboratório, mas são classificados pela participação percentual na CTC.
- Fósforo prioriza P-rem; na ausência, usa argila; sem ambos, aplica a faixa de cafeicultura consolidada.
- Enxofre usa P-rem quando informado e a faixa consolidada quando não informado.
- Métodos/extratores de B, Cu, Mn e Zn permanecem considerados pelo motor central.
- Relações Ca/K, Mg/K e Ca/Mg usam uma única classificação: abaixo do equilíbrio, equilíbrio ou acima do equilíbrio.

## Garantia contra contradições

- O cálculo completo da amostra gera uma única estrutura com resultados matemáticos e interpretações.
- Os componentes visuais não recalculam nem reclassificam valores.
- Foram adicionados testes dos limites exatos, inclusive P, S, SB e relações entre bases.

