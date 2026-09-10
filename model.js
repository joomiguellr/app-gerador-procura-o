/* ============================================================
   MODELO DE DOCUMENTO — Procuração "ad et extra judicia"
   Reconstrói o texto do modelo Word original, mantendo fixo tudo
   que não estava grifado de amarelo, e tratando os campos grifados
   como opcionais: se um campo não for preenchido, ele (e a pontuação
   que o introduz) simplesmente não aparece no texto final.
   ============================================================ */

var FIRM = {
  advogado: "Gabriel Leme Rocha",
  qualificacao: "OAB/SP nº 487.487 e CPF nº 448.319.148-94, brasileiro, advogado, com escritório profissional na rua Isaura Andrade Monte, nº 209, Jd. Planalto, CEP 17293-044, na cidade de Macatuba/SP."
};

var PODERES_TEXTO =
  ': Os da cláusula "ad et extra judicia", para o foro em geral, podendo agir em conjunto ou isoladamente, ' +
  'independentemente da ordem de nomeação e mais o de propor contra quem de direito as ações competentes e ' +
  'defendê-lo(s) nas contrárias, seguindo umas e outras até final decisão, usando dos recursos legais e ' +
  'acompanhando-os, conferindo-lhe(s), ainda, poderes especiais para: representar o outorgante para transigir, ' +
  'inclusive em audiência, conforme artigo 334, parágrafo 10, do CPC, confessar, desistir, renunciar, transigir, ' +
  'firmar compromissos ou acordos, assinar termos de adjudicação, de caução e de penhora, declarações, receber, ' +
  'pagar, dar quitação, levantar depósitos judiciais, passar recibos, substabelecer com ou sem reservas de iguais ' +
  'poderes, dando tudo por bom, firme e valioso.';

var FOOTNOTE_TEXTO =
  '(Com base no § 1º do artigo 105 do CPC e nos termos da Lei nº 13.874/19, bem como na Medida Provisória ' +
  'nº 2.200-2/01, no Decreto nº 10.278/20, e, ainda, no Enunciado nº 297 do Conselho Nacional de Justiça, ' +
  'poderá este documento ser assinados digitalmente. Para este fim, serão utilizados os serviços disponíveis ' +
  'no mercado e amplamente utilizados que possibilitam a segurança, validade jurídica, autenticidade, ' +
  'integridade e validade da assinatura eletrônica por meio de sistemas de certificação digital capazes de ' +
  'validar a autoria, bem como de traçar a "trilha de auditoria digital" (cadeia de custódia) do documento, ' +
  'a fim de verificar sua integridade e autenticidade).';

function val(d, key) {
  return (d[key] || '').trim();
}

// Builds a run list from an ordered list of {key, prefix, bold} segments,
// dropping any segment whose field is empty, and stripping a leading
// ", " from whichever segment ends up first once empties are removed.
function buildOptionalRuns(d, leadLabel, leadBold, segments, trailing) {
  var filled = segments.filter(function (s) { return val(d, s.key) !== ''; });
  var runs = [];
  if (leadLabel) runs.push({ text: leadLabel, bold: leadBold });
  filled.forEach(function (seg, idx) {
    var prefix = seg.prefix;
    if (idx === 0) prefix = prefix.replace(/^,\s*/, '');
    if (prefix) runs.push({ text: prefix, bold: false });
    runs.push({ text: val(d, seg.key), bold: !!seg.bold });
  });
  if (trailing) runs.push({ text: trailing, bold: false });
  return runs;
}

function buildOutorganteRuns(d) {
  var segments = [
    { key: 'nome', prefix: '', bold: true },
    { key: 'nacionalidade', prefix: ', ', bold: false },
    { key: 'estadoCivil', prefix: ', ', bold: false },
    { key: 'rg', prefix: ', RG n. ', bold: false },
    { key: 'cpf', prefix: ', CPF n. ', bold: false },
    { key: 'rua', prefix: ', residente e domiciliada na ', bold: false },
    { key: 'numero', prefix: ', ', bold: false },
    { key: 'bairro', prefix: ', ', bold: false },
    { key: 'cep', prefix: ', CEP n. ', bold: false },
    { key: 'cidade', prefix: ', na cidade de ', bold: false }
  ];
  return buildOptionalRuns(d, 'OUTORGANTE: ', true, segments, '.');
}

function buildOutorgadoRuns() {
  return [
    { text: 'OUTORGADO: ', bold: true },
    { text: FIRM.advogado + ', ', bold: true },
    { text: FIRM.qualificacao, bold: false }
  ];
}

function buildPoderesRuns() {
  return [
    { text: 'PODERES', bold: true },
    { text: PODERES_TEXTO, bold: false }
  ];
}

function buildLocalDataRuns(d) {
  var segments = [
    { key: 'local', prefix: '' },
    { key: 'dia', prefix: ', ' },
    { key: 'mes', prefix: ' de ' },
    { key: 'ano', prefix: ' de ' }
  ];
  return buildOptionalRuns(d, '', false, segments, '');
}

function buildSignatureNomeRuns(d) {
  return [
    { text: 'OUTORGANTE: ', bold: true },
    { text: val(d, 'nome'), bold: false }
  ];
}

function buildSignatureCpfRuns(d) {
  return [
    { text: 'CPF: ', bold: true },
    { text: val(d, 'cpf'), bold: false }
  ];
}

function isOutorganteEmpty(d) {
  return val(d, 'nome') === '';
}

function isLocalDataEmpty(d) {
  return val(d, 'local') === '' && val(d, 'dia') === '' && val(d, 'mes') === '' && val(d, 'ano') === '';
}

// The full document as an ordered list of blocks. Both the HTML preview
// and the PDF renderer walk this same structure, so they always agree.
function buildDocumentModel(d) {
  var blocks = [];
  blocks.push({ type: 'title', text: 'PROCURAÇÃO' });
  blocks.push({ type: 'subtitle', text: '"ad et extra judicia"' });
  blocks.push({ type: 'space' });
  blocks.push({ type: 'p', align: 'justify', runs: buildOutorganteRuns(d), placeholderIf: isOutorganteEmpty(d) });
  blocks.push({ type: 'space' });
  blocks.push({ type: 'p', align: 'justify', runs: buildOutorgadoRuns() });
  blocks.push({ type: 'space' });
  blocks.push({ type: 'p', align: 'justify', runs: buildPoderesRuns() });
  blocks.push({ type: 'space' });
  blocks.push({ type: 'space' });
  blocks.push({ type: 'p', align: 'center', runs: buildLocalDataRuns(d), placeholderIf: isLocalDataEmpty(d) });
  blocks.push({ type: 'sigspace' });
  blocks.push({ type: 'p', align: 'center', runs: [{ text: '____________________________________________', bold: true }] });
  blocks.push({ type: 'p', align: 'center', runs: buildSignatureNomeRuns(d), tight: true });
  blocks.push({ type: 'p', align: 'center', runs: buildSignatureCpfRuns(d), tight: true });
  blocks.push({ type: 'footnote', text: FOOTNOTE_TEXTO });
  return blocks;
}
