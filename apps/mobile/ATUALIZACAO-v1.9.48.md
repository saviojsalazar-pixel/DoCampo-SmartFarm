# Do Campo SmartFarm v1.9.48

## Escopo

Esta atualização preserva a geração atual do banco e concentra as alterações na
recomendação Via Solo e na adaptação das telas de visualização e edição para o
celular. Nenhum produtor, propriedade, talhão, produto, visita, recomendação ou
documento existente é removido durante a instalação.

## Receituário Via Solo

- Apresentação aproximada do receituário técnico de referência do Gláucio,
  mantendo o padrão visual, a logo e a identidade da Do Campo Agronegócios.
- PDF vetorial A4; não utiliza captura de tela nem dependências externas.
- O modelo normal com seis talhões fica organizado em duas páginas: dados,
  cálculos, resumo, ciência e assinaturas na primeira; recomendações técnicas na
  segunda.
- Ingrediente ativo e alvo permanecem no documento, concentrados no resumo para
  evitar repetição, sobreposição e páginas desnecessárias.
- Paginação dinâmica para nomes longos, muitos produtos, muitos talhões e textos
  técnicos extensos.
- O arquivo é salvo no padrão
  `Receituario_Via_Solo_<Fazenda>_<codigo-unico>.pdf`.
- O código `VSL` continua sendo reservado antes da geração e identifica de forma
  única o responsável e o aparelho, evitando colisão entre celulares.

## Agrupamento opcional de talhões

- Novo botão **Agrupar talhões semelhantes**.
- A sugestão aceita somente talhões cuja diferença entre a menor e a maior
  população do grupo seja de até 500 plantas por hectare.
- O usuário confere os membros e escolhe o talhão de referência antes de aplicar.
- Produto e volume por planta do talhão de referência são copiados somente após a
  confirmação.
- Área, população, calda, cargas e quantidades continuam calculadas separadamente
  para cada talhão.
- Se a recomendação de algum membro for alterada depois, o PDF deixa de tratá-lo
  como parte do grupo incompatível, evitando apresentar receitas diferentes como
  se fossem uma só.

## Visualização e edição no celular

- As prévias de PDF passam a usar toda a altura visível da tela e rolagem interna,
  inclusive com barra de navegação, orientação alterada e teclado aberto.
- Páginas A4 são ajustadas à largura disponível na prévia, sem esconder a lateral
  direita.
- Editores de produtores, propriedades, talhões e produtos ficam em tela cheia no
  celular, com cabeçalho e ações acessíveis.
- A linha de talhão reserva campos próprios para nome, hectares, pés de café e
  exclusão; no celular o nome ocupa a largura completa e os demais campos ficam na
  linha seguinte.
- Ao editar um campo com o teclado aberto, a tela reposiciona o controle para que
  ele permaneça visível.

## Persistência

- A geração do banco permanece `8d487154-0a7b-4d39-9228-7c6cc414d979`.
- O formato de backup permanece compatível com a geração atual.
- Rascunhos Via Solo anteriores continuam aceitos; o novo formato acrescenta
  somente os agrupamentos confirmados.
- O fluxo de salvamento continua registrando o snapshot técnico antes de gerar o
  PDF, preservando os dados mesmo se o arquivo precisar ser gerado novamente.

## Validação

- Testes de agrupamento com limite exato de 500 plantas/ha e rejeição de grupos
  cuja amplitude ultrapassa o limite.
- Teste de receita compatível independentemente da ordem dos produtos.
- Teste de código e nome do arquivo final.
- Teste de PDF normal com duas páginas.
- Teste extremo com produto longo, 32 produtos em um talhão, grupo, doze talhões
  e noventa orientações, confirmando paginação automática sem corte.
- Testes de layout móvel, sintaxe, arquivos offline e igualdade entre a pasta web
  e a cópia incorporada ao Android.

## Versão Android

- `versionName`: 1.9.48
- `versionCode`: 228
