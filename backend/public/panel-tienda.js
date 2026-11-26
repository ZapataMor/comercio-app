// Mi tienda (panel web): en el formulario de cuenta solo se muestran los
// campos que aplican al tipo (banco, ahorros/corriente) y la etiqueta del
// número cambia («Llave», «Número de celular»...). Los modales los abre
// panel-catalogo.js.
(() => {
    const etiquetas = { llave: 'Llave', nequi: 'Número de celular', daviplata: 'Número de celular', qr: 'Número o llave (opcional)' };
    const ajustar = (select) => {
        const form = select.closest('form');
        const tipo = select.value;
        form.querySelectorAll('[data-cuenta-solo]').forEach((campo) => {
            const aplica = campo.dataset.cuentaSolo.split(' ').includes(tipo);
            campo.hidden = !aplica;
            campo.querySelectorAll('input,select').forEach((c) => { c.disabled = !aplica; });
        });
        form.querySelector('[data-etiqueta-numero]').textContent = etiquetas[tipo] || 'Número de cuenta';
        form.querySelector('[data-ayuda-qr]').hidden = tipo !== 'qr';
        form.querySelector('[name=numero]').required = tipo !== 'qr';
    };
    document.addEventListener('change', (e) => { if (e.target.matches('[data-tipo-cuenta]')) ajustar(e.target); });
    document.querySelectorAll('[data-tipo-cuenta]').forEach(ajustar);
})();
