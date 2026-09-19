'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FacadeEngine = require('../facade_engine');
const engine = new FacadeEngine();
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

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

test('conserva exactamente las cinco filas de la tabla', () => {
    const expected = [
        [6, 4.8, 5.9, 1.6, 2.4, 1.0, 1.4, 2.7, 1.1],
        [7, 5.0, 6.2, 1.8, 2.5, 1.2, 1.5, 2.9, 1.2],
        [8, 5.3, 6.6, 2.0, 2.6, 1.4, 1.6, 3.2, 1.3],
        [9, 5.6, 7.0, 2.2, 2.7, 1.5, 1.65, 3.4, 1.4],
        [10, 5.9, 7.4, 2.4, 2.8, 1.6, 1.7, 3.8, 1.5]
    ];
    for (const [width, minH, maxH, doorW, doorH, windowW, windowH, projectionW, difference] of expected) {
        const d = engine.getFacadeDimensions(width);
        assert.deepEqual(
            [d.interiorWidth, d.minHeight, d.maxHeight, d.doorWidth, d.doorHeight, d.windowWidth, d.windowHeight, d.projectionWidth, d.heightDifference],
            [width, minH, maxH, doorW, doorH, windowW, windowH, projectionW, difference]
        );
        near(d.totalWidth - d.interiorWidth, 0.4);
        assert.equal(d.mouldingThickness, 0.19);
    }
});

test('interpola linealmente los anchos intermedios', () => {
    const d = engine.getFacadeDimensions(8.5);
    assert.deepEqual(d, {
        interiorWidth: 8.5, totalWidth: 8.9, minHeight: 5.45, maxHeight: 6.8,
        doorWidth: 2.1, doorHeight: 2.65, windowWidth: 1.45, windowHeight: 1.625,
        projectionWidth: 3.3, heightDifference: 1.35, mouldingThickness: 0.19
    });
});

test('limita el editor al rango interior de 6 a 10 m', () => {
    assert.equal(engine.getFacadeDimensions(-20).interiorWidth, 6);
    assert.equal(engine.getFacadeDimensions(50).interiorWidth, 10);
    assert.equal(engine.normalizeOptions({ interiorWidth: 'abc' }).interiorWidth, 10);
    assert.equal(engine.normalizeOptions({ interiorWidth: Infinity }).interiorWidth, 10);
});

test('alturas y sobresaliente gobiernan la geometría', () => {
    for (const width of [6, 6.5, 8, 9.25, 10]) {
        const d = engine.getFacadeDimensions(width);
        const c = engine.getFacadeConstants(width);
        near(c.WING_CORNICE_TOP, d.minHeight);
        near(c.PILASTER_TOP, d.maxHeight);
        near(c.PILASTER_TOP - c.WING_CORNICE_TOP, d.heightDifference);
        near(c.PILASTER_OUTER_X * 2, d.projectionWidth);
        near(c.PILASTER_WIDTH, 0.19);
    }
});

test('el alto de puerta y ventana llega hasta la punta del arco', () => {
    for (const width of [6, 7.3, 9, 10]) {
        const d = engine.getFacadeDimensions(width);
        const c = engine.getFacadeConstants(width);
        const door = engine.getPointedArchGeometry(0, c.DOOR_OPENING, c.DOOR_HEIGHT, c.DOOR_ARCH_R_IN);
        const window = engine.getPointedArchGeometry(0, c.WINDOW_WIDTH, c.WINDOW_SPRING_Y, c.WINDOW_ARCH_R_IN);
        near(door.apexY, d.doorHeight);
        near(window.apexY - c.WINDOW_SILL_Y, d.windowHeight);
    }
});

test('la distribución permanece simétrica y dentro de cada ala', () => {
    for (let step = 120; step <= 200; step++) {
        const interior = step / 20;
        for (const mode of ['auto', 'exact_150', 'manual']) {
            for (const count of [0, 1, 2, 6]) {
                const layout = engine.calculateLayout(interior, 1.5, mode, count);
                assert.deepEqual(layout.windowPositionsLeft, layout.windowPositionsRight.map(x => -x).reverse());
                assert.equal(layout.interiorWidth, interior);
                near(layout.totalWidth, interior + 0.4);
                if (layout.isGeometryValid && layout.numWindowsPerWing) {
                    assert.ok(layout.actualInnerMargin >= -1e-9);
                    near(layout.actualInnerMargin, layout.actualOuterMargin);
                }
            }
        }
    }
});

test('SVG y DXF no generan valores no finitos con entradas corruptas', () => {
    for (const width of [undefined, null, '', 'abc', NaN, Infinity, -Infinity, -20, 50000, '8.5']) {
        const options = { interiorWidth: width, minFreeSpace: Infinity, manualCount: 1e30, titleFontSize: 'abc', dimFontSize: NaN };
        const result = engine.generateSVG(options);
        assert.ok(result.dimensions.interiorWidth >= 6 && result.dimensions.interiorWidth <= 10);
        assert.doesNotMatch(result.svg, /NaN|Infinity/);
        assert.doesNotMatch(engine.generateDXF(options), /NaN|Infinity/);
    }
});

test('SVG escapa los rótulos', () => {
    const svg = engine.generateSVG({ titleLine1: 'A & B < C', titleLine2: '</text><script>' }).svg;
    assert.match(svg, /A &amp; B &lt; C/);
    assert.doesNotMatch(svg, /<script>/);
});

test('arcos DXF usan barridos cortos y pares reflejados', () => {
    for (const width of [6, 8, 10]) {
        const arcs = entities(engine.generateDXF({ interiorWidth: width })).filter(entity => entity.type === 'ARC');
        assert.ok(arcs.length >= 8);
        const sweeps = arcs.map(arc => (Number(arc['51']) - Number(arc['50']) + 360) % 360);
        sweeps.forEach(sweep => assert.ok(sweep > 0 && sweep <= 90));
        for (let i = 0; i < sweeps.length; i += 2) near(sweeps[i], sweeps[i + 1], 0.02);
    }
});

test('DXF respeta cotas apagadas y conserva los muros', () => {
    const result = entities(engine.generateDXF({ interiorWidth: 8, showDimensions: false }));
    assert.ok(!result.some(entity => entity['8'] === 'COTAS'));
    assert.ok(result.some(entity => entity.type === 'LINE' && entity['8'] === 'MUROS'));
});

test('rótulo SVG y DXF comparten su posición proporcional', () => {
    const options = { interiorWidth: 7.5, titleFontSize: 0.35, titleLine1: 'Uno\nDos', titleLine2: 'Á & B' };
    const normalized = engine.normalizeOptions(options);
    const d = engine.getFacadeDimensions(normalized.interiorWidth);
    const title = engine.getTitleGeometry(normalized.titleLine1, normalized.titleLine2, normalized.titleFontSize, d.minHeight + d.heightDifference * 0.30);
    const texts = entities(engine.generateDXF(options)).filter(entity => entity.type === 'TEXT' && entity['8'] === 'TEXTOS');
    assert.equal(texts[0]['1'], 'Uno Dos');
    near(Number(texts[0]['21']), title.line1Y);
    near(Number(texts[1]['21']), title.line2Y);
});
