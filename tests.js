// ============================================================================
//  Автотесты комплекса веб-тренажёров «Системный анализ»
//  Запуск:  node tests.js
//
//  Тесты сверены с материалами:
//    - «пример_расчета_структурной_сложности.pdf»  (энтропия, H=6.5)
//    - «Задание 1. Оценка сложности структуры.pdf»  (формула, H=6.5)
//    - «кластерные_ранжировки.pdf»                  (графовый алгоритм)
// ============================================================================

let passed = 0, failed = 0;
const failures = [];

function check(name, cond, extra) {
    if (cond) { passed++; console.log(`  ✔ ${name}`); }
    else { failed++; failures.push(name); console.log(`  ✘ ${name}  ${extra || ''}`); }
}
function close(a, b, eps) { return Math.abs(a - b) <= eps; }
function eqSet(a, b) {
    if (a.length !== b.length) return false;
    const s = new Set(b);
    return a.every(x => s.has(x));
}

console.log('==============================================================');
console.log('  МОДУЛЬ 1 — Оценка сложности структуры (энтропия)');
console.log('==============================================================');

// --- Копия ризонера из module1_entropy.html ---
function parseRules(text) {
    const rules = { sub: [], inv: [], trans: [], chain: [] };
    text.split('\n').forEach(line => {
        let mSub = line.match(/:(\w+)\s+rdfs:subPropertyOf\s+:(\w+)/);
        if (mSub) rules.sub.push([mSub[1], mSub[2]]);
        let mInv = line.match(/:(\w+)\s+owl:inverseOf\s+:(\w+)/);
        if (mInv) rules.inv.push([mInv[2], mInv[1]]);
        let mTrans = line.match(/:(\w+)\s+a\s+owl:TransitiveProperty/);
        if (mTrans) rules.trans.push(mTrans[1]);
        let mChain = line.match(/:(\w+)\s+.*owl:propertyChainAxiom\s*\(\s*:(\w+)\s+:(\w+)\s*\)/);
        if (mChain) rules.chain.push({ res: mChain[1], p1: mChain[2], p2: mChain[3] });
    });
    return rules;
}
function runInference(baseFacts, rules) {
    let facts = new Set(baseFacts);
    let changed = true;
    const addFact = (s, p, o) => {
        if (p === 'r5' && s === o) return false;
        const str = `${s}|${p}|${o}`;
        if (!facts.has(str)) { facts.add(str); return true; }
        return false;
    };
    while (changed) {
        changed = false;
        const cf = Array.from(facts).map(f => f.split('|'));
        for (let i = 0; i < cf.length; i++) {
            const [s1, p1, o1] = cf[i];
            for (const [base, sub] of rules.sub) if (p1 === base) changed = addFact(s1, sub, o1) || changed;
            for (const [base, inv] of rules.inv) {
                if (p1 === base) changed = addFact(o1, inv, s1) || changed;
                if (p1 === inv) changed = addFact(o1, base, s1) || changed;
            }
            for (let j = 0; j < cf.length; j++) {
                const [s2, p2, o2] = cf[j];
                if (o1 === s2) {
                    for (const t of rules.trans) if (p1 === t && p2 === t) changed = addFact(s1, t, o2) || changed;
                    for (const c of rules.chain) if (p1 === c.p1 && p2 === c.p2) changed = addFact(s1, c.res, o2) || changed;
                }
            }
        }
    }
    return Array.from(facts).map(f => f.split('|'));
}
const RULES_TEXT = `:r2 owl:inverseOf :r1 .
:ancestorOf a owl:TransitiveProperty .
:r1 rdfs:subPropertyOf :ancestorOf .
:r3 owl:propertyChainAxiom ( :r1 :ancestorOf ) .
:r4 owl:inverseOf :r3 .
:r5 owl:propertyChainAxiom ( :r2 :r1 ) .`;
const RULES = parseRules(RULES_TEXT);

function entropyOf(edges) {
    const baseFacts = edges.map(([a, b]) => `${a}|r1|${b}`);
    const facts = runInference(baseFacts, RULES);
    const MEASURE = ['r1', 'r2', 'r3', 'r4', 'r5'];
    const nodeIds = [...new Set(facts.flatMap(([s, , o]) => [s, o]))];
    const n = nodeIds.length;
    const out = {};
    facts.forEach(([s, p]) => { if (MEASURE.includes(p)) { const k = s + '|' + p; out[k] = (out[k] || 0) + 1; } });
    let H = 0;
    nodeIds.forEach(nd => MEASURE.forEach(r => {
        const l = out[nd + '|' + r] || 0;
        if (l > 0) H += -(l / (n - 1)) * Math.log2(l / (n - 1));
    }));
    const c = 1 / (Math.E * Math.LN2);
    const Href = c * n * MEASURE.length;
    return { H, h: Href > 0 ? H / Href : 0, facts, nodeIds: n };
}
function relPairs(facts, rel) {
    return facts.filter(f => f[1] === rel).map(f => `${f[0]}→${f[2]}`).sort();
}

const tree = [['m1', 'm2'], ['m1', 'm3'], ['m3', 'm4'], ['m3', 'm5']];
const t = entropyOf(tree);

check('Стартовое дерево: H(M,R) = 6.5', close(t.H, 6.5, 0.05), `H=${t.H}`);
check('Стартовое дерево: h(M,R) ≈ 0.49', close(t.h, 0.49, 0.01), `h=${t.h}`);
check('Число узлов дерева n = 5', t.nodeIds === 5, `n=${t.nodeIds}`);
check('r1 = {(1,2),(1,3),(3,4),(3,5)}',
    eqSet(relPairs(t.facts, 'r1'), ['m1→m2', 'm1→m3', 'm3→m4', 'm3→m5']),
    JSON.stringify(relPairs(t.facts, 'r1')));
check('r2 = {(2,1),(3,1),(4,3),(5,3)}',
    eqSet(relPairs(t.facts, 'r2'), ['m2→m1', 'm3→m1', 'm4→m3', 'm5→m3']),
    JSON.stringify(relPairs(t.facts, 'r2')));
check('r3 = {(1,4),(1,5)}',
    eqSet(relPairs(t.facts, 'r3'), ['m1→m4', 'm1→m5']),
    JSON.stringify(relPairs(t.facts, 'r3')));
check('r4 = {(4,1),(5,1)}',
    eqSet(relPairs(t.facts, 'r4'), ['m4→m1', 'm5→m1']),
    JSON.stringify(relPairs(t.facts, 'r4')));
check('r5 = {(2,3),(3,2),(4,5),(5,4)}',
    eqSet(relPairs(t.facts, 'r5'), ['m2→m3', 'm3→m2', 'm4→m5', 'm5→m4']),
    JSON.stringify(relPairs(t.facts, 'r5')));

const star = entropyOf([['m1', 'm2'], ['m1', 'm3'], ['m1', 'm4']]);
check('Звезда (3 подчинённых): H ≈ 2.8', close(star.H, 2.8, 0.06), `H=${star.H}`);

const single = entropyOf([['m1', 'm2']]);
check('Одно ребро: H = 0.0', close(single.H, 0.0, 0.001), `H=${single.H}`);

const empty = entropyOf([]);
check('Пустой граф: H = 0.0', close(empty.H, 0.0, 0.001), `H=${empty.H}`);

// r5 не должен содержать петель
const loops = relPairs(t.facts, 'r5').filter(x => x.split('→')[0] === x.split('→')[1]);
check('r5 не содержит петель (x→x)', loops.length === 0, JSON.stringify(loops));

// Линейная цепочка: m1→m2→m3→m4 — проверка опосредованных отношений
const chain = entropyOf([['m1', 'm2'], ['m2', 'm3'], ['m3', 'm4']]);
check('Цепочка: r3 = {(m1,m3),(m1,m4),(m2,m4)}',
    eqSet(relPairs(chain.facts, 'r3'), ['m1→m3', 'm1→m4', 'm2→m4']),
    JSON.stringify(relPairs(chain.facts, 'r3')));
check('Цепочка: r5 пусто (нет сослуживцев)',
    relPairs(chain.facts, 'r5').length === 0,
    JSON.stringify(relPairs(chain.facts, 'r5')));

console.log('');
console.log('==============================================================');
console.log('  МОДУЛЬ 2 — Кластерная ранжировка (графовый алгоритм)');
console.log('==============================================================');

function parseRanking(str) {
    str = str.replace(/\s+/g, '').toUpperCase();
    const matches = (str.match(/\{[^}]+\}|[^,{}]+/g)) || [];
    const ranks = {}, canonical = {}, tiesCount = [];
    let currentRank = 1;
    matches.forEach(m => {
        const cluster = m.startsWith('{') ? m.slice(1, -1).split(',').filter(x => x) : [m];
        const size = cluster.length;
        if (size > 1) tiesCount.push(size);
        const avgRank = (currentRank * 2 + size - 1) / 2;
        cluster.forEach(p => { ranks[p] = avgRank; canonical[p] = currentRank; });
        currentRank += size;
    });
    return { ranks, canonical, tiesCount };
}
function clusterRanking(inputs) {
    const expertData = inputs.map(parseRanking);
    const projects = Array.from(new Set(expertData.flatMap(e => Object.keys(e.ranks)))).sort();
    const n = projects.length, m = expertData.length;

    let contradiction = {}, unanimousEqual = {};
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const p1 = projects[i], p2 = projects[j];
        let hasPlus = false, hasMinus = false, allZero = true;
        for (let e = 0; e < m; e++) {
            const s = Math.sign((expertData[e].canonical[p2] || 0) - (expertData[e].canonical[p1] || 0));
            if (s > 0) hasPlus = true; else if (s < 0) hasMinus = true;
            if (s !== 0) allZero = false;
        }
        const key = p1 + '|' + p2;
        if (hasPlus && hasMinus) contradiction[key] = true;
        if (allZero) unanimousEqual[key] = true;
    }

    const g0 = {}; projects.forEach(p => g0[p] = []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const p1 = projects[i], p2 = projects[j], key = p1 + '|' + p2;
        if (contradiction[key] || unanimousEqual[key]) { g0[p1].push(p2); g0[p2].push(p1); }
    }

    const groups = [], seen = new Set();
    projects.forEach(p => {
        if (!seen.has(p)) {
            const comp = []; const stack = [p]; seen.add(p);
            while (stack.length) {
                const cur = stack.pop(); comp.push(cur);
                g0[cur].forEach(nb => { if (!seen.has(nb)) { seen.add(nb); stack.push(nb); } });
            }
            comp.sort(); groups.push(comp);
        }
    });

    const P = groups.length; const indeg = new Array(P).fill(0);
    for (let gi = 0; gi < P; gi++) for (let gj = 0; gj < P; gj++) {
        if (gi === gj) continue;
        const a = groups[gi][0], b = groups[gj][0];
        let weakAll = true, strictSome = false;
        for (let e = 0; e < m; e++) {
            const ra = expertData[e].canonical[a] || 0, rb = expertData[e].canonical[b] || 0;
            if (ra > rb) { weakAll = false; break; }
            if (ra < rb) strictSome = true;
        }
        if (weakAll && strictSome) indeg[gj]++;
    }
    return groups.map((g, idx) => ({ group: g, rank: 1 + indeg[idx] }))
        .sort((x, y) => x.rank - y.rank)
        .map(it => it.group.length > 1 ? `{${it.group.join(',')}}` : it.group[0])
        .join(' < ');
}

check('Пример 2.1: T < K < M < {D,Z}',
    clusterRanking(['T, {K, M}, D, Z', '{T, K}, M, Z, D']) === 'T < K < M < {D,Z}',
    clusterRanking(['T, {K, M}, D, Z', '{T, K}, M, Z, D']));
check('Пример 3.1: {A,B,C}',
    clusterRanking(['A, B, C', 'C, A, B']) === '{A,B,C}',
    clusterRanking(['A, B, C', 'C, A, B']));
check('Пример 5.1: A < B',
    clusterRanking(['{A, B}', '{A, B}', 'A, B']) === 'A < B',
    clusterRanking(['{A, B}', '{A, B}', 'A, B']));
check('Полное согласие: A < B < C < D',
    clusterRanking(['A, B, C, D', 'A, B, C, D']) === 'A < B < C < D',
    clusterRanking(['A, B, C, D', 'A, B, C, D']));
check('Цикл (полное несогласие): {A,B,C}',
    clusterRanking(['A, B, C', 'B, C, A', 'C, A, B']) === '{A,B,C}',
    clusterRanking(['A, B, C', 'B, C, A', 'C, A, B']));
check('Единогласное равенство: {A,B} < C',
    clusterRanking(['{A, B}, C', '{A, B}, C']) === '{A,B} < C',
    clusterRanking(['{A, B}, C', '{A, B}, C']));
check('Один эксперт: B < A < C',
    clusterRanking(['B, A, C']) === 'B < A < C',
    clusterRanking(['B, A, C']));
check('Цепочка противоречий: {A,B,C,D}',
    clusterRanking(['A, B, C, D', 'C, D, A, B']) === '{A,B,C,D}',
    clusterRanking(['A, B, C, D', 'C, D, A, B']));

// --- Коэффициент Канделла W (поправка на связанные ранги) ---
function kendall(inputs) {
    const expertData = inputs.map(parseRanking);
    const projects = Array.from(new Set(expertData.flatMap(e => Object.keys(e.ranks)))).sort();
    const n = projects.length, m = expertData.length;
    const sumRanks = {}; projects.forEach(p => sumRanks[p] = 0);
    expertData.forEach(e => projects.forEach(p => sumRanks[p] += e.ranks[p] || 0));
    const meanSum = m * (n + 1) / 2;
    let S = 0; projects.forEach(p => S += Math.pow(sumRanks[p] - meanSum, 2));
    let sumT = 0; expertData.forEach(e => e.tiesCount.forEach(t => sumT += t * t * t - t));
    const denom = m * m * (n * n * n - n) - m * sumT;
    const W = denom === 0 ? 0 : 12 * S / denom;
    return { W, chi: m * (n - 1) * W };
}
check('Канделл W = 1 при полном согласии',
    close(kendall(['A, B, C, D', 'A, B, C, D']).W, 1.0, 1e-9),
    `W=${kendall(['A, B, C, D', 'A, B, C, D']).W}`);
check('Канделл W = 0 при полном несогласии (2 эксперта, обратный порядок)',
    close(kendall(['A, B, C', 'C, B, A']).W, 0.0, 1e-9),
    `W=${kendall(['A, B, C', 'C, B, A']).W}`);
const wt = kendall(['T, {K, M}, D, Z', '{T, K}, M, Z, D']);
check('Канделл W конечен при связанных рангах (пример 2.1)',
    isFinite(wt.W) && wt.W >= 0 && wt.W <= 1, `W=${wt.W}`);
const chiFull = kendall(['A, B, C, D', 'A, B, C, D']);
check('χ² = m(n−1) при полном согласии (m=2, n=4 → 6.0)',
    close(chiFull.chi, 6.0, 1e-9), `chi=${chiFull.chi}`);

console.log('');
console.log('==============================================================');
console.log('  МОДУЛЬ 3 — Численное агрегирование (инварианты)');
console.log('==============================================================');

function aggregate(inputs, eps = 0.001, maxIter = 1000) {
    const expertData = inputs.map(parseRanking);
    const projects = Array.from(new Set(expertData.flatMap(e => Object.keys(e.ranks)))).sort();
    const m = expertData.length, n = projects.length;
    // x_ij = r_ij / Σ r_ij
    const X = expertData.map(e => {
        let sum = 0; projects.forEach(p => sum += e.ranks[p] || 0);
        const row = {}; projects.forEach(p => row[p] = (e.ranks[p] || 0) / sum);
        return row;
    });
    let w = new Array(m).fill(1 / m);
    let converged = false, iters = 0;
    for (let it = 0; it < maxIter; it++) {
        iters = it + 1;
        const g = {}; projects.forEach(p => { g[p] = 0; for (let i = 0; i < m; i++) g[p] += w[i] * X[i][p]; });
        const rho = new Array(m).fill(0);
        for (let i = 0; i < m; i++) projects.forEach(p => rho[i] += Math.abs(X[i][p] - g[p]));
        const invRho = rho.map(r => r < 1e-12 ? 1e12 : 1 / r);
        const N = invRho.reduce((a, b) => a + b, 0);
        const newW = invRho.map(v => v / N);
        let maxDelta = 0; for (let i = 0; i < m; i++) maxDelta = Math.max(maxDelta, Math.abs(newW[i] - w[i]));
        w = newW;
        if (maxDelta < eps) { converged = true; break; }
    }
    // финальные групповые оценки и порядок
    const g = {}; projects.forEach(p => { g[p] = 0; for (let i = 0; i < m; i++) g[p] += w[i] * X[i][p]; });
    const order = [...projects].sort((a, b) => g[a] - g[b]);
    return { w, order, converged, iters };
}

const a1 = aggregate(['A, {B, C}, D', 'A, B, C, D', '{A, B}, C, D', 'B, A, {C, D}']);
check('Агрегирование сходится (max|Δw| < ε)', a1.converged, `iters=${a1.iters}`);
check('Веса в сумме дают 1', close(a1.w.reduce((a, b) => a + b, 0), 1.0, 1e-9), `sum=${a1.w.reduce((a,b)=>a+b,0)}`);
check('Все веса неотрицательны', a1.w.every(x => x >= -1e-12), JSON.stringify(a1.w));
check('Порядок содержит все проекты', a1.order.length === 4, JSON.stringify(a1.order));

const a2 = aggregate(['A, B, C, D', 'A, B, C, D', 'A, B, C, D']);
check('Полное согласие: сходится и порядок A<B<C<D', a2.converged && a2.order.join('') === 'ABCD',
    `order=${a2.order.join('')}`);

console.log('');
console.log('==============================================================');
console.log('  СТРЕСС-ТЕСТ на случайных данных (детерминированный)');
console.log('==============================================================');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20241116);

let stressOk = true;
let stressMsg = '';
for (let iter = 0; iter < 200; iter++) {
    const m = 2 + Math.floor(rnd() * 5);            // 2..6 экспертов
    const n = 3 + Math.floor(rnd() * 5);            // 3..7 проектов
    const proj = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const inputs = [];
    for (let e = 0; e < m; e++) {
        inputs.push([...proj].sort(() => rnd() - 0.5).join(', '));
    }
    // кластерная ранжировка: все проекты ровно по одному разу
    const res = clusterRanking(inputs);
    const tokens = res.split(' < ').map(s => s.replace(/[{}]/g, '')).join(',').split(',').sort();
    if (JSON.stringify(tokens) !== JSON.stringify([...proj].sort())) { stressOk = false; stressMsg = `ранжировка некорректна: ${res}`; break; }
    // Канделл в [0,1]
    const kw = kendall(inputs).W;
    if (!(kw >= -1e-9 && kw <= 1 + 1e-9)) { stressOk = false; stressMsg = `W вне диапазона: ${kw}`; break; }
    // агрегирование сходится
    const ag = aggregate(inputs);
    if (!ag.converged) { stressOk = false; stressMsg = `не сходится: ${inputs.join(' | ')}`; break; }
}
check('200 случайных наборов: ранжировка корректна, W∈[0,1], агрегирование сходится', stressOk, stressMsg);

console.log('');
console.log('==============================================================');
console.log(`  ИТОГО: ${passed} прошло, ${failed} упало`);
console.log('==============================================================');
if (failed) { console.log('Упавшие:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
else console.log('  Все тесты пройдены ✔');
