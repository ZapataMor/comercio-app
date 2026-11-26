{{-- Paginación del panel del negocio (sin Tailwind). --}}
@if ($paginator->hasPages())
    <nav class="paginas" aria-label="Páginas">
        <span>Página {{ $paginator->currentPage() }} de {{ $paginator->lastPage() }}</span>
        <div>
            @if ($paginator->onFirstPage())
                <span class="boton-pagina" aria-disabled="true">Anterior</span>
            @else
                <a href="{{ $paginator->previousPageUrl() }}" rel="prev">Anterior</a>
            @endif
            @if ($paginator->hasMorePages())
                <a href="{{ $paginator->nextPageUrl() }}" rel="next">Siguiente</a>
            @else
                <span class="boton-pagina" aria-disabled="true">Siguiente</span>
            @endif
        </div>
    </nav>
@endif
