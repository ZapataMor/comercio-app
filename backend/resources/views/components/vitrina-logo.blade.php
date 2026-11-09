@props(['height' => 40, 'name' => 'Vitrina'])
@php $logoWidth = $name === 'Vitrinapp' ? 650 : 512; @endphp
{{-- Geometría y colores de frontend/src/components/Logo.tsx, versión día. --}}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {{ $logoWidth }} 160"
     width="{{ $height * $logoWidth / 160 }}" height="{{ $height }}" role="img" aria-label="{{ $name }}"
     {{ $attributes->class(['vitrina-logo']) }}>
    <rect x="0" y="5" width="150" height="150" rx="33" fill="#F7EBD8"/>
    <g transform="translate(0,5) scale(.75)">
        <path d="M42 30H71V72A14.5 14.5 0 0 1 42 72Z" fill="#E2572B"/>
        <path d="M71 30H100V72A14.5 14.5 0 0 1 71 72Z" fill="#F3E0BE"/>
        <path d="M100 30H129V72A14.5 14.5 0 0 1 100 72Z" fill="#E2572B"/>
        <path d="M129 30H158V72A14.5 14.5 0 0 1 129 72Z" fill="#F3E0BE"/>
        <path d="M58 108L100 170L142 108" fill="none" stroke="#22264F" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="100" cy="104" r="9" fill="#F2A93B"/>
    </g>
    <text x="180" y="119.5" font-family="VitrinaSora, sans-serif" font-size="100" font-weight="700" letter-spacing="-1.5" fill="#22264F">{{ $name === 'Vitrinapp' ? 'vıtrınapp' : 'vıtrına' }}</text>
    <rect x="246.65" y="42.5" width="15" height="15" fill="#E2572B" transform="rotate(45 254.15 50)"/>
    <rect x="361.07" y="42.5" width="15" height="15" fill="#E2572B" transform="rotate(45 368.57 50)"/>
</svg>
