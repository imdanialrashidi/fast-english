@extends('layouts.public')

@section('title', 'دسترسی ندارید')

@section('content')
<div class="fe-measure">
    <h1>دسترسی ندارید</h1>
    <p class="fe-muted">متن کامل این درس نیازمند اشتراک فعال است. نمونه‌های عمومی بدون ورود در دسترس‌اند.</p>
    @guest
        <p><a class="fe-level-link" href="{{ route('login') }}">ورود به حساب</a></p>
    @endguest
</div>
@endsection
