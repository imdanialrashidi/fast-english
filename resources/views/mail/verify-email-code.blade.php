<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>کد تأیید ایمیل Fast English</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ee;color:#1f1b16;font-family:Tahoma,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f4ee;padding:24px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5ded3;border-radius:16px;padding:28px;">
                <tr>
                    <td style="font-size:20px;font-weight:700;padding-bottom:8px;">Fast English</td>
                </tr>
                <tr>
                    <td style="font-size:16px;line-height:28px;padding-bottom:16px;">
                        {{ $userName }} عزیز،
                    </td>
                </tr>
                <tr>
                    <td style="font-size:15px;line-height:26px;color:#5c5348;padding-bottom:20px;">
                        برای کامل‌کردن ساخت حساب، کد زیر را در صفحهٔ تأیید ایمیل وارد کنید.
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:8px 0 20px 0;">
                        <div dir="ltr" style="display:inline-block;letter-spacing:10px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;color:#1f1b16;background:#f7f4ee;border:1px solid #e5ded3;border-radius:12px;padding:14px 22px 14px 32px;">{{ $code }}</div>
                    </td>
                </tr>
                <tr>
                    <td style="font-size:14px;line-height:24px;color:#5c5348;padding-bottom:12px;">
                        این کد تا {{ $expiresInMinutes }} دقیقه معتبر است و فقط یک بار استفاده می‌شود.
                    </td>
                </tr>
                <tr>
                    <td style="font-size:13px;line-height:24px;color:#7a7165;border-top:1px solid #e5ded3;padding-top:16px;">
                        اگر شما این حساب را نساخته‌اید، این ایمیل را نادیده بگیرید. کد را برای هیچ‌کس نفرستید؛ کارکنان Fast English هرگز کد را از شما نمی‌پرسند.
                    </td>
                </tr>
            </table>
            <div style="font-size:12px;color:#7a7165;padding-top:14px;">Fast English — خواندن و شنیدن انگلیسی</div>
        </td>
    </tr>
</table>
</body>
</html>
