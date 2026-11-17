document.addEventListener('submit',function(event){const form=event.target;if(form.dataset.confirm&&!window.confirm(form.dataset.confirm)){event.preventDefault();return;}if(form.method.toLowerCase()==='post'){form.querySelectorAll('button[type="submit"],button:not([type])').forEach(b=>{b.disabled=true;b.textContent='Guardando…';});}});
document.addEventListener('error', function(event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-foto-negocio')) return;
    const fallback = document.createElement('div');
    fallback.className = img.parentElement.className + ' foto-fallida';
    fallback.textContent = 'Imagen no disponible: ' + img.alt;
    img.parentElement.replaceWith(fallback);
}, true);
