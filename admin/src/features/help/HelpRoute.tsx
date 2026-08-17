// admin/src/features/help/HelpRoute.tsx
// Static read-only Staff Help (راهنما). Intentionally NOT a knowledge base:
// a compact operational cheat sheet with pointers to the full Persian
// manuals (docs/OPERATOR_MANUAL_FA.md, docs/TECHNICAL_OWNER_RUNBOOK_FA.md),
// which live in the repository and are maintained there. No API calls, no
// new dependencies, no per-operator data.

import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { PageContainer } from '../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../shared/ui/PageHeader';

const REQUEST_STATUS_ROWS: Array<{ name: string; label: string; meaning: string }> = [
  { name: 'pending', label: 'در انتظار', meaning: 'رسید ثبت شده و منتظر بررسی شماست.' },
  { name: 'approved', label: 'تأیید شده', meaning: 'اشتراک فعال شد؛ درخواست بایگانی می‌شود.' },
  {
    name: 'rejected',
    label: 'رد شده',
    meaning: 'با دلیل ثبت شد؛ دانشجو می‌تواند رسید جدید بفرستد.',
  },
  { name: 'cancelled', label: 'لغو شده', meaning: 'کنار گذاشته شده؛ معمولاً اقدامی لازم نیست.' },
];

const ACCOUNT_STATUS_ROWS: Array<{ name: string; label: string; meaning: string }> = [
  {
    name: 'pending_payment',
    label: 'در انتظار پرداخت',
    meaning: 'تازه ثبت‌نام کرده؛ درخواست تأییدشده ندارد.',
  },
  {
    name: 'payment_rejected',
    label: 'پرداخت رد شده',
    meaning: 'آخرین رسید رد شده و اشتراک فعالی ندارد.',
  },
  { name: 'active', label: 'فعال', meaning: 'اشتراک فعال دارد.' },
  { name: 'expired', label: 'منقضی شده', meaning: 'اشتراک قبلی تمام شده.' },
  {
    name: 'suspended',
    label: 'معلق',
    meaning: 'دسترسی قطع شده؛ فعال‌سازی ممکن نیست — ارجاع به مالک/مسئول فنی.',
  },
];

function StatusTable({ rows }: { rows: Array<{ name: string; label: string; meaning: string }> }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>وضعیت</TableCell>
          <TableCell>برچسب</TableCell>
          <TableCell>معنی</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell dir="ltr" sx={{ textAlign: 'start' }}>
              {r.name}
            </TableCell>
            <TableCell>{r.label}</TableCell>
            <TableCell>{r.meaning}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="titleMedium" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export function HelpRoute() {
  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="راهنما"
        subtitle="خلاصهٔ عملیاتی برای کار روزمره — راهنمای کامل در مخزن پروژه نگهداری می‌شود"
      />
      <Stack spacing={2}>
        <SectionCard title="جریان پرداخت (خلاصه)">
          <Typography variant="body2" component="div" sx={{ mb: 1 }}>
            دانشجو ثبت‌نام می‌کند ← طرح را انتخاب و کارت‌به‌کارت واریز می‌کند ← یک رسید بارگذاری می‌کند ←
            درخواست «در انتظار» در صف شما قرار می‌گیرد ← شما طبق روش استاندارد بررسی و «تأیید» یا
            «رد» می‌کنید. تأیید، اشتراک را همان لحظه فعال می‌کند؛ رد با «دلیل رد» (حداقل ۳ حرف) ثبت
            می‌شود که دانشجو همان متن را می‌بیند.
          </Typography>
          <Alert severity="info" sx={{ mt: 1 }}>
            <strong>روش استاندارد بررسی رسید:</strong> خوانایی تصویر، مطابقت مبلغ با «مبلغ مورد
            انتظار»، کارت مقصد، زمان واریز، فرستنده (۴ رقم آخر)، و تکراری نبودن. تصویر رسید به
            تنهایی اثبات پرداخت نیست.
          </Alert>
          <Alert severity="warning" sx={{ mt: 1 }}>
            <strong>تأیید اشتباهی بازگردانی ندارد.</strong> رد کردن، بازگردانی نیست. در این حالت به
            مالک اطلاع دهید؛ هرگز رکوردها را دستی تغییر ندهید.
          </Alert>
        </SectionCard>

        <SectionCard title="معنی وضعیت‌ها">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            درخواست پرداخت
          </Typography>
          <StatusTable rows={REQUEST_STATUS_ROWS} />
          <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
            وضعیت حساب دانشجو
          </Typography>
          <StatusTable rows={ACCOUNT_STATUS_ROWS} />
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            وضعیت اشتراک: «فعال» / «منقضی شده». وضعیت محتوا: «پیش‌نویس» / «منتشر شده» / «آرشیو شده».
          </Typography>
        </SectionCard>

        <SectionCard title="انتشار محتوا (چک‌لیست کوتاه)">
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>عنوان فارسی و انگلیسی دقیق؛ سطح (A1–C2) هر نسخه درست انتخاب شده</li>
            <li>صوت بارگذاری و قابل پخش؛ مدت نمایش داده می‌شود</li>
            <li>متن اپیزود کامل و بدون placeholder؛ واژگان (واژه + معنی فارسی + توضیح انگلیسی)</li>
            <li>تصویر اصلی (و اختیاری تصویر عریض) بارگذاری شده</li>
            <li>پیش‌نمایش را ببینید؛ پنل «آماده انتشار» خطای مانع نداشته باشد</li>
            <li>«انتشار» یعنی بلافاصله در دسترس دانشجویان فعال قرار می‌گیرد</li>
          </Typography>
        </SectionCard>

        <SectionCard title="قوانین ارجاع (خلاصه)">
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>
              یک کاربر نمی‌تواند وارد شود ← وضعیت حساب را ببین؛ اگر عادی ولی خطا دارد ← ارجاع فنی
            </li>
            <li>
              صوت فقط یک اپیزود خراب است ← بررسی محتوا؛ اگر محتوا سالم ولی پخش کلی خراب ← ارجاع فنی
            </li>
            <li>سایت برای همه در دسترس نیست / خطای ۵۰۲ ← ارجاع فنی فوری</li>
            <li>شک به نفوذ یا نشت اطلاعات ← ارجاع امنیتی فوری (مالک + مسئول فنی)</li>
            <li>بازگشت وجه / تأیید اشتباهی / تعیین سطح دوباره ← ارجاع به مالک</li>
          </Typography>
          <Alert severity="error" sx={{ mt: 1.5 }}>
            اپراتور عادی هرگز سرور را ری‌استارت نمی‌کند، دیتابیس را ویرایش نمی‌کند، مهاجرت اجرا نمی‌کند
            و رمز سوپریوزر را نمی‌گیرد.
          </Alert>
        </SectionCard>

        <SectionCard title="راهنمای کامل">
          <Typography variant="body2">
            این صفحه فقط خلاصه است. راهنمای کامل، برگهٔ راهنمای سریع، چک‌لیست روز راه‌اندازی و راهنمای
            مسئول فنی در مخزن پروژه نگهداری می‌شوند (مسیرهای «docs»):
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
            <li>
              <Typography variant="body2" component="span" dir="ltr">
                docs/OPERATOR_MANUAL_FA.md
              </Typography>
            </li>
            <li>
              <Typography variant="body2" component="span" dir="ltr">
                docs/OPERATOR_QUICK_REFERENCE_FA.md
              </Typography>
            </li>
            <li>
              <Typography variant="body2" component="span" dir="ltr">
                docs/LAUNCH_DAY_CHECKLIST_FA.md
              </Typography>
            </li>
            <li>
              <Typography variant="body2" component="span" dir="ltr">
                docs/TECHNICAL_OWNER_RUNBOOK_FA.md
              </Typography>
            </li>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            اگر بین این راهنما و صفحه‌های واقعی اختلاف دیدید، صفحهٔ واقعی ملاک است و به مالک اطلاع
            دهید تا مستندات اصلاح شود.
          </Typography>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
