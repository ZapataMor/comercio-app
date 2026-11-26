// Catálogo del panel web: modales de producto (detalle y edición).
(() => {
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

    // Vista previa de la imagen elegida.
    document.addEventListener('change', (e) => {
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
    });

    // Los campos de comida (extras, ingredientes fijos) y de ropa (colores)
    // solo se muestran para ese tipo, y la etiqueta de las características
    // cambia con el tipo («Ingredientes», «Tallas disponibles»...).
    const ajustarTipo = (select) => {
        const opcion = select.selectedOptions[0];
        const slug = opcion ? opcion.dataset.slug || '' : '';
        const form = select.closest('form');
        form.querySelectorAll('[data-solo]').forEach((campo) => { campo.hidden = campo.dataset.solo !== slug; });
        const etiqueta = form.querySelector('[data-etiqueta-atributos]');
        if (etiqueta) etiqueta.textContent = (opcion && opcion.dataset.etiqueta) || 'Características';
    };
    document.querySelectorAll('[data-tipo-producto]').forEach(ajustarTipo);
})();
