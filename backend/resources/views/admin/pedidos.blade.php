@extends('layouts.app')
@section('titulo', 'Pedidos e historial')
@section('contenido')
@include('admin._nav')
<h1>Pedidos e historial</h1>
@include('admin._pedidos-contenido')
@endsection
