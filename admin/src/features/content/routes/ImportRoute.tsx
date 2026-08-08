// admin/src/features/content/routes/ImportRoute.tsx
// Content Package ZIP import: Select ZIP → Parse/Validate → Report →
// Dry-run Plan → Confirm → Execute → Result (+ recent history).
// The server stays authoritative; the report uses the same shared
// validation modules as the CLI, and execution reuses the Slice 3
// plan/execute transport with planStateHash protection.

import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { parseZip } from '../../../../../shared/content-package/zip';
import { assemblePackageFromZip } from '../../../../../shared/content-package/zipPackage';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { executeImport, fetchImportHistory, requestImportPlan } from '../api';
import { ApiError, contentDiagnosticCopy, resolveContentError, safeErrorMessage } from '../errors';
import {
  diagnosticRows,
  importCounts,
  NO_CHANGE_COPY,
  planRows,
  STALE_PLAN_COPY,
  validationStatus,
} from '../presentation';
import type { ImportAuditItem, ImportPlanResponse } from '../types';

type WizardStep = 'select' | 'report' | 'plan' | 'confirm' | 'result';

interface ReportState {
  ok: boolean;
  errors: Array<{ code: string; severity: string; path: string; message: string }>;
  warnings: Array<{ code: string; severity: string; path: string; message: string }>;
  manifest: unknown;
  manifestText: string;
  assets: Array<{
    path: string;
    sizeBytes: number;
    sha256: string;
    bytes: Uint8Array;
    mimeType: string;
  }>;
  levels: string[];
  vocabularyCount: number;
}

const STEP_LABELS = ['انتخاب بسته', 'بررسی', 'برنامه ورود', 'تأیید'];

export function ImportRoute() {
  const [step, setStep] = useState<WizardStep>('select');
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  const [plan, setPlan] = useState<ImportPlanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    kind: 'completed' | 'no_change';
    episodeId?: string;
    counts?: { created: number; updated: number; noChange: number; importedLevels: string[] };
    auditId?: string;
  } | null>(null);
  const [history, setHistory] = useState<ImportAuditItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(() => {
    void fetchImportHistory(10)
      .then((res) => setHistory(res.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const pickFile = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    setPlan(null);
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setError('فقط بسته فشرده ZIP پذیرفته میشود.');
      return;
    }
    if (file.size === 0) {
      setError('فایل انتخابشده خالی است.');
      return;
    }
    setFileName(file.name);
    setBusy(true);
    setStep('report');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseZip(bytes);
      if (!parsed.ok) {
        setError(parsed.message);
        setStep('select');
        return;
      }
      const pkg = await assemblePackageFromZip(parsed.entries);
      const errors = diagnosticRows(pkg.errors);
      const warnings = diagnosticRows(pkg.warnings);
      const manifest = pkg.manifest as {
        episode?: { slug?: string };
        variants?: Array<{ level: string; vocabulary: unknown[] }>;
      };
      const reportState: ReportState = {
        ok: pkg.ok,
        errors,
        warnings,
        manifest: pkg.manifest,
        manifestText: pkg.manifestText ?? '',
        assets: (pkg.assets ?? []).map((a) => ({
          path: a.path,
          sizeBytes: a.sizeBytes,
          sha256: a.sha256,
          bytes: a.bytes,
          mimeType: a.mimeType,
        })),
        levels: (manifest.variants ?? []).map((v) => v.level),
        vocabularyCount: (manifest.variants ?? []).reduce((n, v) => n + v.vocabulary.length, 0),
      };
      setReport(reportState);
      if (!pkg.ok) {
        setStep('report');
        return;
      }
      // Report screen first; the operator presses «ادامه» to plan.
      setStep('report');
    } catch (err) {
      setError(safeErrorMessage(err));
      setStep('select');
    } finally {
      setBusy(false);
    }
  };

  const runPlan = async () => {
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      const res = await requestImportPlan(
        report.manifest,
        report.assets.map((a) => ({ path: a.path, sizeBytes: a.sizeBytes, sha256: a.sha256 })),
      );
      setPlan(res);
      setStep('plan');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'manifest_invalid' && err.details?.errorJson) {
        try {
          const diags = JSON.parse(err.details.errorJson);
          setReport((r) => (r ? { ...r, ok: false, errors: diags } : r));
        } catch {
          // fall through
        }
      }
      setError(resolveContentError(err).message);
      setStep('report');
    } finally {
      setBusy(false);
    }
  };

  const confirmAndExecute = async () => {
    if (!report || !plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await executeImport(
        report.manifest,
        report.assets.map((a) => ({ path: a.path, bytes: a.bytes, mimeType: a.mimeType })),
        plan.planStateHash,
      );
      if (res.result === 'no_change') {
        setResult({ kind: 'no_change', auditId: res.auditId });
      } else {
        setResult({
          kind: 'completed',
          episodeId: res.createdIds?.episodeId,
          counts: importCounts(plan),
          auditId: res.auditId,
        });
      }
      setStep('result');
      loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'plan_stale') {
        // Section 27: re-plan and require a NEW explicit confirmation.
        setError(STALE_PLAN_COPY);
        const res = await requestImportPlan(
          report.manifest,
          report.assets.map((a) => ({ path: a.path, sizeBytes: a.sizeBytes, sha256: a.sha256 })),
        );
        setPlan(res);
        setStep('plan');
        return;
      }
      setError(resolveContentError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('select');
    setReport(null);
    setPlan(null);
    setResult(null);
    setError(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const status = report ? validationStatus(report.errors, report.warnings) : null;

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="ورود محتوا"
        subtitle="بسته محتوا (ZIP) را بررسی و بهصورت پیشنویس وارد کنید"
      />
      <Stepper
        activeStep={
          ({ select: -1, report: 0, plan: 1, confirm: 2, result: 2 } as Record<WizardStep, number>)[
            step
          ]
        }
        sx={{ mb: 3, overflowX: 'auto' }}
      >
        {STEP_LABELS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 'select' ? (
        <Card>
          <CardContent>
            <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="body2" color="text.secondary">
                بسته ZIP شامل فایل episode.json، تصاویر، صوتها و متنها را انتخاب کنید.
              </Typography>
              <Button
                component="label"
                variant="contained"
                startIcon={<CloudUploadRoundedIcon />}
                disabled={busy}
                data-testid="import-pick"
                sx={{ minHeight: 44 }}
              >
                انتخاب فایل ZIP
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={(e) => void pickFile(e.target.files?.[0])}
                  data-testid="import-input"
                />
              </Button>
              {fileName ? <Typography variant="body2">{fileName}</Typography> : null}
              {error ? (
                <Alert severity="error" role="alert" onClose={() => setError(null)}>
                  {error}
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'report' && report ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="titleMedium">نتیجه بررسی</Typography>
                {status ? (
                  <Chip
                    label={status.label}
                    color={
                      status.tone === 'error'
                        ? 'error'
                        : status.tone === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                    variant="outlined"
                    data-testid="import-report-status"
                  />
                ) : null}
              </Stack>
              <ReportFacts report={report} />
              {report.errors.length > 0 ? (
                <Alert severity="error" data-testid="import-report-errors">
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    بسته معتبر نیست. موارد زیر را اصلاح کنید:
                  </Typography>
                  <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                    {report.errors.map((e, i) => (
                      <li key={i}>
                        <Typography variant="body2">
                          {contentDiagnosticCopy(e.code, e.message)}
                          {e.path ? <span dir="ltr"> ({e.path})</span> : null}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {report.warnings.length > 0 ? (
                <Alert severity="warning" data-testid="import-report-warnings">
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    هشدارها (مانع ورود نیستند):
                  </Typography>
                  <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                    {report.warnings.map((w, i) => (
                      <li key={i}>
                        <Typography variant="body2">
                          {contentDiagnosticCopy(w.code, w.message)}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              {error ? (
                <Alert severity="error" role="alert">
                  {error}
                </Alert>
              ) : null}
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={reset} sx={{ minHeight: 44 }}>
                  انتخاب بسته دیگر
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void runPlan()}
                  disabled={busy || !report.ok}
                  data-testid="import-to-plan"
                  sx={{ minHeight: 44 }}
                >
                  ادامه به برنامه ورود
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'plan' && plan ? (
        <Card>
          <CardContent>
            <Stack spacing={2} data-testid="import-plan">
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="titleMedium">برنامه ورود (پیشنمایش خشک)</Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`نسخه ${plan.contentVersion.toLocaleString('fa-IR')}`}
                />
              </Stack>
              <PlanLines plan={plan} />
              {plan.result === 'no_change' ? <Alert severity="info">{NO_CHANGE_COPY}</Alert> : null}
              {plan.result === 'conflict' ? (
                <Alert severity="warning" data-testid="import-conflict-message">
                  نسخه بسته با محتوای موجود در تعارض است؛ شماره نسخه بسته را افزایش دهید و دوباره
                  بررسی کنید.
                </Alert>
              ) : null}
              {plan.result === 'stale' ? (
                <Alert severity="warning" data-testid="import-conflict-message">
                  نسخه بسته قدیمیتر از محتوای موجود است.
                </Alert>
              ) : null}
              {plan.result === 'rejected' ? (
                <Alert severity="error" data-testid="import-conflict-message">
                  دستهبندی بسته در سیستم وجود ندارد؛ ابتدا دستهبندی را بسازید.
                </Alert>
              ) : null}
              {error ? (
                <Alert severity="error" role="alert" data-testid="import-stale-message">
                  {error}
                </Alert>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                ورود محتوا همیشه بهصورت پیشنویس انجام میشود و چیزی منتشر نخواهد شد.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => setStep('report')} sx={{ minHeight: 44 }}>
                  بازگشت
                </Button>
                {plan.result === 'no_change' ? (
                  <Button
                    variant="contained"
                    onClick={() => void confirmAndExecute()}
                    disabled={busy}
                    data-testid="import-confirm"
                  >
                    ثبت «بدون تغییر»
                  </Button>
                ) : plan.result === 'new' || plan.result === 'update' ? (
                  <Button
                    variant="contained"
                    onClick={() => void confirmAndExecute()}
                    disabled={busy}
                    data-testid="import-confirm"
                    sx={{ minHeight: 44 }}
                  >
                    تأیید و ورود محتوا
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    disabled
                    data-testid="import-confirm"
                    sx={{ minHeight: 44 }}
                  >
                    ورود ممکن نیست
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'result' && result ? (
        <Card>
          <CardContent>
            <Stack spacing={2} data-testid="import-result">
              <Typography variant="titleMedium">
                {result.kind === 'completed' ? 'ورود محتوا انجام شد' : NO_CHANGE_COPY}
              </Typography>
              {result.kind === 'completed' && result.counts ? (
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={`${result.counts.created.toLocaleString('fa-IR')} ایجاد`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`${result.counts.updated.toLocaleString('fa-IR')} بهروزرسانی`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`${result.counts.noChange.toLocaleString('fa-IR')} بدون تغییر`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`سطحها: ${result.counts.importedLevels.join('، ') || '—'}`}
                    dir="ltr"
                    variant="outlined"
                  />
                </Stack>
              ) : null}
              {result.auditId ? (
                <Typography variant="caption" color="text.secondary">
                  شناسه ردیابی: <span dir="ltr">{result.auditId}</span>
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1}>
                {result.kind === 'completed' && result.episodeId ? (
                  <Button
                    component={RouterLink}
                    to={`/content/episodes/${result.episodeId}`}
                    variant="contained"
                    data-testid="import-open-draft"
                    sx={{ minHeight: 44 }}
                  >
                    باز کردن پیشنویس اپیزود
                  </Button>
                ) : null}
                <Button
                  variant="outlined"
                  onClick={reset}
                  sx={{ minHeight: 44 }}
                  data-testid="import-another"
                >
                  ورود بسته دیگر
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {busy ? <StatePanel variant="loading" title="در حال پردازش…" /> : null}

      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="titleMedium">تاریخچه ورودهای اخیر</Typography>
            {history.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                هنوز ورودی ثبت نشده است.
              </Typography>
            ) : (
              <Stack spacing={1} data-testid="import-history">
                {history.map((item) => (
                  <Stack
                    key={item.id}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Typography
                      variant="body2"
                      dir="ltr"
                      sx={{ fontWeight: 600, textAlign: 'start' }}
                    >
                      {item.contentKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      نسخه {item.contentVersion.toLocaleString('fa-IR')}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'failed'
                            ? 'error'
                            : 'default'
                      }
                      label={IMPORT_STATUS_COPY[item.status] ?? item.status}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

const IMPORT_STATUS_COPY: Record<string, string> = {
  completed: 'موفق',
  no_change: 'بدون تغییر',
  failed: 'ناموفق',
  running: 'در حال اجرا',
  planned: 'برنامهریزی شده',
};

function ReportFacts({ report }: { report: ReportState }) {
  const manifest = report.manifest as {
    schemaVersion?: string;
    contentKey?: string;
    contentVersion?: number;
    categoryKey?: string;
    episode?: { slug?: string };
  };
  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: 'نسخه قالب', value: manifest.schemaVersion ?? '—', ltr: true },
    { label: 'کلید محتوا', value: manifest.contentKey ?? '—', ltr: true },
    {
      label: 'نسخه محتوا',
      value: manifest.contentVersion !== undefined ? String(manifest.contentVersion) : '—',
    },
    { label: 'دستهبندی', value: manifest.categoryKey ?? '—', ltr: true },
    { label: 'اپیزود', value: manifest.episode?.slug ?? '—', ltr: true },
    { label: 'سطحها', value: report.levels.join('، ') || '—' },
    { label: 'تعداد فایلها', value: report.assets.length.toLocaleString('fa-IR') },
    { label: 'تعداد واژگان', value: report.vocabularyCount.toLocaleString('fa-IR') },
  ];
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} data-testid="import-report-facts">
      {facts.map((f) => (
        <Box
          key={f.label}
          sx={{
            padding: 1.5,
            borderRadius: 2,
            backgroundColor: 'surfaceContainerLow',
            minWidth: 130,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {f.label}
          </Typography>
          <Typography
            variant="body2"
            dir={f.ltr ? 'ltr' : 'rtl'}
            sx={{ fontWeight: 600, textAlign: 'start', overflowWrap: 'anywhere' }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function PlanLines({ plan }: { plan: ImportPlanResponse }) {
  const rows = planRows(plan);
  return (
    <Stack spacing={1} data-testid="import-plan-lines">
      <PlanLine
        label="دستهبندی"
        value={plan.category.action === 'reuse' ? 'استفاده از دستهبندی موجود' : 'دستهبندی پیدا نشد'}
        tone={plan.category.action === 'reuse' ? 'ok' : 'warn'}
      />
      <PlanLine
        label="اپیزود"
        value={
          plan.episode.action === 'create'
            ? `ایجاد ${plan.contentKey}`
            : plan.episode.action === 'update'
              ? `بهروزرسانی ${plan.contentKey}`
              : (plan.episode.reason ?? 'بدون تغییر')
        }
        tone={plan.episode.action === 'create' || plan.episode.action === 'update' ? 'ok' : 'muted'}
      />
      {rows.map((row) => (
        <PlanLine
          key={row.level}
          label={`سطح ${row.level}`}
          value={`${row.actionCopy}${row.vocabularyCount !== undefined ? ` — ${row.vocabularyCount.toLocaleString('fa-IR')} واژه` : ''}`}
          tone={row.action === 'none' ? 'muted' : 'ok'}
        />
      ))}
    </Stack>
  );
}

function PlanLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'muted';
}) {
  const color =
    tone === 'ok' ? 'success.main' : tone === 'warn' ? 'warning.main' : 'text.secondary';
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
      <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 110 }}>
        {label}
      </Typography>
      <Typography variant="body2" color={color} dir="ltr" sx={{ textAlign: 'start' }}>
        {value}
      </Typography>
    </Stack>
  );
}
