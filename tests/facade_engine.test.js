'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FacadeEngine = require('../facade_engine');
const engine = new FacadeEngine();
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

function entities(dxf) {
    const lines = dxf.trimEnd().split('\n');
    assert.equal(lines.length % 2, 0, 'DXF debe contener pares código/valor');
    const result = [];
    let current;
    for (let i = 0; i < lines.length; i += 2) {
        assert.match(lines[i], /^\d+$/, 'Código de grupo DXF inválido');
        if (lines[i] === '0') {
            current = { type: lines[i + 1] };
            result.push(current);
        } else if (current) current[lines[i]] = lines[i + 1];
    }
    return result;
}

test('el modelo original conserva sus dimensiones y centros', () => {
    const layout = engine.calculateLayout(10.5);
    assert.equal(layout.numWindowsPerWing, 1);
    near(layout.wingSpan, 3.29);
    near(layout.actualInnerMargin, 0.605);
    near(layout.windowPositionsRight[0], 3.605);
    near(layout.windowPositionsLeft[0], -3.605);
    assert.equal(layout.isGeometryValid, true);
});

test('una ventana forzada fuera del muro se marca inválida', () => {
    const layout = engine.calculateLayout(6, 1.5, 'manual', 1);
    assert.equal(layout.isGeometryValid, false);
    assert.ok(layout.actualInnerMargin < 0);
});

test('cero ventanas es una configuración válida y finita', () => {
    const layout = engine.calculateLayout(10.5, 1.5, 'manual', 0);
    assert.equal(layout.totalWindows, 0);
    assert.deepEqual(layout.allWindowCenters, []);
    assert.equal(layout.isGeometryValid, true);
    assert.equal(engine.calculateLayout(6).totalWindows, 0);
});

test('umbrales automáticos sin adelanto por redondeo', () => {
    for (const [width, count] of [[8.68, 1], [18.24, 2], [25.4, 3], [32.56, 4]]) {
        assert.equal(engine.calculateLayout(width).numWindowsPerWing, count);
        assert.equal(engine.calculateLayout(width - 0.001).numWindowsPerWing, count - 1);
    }
});

test('simetría y separación en todos los anchos y modos del editor', () => {
    for (let step = 120; step <= 700; step++) {
        const width = step / 20;
        for (const mode of ['auto', 'exact_150', 'manual']) {
            for (const gap of [1, 1.5, 3]) {
                const layout = engine.calculateLayout(width, gap, mode, 3);
                const right = layout.windowPositionsRight;
                assert.deepEqual(layout.windowPositionsLeft, right.map(x => -x).reverse());
                if (right.length) {
                    const inner = right[0] - layout.windowTotalWidth / 2 - engine.CONSTANTS.PILASTER_OUTER_X;
                    const outer = width / 2 - right.at(-1) - layout.windowTotalWidth / 2;
                    near(inner, outer);
                    near(inner, layout.actualInnerMargin);
                    if (layout.isGeometryValid) {
                        assert.ok(inner >= -1e-9);
                        for (let i = 1; i < right.length; i++) assert.ok(right[i] - right[i - 1] - layout.windowTotalWidth >= gap - 1e-9);
                    }
                }
            }
        }
    }
});

test('separación fija mantiene márgenes idénticos con anchos fraccionarios', () => {
    const layout = engine.calculateLayout(22.734, 1.5, 'exact_150');
    near(layout.actualInnerMargin, 1.8735);
    near(layout.windowPositionsRight[1] - layout.windowPositionsRight[0] - layout.windowTotalWidth, 1.5);
});

test('entradas corruptas y fuera de rango nunca generan geometría no finita', () => {
    for (const width of [undefined, null, '', 'abc', NaN, Infinity, -Infinity, -20, 50000, '10.5']) {
        const options = { totalWidth: width, minFreeSpace: Infinity, manualCount: 1e30, titleFontSize: 'abc', dimFontSize: NaN };
        const result = engine.generateSVG(options);
        assert.ok(result.layout.totalWidth >= 6 && result.layout.totalWidth <= 35);
        assert.doesNotMatch(result.svg, /NaN|Infinity/);
        assert.doesNotMatch(engine.generateDXF(options), /NaN|Infinity/);
    }
    assert.equal(engine.generateSVG({ totalWidth: '10.5' }).svg, engine.generateSVG({ totalWidth: 10.5 }).svg);
    assert.equal(engine.generateSVG({ totalWidth: 5 }).svg, engine.generateSVG({ totalWidth: 6 }).svg);
});

test('SVG escapa los rótulos y permite dejarlos vacíos', () => {
    const svg = engine.generateSVG({ titleLine1: 'A & B < C', titleLine2: '</text><script>' }).svg;
    assert.match(svg, /A &amp; B &lt; C/);
    assert.doesNotMatch(svg, /<script>/);
    const empty = engine.generateSVG({ titleLine1: '', titleLine2: '' }).svg;
    assert.equal((empty.match(/class="title-text"><\/text>/g) || []).length, 2);
});

test('arcos DXF usan el barrido corto y pares reflejados iguales', () => {
    for (const width of [6, 10.5, 25.4, 35]) {
        const arcs = entities(engine.generateDXF({ totalWidth: width })).filter(entity => entity.type === 'ARC');
        assert.ok(arcs.length >= 8);
        const sweeps = arcs.map(arc => (Number(arc['51']) - Number(arc['50']) + 360) % 360);
        sweeps.forEach(sweep => assert.ok(sweep > 0 && sweep <= 90));
        for (let i = 0; i < sweeps.length; i += 2) near(sweeps[i], sweeps[i + 1], 0.02);
    }
});

test('la cota entre caras interiores de pilastras es 3.40 en ambos formatos', () => {
    assert.match(engine.generateSVG().svg, />3\.40<\/text>/);
    assert.doesNotMatch(engine.generateSVG().svg, />3\.30<\/text>/);
    const dimensions = entities(engine.generateDXF()).filter(entity => entity.type === 'TEXT' && entity['8'] === 'COTAS');
    assert.ok(dimensions.some(entity => entity['1'] === '3.40'));
    assert.ok(!dimensions.some(entity => entity['1'] === '3.30'));
});

test('DXF respeta cotas apagadas y mantiene el resto del dibujo', () => {
    const result = entities(engine.generateDXF({ showDimensions: false }));
    assert.ok(!result.some(entity => entity['8'] === 'COTAS'));
    assert.ok(result.some(entity => entity.type === 'LINE' && entity['8'] === 'MUROS'));
});

test('rótulo DXF centrado y consistente con la geometría SVG', () => {
    const options = { titleFontSize: 0.35, titleLine1: 'Uno\nDos', titleLine2: 'Á & B' };
    const normalized = engine.normalizeOptions(options);
    const title = engine.getTitleGeometry(normalized.titleLine1, normalized.titleLine2, normalized.titleFontSize);
    const texts = entities(engine.generateDXF(options)).filter(entity => entity.type === 'TEXT' && entity['8'] === 'TEXTOS');
    assert.equal(texts[0]['1'], 'Uno Dos');
    assert.equal(texts[0]['72'], '1');
    assert.equal(texts[0]['73'], '2');
    near(Number(texts[0]['21']), title.line1Y);
    near(Number(texts[1]['21']), title.line2Y);
});
