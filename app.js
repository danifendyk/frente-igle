/* Controles del editor. Funciona también al abrir index.html sin servidor. */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const engine = new FacadeEngine();
    const $ = id => document.getElementById(id);
    const viewer = $('viewer-container');
    const viewport = $('viewer-viewport');
    const wrapper = $('viewer-svg-wrapper');
    const sidebar = $('sidebar');
    const storageKey = 'asamblea-fachada:v1';
    const pairs = ['total-width', 'manual-count', 'free-space', 'dim-size', 'font-size'];
    const fields = [...pairs.map(name => `slider-${name}`), 'select-dist-mode', 'select-theme',
        'toggle-dimensions', 'toggle-badges', 'toggle-levels', 'toggle-human', 'toggle-axes',
        'toggle-grid', 'input-title-line1', 'input-title-line2'];
    const defaults = Object.fromEntries(fields.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
    let currentResult;
    let renderFrame = 0;
    let saveTimer;
    let noticeTimer;
    let printTheme = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;

    const meters = value => `${value.toFixed(2)} m`;
    const text = (id, value) => { $(id).textContent = value; };
    function notify(message, error = false) {
        const notice = $('app-notice');
        notice.textContent = message;
        notice.classList.toggle('error', error);
        notice.classList.add('visible');
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => notice.classList.remove('visible'), 5000);
    }

    function readOptions() {
        return {
            totalWidth: Number($('slider-total-width').value),
            minFreeSpace: Number($('slider-free-space').value),
            distributionMode: $('select-dist-mode').value,
            manualCount: Number($('slider-manual-count').value),
            theme: $('select-theme').value,
            showDimensions: $('toggle-dimensions').checked,
            showDimBadges: $('toggle-badges').checked,
            showLevels: $('toggle-levels').checked,
            showHuman: $('toggle-human').checked,
            showAxes: $('toggle-axes').checked,
            showGrid: $('toggle-grid').checked,
            dimFontSize: Number($('slider-dim-size').value),
            titleFontSize: Number($('slider-font-size').value),
            titleLine1: $('input-title-line1').value.trim().toUpperCase(),
            titleLine2: $('input-title-line2').value.trim().toUpperCase()
        };
    }

    function saveSettings() {
        try {
            const values = Object.fromEntries(fields.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]));
            // La presentación de impresión es temporal, nunca una preferencia guardada.
            if (printTheme !== null) values['select-theme'] = printTheme;
            localStorage.setItem(storageKey, JSON.stringify(values));
            text('save-status', 'Guardado en este dispositivo');
        } catch {
            text('save-status', 'Guardado local no disponible');
        }
    }

    function restoreSettings(values) {
        if (!values || typeof values !== 'object' || Array.isArray(values)) return;
        for (const id of fields) {
            const field = $(id);
            const value = values[id];
            if (field.type === 'checkbox' && typeof value === 'boolean') field.checked = value;
            else if (field.type === 'range' && value !== '' && (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value))) {
                field.value = Math.max(Number(field.min), Math.min(Number(field.max), Number(value)));
            } else if (field.tagName === 'SELECT' && [...field.options].some(option => option.value === value)) field.value = value;
            else if (field.type === 'text' && typeof value === 'string') field.value = value.slice(0, field.maxLength);
        }
        pairs.forEach(name => { $(`num-${name}`).value = $(`slider-${name}`).value; });
    }

    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            restoreSettings(JSON.parse(saved));
            text('save-status', 'Última configuración recuperada');
        }
    } catch { text('save-status', 'Sesión local'); }

    function renderFacade() {
        cancelAnimationFrame(renderFrame);
        renderFrame = 0;
        const options = readOptions();
        currentResult = engine.generateSVG(options);
        wrapper.innerHTML = currentResult.svg;
        viewer.dataset.theme = options.theme;
        const layout = currentResult.layout;
        ['val-total-width', 'badge-total-width', 'status-width', 'print-width', 'spec-total-width'].forEach(id => text(id, meters(layout.totalWidth)));
        text('badge-window-count', `${layout.totalWindows} ventanas`);
        text('status-windows', `${layout.totalWindows} (${layout.numWindowsPerWing} + ${layout.numWindowsPerWing})`);
        text('print-windows', `${layout.totalWindows} (${layout.numWindowsPerWing} por ala)`);
        text('spec-windows-per-wing', `${layout.numWindowsPerWing} (${layout.totalWindows} en total)`);
        text('spec-wing-width', meters(layout.wingWidth));
        text('spec-top-wing', meters(layout.wingSpan));
        text('spec-free-space', layout.numWindowsPerWing > 1 ? meters(layout.actualFreeSpace) : 'No aplica');
        text('spec-outer-margin', layout.numWindowsPerWing ? meters(layout.actualOuterMargin) : 'Sin ventanas');
        text('spec-inner-margin', layout.numWindowsPerWing ? meters(layout.actualInnerMargin) : 'Sin ventanas');
        text('val-manual-count', String(options.manualCount));
        text('val-free-space', meters(options.minFreeSpace));
        text('val-dim-size', meters(options.dimFontSize));
        text('val-font-size', meters(options.titleFontSize));
        text('fixed-spacing-option', `Separación fija: ${meters(options.minFreeSpace)}`);
        $('group-manual-count').hidden = options.distributionMode !== 'manual';
        const banner = $('rule-status-banner');
        banner.className = `rule-status-banner ${layout.isGeometryValid ? 'valid' : 'invalid'}`;
        if (!layout.isGeometryValid) {
            banner.textContent = layout.actualInnerMargin < 0 || layout.actualOuterMargin < 0
                ? 'Las ventanas no caben en el ala. Reduce la cantidad o amplía el frente.'
                : `Separación insuficiente: ${meters(layout.actualFreeSpace)}. Mínimo: ${meters(options.minFreeSpace)}.`;
        } else if (!layout.totalWindows) {
            banner.textContent = options.distributionMode === 'manual' ? 'Fachada sin ventanas laterales.' : 'Este ancho no permite ventanas con los márgenes del modelo.';
        } else {
            banner.textContent = layout.numWindowsPerWing > 1
                ? `✓ Distribución válida · ${meters(layout.actualFreeSpace)} libres`
                : '✓ Una ventana centrada en cada ala';
        }
        text('geometry-status', layout.isGeometryValid ? (layout.totalWindows ? 'Geometría válida' : 'Sin ventanas laterales') : 'Revisar distribución');
        $('geometry-status').classList.toggle('invalid', !layout.isGeometryValid);
        document.querySelectorAll('.btn-preset').forEach(button => {
            const active = Math.abs(Number(button.dataset.val) - layout.totalWidth) < 0.001;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        $('tool-toggle-cotas').setAttribute('aria-pressed', String(options.showDimensions));
        text('print-date', new Date().toLocaleDateString('es-AR'));
        text('print-project-name', [options.titleLine1, options.titleLine2].filter(Boolean).join(' '));
    }

    function scheduleRender() {
        if (!renderFrame) renderFrame = requestAnimationFrame(renderFacade);
        text('save-status', 'Guardando cambios…');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveSettings, 350);
    }

    pairs.forEach(name => {
        const slider = $(`slider-${name}`);
        const number = $(`num-${name}`);
        slider.addEventListener('input', () => {
            number.value = slider.value;
            number.removeAttribute('aria-invalid');
            scheduleRender();
        });
        number.addEventListener('input', () => {
            const valid = number.value !== '' && number.validity.valid;
            number.setAttribute('aria-invalid', String(!valid));
            if (!valid) return; // Permite editar sin reemplazar el plano por valores parciales.
            slider.value = number.value;
            scheduleRender();
        });
        number.addEventListener('change', () => {
            const value = number.valueAsNumber;
            if (Number.isFinite(value)) slider.value = Math.max(Number(slider.min), Math.min(Number(slider.max), value));
            number.value = slider.value;
            number.removeAttribute('aria-invalid');
            scheduleRender();
        });
    });
    fields.filter(id => !id.startsWith('slider-')).forEach(id => $(id).addEventListener($(id).type === 'text' ? 'input' : 'change', scheduleRender));
    document.querySelectorAll('.btn-preset').forEach(button => button.addEventListener('click', () => {
        $('slider-total-width').value = button.dataset.val;
        $('num-total-width').value = $('slider-total-width').value;
        $('num-total-width').removeAttribute('aria-invalid');
        scheduleRender();
    }));
    $('btn-reset-project').addEventListener('click', () => {
        restoreSettings(defaults);
        document.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
        fitView();
        renderFacade();
        saveSettings();
        notify('Se recuperaron los valores iniciales del modelo.');
    });
    window.addEventListener('pagehide', saveSettings);

    function transformView() {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        text('status-zoom', `${Math.round(zoom * 100)}%`);
    }
    function fitView() {
        zoom = 1;
        panX = panY = 0;
        transformView();
    }
    function zoomAt(nextZoom, x = 0, y = 0) {
        nextZoom = Math.max(0.2, Math.min(5, nextZoom));
        const ratio = nextZoom / zoom;
        panX = x - (x - panX) * ratio;
        panY = y - (y - panY) * ratio;
        zoom = nextZoom;
        transformView();
    }
    function localPoint(x, y) {
        const rect = viewer.getBoundingClientRect();
        return { x: x - rect.left - rect.width / 2, y: y - rect.top - rect.height / 2 };
    }
    const pointers = new Map();
    const interactive = target => target.closest('button, input, select, a, summary');
    viewer.addEventListener('pointerdown', event => {
        if (interactive(event.target) || (event.pointerType === 'mouse' && event.button !== 0)) return;
        viewer.focus({ preventScroll: true });
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        viewer.setPointerCapture(event.pointerId);
        viewer.classList.add('panning');
    });
    viewer.addEventListener('pointermove', event => {
        if (pointers.has(event.pointerId)) {
            const before = [...pointers.values()];
            const previous = pointers.get(event.pointerId);
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const after = [...pointers.values()];
            if (pointers.size === 1) {
                panX += event.clientX - previous.x;
                panY += event.clientY - previous.y;
                transformView();
            } else if (pointers.size === 2) {
                const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                const midpoint = points => localPoint((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
                const start = midpoint(before);
                const end = midpoint(after);
                const oldDistance = distance(before);
                if (oldDistance > 0) zoomAt(zoom * distance(after) / oldDistance, start.x, start.y);
                panX += end.x - start.x;
                panY += end.y - start.y;
                transformView();
            }
        }
        const svg = wrapper.querySelector('svg');
        const matrix = svg?.getScreenCTM();
        if (matrix && currentResult) {
            const point = svg.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const position = point.matrixTransform(matrix.inverse());
            text('status-coords', `X: ${(position.x + currentResult.worldBounds.minX).toFixed(2)} m | Y: ${(currentResult.worldBounds.maxY - position.y).toFixed(2)} m`);
        }
    });
    function releasePointer(event) {
        pointers.delete(event.pointerId);
        viewer.classList.toggle('panning', pointers.size > 0);
    }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => viewer.addEventListener(type, releasePointer));
    viewer.addEventListener('wheel', event => {
        if (interactive(event.target) || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const point = localPoint(event.clientX, event.clientY);
        zoomAt(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), point.x, point.y);
    }, { passive: false });
    viewer.addEventListener('dblclick', event => { if (!interactive(event.target)) fitView(); });
    $('tool-zoom-in').addEventListener('click', () => zoomAt(zoom * 1.2));
    $('tool-zoom-out').addEventListener('click', () => zoomAt(zoom / 1.2));
    ['tool-zoom-reset', 'tool-fit', 'btn-reset-view'].forEach(id => $(id).addEventListener('click', fitView));
    function toggleDimensions() {
        $('toggle-dimensions').checked = !$('toggle-dimensions').checked;
        scheduleRender();
    }
    $('tool-toggle-cotas').addEventListener('click', toggleDimensions);
    $('tool-toggle-theme').addEventListener('click', () => {
        const select = $('select-theme');
        select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
        scheduleRender();
    });
    viewer.addEventListener('keydown', event => {
        if (event.target !== viewer || event.ctrlKey || event.metaKey || event.altKey) return;
        const actions = { '+': () => zoomAt(zoom * 1.2), '=': () => zoomAt(zoom * 1.2), '-': () => zoomAt(zoom / 1.2),
            '0': fitView, 'f': fitView, 'c': toggleDimensions,
            ArrowLeft: () => { panX += 40; transformView(); }, ArrowRight: () => { panX -= 40; transformView(); },
            ArrowUp: () => { panY += 40; transformView(); }, ArrowDown: () => { panY -= 40; transformView(); } };
        const action = actions[event.key];
        if (action) { event.preventDefault(); action(); }
    });

    function download(blob, extension, width) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Fachada_Iglesia_${width.toFixed(2)}m.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function exportSVG() {
        renderFacade();
        const svg = wrapper.querySelector('svg').cloneNode(true);
        const bounds = svg.viewBox.baseVal;
        const width = 3000;
        const height = Math.round(width * bounds.height / bounds.width);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        return { data: new XMLSerializer().serializeToString(svg), width, height, totalWidth: currentResult.layout.totalWidth };
    }
    function downloadDXF() {
        try {
            const options = readOptions();
            download(new Blob([engine.generateDXF(options)], { type: 'application/dxf' }), 'dxf', options.totalWidth);
            notify('DXF descargado. Las coordenadas están expresadas en metros.');
        } catch { notify('No se pudo exportar el DXF. Revisa las medidas e inténtalo de nuevo.', true); }
    }
    ['btn-export-dxf', 'btn-download-dxf', 'nav-btn-dxf'].forEach(id => $(id).addEventListener('click', downloadDXF));
    $('btn-download-svg').addEventListener('click', () => {
        try {
            const result = exportSVG();
            download(new Blob([result.data], { type: 'image/svg+xml;charset=utf-8' }), 'svg', result.totalWidth);
            notify('Plano vectorial SVG descargado.');
        } catch { notify('No se pudo exportar el SVG.', true); }
    });
    $('btn-download-png').addEventListener('click', async () => {
        const button = $('btn-download-png');
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        let url;
        try {
            const result = exportSVG();
            const background = { cad_dark: '#0f141c', cad_white: '#fff', blueprint: '#081c33', realistic: '#0b1120' }[readOptions().theme];
            url = URL.createObjectURL(new Blob([result.data], { type: 'image/svg+xml;charset=utf-8' }));
            const img = new Image();
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
            const canvas = document.createElement('canvas');
            canvas.width = result.width;
            canvas.height = result.height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas no disponible');
            context.fillStyle = background;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('PNG vacío');
            download(blob, 'png', result.totalWidth);
            notify('Imagen PNG de 3000 px descargada.');
        } catch { notify('No se pudo crear la imagen PNG. Puedes descargar el plano en SVG.', true); }
        finally {
            if (url) URL.revokeObjectURL(url);
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    });

    window.addEventListener('beforeprint', () => {
        if (printTheme !== null) return;
        printTheme = $('select-theme').value;
        $('select-theme').value = 'cad_white';
        renderFacade();
    });
    window.addEventListener('afterprint', () => {
        if (printTheme === null) return;
        $('select-theme').value = printTheme;
        printTheme = null;
        renderFacade();
    });
    $('btn-print').addEventListener('click', () => window.print());

    const mobile = window.matchMedia('(max-width: 850px)');
    function syncMobileAccess() {
        const open = sidebar.classList.contains('mobile-open');
        sidebar.inert = mobile.matches && !open;
        viewer.inert = mobile.matches && open;
        $('btn-toggle-sidebar').setAttribute('aria-expanded', String(open));
    }
    function setMobileTab(tab) {
        const open = tab !== 'plano';
        sidebar.classList.toggle('mobile-open', open);
        $('btn-toggle-sidebar').classList.toggle('active', open);
        ['plano', 'ajustes', 'medidas'].forEach(name => {
            const button = $(`nav-btn-${name}`);
            button.classList.toggle('active', tab === name);
            if (tab === name) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        syncMobileAccess();
        if (tab === 'medidas') {
            $('section-specs').open = true;
            $('section-specs').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (open) sidebar.scrollTop = 0;
        if (mobile.matches) (open ? $('btn-close-sidebar') : viewer).focus({ preventScroll: true });
    }
    $('btn-toggle-sidebar').addEventListener('click', () => setMobileTab(sidebar.classList.contains('mobile-open') ? 'plano' : 'ajustes'));
    $('btn-close-sidebar').addEventListener('click', () => setMobileTab('plano'));
    ['plano', 'ajustes', 'medidas'].forEach(tab => $(`nav-btn-${tab}`).addEventListener('click', () => setMobileTab(tab)));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && mobile.matches) setMobileTab('plano'); });
    mobile.addEventListener('change', syncMobileAccess);
    syncMobileAccess();
    renderFacade();
    transformView();
});
