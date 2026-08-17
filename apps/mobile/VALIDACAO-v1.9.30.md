# Validação técnica — versão 1.9.30

## Fonte conferida

**Planilha:** ajuste.xlsx  
**Aba oficial:** Página2 corrigida

## Itens auditados

1. Cálculos de K em cmolc/dm³, SB, t, T, V%, m% e ocupação da CTC.
2. Classificação de pH, MO, P, S, Al, H+Al, SB, t, T, V e m.
3. Classificação de Ca, Mg e K pela porcentagem da CTC, preservando o valor laboratorial na apresentação.
4. Classificação por método/extrator dos micronutrientes.
5. Relações Ca/K, Mg/K e Ca/Mg, incluindo valores exatamente sobre os limites.
6. Consumo do motor central por barras, radar, CTC, triângulo e textos.

## Resultado automatizado

- `solo-rules.test.js`: aprovado.
- `solo-report-audit.test.js`: aprovado.

Observação: os testes asseguram coerência matemática e de software com a aba oficial. A validação agronômica final permanece sob responsabilidade dos profissionais habilitados da Do Campo Agronegócios.
