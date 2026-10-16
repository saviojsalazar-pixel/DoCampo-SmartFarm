# Do Campo SmartFarm v1.9.47

## Objetivo

Incorporar a recomendação técnica via solo criada por Gláucio ao padrão já
consolidado do SmartFarm, preservando seu fluxo, os cálculos por talhão e a
apresentação técnica, sem reintroduzir bancos de dados ou catálogos paralelos.

## Preservação dos dados existentes

- A geração do banco permanece `8d487154-0a7b-4d39-9228-7c6cc414d979`.
- A atualização de 1.9.46 para 1.9.47 não executa restauração de fábrica.
- Produtores, fazendas, talhões, produtos, visitas, recomendações e documentos
  já presentes na geração atual são preservados.
- O novo módulo lê e grava exclusivamente no banco central do aplicativo.

## Recomendação via solo

- Seleção de propriedade e talhões do cadastro oficial.
- Quantidade de pés vinda do cadastro, com edição ou cálculo por espaçamento.
- Aviso obrigatório quando o talhão não possui quantidade de pés cadastrada.
- Produtos do catálogo central, com possibilidade de cadastrar um produto novo.
- Cálculo de volume por planta, calda total, cargas completas e carga final.
- Quantidade de cada produto para carga completa e para a última carga parcial.
- Resumo consolidado de necessidade, estoque informado e quantidade a comprar.
- Métodos Drench/Esguicho, Fertirrigação e aplicação granulada.
- Pré-visualização antes do salvamento.
- PDF vetorial A4 com paginação automática, sem captura de tela e sem CDN.
- Histórico próprio, reaproveitamento como nova recomendação e recuperação de
  geração de PDF pendente.

## Proteções contra perda e conflito

- Rascunho automático no IndexedDB deste aparelho.
- Estado dos talhões ligado ao ID oficial do talhão, não à posição da lista.
- Snapshot técnico salvo antes de iniciar a geração do PDF.
- Se o PDF falhar, a recomendação permanece no histórico como `PDF pendente`.
- Código de documento inclui responsável e aparelho, evitando colisão entre os
  dois celulares.
- Documento final usa o fluxo central de armazenamento, histórico e sincronização.
- Exclusão de produto usa a lixeira central.
- Cadastro duplicado de propriedade ou produto é bloqueado nessa tela e deve ser
  resolvido nas centrais de cadastro.

## Itens do HTML original removidos de propósito

- Banco de produtores e talhões incorporado ao arquivo.
- Catálogo independente de produtos em `localStorage`.
- Dependências externas de Tailwind, Font Awesome, Google Fonts e html2pdf.
- Geração rasterizada do PDF, que elevava o consumo de memória.
- Funções de histórico incompletas e chamadas para funções inexistentes.

## Validação

- Testes do motor com valores decimais em português.
- Cargas exatas e cargas parciais.
- Aplicação líquida e granulada.
- Consolidação sem somar unidades incompatíveis.
- Auditoria contra bancos paralelos, `localStorage`, CDN e html2pdf.
- PDF extremo com 18 talhões, nomes longos, duas prescrições por talhão e cinco
  páginas A4, renderizado e inspecionado sem cortes de conteúdo.
- Suíte integral do projeto executada após sincronizar os arquivos web e Android.

## Versão Android

- `versionName`: 1.9.47
- `versionCode`: 227
