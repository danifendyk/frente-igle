/**
 * FAÇADE ENGINE - ASAMBLEA CRISTIANA
 * Motor geométrico y paramétrico para el dibujo del frente arquitectónico de la iglesia.
 * Replica con precisión milimétrica las cotas y geometría del plano CAD original:
 * - Pilastra: ancho 0.26, longitud total 3.62 m (remate +7.70 a base +4.08), saliente 0.20 m sobre muro (7.50 m), altura 1.40 m sobre cornisa (6.30 m).
 * - Ventana: vano 1.60x1.90, arcos R1.38 y R1.62, distribución simétrica en cada ala según el largo total.
 * - Módulo central estándar e inalterable, homogeneizado para todos los anchos ("largos") de frente.
 */

class FacadeEngine {
    constructor() {
        // Dimensiones canónicas exactas del plano original (en metros)
        this.CONSTANTS = {
            // Módulo central
            PORTAL_WIDTH: 2.92,        // Ancho exterior de la portada central (x: -1.46 a +1.46)
            DOOR_OPENING: 2.40,        // Vano libre de puerta (x: -1.20 a +1.20)
            DOOR_HEIGHT: 3.00,         // Altura de jamba / arranque de arco
            DOOR_ARCH_R_IN: 2.20,      // Radio interior arco ojival puerta
            DOOR_ARCH_R_OUT: 2.44,     // Radio exterior archivoltas puerta (moldura 0.24m)
            
            CENTRAL_WALL_TOP: 7.50,    // Altura del muro central
            
            // Pilastras / Columnas (Cotas CAD: 0.26 ancho, longitud total 3.62 m, remate 7.70 m, base 4.08 m)
            PILASTER_WIDTH: 0.26,      // Ancho exacto de pilastra: 0.26 m (según cota 0.26 en media_1788705305377.png)
            PILASTER_OUTER_X: 1.96,    // Cara exterior de pilastra (1.70 + 0.26 = 1.96 m; a 10.50m: 5.25 - 1.96 = 3.29 m)
            PILASTER_INNER_X: 1.70,    // Cara interior de pilastra (1.70 m al eje central, según cota 1.70)
            PILASTER_TOP: 7.70,        // Remate superior (7.50 + 0.20 = 7.70 m)
            PILASTER_BOTTOM: 4.08,     // Base inferior: 7.70 - 3.62 = 4.08 m (longitud total exacta: 3.62 m)
            PILASTER_HEIGHT: 3.62,     // Longitud total vertical de pilastra: 3.62 m
            
            // Alas laterales y cornisa
            WING_CORNICE_TOP: 6.30,    // Nivel superior de cornisa lateral
            WING_CORNICE_BOT: 6.10,    // Nivel inferior de cornisa lateral (espesor 0.20 m)
            WING_CORNICE_R: 0.14,      // Radio curvatura remate exterior cornisa (R0.14)
            WING_MOULDING_Y: 5.05,     // Altura de moldura horizontal corrida
            
            // Ventanas góticas (Cotas: 1.60 ancho, 1.90 alto paño rectangular, 0.62 margen a moldura)
            WINDOW_WIDTH: 1.60,        // Ancho de vano de ventana
            WINDOW_RECT_HEIGHT: 1.90,  // Altura del paño rectangular (1.10 a 3.00)
            WINDOW_SPRING_Y: 3.00,     // Altura de arranque de arcos
            WINDOW_SILL_Y: 1.10,       // Altura de antepecho / alféizar (3.00 - 1.90 = 1.10)
            WINDOW_ARCH_R_IN: 1.38,    // Radio interior arco ventana
            WINDOW_ARCH_R_OUT: 1.62,   // Radio exterior archivolta ventana (espesor 0.24 m)
            WINDOW_MOULDING_THICK: 0.24,// Espesor total de molduras de ventana (1.62 - 1.38)
            
            DEFAULT_TOTAL_WIDTH: 10.50,// Ancho original del plano
            BASE_OUTER_MARGIN: 0.62,   // Margen exterior exacto: del muro exterior a la moldura exterior
            BASE_INNER_MARGIN: 1.05,   // Margen interior de moldura al portal central
            DEFAULT_MIN_FREE_SPACE: 1.50// Separación mínima libre entre ventanas
        };
    }

    static boundedNumber(value, fallback, min, max) {
        const number = (typeof value === 'number' || (typeof value === 'string' && value.trim())) ? Number(value) : NaN;
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    normalizeOptions(options = {}) {
        const input = options && typeof options === 'object' ? options : {};
        const bounded = FacadeEngine.boundedNumber;
        const title = (value, fallback) => typeof value === 'string'
            ? value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 20) : fallback;
        return {
            ...input,
            totalWidth: bounded(input.totalWidth, 10.50, 6, 35),
            minFreeSpace: bounded(input.minFreeSpace, 1.50, 1, 3),
            manualCount: Math.floor(bounded(input.manualCount, 1, 0, 6)),
            distributionMode: ['auto', 'manual', 'exact_150'].includes(input.distributionMode) ? input.distributionMode : 'auto',
            dimFontSize: bounded(input.dimFontSize, 0.20, 0.14, 0.35),
            titleFontSize: bounded(input.titleFontSize, 0.20, 0.10, 0.35),
            titleLine1: title(input.titleLine1, 'ASAMBLEA'),
            titleLine2: title(input.titleLine2, 'CRISTIANA')
        };
    }

    static escapeXML(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
    }

    getTitleGeometry(line1, line2, fontSize) {
        const maxLength = Math.max(line1.length, line2.length, 1);
        const boxW = +Math.max(1.95, maxLength * fontSize * 0.72 + 0.55).toFixed(2);
        const boxH = +Math.max(0.74, fontSize * 2.80 + 0.18).toFixed(2);
        return { boxW, boxH, boxY: +(6.47 + boxH / 2).toFixed(2),
            line1Y: +(6.41 + fontSize * 0.58).toFixed(2), line2Y: +(6.41 - fontSize * 0.58).toFixed(2) };
    }

    /**
     * Calcula la distribución paramétrica de ventanas según el ancho total ("largo").
     * Regla: Conserva el módulo central y añade 1 ventana cada 1.5 m libres entre ventanas.
     */
    calculateLayout(totalWidth, minFreeSpace = 1.50, distributionMode = 'auto', manualCount = 1) {
        const C = this.CONSTANTS;
        ({ totalWidth, minFreeSpace, distributionMode, manualCount } = this.normalizeOptions({ totalWidth, minFreeSpace, distributionMode, manualCount }));

        const halfTotal = totalWidth / 2.0;
        // El paño del ala donde se centran las ventanas corresponde a la cota 3.29 m (media_1788703759354.png):
        // Se mide desde la cara exterior de la pilastra (1.96 m) hasta el muro exterior (halfTotal).
        const wingSpan = halfTotal - C.PILASTER_OUTER_X;

        // Ancho total exterior de la ventana incluyendo sus archivoltas/molduras:
        // 1.60 (vano) + 2 * 0.24 (molduras) = 2.08 m
        const winTotalW = C.WINDOW_WIDTH + 2 * C.WINDOW_MOULDING_THICK; // 2.08 m
        const winHalfOuter = winTotalW / 2.0; // 1.04 m

        // Determinación del número de ventanas N por ala:
        let numWindows = 1;

        if (distributionMode === 'manual') {
            numWindows = Math.max(0, parseInt(manualCount) || 0);
        } else {
            // Regla automática:
            // Las ventanas se centran y distribuyen de forma estrictamente simétrica respecto al paño del ala (cota 3.29 m).
            // Para N ventanas, se divide el paño en N crujías iguales de ancho bayW = wingSpan / N.
            // En cada crujía, la ventana queda centrada, garantizando:
            // Margen exterior (al muro) = Margen interior (a la columna) = (bayW - winTotalW) / 2
            // Separación libre entre ventanas = bayW - winTotalW = 2 * Margen
            // Se añade 1 ventana adicional cuando la separación libre resultante es >= minFreeSpace (1.50 m)
            if (wingSpan + 1e-9 < winTotalW + 0.30) {
                numWindows = 0;
            } else {
                let n = 1;
                while (true) {
                    const nextN = n + 1;
                    const testBayW = wingSpan / nextN;
                    const testGap = testBayW - winTotalW;
                    if (testGap + 1e-9 >= minFreeSpace) {
                        n = nextN;
                    } else {
                        break;
                    }
                }
                numWindows = n;
            }
        }

        const windowPositionsRight = [];
        let actualFreeSpace = 0;
        let actualOuterMargin = 0;
        let actualInnerMargin = 0;

        if (numWindows === 0) {
            actualFreeSpace = 0;
            actualOuterMargin = +wingSpan.toFixed(2);
            actualInnerMargin = +wingSpan.toFixed(2);
        } else if (numWindows === 1) {
            // 1 ventana por ala:
            // Centrada exactamente en el centro de la cota 3.29 m del ala (entre pilastra x=1.96 y muro exterior x=halfTotal)
            // según plano original y media_1788703759354.png
            const winCenter = (C.PILASTER_OUTER_X + wingSpan / 2.0);
            windowPositionsRight.push(winCenter);

            // Márgenes estrictamente simétricos e idénticos (al muro exterior y a la columna):
            // (3.29 - 2.08) / 2 = 0.605 m ≈ 0.61 m
            const singleMargin = ((wingSpan - winTotalW) / 2.0);
            actualOuterMargin = singleMargin;
            actualInnerMargin = singleMargin;
            actualFreeSpace = 0;
        } else {
            // N >= 2 ventanas:
            if (distributionMode === 'exact_150') {
                actualFreeSpace = minFreeSpace;
                const totalWindowsW = numWindows * winTotalW;
                const totalGapsW = (numWindows - 1) * actualFreeSpace;
                const remainingMargins = wingSpan - totalWindowsW - totalGapsW;
                actualOuterMargin = (remainingMargins / 2.0);
                actualInnerMargin = actualOuterMargin;

                const startMouldingX = C.PILASTER_OUTER_X + actualInnerMargin;
                for (let i = 0; i < numWindows; i++) {
                    const c = startMouldingX + winHalfOuter + i * (winTotalW + actualFreeSpace);
                    windowPositionsRight.push(c);
                }
            } else {
                // Modo modular centrado:
                // Cada ventana se ubica en el centro exacto de su módulo en el paño del ala (wingSpan)
                const bayW = wingSpan / numWindows;
                actualFreeSpace = (bayW - winTotalW);
                actualOuterMargin = (actualFreeSpace / 2.0);
                actualInnerMargin = actualOuterMargin;

                for (let i = 0; i < numWindows; i++) {
                    const c = C.PILASTER_OUTER_X + (i + 0.5) * bayW;
                    windowPositionsRight.push(c);
                }
            }
        }

        // Simetría exacta para el ala izquierda (reflejo sobre el eje x = 0):
        const windowPositionsLeft = windowPositionsRight.map(x => -x).reverse();
        const isGeometryValid = actualOuterMargin >= -1e-9 && actualInnerMargin >= -1e-9
            && (numWindows <= 1 || actualFreeSpace + 1e-9 >= minFreeSpace);

        return {
            totalWidth,
            wingWidth: wingSpan,
            wingSpan,
            lowerWingWidth: +((totalWidth - C.PORTAL_WIDTH) / 2.0).toFixed(2),
            numWindowsPerWing: numWindows,
            totalWindows: numWindows * 2,
            windowWidth: C.WINDOW_WIDTH,
            windowTotalWidth: winTotalW,
            actualFreeSpace,
            actualOuterMargin,
            actualInnerMargin,
            actualInnerMarginToPortal: +(actualInnerMargin + (C.PILASTER_OUTER_X - C.PORTAL_WIDTH / 2.0)).toFixed(2),
            windowPositionsRight,
            windowPositionsLeft,
            allWindowCenters: [...windowPositionsLeft, ...windowPositionsRight],
            isGeometryValid
        };
    }

    /**
     * Geometría precisa de un arco ojival (Gothic pointed arch).
     */
    getPointedArchGeometry(xCenter, span, springY, radius) {
        const halfSpan = span / 2.0;
        const c1X = (xCenter - halfSpan) + radius;
        const c2X = (xCenter + halfSpan) - radius;

        const deltaX = radius - halfSpan;
        const hSq = radius * radius - deltaX * deltaX;
        const heightAboveSpring = hSq > 0 ? Math.sqrt(hSq) : radius;
        const apexY = springY + heightAboveSpring;

        return {
            xCenter,
            span,
            springY,
            radius,
            c1X,
            c2X,
            apexY,
            heightAboveSpring,
            leftStart: { x: xCenter - halfSpan, y: springY },
            rightStart: { x: xCenter + halfSpan, y: springY },
            apex: { x: xCenter, y: apexY }
        };
    }

    /**
     * Genera el SVG vectorial de la fachada respetando fielmente las cotas CAD.
     */
    generateSVG(options = {}) {
        options = this.normalizeOptions(options);
        const {
            totalWidth = this.CONSTANTS.DEFAULT_TOTAL_WIDTH,
            minFreeSpace = 1.50,
            distributionMode = 'auto',
            manualCount = 1,
            showDimensions = true,
            showHuman = true,
            showGrid = false,
            showAxes = true,
            showLevels = true,
            showDimBadges = true,
            dimFontSize = 0.20,
            theme = 'cad_dark',
            titleLine1 = 'ASAMBLEA',
            titleLine2 = 'CRISTIANA',
            titleFontSize = 0.20
        } = options;

        const layout = this.calculateLayout(totalWidth, minFreeSpace, distributionMode, manualCount);
        const C = this.CONSTANTS;

        const THEMES = {
            cad_dark: {
                bg: '#0f141c',
                grid: '#1e2638',
                ground: '#ca8a04',
                groundStroke: '#facc15',
                groundHatch: 'rgba(250, 204, 21, 0.22)',
                wallFill: '#161c28',
                wallStroke: '#facc15',
                mouldingStroke: '#fef08a',
                pilasterFill: '#1c2436',
                pilasterStroke: '#facc15',
                doorFill: '#1e293b',
                doorStroke: '#facc15',
                doorPanel: '#0f172a',
                doorHandle: '#fbbf24',
                glassFill: '#0b253e',
                glassStroke: '#38bdf8',
                dimStroke: '#38bdf8',          // Cian brillante CAD de alta visibilidad
                dimText: '#ffffff',            // Blanco puro para máximo contraste
                dimTick: '#38bdf8',            // Nodos cian
                dimBadgeBg: '#091829',         // Fondo de pastilla para evitar interferencia
                dimBadgeBorder: '#0284c7',     // Borde de la pastilla
                textTitle: '#ef4444',
                humanFill: '#38bdf8',
                axisStroke: 'rgba(250, 204, 21, 0.45)',
                levelStroke: '#38bdf8',
                levelText: '#7dd3fc'
            },
            cad_white: {
                bg: '#ffffff',
                grid: '#f1f5f9',
                ground: '#0f172a',
                groundStroke: '#0f172a',
                groundHatch: 'rgba(15, 23, 42, 0.15)',
                wallFill: '#f8fafc',
                wallStroke: '#0f172a',
                mouldingStroke: '#334155',
                pilasterFill: '#f1f5f9',
                pilasterStroke: '#0f172a',
                doorFill: '#e2e8f0',
                doorStroke: '#0f172a',
                doorPanel: '#cbd5e1',
                doorHandle: '#d97706',
                glassFill: '#e0f2fe',
                glassStroke: '#0284c7',
                dimStroke: '#0284c7',          // Azul técnico profundo
                dimText: '#0f172a',            // Negro nítido
                dimTick: '#0284c7',
                dimBadgeBg: '#ffffff',
                dimBadgeBorder: '#bae6fd',
                textTitle: '#dc2626',
                humanFill: '#64748b',
                axisStroke: 'rgba(15, 23, 42, 0.3)',
                levelStroke: '#0284c7',
                levelText: '#0369a1'
            },
            blueprint: {
                bg: '#081c33',
                grid: '#0f2d4e',
                ground: '#60a5fa',
                groundStroke: '#93c5fd',
                groundHatch: 'rgba(147, 197, 253, 0.2)',
                wallFill: '#0b2644',
                wallStroke: '#ffffff',
                mouldingStroke: '#bae6fd',
                pilasterFill: '#09213b',
                pilasterStroke: '#ffffff',
                doorFill: '#12355b',
                doorStroke: '#ffffff',
                doorPanel: '#081e36',
                doorHandle: '#fbbf24',
                glassFill: '#0f3863',
                glassStroke: '#7dd3fc',
                dimStroke: '#38bdf8',
                dimText: '#ffffff',
                dimTick: '#7dd3fc',
                dimBadgeBg: '#06172a',
                dimBadgeBorder: '#0284c7',
                textTitle: '#f87171',
                humanFill: '#7dd3fc',
                axisStroke: 'rgba(255, 255, 255, 0.4)',
                levelStroke: '#38bdf8',
                levelText: '#ffffff'
            },
            realistic: {
                bg: '#0b1120',
                grid: '#1e293b',
                ground: '#334155',
                groundStroke: '#475569',
                groundHatch: 'rgba(71, 85, 105, 0.3)',
                wallFill: '#f1f5f9',
                wallStroke: '#cbd5e1',
                mouldingStroke: '#94a3b8',
                pilasterFill: '#e2e8f0',
                pilasterStroke: '#94a3b8',
                doorFill: '#78350f',
                doorStroke: '#92400e',
                doorPanel: '#451a03',
                doorHandle: '#f59e0b',
                glassFill: '#0284c7',
                glassStroke: '#38bdf8',
                dimStroke: '#38bdf8',
                dimText: '#ffffff',
                dimTick: '#38bdf8',
                dimBadgeBg: '#0f172a',
                dimBadgeBorder: '#38bdf8',
                textTitle: '#b91c1c',
                humanFill: '#64748b',
                axisStroke: 'rgba(203, 213, 225, 0.3)',
                levelStroke: '#38bdf8',
                levelText: '#38bdf8'
            }
        };

        const pal = THEMES[theme] || THEMES.cad_dark;

        const marginX = Math.max(3.8, totalWidth * 0.16);
        const minX = -(totalWidth / 2.0 + marginX);
        const maxX = +(totalWidth / 2.0 + marginX + (showHuman ? 1.6 : 0) + (showLevels ? 1.5 : 0));
        const minY = -2.50;
        const maxY = 9.50;

        const worldWidth = +(maxX - minX).toFixed(3);
        const worldHeight = +(maxY - minY).toFixed(3);

        const toSvgX = (x) => +((x - minX).toFixed(3));
        const toSvgY = (y) => +((maxY - y).toFixed(3));

        let svg = '';
        svg += `<!-- SVG Generated by FacadeEngine for Asamblea Cristiana -->\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${worldWidth} ${worldHeight}" width="100%" height="100%" style="background-color: ${pal.bg}; shape-rendering: geometricPrecision; text-rendering: geometricPrecision;" class="facade-svg" role="img" aria-label="Elevación frontal de la fachada">\n`;
        svg += `<defs>\n`;
        svg += `  <style>\n`;
        svg += `    .wall-line { stroke: ${pal.wallStroke}; stroke-width: 0.048; fill: none; stroke-linejoin: round; stroke-linecap: round; }\n`;
        svg += `    .wall-fill { fill: ${pal.wallFill}; }\n`;
        svg += `    .moulding-line { stroke: ${pal.mouldingStroke}; stroke-width: 0.026; fill: none; }\n`;
        svg += `    .pilaster-line { stroke: ${pal.pilasterStroke}; stroke-width: 0.042; fill: ${pal.pilasterFill}; }\n`;
        svg += `    .door-fill { fill: ${pal.doorFill}; }\n`;
        svg += `    .door-frame { stroke: ${pal.doorStroke}; stroke-width: 0.042; fill: none; }\n`;
        svg += `    .window-frame { stroke: ${pal.glassStroke}; stroke-width: 0.038; fill: ${pal.glassFill}; }\n`;
        svg += `    .dim-line { stroke: ${pal.dimStroke}; stroke-width: 0.028; fill: none; }\n`;
        svg += `    .dim-tick { stroke: ${pal.dimTick}; stroke-width: 0.038; }\n`;
        svg += `    .dim-badge { fill: ${pal.dimBadgeBg}; stroke: ${pal.dimBadgeBorder}; stroke-width: 0.018; opacity: 1.0; }\n`;
        svg += `    .dim-text { fill: ${pal.dimText}; font-family: 'Consolas', 'Courier New', monospace; font-size: ${dimFontSize}px; text-anchor: middle; font-weight: bold; letter-spacing: 0.02em; }\n`;
        svg += `    .dim-text-vert { fill: ${pal.dimText}; font-family: 'Consolas', 'Courier New', monospace; font-size: ${+(dimFontSize * 0.95).toFixed(3)}px; text-anchor: middle; font-weight: bold; letter-spacing: 0.02em; }\n`;
        svg += `    .dim-gold-text { fill: #facc15; font-family: 'Consolas', 'Courier New', monospace; font-size: ${+(dimFontSize * 0.95).toFixed(3)}px; text-anchor: middle; font-weight: bold; letter-spacing: 0.02em; }\n`;
        svg += `    .dim-gold-line { stroke: #eab308; stroke-width: 0.028; fill: none; }\n`;
        svg += `    .title-text { fill: ${pal.textTitle}; font-family: 'Arial', 'Trebuchet MS', sans-serif; font-size: ${titleFontSize}px; font-weight: bold; letter-spacing: 0.04em; text-anchor: middle; dominant-baseline: central; alignment-baseline: central; }\n`;
        svg += `    .axis-line { stroke: ${pal.axisStroke}; stroke-width: 0.024; stroke-dasharray: 0.35 0.15 0.06 0.15; }\n`;
        svg += `    .grid-line { stroke: ${pal.grid}; stroke-width: 0.016; }\n`;
        svg += `    .level-line { stroke: ${pal.levelStroke}; stroke-width: 0.022; fill: none; }\n`;
        svg += `    .level-text { fill: ${pal.levelText}; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.22px; font-weight: bold; dominant-baseline: central; text-anchor: start; }\n`;
        svg += `  </style>\n`;
        svg += `</defs>\n\n`;

        // 1. Cuadrícula métrica
        if (showGrid) {
            svg += `<g id="layer-grid">\n`;
            for (let gx = Math.floor(minX); gx <= Math.ceil(maxX); gx += 1.0) {
                svg += `  <line x1="${toSvgX(gx)}" y1="${toSvgY(minY)}" x2="${toSvgX(gx)}" y2="${toSvgY(maxY)}" class="grid-line"/>\n`;
            }
            for (let gy = Math.floor(minY); gy <= Math.ceil(maxY); gy += 1.0) {
                svg += `  <line x1="${toSvgX(minX)}" y1="${toSvgY(gy)}" x2="${toSvgX(maxX)}" y2="${toSvgY(gy)}" class="grid-line"/>\n`;
            }
            svg += `</g>\n`;
        }

        // 2. Ejes de simetría
        if (showAxes) {
            svg += `<g id="layer-axes">\n`;
            svg += `  <line x1="${toSvgX(0)}" y1="${toSvgY(-1.8)}" x2="${toSvgX(0)}" y2="${toSvgY(8.85)}" class="axis-line"/>\n`;
            layout.allWindowCenters.forEach(cx => {
                svg += `  <line x1="${toSvgX(cx)}" y1="${toSvgY(-0.8)}" x2="${toSvgX(cx)}" y2="${toSvgY(6.5)}" class="axis-line"/>\n`;
            });
            svg += `  <line x1="${toSvgX(-totalWidth/2 - 0.5)}" y1="${toSvgY(C.WINDOW_SPRING_Y)}" x2="${toSvgX(totalWidth/2 + 0.5)}" y2="${toSvgY(C.WINDOW_SPRING_Y)}" class="axis-line"/>\n`;
            svg += `</g>\n`;
        }

        // 3. Muros principales
        svg += `<g id="layer-walls">\n`;
        const halfTotal = totalWidth / 2.0;

        // Ala izquierda: de x = -halfTotal a x = -C.PILASTER_OUTER_X (-1.96)
        const leftWingSvgPath = [
            `M ${toSvgX(-halfTotal)} ${toSvgY(0)}`,
            `L ${toSvgX(-halfTotal)} ${toSvgY(C.WING_CORNICE_BOT)}`,
            `Q ${toSvgX(-halfTotal - C.WING_CORNICE_R)} ${toSvgY(C.WING_CORNICE_BOT + 0.10)} ${toSvgX(-halfTotal - C.WING_CORNICE_R)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(-C.PILASTER_OUTER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(-C.PILASTER_OUTER_X)} ${toSvgY(0)}`,
            `Z`
        ].join(' ');
        svg += `  <path d="${leftWingSvgPath}" class="wall-fill"/>\n`;
        svg += `  <path d="${leftWingSvgPath}" class="wall-line"/>\n`;

        // Ala derecha: de x = +C.PILASTER_OUTER_X (+1.96) a x = +halfTotal
        const rightWingSvgPath = [
            `M ${toSvgX(C.PILASTER_OUTER_X)} ${toSvgY(0)}`,
            `L ${toSvgX(C.PILASTER_OUTER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(halfTotal + C.WING_CORNICE_R)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `Q ${toSvgX(halfTotal + C.WING_CORNICE_R)} ${toSvgY(C.WING_CORNICE_BOT + 0.10)} ${toSvgX(halfTotal)} ${toSvgY(C.WING_CORNICE_BOT)}`,
            `L ${toSvgX(halfTotal)} ${toSvgY(0)}`,
            `Z`
        ].join(' ');
        svg += `  <path d="${rightWingSvgPath}" class="wall-fill"/>\n`;
        svg += `  <path d="${rightWingSvgPath}" class="wall-line"/>\n`;

        // Molduras de cornisa lateral (3 líneas como en CAD: 6.30, 6.20, 6.10)
        svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="moulding-line"/>\n`;
        svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_BOT + 0.10)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(C.WING_CORNICE_BOT + 0.10)}" class="moulding-line"/>\n`;
        svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_BOT)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(C.WING_CORNICE_BOT)}" class="moulding-line"/>\n`;

        svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="moulding-line"/>\n`;
        svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_BOT + 0.10)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(C.WING_CORNICE_BOT + 0.10)}" class="moulding-line"/>\n`;
        svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_BOT)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(C.WING_CORNICE_BOT)}" class="moulding-line"/>\n`;

        // Moldura corrida intermedia a y = 5.05 m
        svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_MOULDING_Y)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(C.WING_MOULDING_Y)}" class="moulding-line"/>\n`;
        svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_MOULDING_Y)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(C.WING_MOULDING_Y)}" class="moulding-line"/>\n`;

        // Muro central (relleno continuo de todo el cuerpo central hasta la coronación de 7.50 m)
        const centralWallFillPath = [
            `M ${toSvgX(-C.PILASTER_OUTER_X)} ${toSvgY(0)}`,
            `L ${toSvgX(-C.PILASTER_OUTER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(-C.PILASTER_INNER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(-C.PILASTER_INNER_X)} ${toSvgY(C.CENTRAL_WALL_TOP)}`,
            `L ${toSvgX(C.PILASTER_INNER_X)} ${toSvgY(C.CENTRAL_WALL_TOP)}`,
            `L ${toSvgX(C.PILASTER_INNER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(C.PILASTER_OUTER_X)} ${toSvgY(C.WING_CORNICE_TOP)}`,
            `L ${toSvgX(C.PILASTER_OUTER_X)} ${toSvgY(0)}`,
            `Z`
        ].join(' ');
        svg += `  <path d="${centralWallFillPath}" class="wall-fill"/>\n`;

        // Líneas de coronación del muro central (únicamente los bordes visibles: laterales y remate 7.50 m)
        // La pared es continua hacia abajo; NO lleva línea horizontal por detrás del cartel a 6.30 m
        svg += `  <line x1="${toSvgX(-C.PILASTER_INNER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(-C.PILASTER_INNER_X)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="wall-line"/>\n`;
        svg += `  <line x1="${toSvgX(-C.PILASTER_INNER_X)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(C.PILASTER_INNER_X)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="wall-line"/>\n`;
        svg += `  <line x1="${toSvgX(C.PILASTER_INNER_X)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(C.PILASTER_INNER_X)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="wall-line"/>\n`;
        svg += `</g>\n\n`;

        // 4. Pilastras / Columnas estriadas ornamentales
        // Ancho 0.26 m, longitud exacta 3.62 m (remate 7.70 m, base 4.08 m, según media_1788705305377.png y media_1788703155893.png)
        // 4 líneas verticales internas (5 franjas) continuas de tope a base (fiel a plano CAD original)
        svg += `<g id="layer-pilasters">\n`;
        const colW = C.PILASTER_WIDTH; // 0.26 m
        const colTopY = C.PILASTER_TOP; // 7.70 m
        const colBotY = C.PILASTER_BOTTOM; // 4.08 m
        const colH = +(colTopY - colBotY).toFixed(3); // 3.62 m

        const drawPilaster = (isLeft) => {
            const xLeft = isLeft ? -C.PILASTER_OUTER_X : C.PILASTER_INNER_X;
            let pStr = '';
            // Fuste / Cuerpo continuo de la pilastra (ancho exacto 0.26 m)
            pStr += `  <rect x="${toSvgX(xLeft)}" y="${toSvgY(colTopY)}" width="${colW}" height="${colH}" fill="${pal.pilasterFill}" class="pilaster-line"/>\n`;
            // 4 estrías verticales internas (5 franjas iguales de 0.052 m)
            const fluteStep = colW / 5.0; // 0.052 m
            for (let f = 1; f <= 4; f++) {
                const fx = +(xLeft + f * fluteStep).toFixed(3);
                pStr += `  <line x1="${toSvgX(fx)}" y1="${toSvgY(colTopY)}" x2="${toSvgX(fx)}" y2="${toSvgY(colBotY)}" class="moulding-line"/>\n`;
            }
            return pStr;
        };

        svg += drawPilaster(true);  // Pilastra izquierda (x: -1.96 a -1.70)
        svg += drawPilaster(false); // Pilastra derecha (x: +1.70 a +1.96)
        svg += `</g>\n\n`;

        // 5. Portal central y Puerta
        svg += `<g id="layer-portal">\n`;
        const doorHalfW = C.DOOR_OPENING / 2.0; // 1.20 m
        const doorH = C.DOOR_HEIGHT; // 3.00 m
        
        // Vano y marco exterior de la puerta
        svg += `  <rect x="${toSvgX(-doorHalfW)}" y="${toSvgY(doorH)}" width="${C.DOOR_OPENING}" height="${doorH}" class="door-fill door-frame"/>\n`;
        svg += `  <line x1="${toSvgX(0)}" y1="${toSvgY(0)}" x2="${toSvgX(0)}" y2="${toSvgY(doorH)}" class="door-frame" stroke-width="0.035"/>\n`;
        
        // Tableros almohadillados de madera (2 paneles por hoja)
        const panelMargin = 0.10;
        const leafW = +(doorHalfW - panelMargin * 2).toFixed(3);
        const pMidY = 1.35;
        // Hoja izquierda
        svg += `  <rect x="${toSvgX(-doorHalfW + panelMargin)}" y="${toSvgY(pMidY - 0.05)}" width="${leafW}" height="1.15" fill="${pal.doorPanel}" stroke="${pal.doorStroke}" stroke-width="0.02" opacity="0.8"/>\n`;
        svg += `  <rect x="${toSvgX(-doorHalfW + panelMargin)}" y="${toSvgY(doorH - panelMargin)}" width="${leafW}" height="1.35" fill="${pal.doorPanel}" stroke="${pal.doorStroke}" stroke-width="0.02" opacity="0.8"/>\n`;
        // Hoja derecha
        svg += `  <rect x="${toSvgX(panelMargin)}" y="${toSvgY(pMidY - 0.05)}" width="${leafW}" height="1.15" fill="${pal.doorPanel}" stroke="${pal.doorStroke}" stroke-width="0.02" opacity="0.8"/>\n`;
        svg += `  <rect x="${toSvgX(panelMargin)}" y="${toSvgY(doorH - panelMargin)}" width="${leafW}" height="1.35" fill="${pal.doorPanel}" stroke="${pal.doorStroke}" stroke-width="0.02" opacity="0.8"/>\n`;

        // Herrajes de bronce / oro
        const handleY = 1.05;
        svg += `  <rect x="${toSvgX(-0.065)}" y="${toSvgY(handleY + 0.18)}" width="0.038" height="0.32" rx="0.015" fill="${pal.doorHandle}" stroke="#b45309" stroke-width="0.012"/>\n`;
        svg += `  <rect x="${toSvgX(0.027)}" y="${toSvgY(handleY + 0.18)}" width="0.038" height="0.32" rx="0.015" fill="${pal.doorHandle}" stroke="#b45309" stroke-width="0.012"/>\n`;
        svg += `  <circle cx="${toSvgX(-0.046)}" cy="${toSvgY(handleY)}" r="0.012" fill="#78350f"/>\n`;
        svg += `  <circle cx="${toSvgX(0.046)}" cy="${toSvgY(handleY)}" r="0.012" fill="#78350f"/>\n`;

        // Tímpano y archivoltas concéntricas de la puerta (R2.20 a R2.44)
        const doorArchIn = this.getPointedArchGeometry(0, C.DOOR_OPENING, doorH, C.DOOR_ARCH_R_IN);
        const timpanumPath = [
            `M ${toSvgX(-doorHalfW)} ${toSvgY(doorH)}`,
            `A ${doorArchIn.radius} ${doorArchIn.radius} 0 0 1 ${toSvgX(0)} ${toSvgY(doorArchIn.apexY)}`,
            `A ${doorArchIn.radius} ${doorArchIn.radius} 0 0 1 ${toSvgX(doorHalfW)} ${toSvgY(doorH)}`,
            `Z`
        ].join(' ');
        svg += `  <path d="${timpanumPath}" class="door-fill door-frame"/>\n`;

        const doorArchRadii = [2.20, 2.28, 2.36, 2.44];
        doorArchRadii.forEach((r, idx) => {
            const spanR = +(C.DOOR_OPENING + (r - C.DOOR_ARCH_R_IN) * 2.0).toFixed(3);
            const archG = this.getPointedArchGeometry(0, spanR, doorH, r);
            const archP = [
                `M ${toSvgX(-spanR / 2)} ${toSvgY(doorH)}`,
                `A ${r} ${r} 0 0 1 ${toSvgX(0)} ${toSvgY(archG.apexY)}`,
                `A ${r} ${r} 0 0 1 ${toSvgX(spanR / 2)} ${toSvgY(doorH)}`
            ].join(' ');
            svg += `  <path d="${archP}" class="wall-line" stroke-width="${idx === doorArchRadii.length - 1 ? 0.048 : 0.026}"/>\n`;
            svg += `  <line x1="${toSvgX(-spanR / 2)}" y1="${toSvgY(doorH)}" x2="${toSvgX(-spanR / 2)}" y2="${toSvgY(0)}" class="wall-line" stroke-width="${idx === doorArchRadii.length - 1 ? 0.048 : 0.026}"/>\n`;
            svg += `  <line x1="${toSvgX(spanR / 2)}" y1="${toSvgY(doorH)}" x2="${toSvgX(spanR / 2)}" y2="${toSvgY(0)}" class="wall-line" stroke-width="${idx === doorArchRadii.length - 1 ? 0.048 : 0.026}"/>\n`;
        });

        // Ornamento central (cruz ojival)
        svg += `  <g id="ornament-cross" stroke="${pal.wallStroke}" stroke-width="0.028" opacity="0.85">\n`;
        const crossY = doorH + 0.85;
        svg += `    <line x1="${toSvgX(-0.12)}" y1="${toSvgY(crossY)}" x2="${toSvgX(0.12)}" y2="${toSvgY(crossY)}"/>\n`;
        svg += `    <line x1="${toSvgX(0)}" y1="${toSvgY(crossY - 0.16)}" x2="${toSvgX(0)}" y2="${toSvgY(crossY + 0.16)}"/>\n`;
        svg += `    <circle cx="${toSvgX(0)}" cy="${toSvgY(crossY)}" r="0.045" fill="none" stroke="${pal.wallStroke}" stroke-width="0.02"/>\n`;
        svg += `  </g>\n`;
        svg += `</g>\n\n`;

        // 6. Rótulo institucional "ASAMBLEA CRISTIANA"
        svg += `<g id="layer-title">\n`;
        const { boxW, boxH, boxY, line1Y, line2Y } = this.getTitleGeometry(titleLine1, titleLine2, titleFontSize);

        // Placa arquitectónica con doble filete y remaches de fijación (fondo 100% opaco y limpio)
        svg += `  <rect x="${toSvgX(-boxW/2)}" y="${toSvgY(boxY)}" width="${boxW}" height="${boxH}" stroke="${pal.textTitle}" stroke-width="0.028" fill="${pal.wallFill}" opacity="1"/>\n`;
        svg += `  <rect x="${toSvgX(-boxW/2 + 0.04)}" y="${toSvgY(boxY - 0.04)}" width="${+(boxW - 0.08).toFixed(3)}" height="${+(boxH - 0.08).toFixed(3)}" stroke="${pal.textTitle}" stroke-width="0.014" fill="none" opacity="0.6"/>\n`;
        const dotOff = 0.08;
        svg += `  <circle cx="${toSvgX(-boxW/2 + dotOff)}" cy="${toSvgY(boxY - dotOff)}" r="0.018" fill="${pal.textTitle}"/>\n`;
        svg += `  <circle cx="${toSvgX(boxW/2 - dotOff)}" cy="${toSvgY(boxY - dotOff)}" r="0.018" fill="${pal.textTitle}"/>\n`;
        svg += `  <circle cx="${toSvgX(-boxW/2 + dotOff)}" cy="${toSvgY(boxY - boxH + dotOff)}" r="0.018" fill="${pal.textTitle}"/>\n`;
        svg += `  <circle cx="${toSvgX(boxW/2 - dotOff)}" cy="${toSvgY(boxY - boxH + dotOff)}" r="0.018" fill="${pal.textTitle}"/>\n`;
        svg += `  <text x="${toSvgX(0)}" y="${toSvgY(line1Y)}" dominant-baseline="central" alignment-baseline="central" text-anchor="middle" class="title-text">${FacadeEngine.escapeXML(titleLine1)}</text>\n`;
        svg += `  <text x="${toSvgX(0)}" y="${toSvgY(line2Y)}" dominant-baseline="central" alignment-baseline="central" text-anchor="middle" class="title-text">${FacadeEngine.escapeXML(titleLine2)}</text>\n`;
        svg += `</g>\n\n`;

        // 7. Ventanas góticas
        // Vano de 1.60m x 1.90m, antepecho a 1.10m, imposta a 3.00m
        // 7. Ventanas góticas (Formato exacto según plano CAD original y media_1788703046143.png)
        // - Vano de 1.60m x 1.90m, antepecho a 1.10m, imposta a 3.00m
        // - Dos hojas rectangulares con marco perimetral y vidrio en la parte inferior (1.10 a 3.00m)
        // - Tímpano ojival superior limpio y diáfano (sin tracerías secundarias ni rosetones)
        // - 4 archivoltas concéntricas (R1.38, R1.46, R1.54, R1.62) que descienden como jambas al antepecho
        // - Cierre horizontal limpio al nivel de antepecho (1.10m)
        svg += `<g id="layer-windows">\n`;
        const winW = C.WINDOW_WIDTH; // 1.60 m
        const winHRect = C.WINDOW_RECT_HEIGHT; // 1.90 m
        const winSpringY = C.WINDOW_SPRING_Y; // 3.00 m
        const winSillY = C.WINDOW_SILL_Y; // 1.10 m
        const windowArchRadii = [1.38, 1.46, 1.54, 1.62];

        layout.allWindowCenters.forEach((cx, wIndex) => {
            const leftX = +(cx - winW / 2.0).toFixed(3);
            const rightX = +(cx + winW / 2.0).toFixed(3);

            // Vano rectangular de fondo
            svg += `  <!-- Ventana ${wIndex + 1} en x = ${cx.toFixed(2)} -->\n`;
            svg += `  <rect x="${toSvgX(leftX)}" y="${toSvgY(winSpringY)}" width="${winW}" height="${winHRect}" class="window-frame" stroke-width="0.035"/>\n`;

            // Tímpano ojival superior limpio (según media_1788703046143.png)
            const wArchIn = this.getPointedArchGeometry(cx, winW, winSpringY, C.WINDOW_ARCH_R_IN);
            const wTympanumPath = [
                `M ${toSvgX(leftX)} ${toSvgY(winSpringY)}`,
                `A ${wArchIn.radius} ${wArchIn.radius} 0 0 1 ${toSvgX(cx)} ${toSvgY(wArchIn.apexY)}`,
                `A ${wArchIn.radius} ${wArchIn.radius} 0 0 1 ${toSvgX(rightX)} ${toSvgY(winSpringY)}`,
                `Z`
            ].join(' ');
            svg += `  <path d="${wTympanumPath}" class="window-frame" stroke-width="0.035"/>\n`;

            // Línea de imposta horizontal (separa el paño inferior del tímpano)
            svg += `  <line x1="${toSvgX(leftX)}" y1="${toSvgY(winSpringY)}" x2="${toSvgX(rightX)}" y2="${toSvgY(winSpringY)}" class="wall-line" stroke-width="0.035"/>\n`;

            // Dos hojas vidriadas rectangulares con marco perimetral (según media_1788703046143.png)
            const leafMargin = 0.022; // holgura perimetral
            const leafW = +((winW / 2.0) - leafMargin * 2.0).toFixed(3); // ancho aprox 0.756m
            const leafH = +(winHRect - leafMargin * 2.0).toFixed(3); // alto aprox 1.856m
            const frameThick = 0.048; // espesor del marco de la hoja

            const leafOuterY = +(winSpringY - leafMargin).toFixed(3);
            const leafInnerY = +(leafOuterY - frameThick).toFixed(3);
            const paneW = +(leafW - frameThick * 2.0).toFixed(3);
            const paneH = +(leafH - frameThick * 2.0).toFixed(3);

            // Hoja izquierda
            const leftLeafOuterX = +(leftX + leafMargin).toFixed(3);
            const leftLeafInnerX = +(leftLeafOuterX + frameThick).toFixed(3);
            svg += `  <rect x="${toSvgX(leftLeafOuterX)}" y="${toSvgY(leafOuterY)}" width="${leafW}" height="${leafH}" class="wall-line" stroke-width="0.026" fill="${pal.glassFill}"/>\n`;
            svg += `  <rect x="${toSvgX(leftLeafInnerX)}" y="${toSvgY(leafInnerY)}" width="${paneW}" height="${paneH}" class="wall-line" stroke-width="0.018" fill="${pal.glassFill}" opacity="0.85"/>\n`;

            // Hoja derecha
            const rightLeafOuterX = +(cx + leafMargin).toFixed(3);
            const rightLeafInnerX = +(rightLeafOuterX + frameThick).toFixed(3);
            svg += `  <rect x="${toSvgX(rightLeafOuterX)}" y="${toSvgY(leafOuterY)}" width="${leafW}" height="${leafH}" class="wall-line" stroke-width="0.026" fill="${pal.glassFill}"/>\n`;
            svg += `  <rect x="${toSvgX(rightLeafInnerX)}" y="${toSvgY(leafInnerY)}" width="${paneW}" height="${paneH}" class="wall-line" stroke-width="0.018" fill="${pal.glassFill}" opacity="0.85"/>\n`;

            // Montante / junta central entre las dos hojas
            svg += `  <line x1="${toSvgX(cx)}" y1="${toSvgY(winSillY)}" x2="${toSvgX(cx)}" y2="${toSvgY(winSpringY)}" class="wall-line" stroke-width="0.032"/>\n`;

            // 4 archivoltas concéntricas (de R1.38 a R1.62) que descienden en las jambas
            windowArchRadii.forEach((r, rIdx) => {
                const spanR = +(winW + (r - C.WINDOW_ARCH_R_IN) * 2.0).toFixed(3);
                const aGeom = this.getPointedArchGeometry(cx, spanR, winSpringY, r);
                const aPath = [
                    `M ${toSvgX(cx - spanR / 2)} ${toSvgY(winSpringY)}`,
                    `A ${r} ${r} 0 0 1 ${toSvgX(cx)} ${toSvgY(aGeom.apexY)}`,
                    `A ${r} ${r} 0 0 1 ${toSvgX(cx + spanR / 2)} ${toSvgY(winSpringY)}`
                ].join(' ');
                svg += `  <path d="${aPath}" class="wall-line" stroke-width="${rIdx === windowArchRadii.length - 1 ? 0.045 : 0.024}"/>\n`;
                // Jambas verticales que bajan al antepecho (y = 1.10)
                svg += `  <line x1="${toSvgX(cx - spanR / 2)}" y1="${toSvgY(winSpringY)}" x2="${toSvgX(cx - spanR / 2)}" y2="${toSvgY(winSillY)}" class="wall-line" stroke-width="${rIdx === windowArchRadii.length - 1 ? 0.045 : 0.024}"/>\n`;
                svg += `  <line x1="${toSvgX(cx + spanR / 2)}" y1="${toSvgY(winSpringY)}" x2="${toSvgX(cx + spanR / 2)}" y2="${toSvgY(winSillY)}" class="wall-line" stroke-width="${rIdx === windowArchRadii.length - 1 ? 0.045 : 0.024}"/>\n`;
            });

            // Línea horizontal de antepecho que cierra la base de las molduras (ancho 2.08m)
            const outerSpan = +(winW + (C.WINDOW_ARCH_R_OUT - C.WINDOW_ARCH_R_IN) * 2.0).toFixed(3); // 2.08m
            svg += `  <line x1="${toSvgX(cx - outerSpan / 2)}" y1="${toSvgY(winSillY)}" x2="${toSvgX(cx + outerSpan / 2)}" y2="${toSvgY(winSillY)}" class="wall-line" stroke-width="0.045"/>\n`;
        });
        svg += `</g>\n\n`;

        // 8. Línea de suelo y rayado de terreno (Architectural ground baseline & earth hatching)
        svg += `<g id="layer-ground">\n`;
        const groundMargin = Math.max(1.8, totalWidth * 0.09);
        const groundX1 = -(totalWidth / 2.0 + groundMargin);
        const groundX2 = +(totalWidth / 2.0 + groundMargin);
        svg += `  <line x1="${toSvgX(groundX1)}" y1="${toSvgY(0)}" x2="${toSvgX(groundX2)}" y2="${toSvgY(0)}" stroke="${pal.groundStroke}" stroke-width="0.08" stroke-linecap="square"/>\n`;
        svg += `  <line x1="${toSvgX(groundX1)}" y1="${toSvgY(-0.06)}" x2="${toSvgX(groundX2)}" y2="${toSvgY(-0.06)}" stroke="${pal.ground}" stroke-width="0.03"/>\n`;
        // Rayado de tierra a 45°
        for (let hx = groundX1; hx <= groundX2; hx += 0.40) {
            svg += `  <line x1="${toSvgX(hx)}" y1="${toSvgY(-0.06)}" x2="${toSvgX(hx - 0.18)}" y2="${toSvgY(-0.25)}" stroke="${pal.groundHatch}" stroke-width="0.02"/>\n`;
        }
        svg += `</g>\n\n`;

        // 9. Silueta de figura humana
        if (showHuman) {
            svg += `<g id="layer-human" opacity="0.85">\n`;
            const hx = totalWidth / 2.0 + 1.25;
            svg += `  <circle cx="${toSvgX(hx)}" cy="${toSvgY(1.65)}" r="0.10" fill="${pal.humanFill}"/>\n`;
            svg += `  <path d="M ${toSvgX(hx - 0.16)} ${toSvgY(1.52)} L ${toSvgX(hx + 0.16)} ${toSvgY(1.52)} L ${toSvgX(hx + 0.14)} ${toSvgY(0.95)} L ${toSvgX(hx - 0.14)} ${toSvgY(0.95)} Z" fill="${pal.humanFill}"/>\n`;
            svg += `  <path d="M ${toSvgX(hx - 0.13)} ${toSvgY(0.95)} L ${toSvgX(hx - 0.08)} ${toSvgY(0.0)} L ${toSvgX(hx - 0.02)} ${toSvgY(0.0)} L ${toSvgX(hx - 0.03)} ${toSvgY(0.95)} Z" fill="${pal.humanFill}"/>\n`;
            svg += `  <path d="M ${toSvgX(hx + 0.03)} ${toSvgY(0.95)} L ${toSvgX(hx + 0.02)} ${toSvgY(0.0)} L ${toSvgX(hx + 0.08)} ${toSvgY(0.0)} L ${toSvgX(hx + 0.13)} ${toSvgY(0.95)} Z" fill="${pal.humanFill}"/>\n`;
            svg += `  <path d="M ${toSvgX(hx + 0.16)} ${toSvgY(1.50)} L ${toSvgX(hx + 0.20)} ${toSvgY(1.05)} L ${toSvgX(hx + 0.17)} ${toSvgY(0.90)} L ${toSvgX(hx + 0.13)} ${toSvgY(1.05)} Z" fill="${pal.humanFill}"/>\n`;
            svg += `</g>\n\n`;
        }

        // 10. Cotas arquitectónicas (reproducción exacta del plano CAD)
        if (showDimensions) {
            svg += `<g id="layer-dimensions">\n`;

            const drawDot = (x, y) => {
                return `  <circle cx="${toSvgX(x)}" cy="${toSvgY(y)}" r="0.040" fill="${pal.dimTick}" stroke="${pal.bg}" stroke-width="0.012"/>\n`;
            };

            const drawLeader = (xStart, yStart, xElbow, yElbow, xEnd, text) => {
                let lStr = '';
                lStr += `  <polyline points="${toSvgX(xStart)},${toSvgY(yStart)} ${toSvgX(xElbow)},${toSvgY(yElbow)} ${toSvgX(xEnd)},${toSvgY(yElbow)}" class="dim-line"/>\n`;
                lStr += drawDot(xStart, yStart);
                const midX = (xElbow + xEnd) / 2.0;
                const textY = yElbow + 0.09;
                const badgeY = toSvgY(textY);
                const baseShift = +(dimFontSize * 0.33).toFixed(3);
                const textSvgY = +(badgeY + baseShift).toFixed(3);

                if (showDimBadges) {
                    const textLen = String(text).length;
                    const bW = Math.max(0.42, +(textLen * dimFontSize * 0.62 + 0.14).toFixed(3));
                    const bH = +(dimFontSize * 1.40).toFixed(3);
                    lStr += `  <rect x="${toSvgX(midX) - bW / 2.0}" y="${badgeY - bH / 2.0}" width="${bW}" height="${bH}" rx="0.03" class="dim-badge"/>\n`;
                }
                lStr += `  <text x="${toSvgX(midX)}" y="${textSvgY}" text-anchor="middle" class="dim-text">${text}</text>\n`;
                return lStr;
            };

            // Helper específico para directrices de radios arquitectónicos (R1.38, R1.62, R2.20, R2.44, etc.)
            const drawRadiusLeader = (targetX, targetY, angleDeg, leaderLen, text, isGold = true, shelfDirection = -1) => {
                const rad = angleDeg * Math.PI / 180.0;
                const endX = +(targetX + Math.cos(rad) * leaderLen).toFixed(3);
                const endY = +(targetY + Math.sin(rad) * leaderLen).toFixed(3);
                const shelfLen = 0.42;
                const shelfEndX = +(endX + shelfDirection * shelfLen).toFixed(3);
                const midX = (endX + shelfEndX) / 2.0;
                const textY = endY + 0.09;
                const badgeY = toSvgY(textY);
                const baseShift = +(dimFontSize * 0.33).toFixed(3);
                const textSvgY = +(badgeY + baseShift).toFixed(3);

                const lineCls = isGold ? 'dim-gold-line' : 'dim-line';
                const textCls = isGold ? 'dim-gold-text' : 'dim-text';
                const tickFill = isGold ? '#facc15' : pal.dimTick;

                let rStr = '';
                rStr += `  <!-- Radio ${text} -->\n`;
                rStr += `  <polyline points="${toSvgX(targetX)},${toSvgY(targetY)} ${toSvgX(endX)},${toSvgY(endY)} ${toSvgX(shelfEndX)},${toSvgY(endY)}" class="${lineCls}"/>\n`;
                rStr += `  <circle cx="${toSvgX(targetX)}" cy="${toSvgY(targetY)}" r="0.038" fill="${tickFill}" stroke="${pal.bg}" stroke-width="0.012"/>\n`;

                if (showDimBadges) {
                    const textLen = String(text).length;
                    const bW = Math.max(0.48, +(textLen * dimFontSize * 0.62 + 0.14).toFixed(3));
                    const bH = +(dimFontSize * 1.40).toFixed(3);
                    rStr += `  <rect x="${toSvgX(midX) - bW / 2.0}" y="${badgeY - bH / 2.0}" width="${bW}" height="${bH}" rx="0.03" class="dim-badge"/>\n`;
                }
                rStr += `  <text x="${toSvgX(midX)}" y="${textSvgY}" text-anchor="middle" class="${textCls}">${text}</text>\n`;
                return rStr;
            };

            const drawHorizDim = (x1, x2, y, text, withDots = true) => {
                let dStr = '';
                const left = Math.min(x1, x2);
                const right = Math.max(x1, x2);
                const mid = (left + right) / 2.0;
                const tickLen = 0.06;

                dStr += `  <line x1="${toSvgX(left)}" y1="${toSvgY(y)}" x2="${toSvgX(right)}" y2="${toSvgY(y)}" class="dim-line"/>\n`;
                dStr += `  <line x1="${toSvgX(left - tickLen)}" y1="${toSvgY(y - tickLen)}" x2="${toSvgX(left + tickLen)}" y2="${toSvgY(y + tickLen)}" class="dim-tick"/>\n`;
                dStr += `  <line x1="${toSvgX(right - tickLen)}" y1="${toSvgY(y - tickLen)}" x2="${toSvgX(right + tickLen)}" y2="${toSvgY(y + tickLen)}" class="dim-tick"/>\n`;
                if (withDots) {
                    dStr += drawDot(left, y);
                    dStr += drawDot(right, y);
                }
                dStr += `  <line x1="${toSvgX(left)}" y1="${toSvgY(y + 0.08)}" x2="${toSvgX(left)}" y2="${toSvgY(y - 0.08)}" class="dim-line" opacity="0.4"/>\n`;
                dStr += `  <line x1="${toSvgX(right)}" y1="${toSvgY(y + 0.08)}" x2="${toSvgX(right)}" y2="${toSvgY(y - 0.08)}" class="dim-line" opacity="0.4"/>\n`;

                const badgeY = toSvgY(y);
                const baseShift = +(dimFontSize * 0.33).toFixed(3);
                const textSvgY = +(badgeY + baseShift).toFixed(3);

                if (showDimBadges) {
                    const textLen = String(text).length;
                    const bW = Math.max(0.42, +(textLen * dimFontSize * 0.62 + 0.14).toFixed(3));
                    const bH = +(dimFontSize * 1.40).toFixed(3);
                    dStr += `  <rect x="${toSvgX(mid) - bW / 2.0}" y="${badgeY - bH / 2.0}" width="${bW}" height="${bH}" rx="0.03" class="dim-badge"/>\n`;
                }
                dStr += `  <text x="${toSvgX(mid)}" y="${textSvgY}" text-anchor="middle" class="dim-text">${text}</text>\n`;
                return dStr;
            };

            const drawVertDim = (x, y1, y2, text, textOffset = 0, withDots = true) => {
                let dStr = '';
                const bot = Math.min(y1, y2);
                const top = Math.max(y1, y2);
                const mid = (bot + top) / 2.0;
                const tickLen = 0.06;

                dStr += `  <line x1="${toSvgX(x)}" y1="${toSvgY(bot)}" x2="${toSvgX(x)}" y2="${toSvgY(top)}" class="dim-line"/>\n`;
                dStr += `  <line x1="${toSvgX(x - tickLen)}" y1="${toSvgY(bot - tickLen)}" x2="${toSvgX(x + tickLen)}" y2="${toSvgY(bot + tickLen)}" class="dim-tick"/>\n`;
                dStr += `  <line x1="${toSvgX(x - tickLen)}" y1="${toSvgY(top - tickLen)}" x2="${toSvgX(x + tickLen)}" y2="${toSvgY(top + tickLen)}" class="dim-tick"/>\n`;
                if (withDots) {
                    dStr += drawDot(x, bot);
                    dStr += drawDot(x, top);
                }
                const svgX = toSvgX(x - textOffset);
                const svgY = toSvgY(mid);
                const baseShift = +(dimFontSize * 0.33).toFixed(3);

                if (showDimBadges) {
                    const textLen = String(text).length;
                    const bW = Math.max(0.42, +(textLen * dimFontSize * 0.62 + 0.14).toFixed(3));
                    const bH = +(dimFontSize * 1.40).toFixed(3);
                    dStr += `  <g transform="translate(${svgX}, ${svgY}) rotate(-90)">\n`;
                    dStr += `    <rect x="${-(bW / 2.0)}" y="${-(bH / 2.0)}" width="${bW}" height="${bH}" rx="0.03" class="dim-badge"/>\n`;
                    dStr += `    <text x="0" y="${baseShift}" text-anchor="middle" class="dim-text-vert">${text}</text>\n`;
                    dStr += `  </g>\n`;
                } else {
                    dStr += `  <g transform="translate(${svgX}, ${svgY}) rotate(-90)">\n`;
                    dStr += `    <text x="0" y="${baseShift}" text-anchor="middle" class="dim-text-vert">${text}</text>\n`;
                    dStr += `  </g>\n`;
                }
                return dStr;
            };

            // =========================================================
            // A) COTAS DE CORONACIÓN Y PILASTRAS (media_1788702054935.png & media_1788701999350.png & media_1788703155893.png)
            // =========================================================
            // 1. Cota vertical 3.62 de la pilastra izquierda (media_1788703155893.png):
            // Acota la longitud completa de la pilastra superior (de base 4.08 a remate 7.70)
            const leftColDimX = -2.18;
            svg += drawVertDim(leftColDimX, C.PILASTER_BOTTOM, C.PILASTER_TOP, '3.62', 0);

            // Líneas testigo horizontales de la pilastra izquierda:
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(leftColDimX - 0.08)}" y2="${toSvgY(C.PILASTER_TOP)}" class="dim-line" opacity="0.4"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_INNER_X)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(leftColDimX - 0.08)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="dim-line" opacity="0.4"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(leftColDimX - 0.08)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="dim-line" opacity="0.4"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_BOTTOM)}" x2="${toSvgX(leftColDimX - 0.08)}" y2="${toSvgY(C.PILASTER_BOTTOM)}" class="dim-line" opacity="0.4"/>\n`;

            // Cadena adyacente de niveles de coronación escalonada (1.20 y 0.20):
            // Tier 1: 1.20 (cornisa 6.30 a muro 7.50) en x = -2.55
            const leftCrownDimX1 = -2.55;
            svg += drawVertDim(leftCrownDimX1, C.WING_CORNICE_TOP, C.CENTRAL_WALL_TOP, '1.20', 0);
            svg += `  <line x1="${toSvgX(leftColDimX)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(leftCrownDimX1 - 0.08)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="dim-line" opacity="0.3"/>\n`;
            svg += `  <line x1="${toSvgX(leftColDimX)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(leftCrownDimX1 - 0.08)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="dim-line" opacity="0.3"/>\n`;

            // Tier 2: 0.20 (muro 7.50 a remate 7.70) en x = -2.90 para evitar solapamiento con 1.20
            const leftCrownDimX2 = -2.90;
            svg += drawVertDim(leftCrownDimX2, C.CENTRAL_WALL_TOP, C.PILASTER_TOP, '0.20', 0);
            svg += `  <line x1="${toSvgX(leftCrownDimX1)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(leftCrownDimX2 - 0.08)}" y2="${toSvgY(C.PILASTER_TOP)}" class="dim-line" opacity="0.3"/>\n`;
            svg += `  <line x1="${toSvgX(leftCrownDimX1)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(leftCrownDimX2 - 0.08)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="dim-line" opacity="0.3"/>\n`;

            // 2. Cota vertical derecha (x = +2.24): Altura de pilastra sobre cornisa (1.40)
            // Exactamente como en plano: 6.30 a 7.70 = 1.40 m
            const rightColDimX = 2.24;
            svg += drawVertDim(rightColDimX, C.WING_CORNICE_TOP, C.PILASTER_TOP, '1.40', 0);
            svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(rightColDimX + 0.08)}" y2="${toSvgY(C.PILASTER_TOP)}" class="dim-line" opacity="0.4"/>\n`;
            svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(rightColDimX + 0.08)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="dim-line" opacity="0.4"/>\n`;

            // 3. Cadena horizontal inferior de coronación (y = 7.85 m):
            // Acotación de 1.70 y 1.70 desde el eje central a las caras interiores de las pilastras
            const innerDimY = 7.85;
            const innerLeftX = -1.70;
            const innerRightX = 1.70;
            svg += drawHorizDim(innerLeftX, 0, innerDimY, '1.70');
            svg += drawHorizDim(0, innerRightX, innerDimY, '1.70');

            // Líneas guía verticales para 1.70 y 1.70:
            svg += `  <line x1="${toSvgX(innerLeftX)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(innerLeftX)}" y2="${toSvgY(innerDimY + 0.08)}" class="dim-line" opacity="0.4"/>\n`;
            svg += `  <line x1="${toSvgX(innerRightX)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(innerRightX)}" y2="${toSvgY(innerDimY + 0.08)}" class="dim-line" opacity="0.4"/>\n`;

            // 4. Cadena horizontal superior de coronación (y = 8.35 m):
            // - Tramo izquierdo: del borde del ala a la pilastra izquierda (3.29 a 10.50m)
            // - Directriz pilastra izquierda: 0.28
            // - Tramo central: 3.40 entre pilastras
            // - Directriz pilastra derecha: 0.33
            // - Tramo derecho: de la pilastra derecha al borde del ala (3.29 a 10.50m)
            const topDimY = 8.35;
            const wingToColSpan = +(halfTotal - C.PILASTER_OUTER_X).toFixed(2);

            // Tramo ala izquierda (3.29 a 10.50m)
            svg += drawHorizDim(-halfTotal, -C.PILASTER_OUTER_X, topDimY, `${wingToColSpan.toFixed(2)}`);

            // Tramo pilastra izquierda (ancho exacto 0.26 m, según media_1788705305377.png)
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(topDimY)}" x2="${toSvgX(-C.PILASTER_INNER_X)}" y2="${toSvgY(topDimY)}" class="dim-line"/>\n`;
            svg += drawDot(-C.PILASTER_OUTER_X, topDimY);
            svg += drawDot(-C.PILASTER_INNER_X, topDimY);
            svg += drawLeader(-((C.PILASTER_OUTER_X + C.PILASTER_INNER_X) / 2.0), topDimY, -1.60, topDimY + 0.35, -1.20, '0.26');

            // Tramo central entre pilastras (3.40)
            svg += drawHorizDim(-C.PILASTER_INNER_X, C.PILASTER_INNER_X, topDimY, '3.40');

            // Tramo pilastra derecha (ancho exacto 0.26 m, según media_1788705305377.png)
            svg += `  <line x1="${toSvgX(C.PILASTER_INNER_X)}" y1="${toSvgY(topDimY)}" x2="${toSvgX(C.PILASTER_OUTER_X)}" y2="${toSvgY(topDimY)}" class="dim-line"/>\n`;
            svg += drawDot(C.PILASTER_INNER_X, topDimY);
            svg += drawDot(C.PILASTER_OUTER_X, topDimY);
            svg += drawLeader((C.PILASTER_INNER_X + C.PILASTER_OUTER_X) / 2.0, topDimY, 1.62, topDimY + 0.35, 2.05, '0.26');

            // Tramo ala derecha (3.29 a 10.50m)
            svg += drawHorizDim(C.PILASTER_OUTER_X, halfTotal, topDimY, `${wingToColSpan.toFixed(2)}`);

            // Líneas guía verticales que descienden desde la cadena superior (y = 8.35):
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(-halfTotal)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35" stroke-dasharray="0.1 0.1"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_INNER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(-C.PILASTER_INNER_X)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(C.PILASTER_INNER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(C.PILASTER_INNER_X)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(C.PILASTER_OUTER_X)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(topDimY + 0.12)}" class="dim-line" opacity="0.35" stroke-dasharray="0.1 0.1"/>\n`;

            // =========================================================
            // B) COTAS DE VENTANA Y FACHADA (Dinámicas, simétricas y fieles a CAD)
            // =========================================================
            const winHalfOuter = layout.windowTotalWidth / 2.0;
            const dimSillY = C.WINDOW_SILL_Y;

            // Cotas de ala a y = 5.75m en paño izquierdo y derecho (3.29m a L=10.50m)
            const wingDimY = 5.75;
            // Ala izquierda
            svg += drawHorizDim(-halfTotal, -C.PILASTER_OUTER_X, wingDimY, `${layout.wingSpan.toFixed(2)}`);
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(-halfTotal)}" y2="${toSvgY(wingDimY + 0.10)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(-C.PILASTER_OUTER_X)}" y2="${toSvgY(wingDimY + 0.10)}" class="dim-line" opacity="0.35"/>\n`;
            // Ala derecha
            svg += drawHorizDim(C.PILASTER_OUTER_X, halfTotal, wingDimY, `${layout.wingSpan.toFixed(2)}`);
            svg += `  <line x1="${toSvgX(C.PILASTER_OUTER_X)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(C.PILASTER_OUTER_X)}" y2="${toSvgY(wingDimY + 0.10)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(wingDimY + 0.10)}" class="dim-line" opacity="0.35"/>\n`;

            // Cotas de ventana izquierda (Fiel a media_1788703046143.png: 1.60 ancho vano inferior, 1.90 alto lateral)
            if (layout.windowPositionsLeft.length > 0) {
                const wLeftRef = layout.windowPositionsLeft[layout.windowPositionsLeft.length - 1];
                const wLeftOuterM = +(wLeftRef - winHalfOuter).toFixed(3);

                // Cota 1.90: vertical en el costado exterior de la ventana izquierda (sin colisión con márgenes de ala)
                const dimWinVertX = +(wLeftOuterM - 0.22).toFixed(3);
                svg += drawVertDim(dimWinVertX, C.WINDOW_SILL_Y, C.WINDOW_SPRING_Y, '1.90', 0);
                svg += `  <line x1="${toSvgX(wLeftOuterM)}" y1="${toSvgY(C.WINDOW_SPRING_Y)}" x2="${toSvgX(dimWinVertX - 0.08)}" y2="${toSvgY(C.WINDOW_SPRING_Y)}" class="dim-line" opacity="0.35"/>\n`;
                svg += `  <line x1="${toSvgX(wLeftOuterM)}" y1="${toSvgY(C.WINDOW_SILL_Y)}" x2="${toSvgX(dimWinVertX - 0.08)}" y2="${toSvgY(C.WINDOW_SILL_Y)}" class="dim-line" opacity="0.35"/>\n`;

                // Cota 1.60: ancho de vano inferior de la ventana izquierda
                svg += drawHorizDim(wLeftRef - C.WINDOW_WIDTH / 2.0, wLeftRef + C.WINDOW_WIDTH / 2.0, dimSillY - 0.35, '1.60');
            }

            // Cotas de distribución y márgenes en el paño derecho (Simetría rigurosa)
            if (layout.windowPositionsRight.length > 0) {
                const lastWinCenter = layout.windowPositionsRight[layout.windowPositionsRight.length - 1];
                const firstWinCenter = layout.windowPositionsRight[0];
                const winOuterMouldingX = +(lastWinCenter + winHalfOuter).toFixed(3);
                const winInnerMouldingX = +(firstWinCenter - winHalfOuter).toFixed(3);

                // Cota dinámica de margen exterior (del muro exterior al borde de moldura)
                const extMarginVal = +(halfTotal - winOuterMouldingX).toFixed(2);
                svg += drawHorizDim(winOuterMouldingX, halfTotal, dimSillY, `${extMarginVal.toFixed(2)}`);

                // Cota dinámica de margen interior (de la moldura a la pilastra 1.96m)
                const intMarginVal = +(winInnerMouldingX - C.PILASTER_OUTER_X).toFixed(2);
                svg += drawHorizDim(C.PILASTER_OUTER_X, winInnerMouldingX, dimSillY, `${intMarginVal.toFixed(2)}`);

                // Si hay múltiples ventanas, cotas de separación dinámicas entre molduras
                for (let i = 0; i < layout.windowPositionsRight.length - 1; i++) {
                    const c1 = layout.windowPositionsRight[i];
                    const c2 = layout.windowPositionsRight[i + 1];
                    const gapStart = +(c1 + winHalfOuter).toFixed(3);
                    const gapEnd = +(c2 - winHalfOuter).toFixed(3);
                    const gapSize = +(gapEnd - gapStart).toFixed(2);
                    svg += drawHorizDim(gapStart, gapEnd, dimSillY, `${gapSize.toFixed(2)}`);
                }

                // Cota 1.60: ancho vano inferior en ventana derecha
                svg += drawHorizDim(lastWinCenter - C.WINDOW_WIDTH / 2.0, lastWinCenter + C.WINDOW_WIDTH / 2.0, dimSillY - 0.35, '1.60');
            }

            // Cotas verticales derecha de moldura (5.05m) y cornisa (1.05m y 0.20m escalonadas):
            const rightDimX = halfTotal + 0.55;
            svg += drawVertDim(rightDimX, 0, C.WING_MOULDING_Y, '5.05', 0);
            svg += drawVertDim(rightDimX, C.WING_MOULDING_Y, C.WING_CORNICE_BOT, '1.05', 0);
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(rightDimX + 0.08)}" y2="${toSvgY(0)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(C.WING_MOULDING_Y)}" x2="${toSvgX(rightDimX + 0.08)}" y2="${toSvgY(C.WING_MOULDING_Y)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(C.WING_CORNICE_BOT)}" x2="${toSvgX(rightDimX + 0.08)}" y2="${toSvgY(C.WING_CORNICE_BOT)}" class="dim-line" opacity="0.35"/>\n`;

            // Cota 0.20 de cornisa en tier exterior (x = halfTotal + 0.95) para cero solapamiento con 1.05m:
            const rightCorniceDimX2 = halfTotal + 0.95;
            svg += drawVertDim(rightCorniceDimX2, C.WING_CORNICE_BOT, C.WING_CORNICE_TOP, '0.20', 0);
            svg += `  <line x1="${toSvgX(rightDimX)}" y1="${toSvgY(C.WING_CORNICE_BOT)}" x2="${toSvgX(rightCorniceDimX2 + 0.08)}" y2="${toSvgY(C.WING_CORNICE_BOT)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(rightCorniceDimX2 + 0.08)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="dim-line" opacity="0.35"/>\n`;

            // =========================================================
            // C) COTAS GENERALES INFERIORES
            // =========================================================
            // Cota total general en el nivel más bajo (y = -1.35)
            svg += drawHorizDim(-halfTotal, halfTotal, -1.35, `${totalWidth.toFixed(2)}`);
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(-halfTotal)}" y2="${toSvgY(-1.45)}" class="dim-line" stroke-dasharray="0.1 0.1"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(-1.45)}" class="dim-line" stroke-dasharray="0.1 0.1"/>\n`;

            // Cota tripartita a y = -0.75 (Ala Izq | Portal 2.92 | Ala Der):
            const portalWingW = +(halfTotal - C.PORTAL_WIDTH / 2.0).toFixed(2);
            svg += drawHorizDim(-halfTotal, -C.PORTAL_WIDTH / 2.0, -0.75, `${portalWingW.toFixed(2)}`);
            svg += drawHorizDim(-C.PORTAL_WIDTH / 2.0, C.PORTAL_WIDTH / 2.0, -0.75, `${C.PORTAL_WIDTH.toFixed(2)}`);
            svg += drawHorizDim(C.PORTAL_WIDTH / 2.0, halfTotal, -0.75, `${portalWingW.toFixed(2)}`);
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(-halfTotal)}" y2="${toSvgY(-0.85)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(-C.PORTAL_WIDTH / 2.0)}" y1="${toSvgY(0)}" x2="${toSvgX(-C.PORTAL_WIDTH / 2.0)}" y2="${toSvgY(-0.85)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(C.PORTAL_WIDTH / 2.0)}" y1="${toSvgY(0)}" x2="${toSvgX(C.PORTAL_WIDTH / 2.0)}" y2="${toSvgY(-0.85)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(halfTotal)}" y2="${toSvgY(-0.85)}" class="dim-line" opacity="0.35"/>\n`;

            // Cota vano puerta central (2.40):
            svg += drawHorizDim(-doorHalfW, doorHalfW, 3.25, `${C.DOOR_OPENING.toFixed(2)}`);
            svg += `  <line x1="${toSvgX(-doorHalfW)}" y1="${toSvgY(C.DOOR_HEIGHT)}" x2="${toSvgX(-doorHalfW)}" y2="${toSvgY(3.35)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(doorHalfW)}" y1="${toSvgY(C.DOOR_HEIGHT)}" x2="${toSvgX(doorHalfW)}" y2="${toSvgY(3.35)}" class="dim-line" opacity="0.35"/>\n`;

            // =========================================================
            // D) COTAS VERTICALES GENERALES EN CASCADA EXTERIOR IZQUIERDA
            // Dispuestas progresivamente hacia la izquierda para legibilidad absoluta:
            // =========================================================
            const leftDim1 = -halfTotal - 0.55; // Nivel arranque arcos (+3.00)
            const leftDim2 = -halfTotal - 1.15; // Nivel cornisa (+6.30)
            const leftDim3 = -halfTotal - 1.75; // Nivel muro central (+7.50)
            const leftDim4 = -halfTotal - 2.35; // Nivel remate pilastra (+7.70)

            svg += drawVertDim(leftDim1, 0, C.WINDOW_SPRING_Y, '3.00', 0);
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(0)}" x2="${toSvgX(leftDim1 - 0.08)}" y2="${toSvgY(0)}" class="dim-line" opacity="0.35"/>\n`;
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WINDOW_SPRING_Y)}" x2="${toSvgX(leftDim1 - 0.08)}" y2="${toSvgY(C.WINDOW_SPRING_Y)}" class="dim-line" opacity="0.35"/>\n`;

            svg += drawVertDim(leftDim2, 0, C.WING_CORNICE_TOP, '6.30', 0);
            svg += `  <line x1="${toSvgX(-halfTotal)}" y1="${toSvgY(C.WING_CORNICE_TOP)}" x2="${toSvgX(leftDim2 - 0.08)}" y2="${toSvgY(C.WING_CORNICE_TOP)}" class="dim-line" opacity="0.35"/>\n`;

            svg += drawVertDim(leftDim3, 0, C.CENTRAL_WALL_TOP, '7.50', 0);
            svg += `  <line x1="${toSvgX(-C.PILASTER_INNER_X)}" y1="${toSvgY(C.CENTRAL_WALL_TOP)}" x2="${toSvgX(leftDim3 - 0.08)}" y2="${toSvgY(C.CENTRAL_WALL_TOP)}" class="dim-line" opacity="0.35"/>\n`;

            svg += drawVertDim(leftDim4, 0, C.PILASTER_TOP, '7.70', 0);
            svg += `  <line x1="${toSvgX(-C.PILASTER_OUTER_X)}" y1="${toSvgY(C.PILASTER_TOP)}" x2="${toSvgX(leftDim4 - 0.08)}" y2="${toSvgY(C.PILASTER_TOP)}" class="dim-line" opacity="0.35"/>\n`;

            // =========================================================
            // E) DIRECTRICES DE RADIOS (R1.38, R1.62, R2.20, R2.44, R0.14)
            // =========================================================
            svg += `  <g id="radius-labels" opacity="0.96">\n`;
            // Radios de la puerta central: ubicados en el cuadrante derecho del arco para equilibrar el plano y no colisionar con la columna izquierda
            svg += drawRadiusLeader(0.68, 4.12, 35, 0.48, 'R2.20', false, 1);
            svg += drawRadiusLeader(0.82, 4.42, 35, 0.62, 'R2.44', false, 1);

            // Radios de la ventana izquierda (con directrices paralelas y limpias según media_1788705439561.png)
            if (layout.windowPositionsLeft.length > 0) {
                const wLeftRef = layout.windowPositionsLeft[layout.windowPositionsLeft.length - 1];
                const geomIn = this.getPointedArchGeometry(wLeftRef, C.WINDOW_WIDTH, C.WINDOW_SPRING_Y, C.WINDOW_ARCH_R_IN);
                const geomOut = this.getPointedArchGeometry(wLeftRef, C.WINDOW_WIDTH + C.WINDOW_MOULDING_THICK * 2.0, C.WINDOW_SPRING_Y, C.WINDOW_ARCH_R_OUT);

                // Directriz R1.62: parte alta de la archivolta exterior (cerca de clave), sube a 135° despejada arriba
                const rad162 = 126 * Math.PI / 180;
                const r162TargetX = +(geomOut.c1X + 1.62 * Math.cos(rad162)).toFixed(3);
                const r162TargetY = +(C.WINDOW_SPRING_Y + 1.62 * Math.sin(rad162)).toFixed(3);
                svg += drawRadiusLeader(r162TargetX, r162TargetY, 135, 0.40, 'R1.62', true, -1);

                // Directriz R1.38: parte media-baja del vano interior, sube a 135° paralela por debajo de R1.62
                const rad138 = 146 * Math.PI / 180;
                const r138TargetX = +(geomIn.c1X + 1.38 * Math.cos(rad138)).toFixed(3);
                const r138TargetY = +(C.WINDOW_SPRING_Y + 1.38 * Math.sin(rad138)).toFixed(3);
                svg += drawRadiusLeader(r138TargetX, r138TargetY, 135, 0.40, 'R1.38', true, -1);
            }

            // Radio de cornisa R0.14
            const r014TargetX = -halfTotal - C.WING_CORNICE_R;
            const r014TargetY = C.WING_CORNICE_BOT + 0.10;
            svg += drawRadiusLeader(r014TargetX, r014TargetY, 130, 0.45, 'R0.14', false, -1);
            svg += `  </g>\n`;

            svg += `</g>\n\n`;
        }

        // 11. Niveles arquitectónicos oficiales (N.P.T., N.A.V., N.I.V., etc.)
        // Posicionados en x = halfTotal + 1.70 para evitar colisiones con las cotas verticales
        if (showLevels) {
            svg += `<g id="layer-levels" opacity="0.95">\n`;
            const lvlX = halfTotal + 1.70;
            const levels = [
                { y: 0.00, label: 'N.P.T.', val: '±0.00' },
                { y: C.WINDOW_SILL_Y, label: 'N.A.V.', val: `+${C.WINDOW_SILL_Y.toFixed(2)}` },
                { y: C.WINDOW_SPRING_Y, label: 'N.I.V.', val: `+${C.WINDOW_SPRING_Y.toFixed(2)}` },
                { y: C.WING_MOULDING_Y, label: 'N.M.C.', val: `+${C.WING_MOULDING_Y.toFixed(2)}` },
                { y: C.WING_CORNICE_TOP, label: 'N.C.A.', val: `+${C.WING_CORNICE_TOP.toFixed(2)}` },
                { y: C.CENTRAL_WALL_TOP, label: 'N.C.M.', val: `+${C.CENTRAL_WALL_TOP.toFixed(2)}` },
                { y: C.PILASTER_TOP, label: 'N.R.P.', val: `+${C.PILASTER_TOP.toFixed(2)}` }
            ];
            levels.forEach(lvl => {
                const arrowW = 0.20;
                const arrowH = 0.14;
                svg += `  <!-- Nivel ${lvl.label} ${lvl.val} -->\n`;
                svg += `  <line x1="${toSvgX(halfTotal + 0.15)}" y1="${toSvgY(lvl.y)}" x2="${toSvgX(lvlX + 1.65)}" y2="${toSvgY(lvl.y)}" class="level-line"/>\n`;
                svg += `  <polygon points="${toSvgX(lvlX)},${toSvgY(lvl.y)} ${toSvgX(lvlX + arrowW)},${toSvgY(lvl.y + arrowH)} ${toSvgX(lvlX + arrowW * 2)},${toSvgY(lvl.y + arrowH)}" fill="${pal.levelStroke}"/>\n`;
                svg += `  <text x="${toSvgX(lvlX + arrowW * 2 + 0.10)}" y="${toSvgY(lvl.y + 0.06)}" class="level-text">${lvl.label} ${lvl.val}</text>\n`;
            });
            svg += `</g>\n\n`;
        }

        svg += `</svg>`;
        return {
            svg,
            layout,
            worldBounds: { minX, maxX, minY, maxY, worldWidth, worldHeight }
        };
    }

    /**
     * Generador de archivo AutoCAD DXF (R12 / AC1009 ASCII).
     * Replica exactamente los muros, pilastras, molduras y cotas en capas AutoCAD.
     */
    generateDXF(options = {}) {
        options = this.normalizeOptions(options);
        const {
            totalWidth = this.CONSTANTS.DEFAULT_TOTAL_WIDTH,
            minFreeSpace = 1.50,
            distributionMode = 'auto',
            manualCount = 1,
            titleLine1 = 'ASAMBLEA',
            titleLine2 = 'CRISTIANA',
            titleFontSize = 0.20
        } = options;

        const layout = this.calculateLayout(totalWidth, minFreeSpace, distributionMode, manualCount);
        const C = this.CONSTANTS;
        const halfTotal = totalWidth / 2.0;
        const winHalfOuter = layout.windowTotalWidth / 2.0;

        let dxf = '';
        dxf += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';
        dxf += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n5\n';
        dxf += '0\nLAYER\n2\nMUROS\n70\n0\n62\n2\n6\nCONTINUOUS\n';
        dxf += '0\nLAYER\n2\nCARPINTERIAS\n70\n0\n62\n7\n6\nCONTINUOUS\n';
        dxf += '0\nLAYER\n2\nARCOS\n70\n0\n62\n2\n6\nCONTINUOUS\n';
        dxf += '0\nLAYER\n2\nCOTAS\n70\n0\n62\n4\n6\nCONTINUOUS\n';
        dxf += '0\nLAYER\n2\nTEXTOS\n70\n0\n62\n1\n6\nCONTINUOUS\n';
        dxf += '0\nENDTAB\n0\nENDSEC\n';
        dxf += '0\nSECTION\n2\nENTITIES\n';

        const dxfLine = (x1, y1, x2, y2, layer = 'MUROS') => {
            if (layer === 'COTAS' && options.showDimensions === false) return '';
            return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0.0\n11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0.0\n`;
        };

        const dxfText = (x, y, height, text, layer = 'TEXTOS', rot = 0) => {
            if (layer === 'COTAS' && options.showDimensions === false) return '';
            text = String(text).replace(/[\r\n\x00]/g, ' ');
            return `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n40\n${height.toFixed(4)}\n1\n${text}\n50\n${rot.toFixed(1)}\n`;
        };

        const dxfArc = (xc, yc, r, startAngleDeg, endAngleDeg, layer = 'ARCOS') => {
            return `0\nARC\n8\n${layer}\n10\n${xc.toFixed(4)}\n20\n${yc.toFixed(4)}\n30\n0.0\n40\n${r.toFixed(4)}\n50\n${startAngleDeg.toFixed(2)}\n51\n${endAngleDeg.toFixed(2)}\n`;
        };

        // 1. Suelo
        dxf += dxfLine(-halfTotal - 1.5, 0, halfTotal + 1.5, 0, 'MUROS');

        // 2. Muros
        // Ala izquierda
        dxf += dxfLine(-halfTotal, 0, -halfTotal, C.WING_CORNICE_BOT, 'MUROS');
        dxf += dxfLine(-halfTotal, C.WING_CORNICE_BOT, -halfTotal - C.WING_CORNICE_R, C.WING_CORNICE_TOP, 'MUROS');
        dxf += dxfLine(-halfTotal - C.WING_CORNICE_R, C.WING_CORNICE_TOP, -C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, 'MUROS');
        dxf += dxfLine(-halfTotal, C.WING_CORNICE_BOT, -C.PILASTER_OUTER_X, C.WING_CORNICE_BOT, 'MUROS');
        dxf += dxfLine(-halfTotal, C.WING_MOULDING_Y, -C.PILASTER_OUTER_X, C.WING_MOULDING_Y, 'MUROS');

        // Ala derecha
        dxf += dxfLine(C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, halfTotal + C.WING_CORNICE_R, C.WING_CORNICE_TOP, 'MUROS');
        dxf += dxfLine(halfTotal + C.WING_CORNICE_R, C.WING_CORNICE_TOP, halfTotal, C.WING_CORNICE_BOT, 'MUROS');
        dxf += dxfLine(halfTotal, C.WING_CORNICE_BOT, halfTotal, 0, 'MUROS');
        dxf += dxfLine(C.PILASTER_OUTER_X, C.WING_CORNICE_BOT, halfTotal, C.WING_CORNICE_BOT, 'MUROS');
        dxf += dxfLine(C.PILASTER_OUTER_X, C.WING_MOULDING_Y, halfTotal, C.WING_MOULDING_Y, 'MUROS');

        // Muro central
        dxf += dxfLine(-C.PILASTER_INNER_X, C.WING_CORNICE_TOP, -C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, 'MUROS');
        dxf += dxfLine(-C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, 'MUROS');
        dxf += dxfLine(C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, C.PILASTER_INNER_X, C.WING_CORNICE_TOP, 'MUROS');

        // 3. Pilastras exactas (ancho 0.26, 4 estrías internas)
        const colW = C.PILASTER_WIDTH; // 0.26
        [-1, 1].forEach(side => {
            const x1 = side > 0 ? C.PILASTER_INNER_X : -C.PILASTER_OUTER_X;
            const x2 = side > 0 ? C.PILASTER_OUTER_X : -C.PILASTER_INNER_X;
            dxf += dxfLine(x1, C.PILASTER_BOTTOM, x1, C.PILASTER_TOP, 'MUROS');
            dxf += dxfLine(x2, C.PILASTER_BOTTOM, x2, C.PILASTER_TOP, 'MUROS');
            dxf += dxfLine(x1, C.PILASTER_TOP, x2, C.PILASTER_TOP, 'MUROS');
            dxf += dxfLine(x1, C.PILASTER_BOTTOM, x2, C.PILASTER_BOTTOM, 'MUROS');
            for (let f = 1; f <= 4; f++) {
                const fx = x1 + f * (colW / 5.0);
                dxf += dxfLine(fx, C.PILASTER_BOTTOM, fx, C.PILASTER_TOP, 'MUROS');
            }
        });

        // 4. Puerta central y arcos
        const doorHalfW = C.DOOR_OPENING / 2.0;
        dxf += dxfLine(-doorHalfW, 0, -doorHalfW, C.DOOR_HEIGHT, 'CARPINTERIAS');
        dxf += dxfLine(doorHalfW, 0, doorHalfW, C.DOOR_HEIGHT, 'CARPINTERIAS');
        dxf += dxfLine(-doorHalfW, C.DOOR_HEIGHT, doorHalfW, C.DOOR_HEIGHT, 'CARPINTERIAS');
        dxf += dxfLine(0, 0, 0, C.DOOR_HEIGHT, 'CARPINTERIAS');

        [2.20, 2.28, 2.36, 2.44].forEach(r => {
            const spanR = C.DOOR_OPENING + (r - C.DOOR_ARCH_R_IN) * 2.0;
            const arch = this.getPointedArchGeometry(0, spanR, C.DOOR_HEIGHT, r);
            const angStart1 = Math.atan2(0, (-spanR / 2) - arch.c1X) * (180 / Math.PI);
            const angApex1 = Math.atan2(arch.apexY - C.DOOR_HEIGHT, 0 - arch.c1X) * (180 / Math.PI);
            dxf += dxfArc(arch.c1X, C.DOOR_HEIGHT, r, (angApex1 + 360) % 360, (angStart1 + 360) % 360, 'ARCOS');

            const angApex2 = Math.atan2(arch.apexY - C.DOOR_HEIGHT, 0 - arch.c2X) * (180 / Math.PI);
            const angEnd2 = Math.atan2(0, (spanR / 2) - arch.c2X) * (180 / Math.PI);
            dxf += dxfArc(arch.c2X, C.DOOR_HEIGHT, r, (angEnd2 + 360) % 360, (angApex2 + 360) % 360, 'ARCOS');

            dxf += dxfLine(-spanR / 2, 0, -spanR / 2, C.DOOR_HEIGHT, 'MUROS');
            dxf += dxfLine(spanR / 2, 0, spanR / 2, C.DOOR_HEIGHT, 'MUROS');
        });

        // 5. Ventanas (Formato exacto de 2 hojas rectangulares según media_1788703046143.png)
        const winW = C.WINDOW_WIDTH;
        const winHRect = C.WINDOW_RECT_HEIGHT;
        layout.allWindowCenters.forEach(cx => {
            const wL = cx - winW / 2.0;
            const wR = cx + winW / 2.0;
            // Vano rectangular
            dxf += dxfLine(wL, C.WINDOW_SILL_Y, wL, C.WINDOW_SPRING_Y, 'CARPINTERIAS');
            dxf += dxfLine(wR, C.WINDOW_SILL_Y, wR, C.WINDOW_SPRING_Y, 'CARPINTERIAS');
            dxf += dxfLine(wL, C.WINDOW_SILL_Y, wR, C.WINDOW_SILL_Y, 'CARPINTERIAS');
            dxf += dxfLine(wL, C.WINDOW_SPRING_Y, wR, C.WINDOW_SPRING_Y, 'CARPINTERIAS');
            // Montante central entre hojas
            dxf += dxfLine(cx, C.WINDOW_SILL_Y, cx, C.WINDOW_SPRING_Y, 'CARPINTERIAS');

            // Dos hojas rectangulares con marco perimetral
            const leafMargin = 0.022;
            const frameThick = 0.048;
            const leafW = (winW / 2.0) - leafMargin * 2.0;
            const leafH = winHRect - leafMargin * 2.0;
            // Marco hoja izquierda
            dxf += dxfLine(wL + leafMargin, C.WINDOW_SILL_Y + leafMargin, wL + leafMargin + leafW, C.WINDOW_SILL_Y + leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(wL + leafMargin, C.WINDOW_SPRING_Y - leafMargin, wL + leafMargin + leafW, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(wL + leafMargin, C.WINDOW_SILL_Y + leafMargin, wL + leafMargin, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(wL + leafMargin + leafW, C.WINDOW_SILL_Y + leafMargin, wL + leafMargin + leafW, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');
            // Marco hoja derecha
            dxf += dxfLine(cx + leafMargin, C.WINDOW_SILL_Y + leafMargin, cx + leafMargin + leafW, C.WINDOW_SILL_Y + leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(cx + leafMargin, C.WINDOW_SPRING_Y - leafMargin, cx + leafMargin + leafW, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(cx + leafMargin, C.WINDOW_SILL_Y + leafMargin, cx + leafMargin, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');
            dxf += dxfLine(cx + leafMargin + leafW, C.WINDOW_SILL_Y + leafMargin, cx + leafMargin + leafW, C.WINDOW_SPRING_Y - leafMargin, 'CARPINTERIAS');

            // 4 archivoltas concéntricas (R1.38 a R1.62) que descienden en las jambas
            [1.38, 1.46, 1.54, 1.62].forEach(r => {
                const spanR = winW + (r - C.WINDOW_ARCH_R_IN) * 2.0;
                const aGeom = this.getPointedArchGeometry(cx, spanR, C.WINDOW_SPRING_Y, r);
                const aStart1 = Math.atan2(0, (cx - spanR / 2) - aGeom.c1X) * (180 / Math.PI);
                const aApex1 = Math.atan2(aGeom.apexY - C.WINDOW_SPRING_Y, cx - aGeom.c1X) * (180 / Math.PI);
                dxf += dxfArc(aGeom.c1X, C.WINDOW_SPRING_Y, r, (aApex1 + 360) % 360, (aStart1 + 360) % 360, 'ARCOS');

                const aApex2 = Math.atan2(aGeom.apexY - C.WINDOW_SPRING_Y, cx - aGeom.c2X) * (180 / Math.PI);
                const aEnd2 = Math.atan2(0, (cx + spanR / 2) - aGeom.c2X) * (180 / Math.PI);
                dxf += dxfArc(aGeom.c2X, C.WINDOW_SPRING_Y, r, (aEnd2 + 360) % 360, (aApex2 + 360) % 360, 'ARCOS');

                dxf += dxfLine(cx - spanR / 2, C.WINDOW_SILL_Y, cx - spanR / 2, C.WINDOW_SPRING_Y, 'MUROS');
                dxf += dxfLine(cx + spanR / 2, C.WINDOW_SILL_Y, cx + spanR / 2, C.WINDOW_SPRING_Y, 'MUROS');
            });

            // Línea base recta que cierra las molduras en el antepecho
            const outerSpan = winW + (C.WINDOW_ARCH_R_OUT - C.WINDOW_ARCH_R_IN) * 2.0;
            dxf += dxfLine(cx - outerSpan / 2, C.WINDOW_SILL_Y, cx + outerSpan / 2, C.WINDOW_SILL_Y, 'MUROS');
        });

        // 6. Rótulo: el marco y los centros de texto coinciden con el SVG.
        const { boxW: dBoxW, boxH: dBoxH, boxY: dBoxY, line1Y, line2Y } = this.getTitleGeometry(titleLine1, titleLine2, titleFontSize);
        const centeredTitle = (line, y) => dxfText(0, y, titleFontSize, line, 'TEXTOS')
            + `72\n1\n73\n2\n11\n0.0000\n21\n${y.toFixed(4)}\n31\n0.0\n`;
        dxf += centeredTitle(titleLine1, line1Y);
        dxf += centeredTitle(titleLine2, line2Y);
        dxf += dxfLine(-dBoxW/2, dBoxY, dBoxW/2, dBoxY, 'TEXTOS');
        dxf += dxfLine(dBoxW/2, dBoxY, dBoxW/2, dBoxY - dBoxH, 'TEXTOS');
        dxf += dxfLine(dBoxW/2, dBoxY - dBoxH, -dBoxW/2, dBoxY - dBoxH, 'TEXTOS');
        dxf += dxfLine(-dBoxW/2, dBoxY - dBoxH, -dBoxW/2, dBoxY, 'TEXTOS');

        // 7. Cotas principales (AutoCAD DXF - Capa COTAS)
        const wingSpanDxf = +(halfTotal - C.PILASTER_OUTER_X).toFixed(2);
        const topDimY = 8.35;

        // Cadena superior (y = 8.35):
        // Ala izquierda
        dxf += dxfLine(-halfTotal, topDimY, -C.PILASTER_OUTER_X, topDimY, 'COTAS');
        dxf += dxfText((-halfTotal - C.PILASTER_OUTER_X) / 2.0 - 0.25, topDimY + 0.08, 0.18, `${wingSpanDxf.toFixed(2)}`, 'COTAS');
        // Pilastra izquierda y directriz 0.26
        dxf += dxfLine(-C.PILASTER_OUTER_X, topDimY, -C.PILASTER_INNER_X, topDimY, 'COTAS');
        dxf += dxfLine(-((C.PILASTER_OUTER_X + C.PILASTER_INNER_X) / 2.0), topDimY, -1.60, topDimY + 0.35, 'COTAS');
        dxf += dxfLine(-1.60, topDimY + 0.35, -1.20, topDimY + 0.35, 'COTAS');
        dxf += dxfText(-1.50, topDimY + 0.40, 0.16, '0.26', 'COTAS');
        // Tramo central 3.40
        dxf += dxfLine(-C.PILASTER_INNER_X, topDimY, C.PILASTER_INNER_X, topDimY, 'COTAS');
        dxf += dxfText(-0.25, topDimY + 0.08, 0.18, '3.40', 'COTAS');
        // Pilastra derecha y directriz 0.26
        dxf += dxfLine(C.PILASTER_INNER_X, topDimY, C.PILASTER_OUTER_X, topDimY, 'COTAS');
        dxf += dxfLine((C.PILASTER_INNER_X + C.PILASTER_OUTER_X) / 2.0, topDimY, 1.62, topDimY + 0.35, 'COTAS');
        dxf += dxfLine(1.62, topDimY + 0.35, 2.05, topDimY + 0.35, 'COTAS');
        dxf += dxfText(1.72, topDimY + 0.40, 0.16, '0.26', 'COTAS');
        // Ala derecha
        dxf += dxfLine(C.PILASTER_OUTER_X, topDimY, halfTotal, topDimY, 'COTAS');
        dxf += dxfText((C.PILASTER_OUTER_X + halfTotal) / 2.0 - 0.25, topDimY + 0.08, 0.18, `${wingSpanDxf.toFixed(2)}`, 'COTAS');

        // Líneas guía verticales de la cadena superior
        dxf += dxfLine(-halfTotal, C.WING_CORNICE_TOP, -halfTotal, topDimY + 0.10, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.PILASTER_TOP, -C.PILASTER_OUTER_X, topDimY + 0.10, 'COTAS');
        dxf += dxfLine(-C.PILASTER_INNER_X, C.PILASTER_TOP, -C.PILASTER_INNER_X, topDimY + 0.10, 'COTAS');
        dxf += dxfLine(C.PILASTER_INNER_X, C.PILASTER_TOP, C.PILASTER_INNER_X, topDimY + 0.10, 'COTAS');
        dxf += dxfLine(C.PILASTER_OUTER_X, C.PILASTER_TOP, C.PILASTER_OUTER_X, topDimY + 0.10, 'COTAS');
        dxf += dxfLine(halfTotal, C.WING_CORNICE_TOP, halfTotal, topDimY + 0.10, 'COTAS');

        // Cadena inferior (y = 7.85): 1.70 y 1.70 al eje
        const innerDimY = 7.85;
        dxf += dxfLine(-1.70, innerDimY, 0, innerDimY, 'COTAS');
        dxf += dxfText(-0.95, innerDimY + 0.08, 0.18, '1.70', 'COTAS');
        dxf += dxfLine(0, innerDimY, 1.70, innerDimY, 'COTAS');
        dxf += dxfText(0.75, innerDimY + 0.08, 0.18, '1.70', 'COTAS');
        dxf += dxfLine(-1.70, C.PILASTER_TOP, -1.70, innerDimY + 0.08, 'COTAS');
        dxf += dxfLine(1.70, C.PILASTER_TOP, 1.70, innerDimY + 0.08, 'COTAS');

        // Cotas verticales izquierda escalonadas en 3 niveles (3.62, 1.20, 0.20) sin solapamiento
        const leftColDimX = -2.18;
        dxf += dxfLine(leftColDimX, C.PILASTER_BOTTOM, leftColDimX, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.PILASTER_TOP, leftColDimX - 0.10, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.PILASTER_BOTTOM, leftColDimX - 0.10, C.PILASTER_BOTTOM, 'COTAS');
        dxf += dxfText(leftColDimX - 0.15, (C.PILASTER_BOTTOM + C.PILASTER_TOP) / 2.0 - 0.20, 0.18, '3.62', 'COTAS', 90);

        // Nivel 2: Cota 1.20m de cornisa lateral a muro central
        const leftCrownDimX1 = -2.55;
        dxf += dxfLine(leftCrownDimX1, C.WING_CORNICE_TOP, leftCrownDimX1, C.CENTRAL_WALL_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, leftCrownDimX1 - 0.10, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, leftCrownDimX1 - 0.10, C.CENTRAL_WALL_TOP, 'COTAS');
        dxf += dxfText(leftCrownDimX1 - 0.15, (C.WING_CORNICE_TOP + C.CENTRAL_WALL_TOP) / 2.0 - 0.20, 0.18, '1.20', 'COTAS', 90);

        // Nivel 3: Cota 0.20m de muro central a remate de pilastra
        const leftCrownDimX2 = -2.90;
        dxf += dxfLine(leftCrownDimX2, C.CENTRAL_WALL_TOP, leftCrownDimX2, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, leftCrownDimX2 - 0.10, C.CENTRAL_WALL_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.PILASTER_TOP, leftCrownDimX2 - 0.10, C.PILASTER_TOP, 'COTAS');
        dxf += dxfText(leftCrownDimX2 - 0.15, (C.CENTRAL_WALL_TOP + C.PILASTER_TOP) / 2.0 - 0.10, 0.18, '0.20', 'COTAS', 90);

        // Cota vertical derecha (1.40)
        const rightColDimX = 2.28;
        dxf += dxfLine(rightColDimX, C.WING_CORNICE_TOP, rightColDimX, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(C.PILASTER_OUTER_X, C.PILASTER_TOP, rightColDimX + 0.10, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, rightColDimX + 0.10, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfText(rightColDimX + 0.20, 6.90, 0.18, '1.40', 'COTAS', 90);

        // Ventana derecha y cotas de ala (dinámicas y simétricas)
        if (layout.windowPositionsRight.length > 0) {
            const lastWinC = layout.windowPositionsRight[layout.windowPositionsRight.length - 1];
            const firstWinC = layout.windowPositionsRight[0];
            const winOutM = +(lastWinC + winHalfOuter).toFixed(3);
            const winInM = +(firstWinC - winHalfOuter).toFixed(3);

            // Cota margen exterior dinámico
            const dxfExtMargin = +(halfTotal - winOutM).toFixed(2);
            dxf += dxfLine(winOutM, C.WINDOW_SILL_Y, halfTotal, C.WINDOW_SILL_Y, 'COTAS');
            dxf += dxfText((winOutM + halfTotal) / 2.0 - 0.20, C.WINDOW_SILL_Y + 0.05, 0.18, `${dxfExtMargin.toFixed(2)}`, 'COTAS');

            // Cota margen interior dinámico (a la cara exterior de la pilastra 1.96m, fiel a cota 3.29m de media_1788703759354.png)
            const dxfIntMargin = +(winInM - C.PILASTER_OUTER_X).toFixed(2);
            dxf += dxfLine(C.PILASTER_OUTER_X, C.WINDOW_SILL_Y, winInM, C.WINDOW_SILL_Y, 'COTAS');
            dxf += dxfText((C.PILASTER_OUTER_X + winInM) / 2.0 - 0.20, C.WINDOW_SILL_Y + 0.05, 0.18, `${dxfIntMargin.toFixed(2)}`, 'COTAS');

            // Cota de ala en paño izquierdo a y = 5.75m (fiel a media_1788703759354.png: 3.29m a L=10.50m)
            const dxfWingDimY = 5.75;
            dxf += dxfLine(-halfTotal, dxfWingDimY, -C.PILASTER_OUTER_X, dxfWingDimY, 'COTAS');
            dxf += dxfLine(-halfTotal, C.WING_CORNICE_TOP, -halfTotal, dxfWingDimY + 0.12, 'COTAS');
            dxf += dxfLine(-C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, -C.PILASTER_OUTER_X, dxfWingDimY + 0.12, 'COTAS');
            dxf += dxfText((-halfTotal - C.PILASTER_OUTER_X) / 2.0 - 0.20, dxfWingDimY + 0.08, 0.18, `${wingSpanDxf.toFixed(2)}`, 'COTAS');

            // Cota de ala en paño derecho a y = 5.75m
            dxf += dxfLine(C.PILASTER_OUTER_X, dxfWingDimY, halfTotal, dxfWingDimY, 'COTAS');
            dxf += dxfLine(C.PILASTER_OUTER_X, C.WING_CORNICE_TOP, C.PILASTER_OUTER_X, dxfWingDimY + 0.12, 'COTAS');
            dxf += dxfLine(halfTotal, C.WING_CORNICE_TOP, halfTotal, dxfWingDimY + 0.12, 'COTAS');
            dxf += dxfText((C.PILASTER_OUTER_X + halfTotal) / 2.0 - 0.20, dxfWingDimY + 0.08, 0.18, `${wingSpanDxf.toFixed(2)}`, 'COTAS');

            // Eje vertical de simetría de la ventana que cruza el centro de la cota 3.29m
            dxf += dxfLine(-lastWinC, C.WINDOW_SILL_Y - 0.20, -lastWinC, dxfWingDimY + 0.20, 'COTAS');
            dxf += dxfLine(lastWinC, C.WINDOW_SILL_Y - 0.20, lastWinC, dxfWingDimY + 0.20, 'COTAS');

            // Cotas de separación libre entre ventanas si N >= 2
            for (let i = 0; i < layout.windowPositionsRight.length - 1; i++) {
                const c1 = layout.windowPositionsRight[i];
                const c2 = layout.windowPositionsRight[i + 1];
                const gapStart = +(c1 + winHalfOuter).toFixed(3);
                const gapEnd = +(c2 - winHalfOuter).toFixed(3);
                const gapDxf = +(gapEnd - gapStart).toFixed(2);
                dxf += dxfLine(gapStart, C.WINDOW_SILL_Y, gapEnd, C.WINDOW_SILL_Y, 'COTAS');
                dxf += dxfText((gapStart + gapEnd) / 2.0 - 0.20, C.WINDOW_SILL_Y + 0.05, 0.18, `${gapDxf.toFixed(2)}`, 'COTAS');
            }

            // Cota vertical 1.90m (vano altura interior) - ubicada en la ventana izquierda fiel al plano CAD original (media_1788703046143.png)
            // evitando intersecarse con las cotas horizontales del paño derecho (0.61m)
            if (layout.windowPositionsLeft.length > 0) {
                const wLeftOuterM = +(layout.windowPositionsLeft[0] - winHalfOuter).toFixed(3);
                dxf += dxfLine(wLeftOuterM - 0.22, C.WINDOW_SILL_Y, wLeftOuterM - 0.22, C.WINDOW_SPRING_Y, 'COTAS');
                dxf += dxfLine(wLeftOuterM, C.WINDOW_SILL_Y, wLeftOuterM - 0.27, C.WINDOW_SILL_Y, 'COTAS');
                dxf += dxfLine(wLeftOuterM, C.WINDOW_SPRING_Y, wLeftOuterM - 0.27, C.WINDOW_SPRING_Y, 'COTAS');
                dxf += dxfText(wLeftOuterM - 0.38, 2.00, 0.18, '1.90', 'COTAS', 90);
            }

            // Cota horizontal 1.60m
            dxf += dxfLine(lastWinC - winW / 2.0, C.WINDOW_SILL_Y - 0.30, lastWinC + winW / 2.0, C.WINDOW_SILL_Y - 0.30, 'COTAS');
            dxf += dxfText(lastWinC - 0.20, C.WINDOW_SILL_Y - 0.25, 0.18, '1.60', 'COTAS');
        }

        // Cota horizontal puerta central 2.40m (a y = 3.25m)
        dxf += dxfLine(-doorHalfW, 3.25, doorHalfW, 3.25, 'COTAS');
        dxf += dxfLine(-doorHalfW, C.DOOR_HEIGHT, -doorHalfW, 3.35, 'COTAS');
        dxf += dxfLine(doorHalfW, C.DOOR_HEIGHT, doorHalfW, 3.35, 'COTAS');
        dxf += dxfText(-0.20, 3.32, 0.18, `${C.DOOR_OPENING.toFixed(2)}`, 'COTAS');

        // Cotas verticales generales en cascada exterior izquierda (3.00, 6.30, 7.50, 7.70)
        const leftDim1 = -halfTotal - 0.60;
        const leftDim2 = -halfTotal - 1.25;
        const leftDim3 = -halfTotal - 1.90;
        const leftDim4 = -halfTotal - 2.55;

        // Cota 3.00 (Arranque arcos)
        dxf += dxfLine(leftDim1, 0, leftDim1, C.WINDOW_SPRING_Y, 'COTAS');
        dxf += dxfLine(-halfTotal, 0, leftDim1 - 0.10, 0, 'COTAS');
        dxf += dxfLine(-halfTotal, C.WINDOW_SPRING_Y, leftDim1 - 0.10, C.WINDOW_SPRING_Y, 'COTAS');
        dxf += dxfText(leftDim1 - 0.15, C.WINDOW_SPRING_Y / 2.0 - 0.20, 0.18, '3.00', 'COTAS', 90);

        // Cota 6.30 (Cornisa lateral)
        dxf += dxfLine(leftDim2, 0, leftDim2, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfLine(-halfTotal, C.WING_CORNICE_TOP, leftDim2 - 0.10, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfText(leftDim2 - 0.15, C.WING_CORNICE_TOP / 2.0 - 0.20, 0.18, '6.30', 'COTAS', 90);

        // Cota 7.50 (Muro central)
        dxf += dxfLine(leftDim3, 0, leftDim3, C.CENTRAL_WALL_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_INNER_X, C.CENTRAL_WALL_TOP, leftDim3 - 0.10, C.CENTRAL_WALL_TOP, 'COTAS');
        dxf += dxfText(leftDim3 - 0.15, C.CENTRAL_WALL_TOP / 2.0 - 0.20, 0.18, '7.50', 'COTAS', 90);

        // Cota 7.70 (Remate pilastra)
        dxf += dxfLine(leftDim4, 0, leftDim4, C.PILASTER_TOP, 'COTAS');
        dxf += dxfLine(-C.PILASTER_OUTER_X, C.PILASTER_TOP, leftDim4 - 0.10, C.PILASTER_TOP, 'COTAS');
        dxf += dxfText(leftDim4 - 0.15, C.PILASTER_TOP / 2.0 - 0.20, 0.18, '7.70', 'COTAS', 90);

        // Cotas verticales derecha de cornisa y moldura (escalonadas en 2 niveles para evitar solapamiento entre 1.05 y 0.20)
        const rightDimX = halfTotal + 0.55;
        // 5.05m moldura corrida
        dxf += dxfLine(rightDimX, 0, rightDimX, C.WING_MOULDING_Y, 'COTAS');
        dxf += dxfLine(halfTotal, 0, rightDimX + 0.10, 0, 'COTAS');
        dxf += dxfLine(halfTotal, C.WING_MOULDING_Y, rightDimX + 0.10, C.WING_MOULDING_Y, 'COTAS');
        dxf += dxfText(rightDimX + 0.20, C.WING_MOULDING_Y / 2.0 - 0.20, 0.18, '5.05', 'COTAS', 90);

        // 1.05m de moldura a bajo cornisa
        dxf += dxfLine(rightDimX, C.WING_MOULDING_Y, rightDimX, C.WING_CORNICE_BOT, 'COTAS');
        dxf += dxfLine(halfTotal, C.WING_CORNICE_BOT, rightDimX + 0.10, C.WING_CORNICE_BOT, 'COTAS');
        dxf += dxfText(rightDimX + 0.20, (C.WING_MOULDING_Y + C.WING_CORNICE_BOT) / 2.0 - 0.20, 0.18, '1.05', 'COTAS', 90);

        // 0.20m espesor cornisa en segundo nivel exterior escalonado
        const rightCorniceDimX2 = halfTotal + 0.95;
        dxf += dxfLine(rightCorniceDimX2, C.WING_CORNICE_BOT, rightCorniceDimX2, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfLine(halfTotal, C.WING_CORNICE_BOT, rightCorniceDimX2 + 0.10, C.WING_CORNICE_BOT, 'COTAS');
        dxf += dxfLine(halfTotal, C.WING_CORNICE_TOP, rightCorniceDimX2 + 0.10, C.WING_CORNICE_TOP, 'COTAS');
        dxf += dxfText(rightCorniceDimX2 + 0.20, (C.WING_CORNICE_BOT + C.WING_CORNICE_TOP) / 2.0 - 0.10, 0.18, '0.20', 'COTAS', 90);

        // Directrices de radios en DXF (Capa COTAS)
        const dxfRadiusLeader = (targetX, targetY, angleDeg, length, text) => {
            const rad = (angleDeg * Math.PI) / 180;
            const elbowX = +(targetX + length * Math.cos(rad)).toFixed(3);
            const elbowY = +(targetY + length * Math.sin(rad)).toFixed(3);
            const shelfDir = Math.cos(rad) >= 0 ? 1 : -1;
            const shelfLength = 0.50;
            const shelfEndX = +(elbowX + shelfDir * shelfLength).toFixed(3);
            let res = '';
            res += dxfLine(targetX, targetY, elbowX, elbowY, 'COTAS');
            res += dxfLine(elbowX, elbowY, shelfEndX, elbowY, 'COTAS');
            const textX = shelfDir > 0 ? elbowX + 0.05 : shelfEndX + 0.05;
            res += dxfText(textX, elbowY + 0.06, 0.18, text, 'COTAS');
            return res;
        };

        // Radios de la ventana izquierda (R1.38 y R1.62 según media_1788705439561.png)
        if (layout.windowPositionsLeft.length > 0) {
            const wLeftRef = layout.windowPositionsLeft[layout.windowPositionsLeft.length - 1];
            const geomIn = this.getPointedArchGeometry(wLeftRef, C.WINDOW_WIDTH, C.WINDOW_SPRING_Y, C.WINDOW_ARCH_R_IN);
            const geomOut = this.getPointedArchGeometry(wLeftRef, C.WINDOW_WIDTH + C.WINDOW_MOULDING_THICK * 2.0, C.WINDOW_SPRING_Y, C.WINDOW_ARCH_R_OUT);

            const rad162 = 126 * Math.PI / 180;
            const r162TargetX = +(geomOut.c1X + 1.62 * Math.cos(rad162)).toFixed(3);
            const r162TargetY = +(C.WINDOW_SPRING_Y + 1.62 * Math.sin(rad162)).toFixed(3);
            dxf += dxfRadiusLeader(r162TargetX, r162TargetY, 135, 0.40, 'R1.62');

            const rad138 = 146 * Math.PI / 180;
            const r138TargetX = +(geomIn.c1X + 1.38 * Math.cos(rad138)).toFixed(3);
            const r138TargetY = +(C.WINDOW_SPRING_Y + 1.38 * Math.sin(rad138)).toFixed(3);
            dxf += dxfRadiusLeader(r138TargetX, r138TargetY, 135, 0.40, 'R1.38');
        }

        // Radios de la portada central (R2.20 y R2.44) en lado derecho para equilibrar dibujo y evitar solape con pilastra
        dxf += dxfRadiusLeader(0.68, 4.12, 35, 0.52, 'R2.20');
        dxf += dxfRadiusLeader(0.82, 4.42, 35, 0.55, 'R2.44');

        // Radio de cornisa R0.14
        dxf += dxfRadiusLeader(-halfTotal - C.WING_CORNICE_R, C.WING_CORNICE_BOT + 0.10, 130, 0.60, 'R0.14');

        // Cotas inferiores generales
        const portalWingW = +(halfTotal - C.PORTAL_WIDTH / 2.0).toFixed(2);
        dxf += dxfLine(-halfTotal, -1.25, halfTotal, -1.25, 'COTAS');
        dxf += dxfText(-0.40, -1.15, 0.22, `${totalWidth.toFixed(2)}`, 'COTAS');
        dxf += dxfLine(-halfTotal, -0.70, -C.PORTAL_WIDTH / 2.0, -0.70, 'COTAS');
        dxf += dxfText((-halfTotal - C.PORTAL_WIDTH / 2.0) / 2.0 - 0.20, -0.65, 0.18, `${portalWingW.toFixed(2)}`, 'COTAS');
        dxf += dxfLine(-C.PORTAL_WIDTH / 2.0, -0.70, C.PORTAL_WIDTH / 2.0, -0.70, 'COTAS');
        dxf += dxfText(-0.20, -0.65, 0.18, `${C.PORTAL_WIDTH.toFixed(2)}`, 'COTAS');
        dxf += dxfLine(C.PORTAL_WIDTH / 2.0, -0.70, halfTotal, -0.70, 'COTAS');
        dxf += dxfText((C.PORTAL_WIDTH / 2.0 + halfTotal) / 2.0 - 0.20, -0.65, 0.18, `${portalWingW.toFixed(2)}`, 'COTAS');

        dxf += '0\nENDSEC\n0\nEOF\n';
        return dxf;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FacadeEngine;
} else if (typeof window !== 'undefined') {
    window.FacadeEngine = FacadeEngine;
}
