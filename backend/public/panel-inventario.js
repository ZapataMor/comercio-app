// Inventario del panel web: filas de características (agregar, quitar,
// atajos y valores sugeridos según el nombre), unidad que se ve junto a las
// cantidades y el formulario de entrada / salida / conteo.
// Los modales, la vista previa de la foto y las confirmaciones los maneja
// panel-catalogo.js.
(() => {
    let listas = {};
    try { listas = JSON.parse((document.getElementById('inv-listas-valores') || {}).textContent || '{}'); } catch (_) { /* sin sugerencias */ }

    // ------------------------------------------------ Características
    // Los nombres de los campos se rehacen en orden antes de enviar, así las
    // filas nuevas o quitadas no dejan huecos.
    const renumerar = (caja) => {
        const campo = caja.dataset.campo || 'caracteristicas';
        caja.querySelectorAll('.caracteristica-fila').forEach((fila, i) => {
            fila.querySelector('[data-car-nombre]').name = `${campo}[${i}][nombre]`;
            fila.querySelector('[data-car-valor]').name = `${campo}[${i}][valor]`;
        });
    };
    const sugerirValores = (nombreInput) => {
        const valor = nombreInput.closest('.caracteristica-fila').querySelector('[data-car-valor]');
        const lista = listas[nombreInput.value.trim().toLowerCase()];
        if (lista) valor.setAttribute('list', lista); else valor.removeAttribute('list');
    };
    const agregar = (caja, nombre) => {
        const filas = [...caja.querySelectorAll('.caracteristica-fila')];
        if (nombre) {
            // Si ya está, solo se lleva al valor.
            const ya = filas.find((f) => f.querySelector('[data-car-nombre]').value.trim().toLowerCase() === nombre.toLowerCase());
            if (ya) { ya.querySelector('[data-car-valor]').focus(); return; }
        }
        let fila = filas.find((f) => !f.querySelector('[data-car-nombre]').value.trim() && !f.querySelector('[data-car-valor]').value.trim());
        if (!fila) {
            if (filas.length >= 20) { alert('Llegaste al máximo de 20 características.'); return; }
            fila = document.getElementById('plantilla-caracteristica').content.firstElementChild.cloneNode(true);
            caja.querySelector('[data-car-filas]').appendChild(fila);
            renumerar(caja);
        }
        const nombreInput = fila.querySelector('[data-car-nombre]');
        if (nombre) {
            nombreInput.value = nombre;
            sugerirValores(nombreInput);
            fila.querySelector('[data-car-valor]').focus();
        } else {
            nombreInput.focus();
        }
    };

    document.addEventListener('click', (e) => {
        const boton = e.target.closest('[data-car-agregar]');
        if (boton) { agregar(boton.closest('[data-caracteristicas]'), boton.dataset.carAgregar); return; }
        const quitar = e.target.closest('[data-car-quitar]');
        if (quitar) {
            const caja = quitar.closest('[data-caracteristicas]');
            const fila = quitar.closest('.caracteristica-fila');
            // La última fila se vacía en vez de desaparecer.
            if (caja.querySelectorAll('.caracteristica-fila').length > 1) fila.remove();
            else fila.querySelectorAll('input').forEach((i) => { i.value = ''; });
            renumerar(caja);
        }
    });
    document.addEventListener('input', (e) => {
        if (e.target.matches('[data-car-nombre]')) sugerirValores(e.target);
    });
    // Enter en una característica pasa al valor o abre otra fila (no envía).
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('[data-car-nombre],[data-car-valor]')) return;
        e.preventDefault();
        const fila = e.target.closest('.caracteristica-fila');
        if (e.target.matches('[data-car-nombre]')) fila.querySelector('[data-car-valor]').focus();
        else agregar(fila.closest('[data-caracteristicas]'), '');
    });
    document.addEventListener('submit', (e) => {
        const caja = e.target.querySelector && e.target.querySelector('[data-caracteristicas]');
        if (caja) renumerar(caja);
    }, true);

    // ------------------------------------------------ Unidad junto a las cantidades
    const ajustarUnidad = (select) => {
        const plural = (select.selectedOptions[0] || {}).dataset?.plural || '';
        select.closest('form').querySelectorAll('[data-unidad-texto]').forEach((t) => { t.textContent = plural; });
    };

    // ------------------------------------------------ Entrada / salida / conteo
    const TEXTOS = {
        entrada: ['¿Cuánto entró?', 'Se suma a lo que hay.', 'Registrar entrada', 'Compra al proveedor, devolución…'],
        salida: ['¿Cuánto salió?', 'Se resta de lo que hay.', 'Registrar salida', 'Trabajo de la puerta, venta, daño…'],
        ajuste: ['¿Cuánto hay contado?', 'La existencia pasa a ser lo que contaste.', 'Guardar conteo', 'Conteo del sábado…'],
    };
    const ajustarMovimiento = (form) => {
        const tipo = (form.querySelector('input[name=tipo]:checked') || {}).value || 'entrada';
        const [etiqueta, ayuda, boton, nota] = TEXTOS[tipo];
        form.dataset.tipo = tipo;
        form.querySelector('[data-movimiento-etiqueta]').textContent = etiqueta;
        form.querySelector('[data-movimiento-ayuda]').textContent = ayuda;
        form.querySelector('[data-movimiento-boton]').textContent = boton;
        form.querySelector('[data-movimiento-nota]').placeholder = nota;
    };

    document.addEventListener('change', (e) => {
        if (e.target.matches('[data-unidad]')) ajustarUnidad(e.target);
        if (e.target.matches('[data-movimiento] input[name=tipo]')) ajustarMovimiento(e.target.closest('form'));
    });

    // ------------------------------------------------ «−» en la tarjeta: se usó uno
    const csrf = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    const usar = async (boton) => {
        const tarjeta = boton.closest('[data-articulo]');
        boton.disabled = true;
        try {
            const datos = new FormData();
            datos.append('tipo', 'salida');
            datos.append('cantidad', '1');
            datos.append('nota', 'Se usó (desde la tarjeta)');
            const r = await fetch(boton.dataset.usar, {
                method: 'POST', body: datos, credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            });
            const json = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(json.message || 'No se pudo descontar.');
            tarjeta.querySelector('[data-cantidad]').textContent = json.numero;
            tarjeta.querySelector('[data-unidad]').textContent = json.unidad;
            tarjeta.classList.remove('articulo-ok', 'articulo-bajo', 'articulo-agotado');
            tarjeta.classList.add('articulo-' + json.estado);
            const chip = tarjeta.querySelector('[data-estado]');
            chip.hidden = json.estado === 'ok';
            chip.textContent = json.estado_texto;
            chip.classList.toggle('chip-peligro', json.estado === 'agotado');
            chip.classList.toggle('chip-aviso', json.estado === 'bajo');
            const modal = document.querySelector('[data-existencia-modal="' + tarjeta.dataset.articulo + '"]');
            if (modal) {
                modal.querySelector('strong').textContent = json.numero;
                modal.querySelector('span').textContent = json.unidad;
            }
            boton.disabled = json.cantidad < 1;
            tarjeta.classList.remove('recien-usado');
            void tarjeta.offsetWidth; // reinicia la animación
            tarjeta.classList.add('recien-usado');
        } catch (err) {
            boton.disabled = false;
            alert(err.message || 'No se pudo descontar. Revisa tu conexión.');
        }
    };
    document.addEventListener('click', (e) => {
        const boton = e.target.closest('[data-usar]');
        if (boton) usar(boton);
    });

    document.querySelectorAll('[data-unidad]').forEach(ajustarUnidad);
    document.querySelectorAll('[data-movimiento]').forEach(ajustarMovimiento);
    document.querySelectorAll('[data-car-nombre]').forEach(sugerirValores);
})();
