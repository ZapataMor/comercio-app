// Catálogo del panel web: modales de producto (detalle y edición), switch de
// disponible/agotado, pestañas Productos/Servicios, listas que se llenan uno
// por uno y cambios en vivo (lo que se cambie en la app se ve aquí solo).
// Mi tienda también lo usa para sus modales.
(() => {
    const csrf = () => (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

    const abrir = (id, editando = false) => {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.toggle('editando', editando || modal.classList.contains('modal-solo-edicion'));
        if (!modal.open) modal.showModal();
        modal.scrollTop = 0;
    };
    window.panelCatalogo = { abrir };

    document.addEventListener('click', (e) => {
        const abre = e.target.closest('[data-abrir]');
        if (abre) { abrir(abre.dataset.abrir); return; }
        const pestana = e.target.closest('[data-pestana]');
        if (pestana) { elegirPestana(pestana.dataset.pestana); return; }
        const agregar = e.target.closest('[data-lista-agregar]');
        if (agregar) { agregarALista(agregar.closest('[data-lista]')); return; }
        const quitar = e.target.closest('[data-lista-quitar]');
        if (quitar) { const lista = quitar.closest('[data-lista]'); quitar.closest('li').remove(); revisarVacia(lista); return; }
        const modal = e.target.closest('dialog.modal');
        if (!modal) return;
        if (e.target === modal || e.target.closest('[data-cerrar]')) { modal.close(); return; }
        if (e.target.closest('[data-editar]')) { modal.classList.add('editando'); modal.scrollTop = 0; return; }
        if (e.target.closest('[data-cancelar-edicion]')) {
            if (modal.classList.contains('modal-solo-edicion')) modal.close();
            else { modal.classList.remove('editando'); modal.scrollTop = 0; }
        }
    });

    // Confirmar antes de eliminar.
    document.addEventListener('submit', (e) => {
        const mensaje = e.target.dataset.confirmar;
        if (mensaje && !confirm(mensaje)) e.preventDefault();
    });

    document.addEventListener('change', (e) => {
        // Vista previa de la imagen elegida.
        if (e.target.matches('[data-elegir-foto]')) {
            const archivo = e.target.files && e.target.files[0];
            const vista = e.target.closest('form').querySelector('[data-vista-foto]');
            if (archivo && vista) {
                const img = document.createElement('img');
                img.alt = '';
                img.src = URL.createObjectURL(archivo);
                vista.replaceChildren(img);
            }
        }
        if (e.target.matches('[data-tipo-producto]')) ajustarTipo(e.target);
        if (e.target.matches('[data-disponible]')) cambiarDisponible(e.target);
    });

    // ------------------------------------------------ Disponible / agotado
    let cambiando = 0;
    const pintarEstado = (tarjeta, disponible) => {
        tarjeta.classList.toggle('agotado', !disponible);
        tarjeta.querySelectorAll('[data-estado-texto]').forEach((t) => { t.textContent = disponible ? 'Disponible' : 'Agotado'; });
        const chip = tarjeta.querySelector('.producto-estado');
        if (chip) chip.classList.toggle('chip-exito', disponible);
    };
    const cambiarDisponible = async (input) => {
        const tarjeta = input.closest('[data-producto]');
        const disponible = input.checked;
        pintarEstado(tarjeta, disponible);
        input.disabled = true;
        cambiando++;
        try {
            const datos = new FormData();
            datos.append('_method', 'PATCH');
            datos.append('disponible', disponible ? '1' : '0');
            const r = await fetch(input.dataset.disponible, {
                method: 'POST', body: datos, credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'No se pudo cambiar.');
            const json = await r.json();
            input.checked = json.disponible;
            pintarEstado(tarjeta, json.disponible);
        } catch (err) {
            input.checked = !disponible;
            pintarEstado(tarjeta, !disponible);
            alert(err.message || 'No se pudo cambiar. Revisa tu conexión.');
        } finally {
            input.disabled = false;
            cambiando--;
            refrescarLuego(); // el modal del producto también debe mostrar el estado nuevo
        }
    };

    // ------------------------------------------------ Pestañas
    const elegirPestana = (nombre) => {
        document.querySelectorAll('[data-pestana]').forEach((b) => {
            const activa = b.dataset.pestana === nombre;
            b.setAttribute('aria-selected', activa ? 'true' : 'false');
            b.tabIndex = activa ? 0 : -1;
            const panel = document.getElementById(b.getAttribute('aria-controls'));
            if (panel) panel.hidden = !activa;
        });
        document.querySelectorAll('[data-solo-pestana]').forEach((el) => { el.hidden = el.dataset.soloPestana !== nombre; });
        const url = new URL(location.href);
        if (nombre === 'servicios') url.searchParams.set('pestana', 'servicios'); else url.searchParams.delete('pestana');
        history.replaceState(null, '', url);
    };
    document.addEventListener('keydown', (e) => {
        const actual = e.target.closest && e.target.closest('[role="tab"]');
        if (!actual || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const tabs = [...actual.parentElement.querySelectorAll('[role="tab"]')];
        const siguiente = tabs[(tabs.indexOf(actual) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        elegirPestana(siguiente.dataset.pestana);
        siguiente.focus();
    });

    // ------------------------------------------------ Listas uno por uno
    const revisarVacia = (lista) => {
        const vacia = lista.querySelector('[data-lista-vacia]');
        if (vacia) vacia.hidden = lista.querySelectorAll('[data-lista-filas] li').length > 0;
    };
    const agregarALista = (lista) => {
        const entrada = lista.querySelector('[data-lista-entrada]');
        const texto = entrada.value.trim().replace(/\s+/g, ' ');
        if (!texto) { entrada.focus(); return; }
        const filas = lista.querySelector('[data-lista-filas]');
        const existentes = [...filas.querySelectorAll('input[type=hidden]')].map((i) => i.value.toLowerCase());
        if (existentes.includes(texto.toLowerCase())) { entrada.select(); return; }
        if (existentes.length >= Number(lista.dataset.maximo || 30)) { alert('Llegaste al máximo de ' + lista.dataset.maximo + '.'); return; }
        const fila = document.getElementById('plantilla-lista-item').content.firstElementChild.cloneNode(true);
        fila.querySelector('.lista-item-texto').textContent = texto;
        const oculto = fila.querySelector('input[type=hidden]');
        oculto.name = lista.dataset.campo + '[]';
        oculto.value = texto;
        fila.querySelector('[data-lista-quitar]').setAttribute('aria-label', 'Quitar ' + texto);
        const obligatorio = fila.querySelector('.lista-item-obligatorio');
        if (lista.hasAttribute('data-con-fijos')) {
            const casilla = obligatorio.querySelector('input');
            casilla.value = texto;
            casilla.disabled = lista.closest('form').dataset.tipo !== 'comida';
        } else {
            obligatorio.remove();
        }
        filas.appendChild(fila);
        entrada.value = '';
        entrada.focus();
        revisarVacia(lista);
    };
    // Enter en la casilla agrega a la lista (no envía el formulario).
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-lista-entrada]')) {
            e.preventDefault();
            agregarALista(e.target.closest('[data-lista]'));
        }
    });
    // Lo escrito sin presionar «Agregar» también se guarda.
    document.addEventListener('submit', (e) => {
        if (e.defaultPrevented) return;
        e.target.querySelectorAll('[data-lista]').forEach((lista) => {
            if (lista.querySelector('[data-lista-entrada]').value.trim()) agregarALista(lista);
        });
    }, true);

    // Los campos de comida (extras, obligatorios) y de ropa (colores) solo se
    // muestran para ese tipo, y la etiqueta de las características cambia con
    // el tipo («Ingredientes», «Tallas disponibles»...).
    const ajustarTipo = (select) => {
        const opcion = select.selectedOptions[0];
        const slug = opcion ? opcion.dataset.slug || '' : '';
        const form = select.closest('form');
        form.dataset.tipo = slug;
        form.querySelectorAll('[data-solo]').forEach((campo) => { campo.hidden = campo.dataset.solo !== slug; });
        form.querySelectorAll('.lista-item-obligatorio input').forEach((c) => { c.disabled = slug !== 'comida'; });
        const etiqueta = form.querySelector('[data-etiqueta-atributos]');
        if (etiqueta) etiqueta.textContent = (opcion && opcion.dataset.etiqueta) || 'Características';
    };
    const iniciar = (raiz) => raiz.querySelectorAll('[data-tipo-producto]').forEach(ajustarTipo);
    iniciar(document);

    // ------------------------------------------------ En vivo
    // Cuando el catálogo cambia (en la app, en otra pestaña o aquí mismo),
    // se vuelve a pedir esta página y se cambia solo la parte del catálogo.
    // Si hay un modal abierto o se está escribiendo, espera a que termine.
    const vivo = document.getElementById('catalogo-vivo');
    if (!vivo) return;
    const negocioId = Number(vivo.dataset.negocio);
    let pendiente = false;
    let temporizador = null;

    const ocupado = () => cambiando > 0 || document.querySelector('dialog[open]')
        || (document.activeElement && vivo.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]),select,textarea'));

    const refrescar = async () => {
        if (ocupado()) { pendiente = true; return; }
        pendiente = false;
        try {
            const r = await fetch(location.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
            if (!r.ok || r.redirected) return;
            const nuevo = new DOMParser().parseFromString(await r.text(), 'text/html').getElementById('catalogo-vivo');
            if (!nuevo) return;
            if (ocupado()) { pendiente = true; return; }
            vivo.replaceChildren(...nuevo.childNodes);
            iniciar(vivo);
        } catch (_) { /* sin conexión: se intenta en el próximo aviso */ }
    };
    function refrescarLuego() {
        clearTimeout(temporizador);
        temporizador = setTimeout(refrescar, 350);
    }
    document.addEventListener('close', () => { if (pendiente) refrescarLuego(); }, true);
    document.addEventListener('focusout', () => { if (pendiente) setTimeout(() => { if (pendiente) refrescarLuego(); }, 50); });

    // Respaldo: al volver a la pestaña y cada minuto si no hay conexión en vivo.
    let conectado = false;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescarLuego(); });
    setInterval(() => { if (!conectado && !document.hidden) refrescarLuego(); }, 60000);

    const config = window.vitrinaEnVivo;
    if (!config || !config.clave || typeof window.Pusher !== 'function') return;
    // Como la app: http://host:8000 -> ws://host:8080 (reverb:start);
    // https://host[:p] -> wss://host[:p] (el proxy pasa /app a Reverb).
    const tls = location.protocol === 'https:';
    const puerto = tls ? Number(location.port || 443) : config.puerto;
    try {
        const pusher = new window.Pusher(config.clave, {
            cluster: 'mt1', wsHost: location.hostname, wsPort: puerto, wssPort: puerto,
            forceTLS: tls, enabledTransports: ['ws', 'wss'], disableStats: true,
        });
        pusher.connection.bind('state_change', (s) => { conectado = s.current === 'connected'; });
        pusher.subscribe('catalogo').bind('cambio', (aviso) => {
            if (aviso && aviso.tema === 'catalogo' && Number(aviso.negocio_id) === negocioId) refrescarLuego();
        });
    } catch (_) { /* sin Reverb queda el respaldo */ }
})();
