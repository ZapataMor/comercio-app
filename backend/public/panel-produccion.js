// Producción y materiales (Catálogo y Producción del panel web): filas de
// «Materiales que gasta» (agregar, quitar, unidad del material elegido) y la
// vista previa de «Registrar como hecho» (qué se descuenta y qué falta).
// Los modales y las confirmaciones los maneja panel-catalogo.js.
(() => {
    const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });
    const leer = (texto) => {
        let t = String(texto || '').trim().replace(/\s/g, '');
        if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
    };

    // ------------------------------------------------ Filas de materiales
    const renumerar = (form) => {
        form.querySelectorAll('.material-fila').forEach((fila, i) => {
            fila.querySelector('[data-material-articulo]').name = `materiales[${i}][articulo_id]`;
            fila.querySelector('[data-material-cantidad]').name = `materiales[${i}][cantidad]`;
        });
    };
    const ajustarUnidad = (select) => {
        const opcion = select.selectedOptions[0];
        select.closest('.material-fila').querySelector('[data-material-unidad]').textContent = (opcion && opcion.dataset.unidad) || '—';
    };
    const agregarFila = (form) => {
        const plantilla = document.getElementById('plantilla-material');
        if (!plantilla) return;
        if (form.querySelectorAll('.material-fila').length >= 40) { alert('Llegaste al máximo de 40 materiales.'); return; }
        const fila = plantilla.content.firstElementChild.cloneNode(true);
        form.querySelector('[data-materiales-filas]').appendChild(fila);
        renumerar(form);
        ajustarUnidad(fila.querySelector('[data-material-articulo]'));
        fila.querySelector('[data-material-articulo]').focus();
    };

    document.addEventListener('click', (e) => {
        const editar = e.target.closest('[data-materiales-editar]');
        if (editar) {
            const caja = editar.closest('[data-materiales]');
            caja.classList.add('editando-materiales');
            const form = caja.querySelector('[data-materiales-form]');
            if (!form.querySelector('.material-fila')) agregarFila(form);
            else form.querySelector('[data-material-articulo]').focus();
            return;
        }
        if (e.target.closest('[data-materiales-cancelar]')) { e.target.closest('[data-materiales]').classList.remove('editando-materiales'); return; }
        const agregar = e.target.closest('[data-material-agregar]');
        if (agregar) { agregarFila(agregar.closest('form')); return; }
        const quitar = e.target.closest('[data-material-quitar]');
        if (quitar) { const form = quitar.closest('form'); quitar.closest('.material-fila').remove(); renumerar(form); }
    });
    document.addEventListener('change', (e) => {
        if (e.target.matches('[data-material-articulo]')) ajustarUnidad(e.target);
    });
    document.addEventListener('submit', (e) => {
        if (e.target.matches && e.target.matches('[data-materiales-form]')) renumerar(e.target);
    }, true);

    // ------------------------------------------------ Registrar como hecho
    const vistaPrevia = (form) => {
        let necesidades = [];
        try { necesidades = JSON.parse(form.dataset.necesidades || '[]'); } catch (_) { /* sin datos */ }
        const n = leer(form.querySelector('[data-producir-cantidad]').value);
        const vista = form.querySelector('[data-producir-vista]');
        const aunque = form.querySelector('[data-producir-aunque]');
        vista.replaceChildren();
        if (!(n > 0)) { if (aunque && !form.querySelector('.campo-error')) aunque.hidden = true; return; }
        const titulo = document.createElement('p');
        titulo.className = 'producir-titulo';
        titulo.textContent = 'Se descuenta del inventario:';
        const lista = document.createElement('ul');
        let falta = false;
        necesidades.forEach((m) => {
            const total = Math.round(m.por * n * 1000) / 1000;
            const corto = total > m.hay + 0.0005;
            falta = falta || corto;
            const li = document.createElement('li');
            if (corto) li.className = 'corto';
            const nombre = document.createElement('span');
            nombre.textContent = m.nombre;
            const cuanto = document.createElement('strong');
            cuanto.textContent = numero(total) + ' ' + (Math.abs(total - 1) < 0.0005 ? m.uno : m.varios);
            li.append(nombre, cuanto);
            if (corto) {
                const aviso = document.createElement('small');
                aviso.textContent = 'solo hay ' + numero(m.hay);
                li.append(aviso);
            }
            lista.append(li);
        });
        vista.append(titulo, lista);
        if (aunque) aunque.hidden = !falta && !form.querySelector('.campo-error');
    };
    document.addEventListener('input', (e) => {
        if (e.target.matches('[data-producir-cantidad]')) vistaPrevia(e.target.closest('form'));
    });

    const iniciar = (raiz) => {
        raiz.querySelectorAll('[data-material-articulo]').forEach(ajustarUnidad);
        raiz.querySelectorAll('[data-producir]').forEach(vistaPrevia);
    };
    iniciar(document);
    // El catálogo se vuelve a pintar solo cuando cambia en la app.
    new MutationObserver(() => iniciar(document)).observe(document.querySelector('[data-vivo]') || document.createElement('div'), { childList: true });
})();
