// Materiales y producción del panel web:
// - Etapa «Por hacer»: − y + en cada material, «Añadir material», lo normal
//   del modelo cuando cambia cuántas se hacen y aviso de lo que no alcanza.
// - Modelos: filas de materiales predeterminados (agregar, quitar, unidad) y
//   el buscador de productos del catálogo.
// Los modales, pestañas y confirmaciones los maneja panel-catalogo.js.
(() => {
    const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });
    const redondear = (n) => Math.round(n * 1000) / 1000;
    const leer = (texto) => {
        let t = String(texto ?? '').trim().replace(/\s/g, '');
        if (t === '') return 0;
        if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
        const n = Number(t);
        return Number.isFinite(n) ? n : NaN;
    };
    const unidad = (n, fila) => (Math.abs(n - 1) < 0.0005 ? fila.dataset.uno : fila.dataset.varios);

    // ------------------------------------------------ Etapa «Por hacer»
    const renumerarEtapa = (form) => {
        form.querySelectorAll('[data-etapa-material]').forEach((fila, i) => {
            fila.querySelector('[data-etapa-articulo]').name = `materiales[${i}][articulo_id]`;
            fila.querySelector('[data-etapa-cantidad]').name = `materiales[${i}][cantidad]`;
        });
    };
    // Paso de − y +: de a uno, o de a 0,1 si lo normal tiene decimales menores que uno.
    const paso = (fila) => {
        const normal = Number(fila.dataset.normal || fila.dataset.por || 1);
        return normal > 0 && normal < 1 ? 0.1 : 1;
    };
    const pintarFila = (fila) => {
        const cantidad = leer(fila.querySelector('[data-etapa-cantidad]').value);
        const hay = Number(fila.dataset.hay || 0);
        const corto = cantidad > hay + 0.0005;
        fila.classList.toggle('corto', corto);
        const chip = fila.querySelector('[data-etapa-hay]');
        chip.classList.toggle('chip-peligro', corto);
        const diferencia = fila.querySelector('[data-etapa-diferencia]');
        if (fila.dataset.normal === '') { diferencia.textContent = 'Añadido aparte'; return; }
        const normal = Number(fila.dataset.normal);
        const resta = redondear(cantidad - normal);
        diferencia.textContent = 'Lo normal: ' + numero(normal) + ' ' + unidad(normal, fila)
            + (Number.isNaN(resta) || Math.abs(resta) < 0.0005 ? '' : (resta > 0 ? ' · ' + numero(resta) + ' de más' : ' · ' + numero(-resta) + ' de menos'));
    };
    const pintarAviso = (form) => {
        const faltan = [...form.querySelectorAll('[data-etapa-material].corto')].map((fila) => {
            const falta = redondear(leer(fila.querySelector('[data-etapa-cantidad]').value) - Number(fila.dataset.hay || 0));
            return numero(falta) + ' ' + unidad(falta, fila) + ' de «' + fila.dataset.nombre + '»';
        });
        const aviso = form.querySelector('[data-etapa-aviso]');
        aviso.replaceChildren();
        if (faltan.length) {
            const p = document.createElement('p');
            p.className = 'produccion-falto';
            p.textContent = 'No alcanza: faltan ' + faltan.join('; ') + '. Registra la entrada en Materiales o termínala descontando lo que haya.';
            aviso.append(p);
        }
        const aunque = form.querySelector('[data-etapa-aunque]');
        if (aunque && !form.querySelector('.aviso-error')) aunque.hidden = !faltan.length;
        const vacio = form.querySelector('[data-etapa-vacio]');
        if (vacio) vacio.hidden = !!form.querySelector('[data-etapa-material]');
    };
    const cambiar = (fila, delta) => {
        const input = fila.querySelector('[data-etapa-cantidad]');
        const actual = leer(input.value);
        input.value = numero(Math.max(0, redondear((Number.isNaN(actual) ? 0 : actual) + delta)));
        pintarFila(fila);
        pintarAviso(fila.closest('form'));
    };
    const anadir = (form) => {
        const select = form.querySelector('[data-etapa-elegir]');
        const opcion = select.selectedOptions[0];
        if (!opcion || !opcion.value) { select.focus(); return; }
        const ya = form.querySelector(`[data-etapa-articulo][value="${opcion.value}"]`);
        if (ya) {
            // Ya estaba: se le suma uno.
            cambiar(ya.closest('[data-etapa-material]'), paso(ya.closest('[data-etapa-material]')));
            select.value = '';
            return;
        }
        if (form.querySelectorAll('[data-etapa-material]').length >= 40) { alert('Llegaste al máximo de 40 materiales.'); return; }
        const d = opcion.dataset;
        const fila = document.createElement('li');
        fila.className = 'etapa-material etapa-material-extra';
        fila.dataset.etapaMaterial = '';
        Object.assign(fila.dataset, { hay: d.hay, normal: '', por: '', nombre: d.nombre, uno: d.uno, varios: d.varios });
        const oculto = Object.assign(document.createElement('input'), { type: 'hidden', value: opcion.value });
        oculto.dataset.etapaArticulo = '';
        const nombre = document.createElement('span');
        nombre.className = 'material-nombre';
        const fuerte = document.createElement('strong');
        fuerte.textContent = d.nombre;
        const chico = document.createElement('small');
        if (d.rasgos) chico.append(d.rasgos + ' · ');
        const dif = document.createElement('span');
        dif.dataset.etapaDiferencia = '';
        chico.append(dif);
        nombre.append(fuerte, chico);
        const ajuste = document.createElement('span');
        ajuste.className = 'etapa-ajuste';
        const menos = Object.assign(document.createElement('button'), { type: 'button', className: 'etapa-boton', textContent: '−' });
        menos.dataset.etapaMenos = '';
        menos.setAttribute('aria-label', 'Usar menos ' + d.nombre);
        const input = Object.assign(document.createElement('input'), { value: '1', inputMode: 'decimal', autocomplete: 'off' });
        input.dataset.etapaCantidad = '';
        input.setAttribute('aria-label', 'Cuánto ' + d.nombre + ' se usa');
        const mas = Object.assign(document.createElement('button'), { type: 'button', className: 'etapa-boton', textContent: '+' });
        mas.dataset.etapaMas = '';
        mas.setAttribute('aria-label', 'Usar más ' + d.nombre);
        const u = Object.assign(document.createElement('span'), { className: 'etapa-unidad', textContent: d.plural });
        ajuste.append(menos, input, mas, u);
        const hay = Object.assign(document.createElement('span'), { className: 'material-hay chip', textContent: 'Hay ' + d.hayTexto });
        hay.dataset.etapaHay = '';
        const quitar = Object.assign(document.createElement('button'), { type: 'button', className: 'lista-item-quitar', textContent: '✕' });
        quitar.dataset.etapaQuitar = '';
        quitar.setAttribute('aria-label', 'Quitar ' + d.nombre);
        fila.append(oculto, nombre, ajuste, hay, quitar);
        form.querySelector('[data-etapa-filas]').append(fila);
        renumerarEtapa(form);
        pintarFila(fila);
        pintarAviso(form);
        select.value = '';
        input.focus();
        input.select();
    };
    // Cambió cuántas se hacen: lo normal de cada material del modelo se
    // recalcula y se conserva lo que se había puesto de más o de menos.
    const cambiarTotal = (input) => {
        const form = input.closest('form');
        const nuevo = leer(input.value);
        if (!(nuevo > 0)) return;
        form.querySelectorAll('[data-etapa-material]').forEach((fila) => {
            if (fila.dataset.normal === '' || fila.dataset.por === '') return;
            const normalAntes = Number(fila.dataset.normal);
            const normalNuevo = redondear(Number(fila.dataset.por) * nuevo);
            const campo = fila.querySelector('[data-etapa-cantidad]');
            const actual = leer(campo.value);
            campo.value = numero(Math.max(0, redondear((Number.isNaN(actual) ? normalAntes : actual) + normalNuevo - normalAntes)));
            fila.dataset.normal = String(normalNuevo);
            pintarFila(fila);
        });
        input.dataset.anterior = String(nuevo);
        pintarAviso(form);
    };

    // ------------------------------------------------ Modelos: filas de materiales
    const renumerarModelo = (form) => {
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
        renumerarModelo(form);
        ajustarUnidad(fila.querySelector('[data-material-articulo]'));
        fila.querySelector('[data-material-articulo]').focus();
    };

    document.addEventListener('click', (e) => {
        const menos = e.target.closest('[data-etapa-menos]');
        if (menos) { const fila = menos.closest('[data-etapa-material]'); cambiar(fila, -paso(fila)); return; }
        const mas = e.target.closest('[data-etapa-mas]');
        if (mas) { const fila = mas.closest('[data-etapa-material]'); cambiar(fila, paso(fila)); return; }
        const anade = e.target.closest('[data-etapa-anadir]');
        if (anade) { anadir(anade.closest('form')); return; }
        const quitaEtapa = e.target.closest('[data-etapa-quitar]');
        if (quitaEtapa) {
            const form = quitaEtapa.closest('form');
            quitaEtapa.closest('[data-etapa-material]').remove();
            renumerarEtapa(form);
            pintarAviso(form);
            return;
        }
        const agregar = e.target.closest('[data-material-agregar]');
        if (agregar) { agregarFila(agregar.closest('form')); return; }
        const quitar = e.target.closest('[data-material-quitar]');
        if (quitar) {
            const form = quitar.closest('form');
            // La última fila se vacía en vez de desaparecer.
            if (form.querySelectorAll('.material-fila').length > 1) quitar.closest('.material-fila').remove();
            else { const fila = quitar.closest('.material-fila'); fila.querySelector('select').value = ''; fila.querySelector('input').value = ''; ajustarUnidad(fila.querySelector('select')); }
            renumerarModelo(form);
        }
    });
    document.addEventListener('input', (e) => {
        if (e.target.matches('[data-etapa-cantidad]')) { pintarFila(e.target.closest('[data-etapa-material]')); pintarAviso(e.target.closest('form')); }
        if (e.target.matches('[data-filtrar-productos]')) {
            const q = e.target.value.trim().toLowerCase();
            e.target.parentElement.querySelectorAll('[data-productos-lista] li').forEach((li) => { li.hidden = q !== '' && !li.textContent.toLowerCase().includes(q); });
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target.matches('[data-etapa-total]')) cambiarTotal(e.target);
        if (e.target.matches('[data-material-articulo]')) ajustarUnidad(e.target);
    });
    // Enter en «Añadir material» añade, no envía.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-etapa-elegir]')) { e.preventDefault(); anadir(e.target.closest('form')); }
    });
    document.addEventListener('submit', (e) => {
        if (!e.target.matches) return;
        if (e.target.matches('[data-etapa-form]')) renumerarEtapa(e.target);
        if (e.target.matches('[data-materiales-form]')) renumerarModelo(e.target);
    }, true);

    document.querySelectorAll('[data-etapa-form]').forEach((form) => {
        form.querySelectorAll('[data-etapa-material]').forEach(pintarFila);
        pintarAviso(form);
    });
    document.querySelectorAll('[data-material-articulo]').forEach(ajustarUnidad);
})();
