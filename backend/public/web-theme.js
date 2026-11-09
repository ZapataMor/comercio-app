(() => {
    const update = () => { const hour = new Date().getHours(); document.documentElement.dataset.mode = hour >= 5 && hour < 18 ? 'dia' : 'noche'; };
    update(); setInterval(update, 60000);
})();
