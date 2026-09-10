(function () {
  "use strict";

  var FIELD_IDS = [
    'nome', 'nacionalidade', 'estadoCivil', 'rg', 'cpf',
    'rua', 'numero', 'bairro', 'cep', 'cidade',
    'local', 'dia', 'mes', 'ano'
  ];
  var STORAGE_KEY = 'procuracao_draft_v1';

  var inputs = {};
  FIELD_IDS.forEach(function (id) { inputs[id] = document.getElementById(id); });

  var paperEl = document.getElementById('paper');
  var validationHint = document.getElementById('validationHint');

  function getData() {
    var d = {};
    FIELD_IDS.forEach(function (id) { d[id] = inputs[id].value; });
    return d;
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
    } catch (e) { /* localStorage indisponível — segue sem salvar rascunho */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      FIELD_IDS.forEach(function (id) {
        if (d[id]) inputs[id].value = d[id];
      });
    } catch (e) { /* rascunho corrompido ou indisponível — ignora */ }
  }

  /* ---------------- HTML preview ---------------- */

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function runsToHtml(runs) {
    return runs.map(function (r) {
      var t = escapeHtml(r.text);
      return r.bold ? '<b>' + t + '</b>' : t;
    }).join('');
  }

  function renderPreview() {
    var data = getData();
    var blocks = buildDocumentModel(data);
    var html = '';
    blocks.forEach(function (b) {
      if (b.type === 'title') {
        html += '<p class="doc-title">' + escapeHtml(b.text) + '</p>';
      } else if (b.type === 'subtitle') {
        html += '<p class="doc-subtitle">' + escapeHtml(b.text) + '</p>';
      } else if (b.type === 'space') {
        html += '<div class="doc-space"></div>';
      } else if (b.type === 'sigspace') {
        html += '<div style="height:70px;"></div>';
      } else if (b.type === 'footnote') {
        html += '<p class="doc-footnote">' + escapeHtml(b.text) + '</p>';
      } else if (b.type === 'p') {
        var cls = 'doc-p';
        if (b.align === 'center') cls = 'doc-center';
        if (b.tight) cls += '';
        if (b.placeholderIf) cls += ' empty-outorgante';
        html += '<p class="' + cls + '"' + (b.tight ? ' style="margin-bottom:2px;"' : '') + '>' + runsToHtml(b.runs) + '</p>';
      }
    });
    paperEl.innerHTML = html;
  }

  /* ---------------- Validation hint ---------------- */

  function updateValidation() {
    if (!inputs.nome.value.trim()) {
      validationHint.textContent = 'Informe ao menos o nome do outorgante para gerar o documento.';
      validationHint.classList.add('warn');
    } else {
      validationHint.textContent = '';
      validationHint.classList.remove('warn');
    }
  }

  /* ---------------- PDF generation ---------------- */

  function getFontStyle(bold, italic) {
    if (bold && italic) return 'bolditalic';
    if (bold) return 'bold';
    if (italic) return 'italic';
    return 'normal';
  }

  function tokenizeRuns(runs) {
    var fullText = '';
    var styleMap = [];
    runs.forEach(function (run) {
      var start = fullText.length;
      fullText += run.text;
      for (var i = start; i < fullText.length; i++) {
        styleMap[i] = { bold: !!run.bold, italic: !!run.italic };
      }
    });
    var words = [];
    var i = 0;
    while (i < fullText.length) {
      while (i < fullText.length && /\s/.test(fullText[i])) i++;
      if (i >= fullText.length) break;
      var start2 = i;
      while (i < fullText.length && !/\s/.test(fullText[i])) i++;
      var wordText = fullText.slice(start2, i);
      var style = styleMap[start2];
      words.push({ word: wordText, bold: style.bold, italic: style.italic });
    }
    return words;
  }

  function wrapWords(doc, words, maxWidth, fontSize) {
    doc.setFontSize(fontSize);
    var lines = [];
    var current = [];
    var currentWidth = 0;
    words.forEach(function (w) {
      doc.setFont('times', getFontStyle(w.bold, w.italic));
      var wWidth = doc.getTextWidth(w.word);
      var sp = current.length > 0 ? doc.getTextWidth(' ') : 0;
      if (currentWidth + sp + wWidth > maxWidth && current.length > 0) {
        lines.push({ words: current, width: currentWidth });
        current = [];
        currentWidth = 0;
      }
      if (current.length > 0) currentWidth += doc.getTextWidth(' ');
      var wc = { word: w.word, bold: w.bold, italic: w.italic, width: wWidth };
      current.push(wc);
      currentWidth += wWidth;
    });
    if (current.length) lines.push({ words: current, width: currentWidth });
    return lines;
  }

  function renderParagraphPdf(doc, runs, x, y, maxWidth, fontSize, lineHeight, opts) {
    opts = opts || {};
    var align = opts.align || 'justify';
    var words = tokenizeRuns(runs);
    var lines = wrapWords(doc, words, maxWidth, fontSize);
    doc.setFontSize(fontSize);
    lines.forEach(function (line, idx) {
      if (opts.pageBottom && y > opts.pageBottom) {
        doc.addPage();
        y = opts.pageTop || 25;
      }
      var isLast = idx === lines.length - 1;
      var totalWordsWidth = line.words.reduce(function (s, w) { return s + w.width; }, 0);
      var gaps = line.words.length - 1;
      var spaceW = doc.getTextWidth(' ');
      var cursorX = x;

      if (align === 'justify' && !isLast && gaps > 0) {
        spaceW = (maxWidth - totalWordsWidth) / gaps;
      } else if (align === 'center') {
        var naturalWidth = totalWordsWidth + spaceW * gaps;
        cursorX = x + (maxWidth - naturalWidth) / 2;
      }

      line.words.forEach(function (w, wi) {
        doc.setFont('times', getFontStyle(w.bold, w.italic));
        doc.text(w.word, cursorX, y);
        cursorX += w.width + (wi < line.words.length - 1 ? spaceW : 0);
      });
      y += lineHeight;
    });
    return y;
  }

  function generatePdf() {
    if (!window.jspdf) {
      alert('Não foi possível carregar o gerador de PDF. Verifique sua conexão com a internet e tente novamente.');
      return;
    }
    var data = getData();
    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });

    var marginX = 25;
    var pageWidth = 210;
    var pageHeight = 297;
    var maxWidth = pageWidth - marginX * 2;
    var pageBottom = pageHeight - 30;
    var pageTop = 30;
    var y = 32;

    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.text('PROCURAÇÃO', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    doc.text('"ad et extra judicia"', pageWidth / 2, y, { align: 'center' });
    y += 12;

    y = renderParagraphPdf(doc, buildOutorganteRuns(data), marginX, y, maxWidth, 11, 6, { align: 'justify', pageBottom: pageBottom, pageTop: pageTop });
    y += 8;
    y = renderParagraphPdf(doc, buildOutorgadoRuns(), marginX, y, maxWidth, 11, 6, { align: 'justify', pageBottom: pageBottom, pageTop: pageTop });
    y += 8;
    y = renderParagraphPdf(doc, buildPoderesRuns(), marginX, y, maxWidth, 11, 6, { align: 'justify', pageBottom: pageBottom, pageTop: pageTop });
    y += 16;

    y = renderParagraphPdf(doc, buildLocalDataRuns(data), marginX, y, maxWidth, 11, 6, { align: 'center', pageBottom: pageBottom, pageTop: pageTop });
    y += 26;

    if (y > pageBottom - 30) { doc.addPage(); y = pageTop; }

    y = renderParagraphPdf(doc, [{ text: '____________________________________________', bold: true }], marginX, y, maxWidth, 11, 6, { align: 'center' });
    y += 1;
    y = renderParagraphPdf(doc, buildSignatureNomeRuns(data), marginX, y, maxWidth, 11, 6, { align: 'center' });
    y += 1;
    y = renderParagraphPdf(doc, buildSignatureCpfRuns(data), marginX, y, maxWidth, 11, 6, { align: 'center' });

    // Footnote, anchored near the bottom of the last page
    var footY = pageHeight - 32;
    doc.setDrawColor(200, 195, 180);
    doc.line(marginX, footY - 6, pageWidth - marginX, footY - 6);
    renderParagraphPdf(doc, [{ text: FOOTNOTE_TEXTO, bold: false, italic: true }], marginX, footY, maxWidth, 8, 3.6, { align: 'justify' });

    var nome = (data.nome || '').trim();
    var filename = 'procuracao' + (nome ? '_' + nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : '') + '.pdf';
    doc.save(filename);
  }

  /* ---------------- Quick fill (date/place) ---------------- */

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function quickFillDate() {
    var now = new Date();
    inputs.local.value = 'Macatuba/SP';
    inputs.dia.value = String(now.getDate());
    inputs.mes.value = MESES[now.getMonth()];
    inputs.ano.value = String(now.getFullYear());
    onChange();
  }

  /* ---------------- Wiring ---------------- */

  function onChange() {
    saveDraft();
    renderPreview();
    updateValidation();
  }

  FIELD_IDS.forEach(function (id) {
    inputs[id].addEventListener('input', onChange);
  });

  document.getElementById('downloadBtn').addEventListener('click', generatePdf);
  document.getElementById('quickfillDate').addEventListener('click', quickFillDate);
  document.getElementById('clearBtn').addEventListener('click', function () {
    if (!confirm('Limpar todos os campos do formulário?')) return;
    FIELD_IDS.forEach(function (id) { inputs[id].value = ''; });
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    renderPreview();
    updateValidation();
  });

  // Mobile tabs
  var tabFormBtn = document.getElementById('tabFormBtn');
  var tabPreviewBtn = document.getElementById('tabPreviewBtn');
  var panelForm = document.getElementById('panelForm');
  var panelPreview = document.getElementById('panelPreview');
  tabFormBtn.addEventListener('click', function () {
    tabFormBtn.classList.add('active');
    tabPreviewBtn.classList.remove('active');
    panelForm.classList.add('show');
    panelPreview.classList.remove('show');
  });
  tabPreviewBtn.addEventListener('click', function () {
    tabPreviewBtn.classList.add('active');
    tabFormBtn.classList.remove('active');
    panelPreview.classList.add('show');
    panelForm.classList.remove('show');
  });

  // Init
  loadDraft();
  renderPreview();
  updateValidation();
})();
