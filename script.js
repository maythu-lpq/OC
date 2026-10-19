'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const math = el => window.renderMathInElement && renderMathInElement(el, {
  delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
  throwOnError: false
});
const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
const M = {
  SN1: {n: 'S<sub>N</sub>1', what: 'The leaving group leaves first, making a carbocation. Then the nucleophile attacks. Two steps, and the configuration gets scrambled.'},
  SN2: {n: 'S<sub>N</sub>2', what: 'The nucleophile attacks from the back while the leaving group leaves. One step, and the configuration flips.'},
  E1:  {n: 'E1', what: 'The leaving group leaves first, making a carbocation. Then a base pulls off a neighbouring hydrogen to make an alkene. Two steps.'},
  E2:  {n: 'E2', what: 'A base pulls off a neighbouring hydrogen while the leaving group leaves, making an alkene. One step.'},
  NR:  {n: 'No reaction', what: 'Nothing useful happens under these conditions.'}
};

/* ---------- tabs ---------- */
function show(tab) {
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('on', p.id === tab));
}
$$('.tab').forEach(b => b.onclick = () => show(b.dataset.tab));
math($('.hero'));

/* ---------- 1. predictor (plain words, no formulas) ---------- */
const OPT = {
  sub:  [['methyl', 'Methyl'], ['primary', 'Primary (1°)'], ['secondary', 'Secondary (2°)'], ['tertiary', 'Tertiary (3°)']],
  reag: [['nu', 'Good nucleophile, weak base (I⁻, CN⁻, N₃⁻)'], ['sb', 'Strong base and nucleophile (HO⁻, EtO⁻)'],
         ['bulky', 'Bulky strong base (t-BuOK)'], ['weak', 'Weak nucleophile (H₂O, alcohols)']],
  solv: [['protic', 'Protic (water, alcohols)'], ['aprotic', 'Aprotic (DMSO, DMF, acetone)']],
  temp: [['low', 'Room temperature ❄️'], ['high', 'Heated 🔥']]
};
const ids = {sub: 'c-sub', reag: 'c-reag', solv: 'c-solv', temp: 'c-temp'};
Object.keys(OPT).forEach(k => {
  $('#' + ids[k]).innerHTML = OPT[k].map((o, i) =>
    `<label class="chip"><input type="radio" name="${k}" value="${o[0]}" ${i === (k === 'sub' ? 2 : 0) ? 'checked' : ''}><span>${o[1]}</span></label>`).join('');
});
const val = k => $(`input[name=${k}]:checked`).value;

function predict(s, r, sol, heat) {
  const why = []; let major, minor = null;
  if (r === 'weak') {
    if (sol === 'aprotic' || s === 'methyl' || s === 'primary') {
      major = 'NR'; why.push('The nucleophile is too weak to attack directly, and this carbon cannot form a stable carbocation (or the solvent cannot help it form).');
    } else {
      major = heat ? 'E1' : 'SN1'; minor = heat ? 'SN1' : 'E1';
      why.push('This carbon can form a fairly stable carbocation in a protic solvent, and the solvent itself does the attacking.');
      why.push(heat ? 'Heat favours making the alkene.' : 'At room temperature, substitution wins over elimination.');
    }
  } else if (r === 'bulky') {
    if (s === 'methyl') { major = 'SN2'; why.push('Methyl has no neighbouring hydrogen, so elimination is impossible.'); }
    else { major = 'E2'; why.push('The base is too big to reach the carbon, so it grabs an easy hydrogen on the neighbouring carbon instead.'); if (s === 'primary') why.push('You get the less crowded alkene.'); }
  } else if (r === 'sb') {
    if (s === 'methyl') { major = 'SN2'; why.push('The methyl carbon is wide open and has no neighbouring hydrogen.'); }
    else if (s === 'primary') { major = heat ? 'E2' : 'SN2'; minor = heat ? 'SN2' : 'E2'; why.push('A primary carbon is easy to attack from the back; heating pushes it toward elimination.'); }
    else { major = 'E2'; minor = s === 'secondary' ? 'SN2' : null; why.push('A strong base on a crowded carbon mostly pulls off a hydrogen.'); if (s === 'tertiary') why.push('A tertiary carbon is too crowded for back-side attack.'); }
  } else {
    if (s === 'methyl' || s === 'primary') { major = 'SN2'; why.push('A strong nucleophile and an open carbon is the classic combination.'); }
    else if (s === 'secondary') { major = 'SN2'; minor = 'E2'; why.push(sol === 'aprotic' ? 'An aprotic solvent leaves the nucleophile free and fast.' : 'A protic solvent slows the nucleophile down, so other pathways compete.'); }
    else if (sol === 'protic') { major = 'SN1'; minor = 'E1'; why.push('The carbon is too crowded for back-side attack, the nucleophile is not basic enough to eliminate, and a protic solvent helps the carbocation form.'); }
    else { major = 'E2'; why.push('A tertiary carbon cannot be attacked from the back and an aprotic solvent does not help ionisation, so slow elimination is what is left.'); }
  }
  return {major, minor, why};
}

$('#go').onclick = () => {
  const p = predict(val('sub'), val('reag'), val('solv'), val('temp') === 'high'), m = M[p.major], box = $('#result');
  box.hidden = false;
  box.innerHTML = `<div>Major: <span class="badge">${m.n}</span>${p.minor ? ` &nbsp;Minor: <span class="badge minor">${M[p.minor].n}</span>` : ''}</div>
    <p>${m.what}</p><ul>${p.why.map(w => `<li>${w}</li>`).join('')}</ul>
    ${p.major !== 'NR' ? `<button class="btn ghost" id="see">Watch it happen 🏹</button>` : ''}`;
  const see = $('#see'); if (see) see.onclick = () => { show('visual'); pickMech(p.major); };
};

/* ---------- 2. visualizer with moving electrons ---------- */
const T = (x, y, t, c = '') => `<text x="${x}" y="${y}" class="nd ${c}" text-anchor="middle">${t}</text>`;
const L = (x1, y1, x2, y2, br) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bd">${br ? `<animate attributeName="opacity" to="0" begin="${br}s" dur=".4s" fill="freeze"/>` : ''}</line>`;
const Lf = (x1, y1, x2, y2, t) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bd" opacity="0"><animate attributeName="opacity" to="1" begin="${t}s" dur=".4s" fill="freeze"/></line>`;
// curved arrow + two electrons that hop along it
const A = (d, lab, lx, ly, b = 0.2) => `<path d="${d}" class="arrow" style="animation-delay:${b}s" marker-end="url(#ah)"/><text x="${lx}" y="${ly}" class="al" text-anchor="middle">${lab}</text>` +
  [0, .2].map(o => `<circle r="5.5" class="e" opacity="0"><set attributeName="opacity" to="1" begin="${b + o}s"/><animateMotion path="${d}" dur="1s" begin="${b + o}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/></circle>`).join('');
// leaving group: becomes an anion, then hops away and bounces to the side
const LG = (x, y, a, b, t) => `<g><animateMotion path="M0,0 Q45,-80 100,0 Q115,-24 130,0" dur="1.3s" begin="${t}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 0 .3 1"/>
  <text x="${x}" y="${y}" class="nd lg" text-anchor="middle">${a}<animate attributeName="opacity" to="0" begin="${t}s" dur=".01s" fill="freeze"/></text>
  <text x="${x}" y="${y}" class="nd lg" text-anchor="middle" opacity="0">${b}<set attributeName="opacity" to="1" begin="${t}s"/></text></g>`;
const V = {
  SN2: [
    {t: 'Back-side attack while the leaving group leaves', d: 'The nucleophile pushes its lone pair into carbon from the side opposite bromine. At the same moment the C–Br electrons slide onto Br, and Br⁻ hops away.',
     s: T(70, 130, 'Nu⁻', 'nu') + T(300, 130, 'C', 'c') + T(300, 175, 'R₃', 'sub') + L(318, 126, 385, 126, 1.2) + Lf(100, 126, 282, 126, 1.2) + LG(410, 130, 'Br', 'Br⁻', 1.9) +
        A('M90 108 Q190 36 290 106', 'lone pair attacks C', 190, 52, .2) + A('M352 118 Q395 66 408 104', 'C–Br pair goes to Br', 450, 66, .9)},
    {t: 'Transition state', d: 'Carbon is briefly bonded to both Nu and Br with partial bonds, and the three R groups flatten into one plane.',
     s: T(320, 120, '[ Nu···C···Br ]‡', 'ts') + T(320, 170, 'δ⁻ at both ends, R₃ flat in the middle', 'sub')},
    {t: 'Inverted product', d: 'The new Nu–C bond is formed, Br⁻ has left, and the carbon has turned inside out like an umbrella in the wind (Walden inversion).',
     s: T(200, 130, 'Nu–CR₃', 'prod') + T(430, 130, 'Br⁻', 'lg') + T(200, 175, 'configuration inverted', 'sub')}
  ],
  SN1: [
    {t: 'The leaving group leaves (slow step)', d: 'The C–Br electrons slide onto bromine and Br⁻ hops off by itself, leaving a carbocation behind.',
     s: T(300, 130, 'R₃C', 'c') + L(335, 126, 395, 126, 1) + LG(420, 130, 'Br', 'Br⁻', 1.3) + A('M365 116 Q400 66 418 104', 'C–Br pair goes to Br', 450, 66, .2)},
    {t: 'Carbocation intermediate', d: 'The carbon is now flat with an empty p orbital. More alkyl groups around it make it more stable: 3° > 2° > 1°.',
     s: cation()},
    {t: 'The nucleophile captures C⁺', d: 'The solvent can attack from either face, so both configurations form. Then it loses H⁺ to give the neutral product.',
     s: T(80, 130, 'H₂Ö:', 'nu') + T(300, 130, 'R₃C⁺', 'c') + Lf(125, 126, 275, 126, 1.2) + A('M110 108 Q200 40 288 104', 'attacks either face', 200, 54, .2) + T(300, 175, 'then loses H⁺ → R₃C–OH', 'sub')}
  ],
  E2: [
    {t: 'Everything happens at once', d: 'The base takes a hydrogen, the C–H electrons become the new C=C bond, and the C–Br electrons slide onto Br, which hops away.',
     s: T(60, 135, 'B⁻', 'nu') + T(170, 135, 'H', 'sub') + L(188, 130, 240, 130, 1) + T(262, 135, 'Cβ', 'c') + L(285, 130, 340, 130) + Lf(285, 140, 340, 140, 1.6) + T(362, 135, 'Cα', 'c') + L(385, 130, 435, 130, 1.8) + LG(458, 135, 'Br', 'Br⁻', 2) +
        Lf(85, 130, 152, 130, 1) + A('M75 112 Q120 66 166 114', 'B takes H', 120, 62, .2) + A('M215 120 Q262 62 312 120', 'C–H pair becomes C=C', 265, 54, .6) + A('M410 120 Q445 70 458 110', 'C–Br pair goes to Br', 500, 78, 1)},
    {t: 'Alkene formed', d: 'This needs the H and Br on opposite sides (anti). The base ends up holding the H, and Br⁻ is free.',
     s: T(180, 130, 'C=C', 'prod') + T(320, 130, 'B–H', 'nu') + T(450, 130, 'Br⁻', 'lg') + T(180, 175, 'alkene', 'sub')}
  ],
  E1: [
    {t: 'The leaving group leaves (slow step)', d: 'The same first step as SN1: C–Br electrons go to Br, which hops away, leaving a carbocation.',
     s: T(300, 130, 'R₃C', 'c') + L(335, 126, 395, 126, 1) + LG(420, 130, 'Br', 'Br⁻', 1.3) + A('M365 116 Q400 66 418 104', 'C–Br pair goes to Br', 450, 66, .2)},
    {t: 'A base removes the neighbouring H', d: 'A weak base (often the solvent) takes a hydrogen next to the cation, and the C–H electrons drop in to form the double bond.',
     s: T(70, 135, 'B:', 'nu') + T(180, 135, 'H', 'sub') + L(198, 130, 250, 130, 1) + T(272, 135, 'Cβ', 'c') + L(295, 130, 345, 130) + Lf(295, 140, 345, 140, 1.6) + T(375, 135, 'C⁺', 'c') +
        Lf(95, 130, 162, 130, 1) + A('M80 112 Q125 66 176 114', 'B takes H', 125, 62, .2) + A('M225 120 Q272 62 322 120', 'C–H pair becomes C=C', 272, 54, .6)},
    {t: 'Alkene product', d: 'The more substituted alkene usually wins (Zaitsev). Heat pushes the cation toward E1 rather than SN1.',
     s: T(300, 130, 'C=C', 'prod') + T(300, 175, 'more substituted alkene', 'sub')}
  ]
};
function cation() { return T(300, 130, 'R₃C⁺', 'c') + T(300, 175, 'flat, sp²', 'sub') + T(430, 130, 'Br⁻', 'lg'); }
V.SN1[1].s = cation();
let cur = 'SN2', idx = 0;
const defs = '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f06fa2"/></marker></defs>';
function pickMech(k) { cur = k; idx = 0; drawV(); }
function drawV() {
  const st = V[cur][idx];
  $('#mech-pills').innerHTML = Object.keys(V).map(k => `<button class="pill ${k === cur ? 'on' : ''}" data-m="${k}">${M[k].n}</button>`).join('');
  $$('.pill', $('#mech-pills')).forEach(b => b.onclick = () => pickMech(b.dataset.m));
  $('#svg').innerHTML = defs + st.s;
  $('#st-title').textContent = `Step ${idx + 1} of ${V[cur].length}: ${st.t}`;
  $('#st-desc').textContent = st.d;
  $('#dots').innerHTML = V[cur].map((_, i) => `<span class="dot ${i === idx ? 'on' : ''}"></span>`).join('');
  $('#prev').disabled = idx === 0; $('#next').disabled = idx === V[cur].length - 1;
}
$('#prev').onclick = () => { idx--; drawV(); };
$('#next').onclick = () => { idx++; drawV(); };
$('#replay').onclick = drawV;
drawV();

/* ---------- 3. quiz ---------- */
const PW = ['SN1', 'SN2', 'E1', 'E2'];
const P = (r, a, p, w) => ({c: 'Pathway', q: `Which pathway is the major one?<br><br>${r}`, o: PW, a: PW.indexOf(a), w: `${w}<br>Product: ${p}`});
const C = (c, q, o, w) => ({c, q, o, a: 0, w}); // first option is the correct one; options are shuffled when shown
const Q = [
  P(String.raw`$\ce{CH3Br}$ + $\ce{NaCN}$ in DMSO`, 'SN2', String.raw`$\ce{CH3CN}$`, 'Methyl halide, strong nucleophile, aprotic solvent.'),
  P(String.raw`$\ce{(CH3)3C-Br}$ in water/acetone, 25 °C`, 'SN1', String.raw`$\ce{(CH3)3C-OH}$`, 'Tertiary, weak nucleophile, protic solvent: the carbocation forms easily.'),
  P(String.raw`$\ce{(CH3)3C-Br}$ + $\ce{NaOEt}$ in EtOH`, 'E2', String.raw`$\ce{(CH3)2C=CH2}$`, 'Strong base and a 3° carbon: back-side attack is blocked.'),
  P(String.raw`$\ce{CH3CH2CH2Br}$ + t-BuOK in t-BuOH`, 'E2', String.raw`$\ce{CH3CH=CH2}$`, 'The bulky base cannot attack carbon, so it removes a hydrogen.'),
  P(String.raw`2-bromopropane + $\ce{NaN3}$ in DMF`, 'SN2', String.raw`$\ce{(CH3)2CH-N3}$`, 'Azide is a great nucleophile but a weak base; aprotic solvent boosts it.'),
  P(String.raw`$\ce{(CH3)3C-Cl}$ in EtOH, 80 °C`, 'E1', String.raw`$\ce{(CH3)2C=CH2}$ (major)`, 'Weak base, 3° carbon, heat: elimination beats substitution.'),
  P(String.raw`$\ce{CH3CH2Br}$ + $\ce{NaOH}$ in EtOH, 25 °C`, 'SN2', String.raw`$\ce{CH3CH2OH}$`, 'Primary carbon at low temperature: substitution.'),
  P(String.raw`2-bromobutane + $\ce{NaOEt}$ in EtOH, heat`, 'E2', 'but-2-ene (Zaitsev)', 'Strong base, 2° carbon, heat.'),
  P(String.raw`2-bromo-2-methylbutane in MeOH, 25 °C`, 'SN1', '2-methoxy-2-methylbutane', 'The solvent is the nucleophile (solvolysis) on a 3° carbon.'),
  P(String.raw`1-bromobutane + $\ce{NaI}$ in acetone`, 'SN2', String.raw`$\ce{CH3(CH2)3I}$`, 'The Finkelstein reaction, a textbook SN2.'),
  P(String.raw`bromocyclohexane + $\ce{KCN}$ in DMSO`, 'SN2', 'cyclohexanecarbonitrile', 'Secondary carbon, good nucleophile, aprotic solvent.'),
  P(String.raw`2-chloro-2-methylpropane in ethanol, 25 °C`, 'SN1', 'tert-butyl ethyl ether', 'Tertiary, solvent as nucleophile, no heat.'),
  P(String.raw`2-bromopropane + t-BuOK`, 'E2', String.raw`$\ce{CH3CH=CH2}$`, 'Bulky strong base: elimination.'),
  P(String.raw`1-chloropropane + $\ce{NaOCH3}$ in DMSO, 25 °C`, 'SN2', 'methyl propyl ether', 'Primary carbon, strong nucleophile, aprotic solvent.'),

  C('Product', 'What is the major product of <b>bromoethane + NaCN in DMSO</b>?', ['Propanenitrile', 'Ethene', 'Ethanol', 'Ethylamine'], 'SN2 replaces Br with CN, adding one carbon.'),
  C('Product', 'Major product of <b>tert-butyl bromide + NaOEt</b>?', ['2-methylpropene', 'tert-butyl ethyl ether', 'tert-butanol', '2-methylpropane'], 'E2 wins on a 3° carbon with a strong base.'),
  C('Product', 'Major product of <b>2-bromobutane + NaOEt, heat</b>?', ['But-2-ene', 'But-1-ene', '2-ethoxybutane', 'Butan-2-ol'], 'E2 follows Zaitsev: the more substituted alkene is major.'),
  C('Product', 'Major product of <b>2-bromo-2-methylbutane + t-BuOK</b>?', ['2-methylbut-1-ene (Hofmann)', '2-methylbut-2-ene', '2-methylbutan-2-ol', 'Pentane'], 'A bulky base takes the easiest-to-reach hydrogen, giving the less substituted alkene.'),
  C('Product', 'Major product of <b>tert-butyl bromide in water, 25 °C</b>?', ['tert-butanol', '2-methylpropene', 'Di-tert-butyl ether', 'No reaction'], 'SN1 solvolysis; the water attacks the carbocation.'),
  C('Product', 'Major product of <b>1-bromopropane + NaN₃ in DMF</b>?', ['1-azidopropane', 'Propene', 'Propan-1-ol', '2-azidopropane'], 'SN2 on a primary carbon; the azide ends up where Br was.'),
  C('Product', 'Major product of <b>bromoethane + NaOCH₃ in CH₃OH</b>?', ['Methoxyethane', 'Ethene', 'Ethanol', 'Dimethyl ether'], 'Primary carbon at low temperature: SN2.'),

  C('Concepts', 'Which is the best leaving group?', ['I⁻', 'Br⁻', 'Cl⁻', 'F⁻'], 'Larger, weaker bases leave best. HI is the strongest acid of the four.'),
  C('Concepts', 'Which halide reacts fastest by SN2?', ['CH₃Br', 'CH₃CH₂Br', '(CH₃)₂CHBr', '(CH₃)₃CBr'], 'Less crowding means easier back-side attack: methyl > 1° > 2° > 3°.'),
  C('Concepts', 'Which carbocation is the most stable?', ['Tertiary (3°)', 'Secondary (2°)', 'Primary (1°)', 'Methyl'], 'Alkyl groups donate electron density and spread out the positive charge.'),
  C('Concepts', 'Why do aprotic solvents speed up SN2?', ['They do not hydrogen-bond to the nucleophile', 'They stabilise the carbocation', 'They make the leaving group worse', 'They cool the reaction'], 'A free nucleophile is a fast nucleophile.'),
  C('Concepts', 'In an SN1 reaction, doubling the nucleophile concentration changes the rate how?', ['It does not change', 'It doubles', 'It quadruples', 'It halves'], 'The slow step involves only the alkyl halide.'),
  C('Concepts', 'In SN2, both [RX] and [Nu⁻] are doubled. The rate becomes…', ['4 times faster', '2 times faster', 'Unchanged', '8 times faster'], 'The slow step involves both molecules, so 2 × 2 = 4.'),
  C('Concepts', 'What geometry does E2 need?', ['H and leaving group anti to each other', 'H and leaving group on the same side', 'H and leaving group at 60°', 'No requirement'], 'Anti-periplanar lets the orbitals overlap to form the π bond.'),
  C('Concepts', 'Which is a polar aprotic solvent?', ['DMSO', 'Ethanol', 'Water', 'Acetic acid'], 'It has no O–H or N–H to donate hydrogen bonds.'),
  C('Concepts', 'Which is the best nucleophile in a protic solvent?', ['I⁻', 'F⁻', 'Cl⁻', 'They are all equal'], 'Small F⁻ is wrapped tightly in hydrogen bonds; large I⁻ is polarizable and less solvated.'),
  C('Concepts', 'Which statement about SN1 is true?', ['It has a carbocation intermediate', 'It needs a strong nucleophile', 'It is a single concerted step', 'It is fastest for primary halides'], 'Two steps: ionisation, then capture.'),
  C('Concepts', 'What does raising the temperature favour?', ['Elimination over substitution', 'Substitution over elimination', 'Only SN2', 'Nothing'], 'Elimination makes more molecules, which gains more entropy.'),
  C('Concepts', 'What does the Zaitsev rule say?', ['The more substituted alkene is major', 'The less substituted alkene is major', 'The terminal alkene always wins', 'Alcohols are always major'], 'More substituted alkenes are more stable.'),
  C('Concepts', 'Why can a tertiary halide not do SN2?', ['Three alkyl groups block the back side', 'It has no leaving group', 'The carbocation is too stable', 'The solvent is wrong'], 'The nucleophile cannot reach the carbon.'),
  C('Concepts', 'What is solvolysis?', ['The solvent acts as the nucleophile', 'Dissolving a salt in water', 'Heating without a reagent', 'Breaking down the solvent'], 'Typical for SN1 in water or alcohols.'),
  C('Concepts', 'Why is neopentyl bromide, (CH₃)₃CCH₂Br, so slow in SN2?', ['The bulky group next door blocks the back side', 'It is tertiary', 'Br is a poor leaving group', 'It forms a stable cation'], 'The carbon is primary, but the neighbouring tert-butyl group shields it.'),

  C('Stereo & shifts', '(R)-2-bromobutane reacts with NaCN in DMSO. The product is…', ['The inverted configuration, (S)', 'The same configuration, (R)', 'A racemic mixture', 'A meso compound'], 'SN2 always inverts the stereocentre (Walden inversion).'),
  C('Stereo & shifts', 'An optically pure 3° alkyl bromide reacts with water by SN1. The alcohol is…', ['A racemic mixture', 'Only one enantiomer', 'Fully inverted', 'A meso compound'], 'The flat carbocation is attacked from both faces.'),
  C('Stereo & shifts', 'Which reaction can show a carbocation rearrangement?', ['CH₃CH(Br)CH(CH₃)₂ in hot ethanol', 'CH₃Br + NaCN', '(CH₃)₃CBr + t-BuOK', 'CH₃CH₂Br + NaI in acetone'], 'Only reactions with carbocation intermediates (SN1/E1) can rearrange.'),
  C('Stereo & shifts', 'What does a 1,2-hydride shift do?', ['Turns a 2° cation into a more stable 3° cation', 'Turns a 3° cation into a 1° cation', 'Adds the nucleophile', 'Removes the leaving group'], 'The H moves with its bonding pair to the neighbouring cation centre.'),
  C('Stereo & shifts', 'Major product of 2-bromo-3-methylbutane in ethanol (solvolysis)?', ['2-ethoxy-2-methylbutane (after a hydride shift)', '2-ethoxy-3-methylbutane (no shift)', '1-ethoxy-3-methylbutane', 'Butan-2-ol'], 'The 2° cation shifts to the more stable 3° cation before ethanol attacks.'),
  C('Stereo & shifts', 'What is the inversion of configuration in SN2 called?', ['Walden inversion', 'Zaitsev inversion', 'Markovnikov flip', 'Hammond shift'], 'Named after Paul Walden.')
];
const CATS = ['All', 'Pathway', 'Product', 'Concepts', 'Stereo & shifts'];
let qs, qi, score, streak, missed, cat = 'All';
function menu() {
  const box = $('#quiz-box'), n = c => c === 'All' ? Q.length : Q.filter(q => q.c === c).length;
  box.innerHTML = `<div class="menu"><p>Choose a topic. Wrong answers can be retried at the end.</p>
    <div class="pills">${CATS.map(c => `<button class="pill ${c === cat ? 'on' : ''}" data-c="${c}">${c} (${n(c)})</button>`).join('')}</div>
    <button class="btn" id="start">Start 🚀</button></div>`;
  $$('.pill', box).forEach(b => b.onclick = () => { cat = b.dataset.c; menu(); });
  $('#start').onclick = () => startQuiz(cat === 'All' ? Q : Q.filter(q => q.c === cat));
}
function startQuiz(list) { qs = shuffle(list); qi = 0; score = 0; streak = 0; missed = []; drawQ(); }
function drawQ() {
  const box = $('#quiz-box');
  if (qi >= qs.length) {
    const f = score / qs.length, face = f > .85 ? '🏆' : f > .6 ? '🎉' : '🌱';
    box.innerHTML = `<div class="final"><div class="big">${face}</div><h3>${score} / ${qs.length}</h3>
      <p>${f > .85 ? 'Mechanism master!' : f > .6 ? 'Nice work. Review the ones you missed.' : 'Keep going. The Visualizer and FAQ tabs can help.'}</p>
      ${missed.length ? `<button class="btn ghost" id="retry">Retry missed (${missed.length})</button> ` : ''}<button class="btn" id="back">Choose topic</button></div>`;
    if (missed.length) $('#retry').onclick = () => startQuiz(missed);
    $('#back').onclick = menu; return;
  }
  const q = qs[qi], correct = q.o[q.a], opts = q.c === 'Pathway' ? q.o : shuffle(q.o);
  box.innerHTML = `<div class="qmeta"><span>Question ${qi + 1} of ${qs.length}</span><span>⭐ ${score} · 🔥 ${streak}</span></div>
    <div class="qbar"><i style="width:${qi / qs.length * 100}%"></i></div>
    <div class="qcard"><span class="cat">${q.c}</span><br>${q.q}</div>
    <div class="opts">${opts.map(o => `<button class="opt" data-k="${o}">${M[o] ? M[o].n : o}</button>`).join('')}</div><div id="fb"></div>`;
  math(box);
  $$('.opt', box).forEach(b => b.onclick = () => answer(b, q, correct));
}
function answer(b, q, correct) {
  const ok = b.dataset.k === correct;
  if (ok) { score++; streak++; } else { streak = 0; missed.push(q); }
  $$('.opt').forEach(o => { o.disabled = true; if (o.dataset.k === correct) o.classList.add('ok'); });
  if (!ok) b.classList.add('bad');
  $('#fb').innerHTML = `<div class="fb"><b>${ok ? '✅ Correct!' : `❌ Answer: ${M[correct] ? M[correct].n : correct}`}</b><br>${q.w}<br><br>
    <button class="btn" id="nx">${qi === qs.length - 1 ? 'See score' : 'Next →'}</button></div>`;
  math($('#fb'));
  $('#nx').onclick = () => { qi++; drawQ(); };
}
menu();
