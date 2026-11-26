// Trabajadores del panel web: verificar el código antes de invitar, días y
// horas (atajos, activar las horas del día marcado, copiar la hora), tarea
// libre o «atender un pedido» y «Asignarle una tarea» desde un trabajador.
// Los modales, pestañas y confirmaciones los maneja panel-catalogo.js.
(() => {
    const csrf = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

    // ------------------------------------------------ Código del trabajador
    const verificar = async (form) => {
        const input = form.querySelector('[data-codigo]');
        const caja = form.querySelector('[data-codigo-resultado]');
        const codigo = input.value.trim();
        if (!codigo) { input.focus(); return; }
        caja.hidden = false;
        caja.className = 'codigo-resultado';
        caja.textContent = 'Buscando…';
        try {
            const datos = new FormData();
            datos.append('codigo', codigo);
            const r = await fetch(input.dataset.codigoUrl, {
                method: 'POST', body: datos, credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            });
            const json = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(json.message || 'No se pudo verificar el código.');
            caja.replaceChildren();
            const nombre = document.createElement('strong');
            nombre.textContent = json.nombre;
            const codigoTexto = document.createElement('span');
            codigoTexto.className = 'apagado';
            codigoTexto.textContent = ' #' + json.codigo;
            caja.append(nombre, codigoTexto);
            if (json.aviso) {
                caja.classList.add('con-aviso');
                const aviso = document.createElement('p');
                aviso.textContent = json.aviso;
                caja.append(aviso);
            } else {
                caja.classList.add('encontrado');
                const ok = document.createElement('p');
                ok.textContent = 'Es esta persona. Completa sus datos y envía la invitación.';
                caja.append(ok);
            }
        } catch (err) {
            caja.classList.add('con-aviso');
            caja.textContent = err.message || 'No se pudo verificar. Revisa tu conexión.';
        }
    };

    // ------------------------------------------------ Días y horas
    const ajustarDia = (fila) => {
        const marcado = fila.querySelector('[data-dia-casilla]').checked;
        fila.classList.toggle('activo', marcado);
        fila.querySelectorAll('select').forEach((s) => { s.disabled = !marcado; });
    };
    const iniciarHorarios = (raiz) => raiz.querySelectorAll('[data-dia]').forEach(ajustarDia);

    // ------------------------------------------------ Tarea o pedido
    const ajustarTipo = (form) => {
        const elegido = form.querySelector('[data-tarea-tipo]:checked');
        const tipo = elegido ? elegido.value : 'tarea';
        form.querySelectorAll('[data-solo-tipo]').forEach((el) => { el.hidden = el.dataset.soloTipo !== tipo; });
        const titulo = form.querySelector('[data-tarea-titulo]');
        if (titulo) {
            titulo.required = tipo === 'tarea';
            titulo.placeholder = tipo === 'tarea' ? titulo.dataset.placeholderTarea : titulo.dataset.placeholderPedido;
        }
        const pedido = form.querySelector('select[name=pedido_id]');
        if (pedido) pedido.required = tipo === 'pedido';
    };
    const iniciarTareas = (raiz) => raiz.querySelectorAll('[data-tarea-form]').forEach(ajustarTipo);

    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-verificar-codigo]')) { verificar(e.target.closest('form')); return; }

        const atajo = e.target.closest('[data-atajo]');
        if (atajo) {
            const dias = atajo.dataset.atajo ? atajo.dataset.atajo.split(',') : [];
            atajo.closest('[data-horario]').querySelectorAll('[data-dia]').forEach((fila) => {
                const casilla = fila.querySelector('[data-dia-casilla]');
                casilla.checked = dias.includes(casilla.value);
                ajustarDia(fila);
            });
            return;
        }

        const copiar = e.target.closest('[data-copiar-horario]');
        if (copiar) {
            const filas = [...copiar.closest('[data-horario]').querySelectorAll('[data-dia]')]
                .filter((f) => f.querySelector('[data-dia-casilla]').checked);
            const modelo = filas.find((f) => f.querySelector('select').value);
            if (!modelo) { alert('Primero marca un día y ponle la hora de entrada y de salida.'); return; }
            const [entrada, salida] = [...modelo.querySelectorAll('select')].map((s) => s.value);
            filas.forEach((f) => { const [a, b] = f.querySelectorAll('select'); a.value = entrada; b.value = salida; });
            return;
        }

        // «+ Asignarle una tarea» desde el modal de un trabajador: lo deja elegido.
        const para = e.target.closest('[data-para]');
        if (para) {
            const select = document.querySelector('#tarea-nueva [data-tarea-trabajador]');
            if (select) select.value = para.dataset.para;
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.matches('[data-dia-casilla]')) ajustarDia(e.target.closest('[data-dia]'));
        if (e.target.matches('[data-tarea-tipo]')) ajustarTipo(e.target.closest('form'));
        if (e.target.matches('[data-codigo]')) {
            const caja = e.target.closest('form').querySelector('[data-codigo-resultado]');
            if (caja) caja.hidden = true;
        }
    });

    // Enter en el código verifica en vez de enviar el formulario.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-codigo]')) {
            e.preventDefault();
            verificar(e.target.closest('form'));
        }
    });

    iniciarHorarios(document);
    iniciarTareas(document);
})();
