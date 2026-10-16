(function () {
  'use strict';

  const GREEN = [21, 128, 61];
  const GREEN_DARK = [20, 83, 45];
  const INK = [15, 23, 42];
  const MUTED = [71, 85, 105];
  const LINE = [203, 213, 225];
  const SOFT = [248, 250, 252];
  const MINT = [240, 253, 244];
  const AMBER = [180, 83, 9];
  const PAGE_W = 210;
  const PAGE_H = 297;
  const LEFT = 12;
  const RIGHT = 12;
  const BOTTOM = 19;
  const CONTENT_W = PAGE_W - LEFT - RIGHT;

  const clean = value => String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  const fmt = (value, min = 0, max = 2) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

  function setColor(doc, rgb, fill) {
    if (fill) doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    else doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  function text(doc, value, x, y, options) {
    const opts = options || {};
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 8);
    setColor(doc, opts.color || INK, false);
    doc.text(String(value == null ? '' : value), x, y, { align: opts.align || 'left', baseline: 'alphabetic' });
  }

  function lines(doc, value, width, size) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size || 8);
    const paragraphs = String(value == null ? '' : value).replace(/\r\n?/g, '\n').split('\n');
    return paragraphs.flatMap(paragraph => paragraph.trim() ? doc.splitTextToSize(paragraph.trim(), width) : ['']);
  }

  function box(doc, x, y, w, h, fill, stroke) {
    setColor(doc, fill || SOFT, true);
    doc.setDrawColor(...(stroke || LINE));
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 1.6, 1.6, 'FD');
  }

  function loadLogo() {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const side = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
          canvas.width = side;
          canvas.height = side;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, side, side);
          const ratio = Math.min(side / image.naturalWidth, side / image.naturalHeight);
          const width = image.naturalWidth * ratio;
          const height = image.naturalHeight * ratio;
          context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) { resolve(null); }
      };
      image.onerror = () => resolve(null);
      image.src = 'assets/logo.png';
    });
  }

  function drawHeader(doc, snapshot, logo, subtitle) {
    if (logo) {
      try { doc.addImage(logo, 'PNG', LEFT, 8, 14, 14, undefined, 'FAST'); }
      catch (_) {}
    } else {
      setColor(doc, GREEN, true);
      doc.roundedRect(LEFT, 8, 14, 14, 2, 2, 'F');
      text(doc, 'DC', LEFT + 7, 17.2, { size: 10, bold: true, color: [255, 255, 255], align: 'center' });
    }
    text(doc, 'DO CAMPO AGRONEGÓCIOS', LEFT + 17, 13.3, { size: 12.5, bold: true, color: GREEN });
    text(doc, subtitle || 'RECOMENDAÇÃO TÉCNICA VIA SOLO', LEFT + 17, 18.1, { size: 7.2, bold: true, color: MUTED });
    text(doc, snapshot.documentCode || 'VSL-PRÉVIA', PAGE_W - RIGHT, 12.5, { size: 8.2, bold: true, color: GREEN, align: 'right' });
    text(doc, snapshot.dateLabel || new Date().toLocaleDateString('pt-BR'), PAGE_W - RIGHT, 18, { size: 7.7, color: MUTED, align: 'right' });
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.55);
    doc.line(LEFT, 24, PAGE_W - RIGHT, 24);
    return 28;
  }

  function addContinuationPage(doc, snapshot, logo, subtitle) {
    doc.addPage();
    return drawHeader(doc, snapshot, logo, subtitle || 'RECOMENDAÇÃO TÉCNICA VIA SOLO - CONTINUAÇÃO');
  }

  function ensureSpace(doc, y, needed, snapshot, logo, subtitle) {
    return y + needed <= PAGE_H - BOTTOM ? y : addContinuationPage(doc, snapshot, logo, subtitle);
  }

  function drawFarm(doc, snapshot, y) {
    const height = 28;
    box(doc, LEFT, y, CONTENT_W, height, SOFT, LINE);
    text(doc, 'PROPRIEDADE / FAZENDA', LEFT + 3, y + 5, { size: 6.5, bold: true, color: MUTED });
    lines(doc, snapshot.farm || '--', 84, 8.2).slice(0, 2).forEach((line, index) => text(doc, line, LEFT + 3, y + 10 + index * 3.5, { size: 8.2, bold: true }));
    text(doc, 'PRODUTOR RURAL', LEFT + 98, y + 5, { size: 6.5, bold: true, color: MUTED });
    lines(doc, snapshot.producer || '--', 58, 8.2).slice(0, 2).forEach((line, index) => text(doc, line, LEFT + 98, y + 10 + index * 3.5, { size: 8.2, bold: true }));
    text(doc, snapshot.cpf ? `CPF: ${snapshot.cpf}` : 'CPF: --', PAGE_W - RIGHT - 3, y + 10, { size: 6.6, color: MUTED, align: 'right' });
    doc.setDrawColor(...LINE);
    doc.line(LEFT + 3, y + 17, PAGE_W - RIGHT - 3, y + 17);
    text(doc, 'ENDEREÇO', LEFT + 3, y + 21.2, { size: 6.3, bold: true, color: MUTED });
    lines(doc, snapshot.address || '--', CONTENT_W - 30, 6.9).slice(0, 2).forEach((line, index) => text(doc, line, LEFT + 25, y + 21.2 + index * 3.2, { size: 6.9, color: MUTED }));
    return y + height + 3;
  }

  function drawMetrics(doc, snapshot, y) {
    const gap = 2;
    const width = (CONTENT_W - gap * 3) / 4;
    const values = [
      ['Método via solo', (snapshot.methods || []).join(', ') || '--'],
      ['Total de plantas', `${fmt(snapshot.totals?.plants, 0, 0)} plantas`],
      ['Área tratada', `${fmt(snapshot.totals?.area, 2, 2)} ha`],
      ['Tanque utilizado', `${fmt(snapshot.tankCapacity, 0, 1)} L`]
    ];
    values.forEach((item, index) => {
      const x = LEFT + index * (width + gap);
      box(doc, x, y, width, 16, [241, 245, 249], LINE);
      text(doc, item[0], x + 2, y + 4.5, { size: 6.2, bold: true, color: MUTED });
      const wrapped = lines(doc, item[1], width - 4, 7.5).slice(0, 2);
      text(doc, wrapped[0] || '--', x + 2, y + 9.5, { size: 7.6, bold: true, color: index === 0 || index === 2 || index === 3 ? GREEN : INK });
      if (wrapped[1]) text(doc, wrapped[1], x + 2, y + 13.1, { size: 6.6, bold: true, color: GREEN });
    });
    return y + 20;
  }

  function drawSectionTitle(doc, label, y) {
    text(doc, label.toUpperCase(), LEFT, y, { size: 8.2, bold: true, color: INK });
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(LEFT, y + 1.8, PAGE_W - RIGHT, y + 1.8);
    return y + 5;
  }

  function fieldHeight(doc, field) {
    const load = field.liquidApplication
      ? `${fmt(field.plants, 0, 0)} plantas | ${fmt(field.mlPerPlant, 0, 1)} mL/planta | Calda: ${fmt(field.syrupLiters, 1, 1)} L | ${field.loadDescription}`
      : `${fmt(field.plants, 0, 0)} plantas | Aplicação sem tanque`;
    let height = 13 + lines(doc, load, CONTENT_W - 6, 6.5).length * 3.1;
    (field.products || []).forEach(product => {
      const main = `${product.name} (${fmt(product.dose, 0, 2)} ${product.unit}) • Total: ${fmt(product.total, 2, 2)} ${product.unitBase}`;
      const mix = field.liquidApplication
        ? `Carga cheia: ${fmt(product.fullTankQuantity, 2, 2)} ${product.unitBase}${field.loads.partialLiters ? ` • Carga final: ${fmt(product.partialQuantity, 2, 2)} ${product.unitBase}` : ''}`
        : 'Aplicação sem diluição em tanque';
      height += lines(doc, main, CONTENT_W - 7, 7.2).length * 3.2;
      height += lines(doc, mix, CONTENT_W - 7, 6.7).length * 3.0 + 1.2;
    });
    if (!(field.products || []).length) height += 5;
    return Math.max(19, height + 3);
  }

  function splitField(doc, field) {
    const maximum = PAGE_H - BOTTOM - 31;
    const products = field.products || [];
    if (fieldHeight(doc, field) <= maximum || products.length < 2) return [field];
    const chunks = [];
    let current = [];
    products.forEach(product => {
      const candidate = { ...field, products: [...current, product] };
      if (current.length && fieldHeight(doc, candidate) > maximum) {
        chunks.push(current);
        current = [product];
      } else current.push(product);
    });
    if (current.length) chunks.push(current);
    return chunks.map((chunk, index) => ({
      ...field,
      name: index ? `${field.name} (continuação ${index + 1})` : field.name,
      products: chunk
    }));
  }

  function drawField(doc, field, y) {
    const height = fieldHeight(doc, field);
    box(doc, LEFT, y, CONTENT_W, height, SOFT, LINE);
    text(doc, `Talhão: ${field.name} (${fmt(field.area, 2, 2)} ha)`, LEFT + 2.5, y + 4.8, { size: 7.7, bold: true });
    const load = field.liquidApplication
      ? `${fmt(field.plants, 0, 0)} plantas | ${fmt(field.mlPerPlant, 0, 1)} mL/planta | Calda: ${fmt(field.syrupLiters, 1, 1)} L | ${field.loadDescription}`
      : `${fmt(field.plants, 0, 0)} plantas | Aplicação sem tanque`;
    const loadLines = lines(doc, load, CONTENT_W - 6, 6.5);
    loadLines.forEach((line, index) => text(doc, line, LEFT + 2.5, y + 9 + index * 3.1, { size: 6.5, bold: true, color: GREEN }));
    let cursor = y + 10.8 + loadLines.length * 3.1;
    doc.setDrawColor(...LINE);
    doc.line(LEFT + 2.5, cursor, PAGE_W - RIGHT - 2.5, cursor);
    cursor += 3.2;
    if (!(field.products || []).length) {
      text(doc, 'Nenhum produto selecionado.', LEFT + 2.5, cursor, { size: 7, color: MUTED });
    }
    (field.products || []).forEach(product => {
      const main = `${product.name} (${fmt(product.dose, 0, 2)} ${product.unit}) • Total no talhão: ${fmt(product.total, 2, 2)} ${product.unitBase}`;
      lines(doc, main, CONTENT_W - 7, 7.2).forEach(line => {
        text(doc, line, LEFT + 2.5, cursor, { size: 7.2, bold: true });
        cursor += 3.2;
      });
      const mix = field.liquidApplication
        ? `Carga cheia (${fmt(field.loads.capacity, 0, 1)} L): ${fmt(product.fullTankQuantity, 2, 2)} ${product.unitBase}${field.loads.partialLiters ? ` • Carga final (${fmt(field.loads.partialLiters, 1, 1)} L): ${fmt(product.partialQuantity, 2, 2)} ${product.unitBase}` : ''}`
        : 'Aplicação sem diluição em tanque.';
      lines(doc, mix, CONTENT_W - 7, 6.7).forEach(line => {
        text(doc, line, LEFT + 4, cursor, { size: 6.7, color: GREEN });
        cursor += 3;
      });
      cursor += 1;
    });
    return y + height + 2;
  }

  function drawSummary(doc, snapshot, y, logo) {
    y = ensureSpace(doc, y, 18, snapshot, logo, 'RESUMO CONSOLIDADO - VIA SOLO');
    y = drawSectionTitle(doc, 'Resumo consolidado de insumos', y);
    const products = snapshot.totals?.products || [];
    if (!products.length) {
      text(doc, 'Nenhum produto prescrito.', LEFT, y + 4, { size: 7.4, color: MUTED });
      return y + 9;
    }
    for (const product of products) {
      const nameLines = lines(doc, product.name, CONTENT_W - 5, 7.4).slice(0, 2);
      const height = 8.5 + nameLines.length * 3.3;
      y = ensureSpace(doc, y, height + 2, snapshot, logo, 'RESUMO CONSOLIDADO - VIA SOLO');
      box(doc, LEFT, y, CONTENT_W, height, MINT, [134, 239, 172]);
      nameLines.forEach((line, index) => text(doc, line, LEFT + 2.5, y + 4.2 + index * 3.3, { size: 7.4, bold: true }));
      const totalsY = y + height - 2.7;
      text(doc, `Total: ${fmt(product.total, 2, 2)} ${product.unitBase}`, LEFT + 2.5, totalsY, { size: 7 });
      text(doc, `Em estoque: ${fmt(product.inStock, 2, 2)} ${product.unitBase}`, LEFT + 82, totalsY, { size: 7, color: MUTED });
      text(doc, `A comprar: ${fmt(product.toBuy, 2, 2)} ${product.unitBase}`, PAGE_W - RIGHT - 2.5, totalsY, { size: 7.2, bold: true, color: product.toBuy > 0 ? AMBER : GREEN, align: 'right' });
      y += height + 2;
    }
    return y;
  }

  function drawAcknowledgement(doc, snapshot, y, logo) {
    const notices = [
      'A não observância das recomendações indicadas é passível das sanções previstas em lei.',
      'Em caso de intoxicação, procure atendimento médico levando esta recomendação e a embalagem, o rótulo ou a bula do produto.',
      'As precauções, os cuidados ambientais, os equipamentos de proteção e as condições de uso devem seguir as bulas dos produtos selecionados.',
      'As embalagens vazias devem ser lavadas e devolvidas conforme a orientação presente na nota fiscal e na legislação aplicável.'
    ];
    const noticeLines = notices.flatMap((item, index) => lines(doc, `${index + 1}. ${item}`, CONTENT_W - 6, 6.6));
    const height = 7 + noticeLines.length * 3.2;
    y = ensureSpace(doc, y, height + 25, snapshot, logo, 'CIÊNCIA E ASSINATURAS - VIA SOLO');
    box(doc, LEFT, y, CONTENT_W, height, [255, 251, 235], [252, 211, 77]);
    text(doc, 'CIÊNCIA DO USUÁRIO', LEFT + 2.5, y + 4.4, { size: 7.2, bold: true, color: AMBER });
    let cursor = y + 8;
    noticeLines.forEach(line => {
      text(doc, line, LEFT + 2.5, cursor, { size: 6.6, color: MUTED });
      cursor += 3.2;
    });
    y += height + 4;
    box(doc, LEFT, y, CONTENT_W, 21, SOFT, LINE);
    const half = CONTENT_W / 2;
    doc.setDrawColor(...INK);
    doc.line(LEFT + 10, y + 12, LEFT + half - 10, y + 12);
    doc.line(LEFT + half + 10, y + 12, PAGE_W - RIGHT - 10, y + 12);
    text(doc, snapshot.responsible?.name || 'Responsável técnico', LEFT + half / 2, y + 16, { size: 7.4, bold: true, align: 'center' });
    text(doc, snapshot.responsible?.credential || '', LEFT + half / 2, y + 19.2, { size: 6.4, color: MUTED, align: 'center' });
    text(doc, 'Ciente do Produtor / Aplicador', LEFT + half + half / 2, y + 16, { size: 7.4, bold: true, align: 'center' });
    text(doc, 'Assinatura do responsável', LEFT + half + half / 2, y + 19.2, { size: 6.4, color: MUTED, align: 'center' });
    return y + 24;
  }

  function drawInstructions(doc, snapshot, logo) {
    let y = addContinuationPage(doc, snapshot, logo, 'INSTRUÇÕES E RECOMENDAÇÕES TÉCNICAS');
    const sections = [
      ['Instruções de segurança e EPI', snapshot.notes?.safety, GREEN],
      ['Primeiros socorros', snapshot.notes?.firstAid, [190, 24, 93]],
      ['Aplicação e preparo da calda', snapshot.notes?.technical, GREEN],
      ['Precauções de uso e aplicação', snapshot.notes?.precautions, AMBER],
      ['Manejo integrado', snapshot.notes?.ipm, GREEN],
      ['Cuidados ao meio ambiente', snapshot.notes?.environment, GREEN]
    ];
    for (const section of sections) {
      const wrapped = lines(doc, section[1] || '--', CONTENT_W - 6, 7.3);
      let offset = 0;
      let part = 0;
      while (offset < wrapped.length) {
        let availableLines = Math.floor((PAGE_H - BOTTOM - y - 11) / 3.6);
        if (availableLines < 2) {
          y = addContinuationPage(doc, snapshot, logo, 'INSTRUÇÕES TÉCNICAS - CONTINUAÇÃO');
          availableLines = Math.floor((PAGE_H - BOTTOM - y - 11) / 3.6);
        }
        const chunk = wrapped.slice(offset, offset + Math.max(1, availableLines));
        const height = Math.max(14, 8 + chunk.length * 3.6);
        box(doc, LEFT, y, CONTENT_W, height, SOFT, LINE);
        const title = section[0].toUpperCase() + (part ? ' — CONTINUAÇÃO' : '');
        text(doc, title, LEFT + 2.5, y + 4.7, { size: 7.5, bold: true, color: section[2] });
        let cursor = y + 9;
        chunk.forEach(line => {
          text(doc, line, LEFT + 2.5, cursor, { size: 7.3, color: INK });
          cursor += 3.6;
        });
        y += height + 3;
        offset += chunk.length;
        part++;
        if (offset < wrapped.length) y = addContinuationPage(doc, snapshot, logo, 'INSTRUÇÕES TÉCNICAS - CONTINUAÇÃO');
      }
    }
  }

  function addFooters(doc) {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      box(doc, LEFT, PAGE_H - 14, CONTENT_W, 9, SOFT, LINE);
      text(doc, 'DO CAMPO AGRONEGÓCIOS', PAGE_W / 2, PAGE_H - 10.7, { size: 6.5, bold: true, color: GREEN, align: 'center' });
      text(doc, 'Rua Do Campo, SN, Reduto - Minas Gerais | CNPJ: 52.124.298/0001-45 | Telefone: (33) 98468-9806', PAGE_W / 2, PAGE_H - 7.5, { size: 5.8, color: MUTED, align: 'center' });
      text(doc, `Página ${page} de ${pages}`, PAGE_W - RIGHT - 2, PAGE_H - 7.5, { size: 5.8, color: MUTED, align: 'right' });
    }
  }

  async function generate(snapshot) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('O gerador vetorial de PDF não foi carregado.');
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true });
    const logo = await loadLogo();
    let y = drawHeader(doc, snapshot, logo, 'RECOMENDAÇÃO DE FUNGICIDA, INSETICIDA E NEMATICIDA VIA SOLO');
    y = drawFarm(doc, snapshot, y);
    y = drawMetrics(doc, snapshot, y);
    y = drawSectionTitle(doc, 'Detalhamento de produtos, cargas e calda por talhão', y);
    for (const field of snapshot.fields || []) {
      for (const part of splitField(doc, field)) {
        const needed = fieldHeight(doc, part) + 2;
        y = ensureSpace(doc, y, needed, snapshot, logo, 'DETALHAMENTO POR TALHÃO - CONTINUAÇÃO');
        y = drawField(doc, part, y);
      }
    }
    y = drawSummary(doc, snapshot, y, logo);
    drawAcknowledgement(doc, snapshot, y, logo);
    drawInstructions(doc, snapshot, logo);
    addFooters(doc);
    return doc.output('datauristring');
  }

  window.DoCampoViaSoloPDF = { generate };
})();
