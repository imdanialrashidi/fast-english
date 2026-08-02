// Development-only component catalog (Visual Slice 1).
//
// Renders every part of the visual system with semantic labels and test IDs
// so Playwright can inspect computed styles, geometry, contrast and focus
// without image understanding. The route is registered only when
// `VITE_CATALOG=1` or in dev builds (see App.tsx) and is never part of the
// production navigation.
//
// Sections: source colors, semantic Light/Dark colors, contrast ratios,
// typography, spacing, shape, elevation, motion, buttons, icon buttons,
// inputs, cards, alerts, chips, progress, skeletons, dialogs, navigation,
// logo variants, Persian long text, English LTR text, states, Light/Dark.

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Brand } from '../brand/Brand';
import { StatePanel } from '../shell/StatePanel';
import { contrastRatio } from '../theme/contrast';
import { ThemeSwitch } from '../theme/ThemeSwitch';
import {
  duration,
  easing,
  elevation,
  elevationDark,
  elevationLight,
  fontStacks,
  layout,
  radius,
  semanticColors,
  type semanticLight,
  sourceBrand,
  spacingScale,
  typeScale,
} from '../theme/tokens';
import { cefr, cefrLevels } from '../theme/tokens/cefr';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      data-testid={`catalog-section-${id}`}
      aria-label={title}
      sx={{ mb: 5 }}
    >
      <Typography variant="headlineSmall" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <Box
      data-testid={`swatch-${name}`}
      data-color={value}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        minWidth: 120,
        maxWidth: 160,
      }}
    >
      <Box
        sx={{
          height: 48,
          borderRadius: radius.radiusControl,
          backgroundColor: value,
          border: '1px solid',
          borderColor: 'outlineVariant',
        }}
        aria-hidden
      />
      <Typography variant="labelSmall" sx={{ direction: 'ltr' }}>
        {name}
      </Typography>
      <Typography variant="labelSmall" color="text.secondary" sx={{ direction: 'ltr' }}>
        {value}
      </Typography>
    </Box>
  );
}

// Pairs verified live against the token values (same util as the unit test).
const contrastPairs: Array<{
  label: string;
  fg: keyof typeof semanticLight;
  bg: keyof typeof semanticLight;
  target: number;
}> = [
  { label: 'متن CTA روی Primary', fg: 'onPrimary', bg: 'primary', target: 4.5 },
  {
    label: 'متن روی PrimaryContainer',
    fg: 'onPrimaryContainer',
    bg: 'primaryContainer',
    target: 4.5,
  },
  {
    label: 'متن روی SecondaryContainer',
    fg: 'onSecondaryContainer',
    bg: 'secondaryContainer',
    target: 4.5,
  },
  { label: 'متن روی AccentContainer', fg: 'onAccentContainer', bg: 'accentContainer', target: 4.5 },
  { label: 'متن اصلی روی سطح', fg: 'onSurface', bg: 'surface', target: 4.5 },
  { label: 'متن فرعی روی سطح', fg: 'onSurfaceVariant', bg: 'surface', target: 4.5 },
  { label: 'موفقیت', fg: 'onSuccess', bg: 'success', target: 4.5 },
  { label: 'خطا', fg: 'onError', bg: 'error', target: 4.5 },
  { label: 'هشدار', fg: 'onWarning', bg: 'warning', target: 4.5 },
  { label: 'اطلاع', fg: 'onInfo', bg: 'info', target: 4.5 },
  { label: 'خطوط مرزی (UI)', fg: 'outline', bg: 'surface', target: 3 },
  { label: 'حلقه تمرکز', fg: 'focusRing', bg: 'surface', target: 3 },
];

export function CatalogRoute() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const schemes = ['light', 'dark'] as const;

  return (
    <Box
      data-testid="catalog-root"
      sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 1200, mx: 'auto' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 4, alignItems: 'center' }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="displayMedium" component="h1" sx={{ mb: 0.5 }}>
            کاتالوگ اجزای بصری
          </Typography>
          <Typography variant="bodyMedium" color="text.secondary">
            حالت نمایش را تغییر دهید؛ همهٔ مقادیر با همان توکن‌ها بازبینی می‌شوند.
          </Typography>
        </Box>
        <ThemeSwitch />
      </Stack>

      <Section id="source-colors" title="رنگ‌های منبع برند">
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
          {Object.entries(sourceBrand.light).map(([name, value]) => (
            <Swatch key={name} name={`light.${name}`} value={value} />
          ))}
          {Object.entries(sourceBrand.dark).map(([name, value]) => (
            <Swatch key={name} name={`dark.${name}`} value={value} />
          ))}
        </Stack>
      </Section>

      {schemes.map((scheme) => (
        <Section
          key={scheme}
          id={`semantic-${scheme}`}
          title={`رنگ‌های معنایی — ${scheme === 'light' ? 'روشن' : 'تیره'}`}
        >
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            {Object.entries(semanticColors[scheme]).map(([name, value]) => (
              <Swatch key={name} name={name} value={value} />
            ))}
          </Stack>
        </Section>
      ))}

      <Section id="contrast" title="نسبت‌های کنتراست (محاسبه‌شده)">
        {schemes.map((scheme) => (
          <Box key={scheme} sx={{ mb: 2 }}>
            <Typography variant="titleMedium" sx={{ mb: 1 }}>
              {scheme === 'light' ? 'روشن' : 'تیره'}
            </Typography>
            <Stack spacing={1} data-testid={`contrast-list-${scheme}`}>
              {contrastPairs.map((pair) => {
                const p = semanticColors[scheme];
                const ratio = contrastRatio(p[pair.fg], p[pair.bg]);
                const pass = ratio >= pair.target;
                return (
                  <Box
                    key={pair.label}
                    data-testid={`contrast-${scheme}-${String(pair.fg)}-${String(pair.bg)}`}
                    data-ratio={ratio.toFixed(2)}
                    data-pass={pass ? 'true' : 'false'}
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      p: 1,
                      borderRadius: '10px',
                      backgroundColor: 'surfaceContainerLow',
                    }}
                  >
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '10px',
                        backgroundColor: p[pair.bg],
                        color: p[pair.fg],
                        fontWeight: 700,
                      }}
                    >
                      نمونه
                    </Box>
                    <Typography variant="bodySmall" sx={{ flex: 1, minWidth: 0 }}>
                      {pair.label}
                    </Typography>
                    <Typography variant="labelSmall" sx={{ direction: 'ltr' }}>
                      {ratio.toFixed(2)}:1
                    </Typography>
                    <Chip
                      size="small"
                      color={pass ? 'success' : 'error'}
                      label={pass ? 'قابل قبول' : 'نامعتبر'}
                      sx={{ minHeight: 24 }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Section>

      <Section id="typography" title="تایپوگرافی">
        <Stack spacing={2}>
          {Object.entries(typeScale).map(([name, style]) => (
            <Box key={name} data-testid={`type-${name}`}>
              <Typography variant={name as never} component="div">
                نمونهٔ متن فارسی برای {name}
              </Typography>
              <Typography variant="labelSmall" color="text.secondary" sx={{ direction: 'ltr' }}>
                {name} — {style.fontSize} / {style.lineHeight}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section id="spacing" title="فاصله‌گذاری">
        <Stack spacing={1}>
          {Object.entries(spacingScale).map(([name, value]) => (
            <Box
              key={name}
              data-testid={`spacing-${name}`}
              sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <Typography variant="labelSmall" sx={{ width: 56 }}>
                {name}
              </Typography>
              <Box
                sx={{ height: 16, width: value, backgroundColor: 'primary', borderRadius: '10px' }}
              />
              <Typography variant="labelSmall" color="text.secondary" sx={{ direction: 'ltr' }}>
                {value}px
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section id="shape" title="شکل‌ها">
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
          {Object.entries(radius).map(([name, value]) => (
            <Box key={name} data-testid={`radius-${name}`} sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: value,
                  backgroundColor: 'primaryContainer',
                  border: '1px solid',
                  borderColor: 'outlineVariant',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Typography
                  variant="labelSmall"
                  color="onPrimaryContainer"
                  sx={{ direction: 'ltr' }}
                >
                  {value}px
                </Typography>
              </Box>
              <Typography variant="labelSmall" sx={{ mt: 0.5, display: 'block' }}>
                {name}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section id="elevation" title="ارتفاع">
        {(['light', 'dark'] as const).map((scheme) => (
          <Box key={scheme} sx={{ mb: 2 }}>
            <Typography variant="titleMedium" sx={{ mb: 1 }}>
              {scheme === 'light' ? 'روشن' : 'تیره'}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(scheme === 'light' ? elevationLight : elevationDark).map(
                ([name, value]) => (
                  <Box
                    key={name}
                    data-testid={`elevation-${scheme}-${name}`}
                    data-elevation={value}
                    sx={{
                      width: 120,
                      height: 72,
                      borderRadius: '16px',
                      backgroundColor: 'surfaceContainerLow',
                      boxShadow: value,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Typography variant="labelSmall">{name}</Typography>
                  </Box>
                ),
              )}
            </Stack>
          </Box>
        ))}
        <Typography variant="bodySmall" color="text.secondary">
          مصرف: `theme.elevation.*` و متغیرهای CSS `--mui-elevation-*`.
        </Typography>
      </Section>

      <Section id="motion" title="حرکت">
        <Stack spacing={1}>
          <Typography variant="bodySmall">
            مدت‌ها:{' '}
            {Object.entries(duration)
              .map(([k, v]) => `${k} ${v}ms`)
              .join('، ')}
          </Typography>
          <Typography variant="bodySmall">
            شتاب‌ها:{' '}
            {Object.entries(easing)
              .map(([k, v]) => `${k} ${v}`)
              .join('، ')}
          </Typography>
          <Box data-testid="motion-demo" sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip
              label="بازخورد حالت"
              sx={{
                transition: `background-color ${duration.durationFast}ms ${easing.easingStandard}`,
              }}
            />
            <Typography variant="bodySmall" color="text.secondary">
              کاهش حرکت: همهٔ مدت‌ها در prefers-reduced-motion صفر می‌شوند.
            </Typography>
          </Box>
        </Stack>
      </Section>

      <Section id="buttons" title="دکمه‌ها">
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Button variant="contained" data-testid="btn-primary">
              عمل اصلی
            </Button>
            <Button variant="contained" color="secondary" data-testid="btn-secondary">
              عمل دوم
            </Button>
            <Button
              variant="contained"
              color="success"
              data-testid="btn-tonal"
              sx={{
                backgroundColor: 'successContainer',
                color: 'onSuccessContainer',
                '&:hover': { backgroundColor: 'successContainer' },
              }}
            >
              لحنی
            </Button>
            <Button variant="outlined" data-testid="btn-outlined">
              خط‌دار
            </Button>
            <Button variant="text" data-testid="btn-text">
              متنی
            </Button>
            <Button variant="contained" color="error" data-testid="btn-danger">
              حذف
            </Button>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Button variant="contained" disabled data-testid="btn-disabled">
              غیرفعال
            </Button>
            <Button
              variant="contained"
              data-testid="btn-loading"
              startIcon={<CircularProgress size={18} color="inherit" />}
              disabled
            >
              در حال ارسال…
            </Button>
            <Button variant="contained" size="large" data-testid="btn-large">
              بزرگ
            </Button>
            <Button variant="contained" size="small" data-testid="btn-small">
              کوچک
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section id="icon-buttons" title="دکمه‌های آیکنی">
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <IconButton aria-label="بازگشت" data-testid="icon-btn-back">
            <Typography aria-hidden sx={{ fontSize: 20 }}>
              →
            </Typography>
          </IconButton>
          <IconButton aria-label="بستن" data-testid="icon-btn-close">
            <Typography aria-hidden sx={{ fontSize: 20 }}>
              ×
            </Typography>
          </IconButton>
          <IconButton aria-label="بیشتر" disabled data-testid="icon-btn-disabled">
            <Typography aria-hidden sx={{ fontSize: 20 }}>
              ⋯
            </Typography>
          </IconButton>
        </Stack>
      </Section>

      <Section id="inputs" title="ورودی‌ها">
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          <TextField label="شماره موبایل" placeholder="۰۹۱۲…" data-testid="input-default" />
          <TextField
            label="رمز عبور"
            defaultValue="secret"
            error
            helperText="رمز عبور اشتباه است"
            data-testid="input-error"
          />
          <TextField label="نام" disabled value="غیرفعال" data-testid="input-disabled" />
        </Stack>
      </Section>

      <Section id="cards" title="کارت‌ها">
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Card sx={{ width: 240 }} data-testid="card-outlined">
            <CardContent>
              <Typography variant="titleMedium">کارت خط‌دار</Typography>
              <Typography variant="bodySmall" color="text.secondary">
                متن فرعی برای توضیح کوتاه.
              </Typography>
            </CardContent>
          </Card>
          <Card variant="elevation" sx={{ width: 240 }} data-testid="card-elevated">
            <CardContent>
              <Typography variant="titleMedium">کارت برجسته</Typography>
              <Typography variant="bodySmall" color="text.secondary">
                فقط برای سطوح تعاملی خاص.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Section>

      <Section id="alerts" title="هشدارها">
        <Stack spacing={1} sx={{ maxWidth: 520 }}>
          <Alert severity="success" data-testid="alert-success">
            پرداخت ثبت شد.
          </Alert>
          <Alert severity="info" data-testid="alert-info">
            درس جدیدی منتشر شد.
          </Alert>
          <Alert severity="warning" data-testid="alert-warning">
            اشتراک شما رو به پایان است.
          </Alert>
          <Alert severity="error" data-testid="alert-error">
            خطایی رخ داد؛ دوباره تلاش کنید.
          </Alert>
        </Stack>
      </Section>

      <Section id="chips" title="برچسب‌ها">
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label="A1" size="small" data-testid="chip-default" />
          <Chip label="تکمیل‌شده" color="success" data-testid="chip-success" />
          <Chip label="در انتظار" color="warning" data-testid="chip-warning" />
          <Chip label="ردشده" color="error" data-testid="chip-error" />
          <Chip label="پیشنهادی" variant="outlined" data-testid="chip-outlined" />
          {cefrLevels.map((level) => (
            <Chip
              key={level}
              label={cefr[level].label}
              size="small"
              sx={{ backgroundColor: cefr[level].bg, color: cefr[level].fg, fontWeight: 700 }}
              data-testid={`chip-cefr-${level}`}
            />
          ))}
        </Stack>
      </Section>

      <Section id="progress" title="پیشرفت">
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          <LinearProgress value={65} variant="determinate" data-testid="progress-linear" />
          <Stack direction="row" spacing={2}>
            <CircularProgress size={28} data-testid="progress-circular" />
            <CircularProgress
              size={28}
              value={40}
              variant="determinate"
              data-testid="progress-circular-static"
            />
          </Stack>
        </Stack>
      </Section>

      <Section id="skeletons" title="اسکلت‌ها">
        <Stack spacing={1} sx={{ maxWidth: 420 }}>
          <Skeleton variant="text" width="60%" data-testid="skeleton-text" />
          <Skeleton variant="rectangular" height={80} data-testid="skeleton-rect" />
          <Skeleton variant="rounded" height={48} data-testid="skeleton-rounded" />
        </Stack>
      </Section>

      <Section id="dialogs" title="دیالوگ‌ها">
        <Button variant="outlined" onClick={() => setDialogOpen(true)} data-testid="dialog-trigger">
          باز کردن دیالوگ
        </Button>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} data-testid="catalog-dialog">
          <DialogTitle>تأیید اقدام</DialogTitle>
          <DialogContent>
            <Typography variant="bodyMedium">
              این یک دیالوگ نمونه برای آزمون تلهٔ تمرکز و اندازه در دیدگا‌ه‌های کوچک است.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} variant="text" data-testid="dialog-cancel">
              انصراف
            </Button>
            <Button
              onClick={() => setDialogOpen(false)}
              variant="contained"
              data-testid="dialog-confirm"
            >
              تأیید
            </Button>
          </DialogActions>
        </Dialog>
      </Section>

      <Section id="navigation" title="ناوبری">
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          aria-label="نمونه تب"
          data-testid="tabs-sample"
        >
          <Tab label="خانه" />
          <Tab label="درس‌ها" />
          <Tab label="حساب" />
        </Tabs>
      </Section>

      <Section id="logo" title="لوگو">
        <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <Box data-testid="logo-mark">
            <Brand variant="mark" />
          </Box>
          <Box data-testid="logo-compact">
            <Brand variant="compact" />
          </Box>
          <Box data-testid="logo-full">
            <Brand variant="full" />
          </Box>
          <Box data-testid="logo-header">
            <Brand variant="header" maxWidth={200} />
          </Box>
        </Stack>
        <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 1 }}>
          variant «header» فقط روی سطوح روشن PNG اصلی را نمایش می‌دهد؛ در حالت تیره درمان تک‌رنگ
          جایگزین می‌شود.
        </Typography>
      </Section>

      <Section id="persian-long" title="متن بلند فارسی">
        <Box data-testid="persian-long-text" dir="rtl" lang="fa" sx={{ maxWidth: '40rem' }}>
          <Typography variant="headlineMedium" component="h3" sx={{ overflowWrap: 'anywhere' }}>
            عنوان بسیار بلند صفحهٔ نمونه برای آزمودن شکستن سطر در عنوان‌های طولانی فارسی بدون کوتاه‌شدن
            یا تداخل با کنش‌ها
          </Typography>
          <Typography variant="bodyMedium" data-testid="persian-paragraph">
            پاراگراف بلند فارسی برای بررسی ارتفاع خط راحت و جهت راست‌به‌چپ: یادگیری زبان انگلیسی با
            پادکست، شنیدن هدفمند، تکرار هوشمند و متن‌های سطح‌بندی‌شده را کنار هم می‌آورد تا مسیر یادگیری
            برای هر فارسی‌زبان بزرگسالی روشن و آرام باشد. این پاراگراف عمداً طولانی نوشته شده تا رفتار
            چیدمان در عرض‌های ۳۶۰ تا ۱۴۴۰ پیکسل ثابت بماند.
          </Typography>
        </Box>
      </Section>

      <Section id="english-ltr" title="متن انگلیسی (LTR)">
        <Box data-testid="english-ltr-text" dir="ltr" lang="en" sx={{ maxWidth: '40rem' }}>
          <Typography variant="englishReading" component="p">
            This English reading passage is explicitly left-to-right inside the RTL interface. It
            must stay inside its bounded measure on every supported viewport, keep a readable line
            height, and never overflow the reading container even at 200% text zoom.
          </Typography>
          <Typography variant="englishMetadata" component="p" sx={{ mt: 1 }}>
            Lesson 12 · Upper-intermediate · 08:42
          </Typography>
        </Box>
      </Section>

      <Section id="states" title="حالت‌ها">
        <Stack spacing={2} sx={{ maxWidth: 520 }}>
          <StatePanel variant="loading" data-testid="state-loading" />
          <StatePanel variant="empty" title="هنوز درسی ثبت نشده" data-testid="state-empty" />
          <StatePanel variant="error" title="ارتباط برقرار نشد" data-testid="state-error" />
          <StatePanel variant="success" data-testid="state-success" />
          <StatePanel variant="permission" data-testid="state-permission" />
          <StatePanel variant="offline" data-testid="state-offline" />
        </Stack>
      </Section>

      <Section id="fonts" title="فونت">
        <Typography variant="bodySmall">
          خانوادهٔ اصلی: {fontStacks.fa} — بدون فونت از CDN.
        </Typography>
        <Typography variant="bodySmall" sx={{ direction: 'ltr', textAlign: 'left' }}>
          Latin stack: {fontStacks.en}
        </Typography>
      </Section>
    </Box>
  );
}

export const catalogElevation = elevation;
export const catalogLayout = layout;
