// admin/src/features/settings/BusinessSettingsPanel.tsx
// Business Configuration slice — the ONE obvious Admin location for
// owner-controlled public/payment settings:
//
//   1. Plans        — name, price (toman), duration, active flag
//   2. Payment destination — card number, holder, bank, short transfer
//      instructions, review ETA, payment support contact
//   3. Contact      — canonical public support/collaboration URL
//
// Every save goes through the staff-guarded routes
// (server/pb_hooks/business_settings_routes.pb.js); the server remains
// the security boundary. No secrets are edited here.

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_REVIEW_SLA_TEXT } from '../../../../shared/lib/businessDefaults';
import { toPersianDigits } from '../../../../shared/lib/formatters';
import { getPocketBase } from '../../auth/pocketbase';
import {
  createBusinessPlan,
  fetchBusinessSettings,
  saveBusinessDestination,
  saveBusinessSite,
  updateBusinessPlan,
} from './api';
import {
  type FieldErrors,
  isYearlyPlan,
  normalizeCardNumber,
  validateDestination,
  validatePlan,
  validatePlanDraftPrice,
  validateSiteContact,
} from './logic';
import type { BusinessDestination, BusinessPlan, BusinessSettings, BusinessSite } from './types';

function formatToman(value: number): string {
  return `${toPersianDigits(value.toLocaleString('en-US'))}`;
}

interface SaveState {
  kind: 'idle' | 'saving' | 'saved' | 'error';
  message?: string;
}

function SaveFeedback({ state }: { state: SaveState }) {
  if (state.kind === 'saving') return <Typography variant="caption">در حال ذخیره…</Typography>;
  if (state.kind === 'saved') return <Alert severity="success">ذخیره شد.</Alert>;
  if (state.kind === 'error')
    return <Alert severity="error">{state.message ?? 'ذخیره ممکن نشد.'}</Alert>;
  return null;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

interface PlanDraft {
  name: string;
  slug: string;
  durationDays: string;
  priceToman: string;
  displayOrder: string;
  isActive: boolean;
  description: string;
}

function emptyDraft(): PlanDraft {
  return {
    name: '',
    slug: '',
    durationDays: '30',
    priceToman: '',
    displayOrder: '0',
    isActive: true,
    description: '',
  };
}

function draftFromPlan(p: BusinessPlan): PlanDraft {
  return {
    name: p.name,
    slug: p.slug,
    durationDays: String(p.durationDays),
    priceToman: String(p.priceToman),
    displayOrder: String(p.displayOrder),
    isActive: p.isActive,
    description: p.description,
  };
}

function PlansSection({
  plans,
  token,
  onChanged,
}: {
  plans: BusinessPlan[];
  token: string;
  onChanged: (patch: Partial<BusinessSettings>) => void;
}) {
  const [editing, setEditing] = useState<PlanDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const openNew = () => {
    setErrors({});
    setSaveState({ kind: 'idle' });
    setEditingId(null);
    setEditing(emptyDraft());
  };
  const openEdit = (p: BusinessPlan) => {
    setErrors({});
    setSaveState({ kind: 'idle' });
    setEditingId(p.id);
    setEditing(draftFromPlan(p));
  };

  const save = async () => {
    if (!editing) return;
    const durationDays = Number(editing.durationDays);
    const priceToman = Number(editing.priceToman);
    const validation = validatePlan({
      name: editing.name,
      slug: editing.slug,
      durationDays,
      priceToman,
    });
    // A blank price field must be rejected BEFORE Number('') === 0: an
    // accidental empty field must never silently publish a FREE plan.
    const draftPriceError = validatePlanDraftPrice(editing.priceToman);
    if (draftPriceError) validation.priceToman = draftPriceError;
    // The owner-approved launch set has no yearly plan; creating one is
    // refused in the editor even before the server check.
    if (validation.name === '' && isYearlyPlan({ durationDays, slug: editing.slug })) {
      validation.durationDays = 'طرح سالانه (۳۶۵ روز) ارائه نمیشود.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setSaveState({ kind: 'saving' });
    try {
      let savedPlan: BusinessPlan | null = null;
      if (editingId) {
        const res = await updateBusinessPlan(token, editingId, {
          name: editing.name.trim(),
          slug: editing.slug.trim(),
          durationDays,
          priceToman,
          displayOrder: Number(editing.displayOrder) || 0,
          isActive: editing.isActive,
          description: editing.description.trim(),
        });
        savedPlan = res.plan;
      } else {
        const res = await createBusinessPlan(token, {
          name: editing.name.trim(),
          slug: editing.slug.trim(),
          durationDays,
          priceToman,
          displayOrder: Number(editing.displayOrder) || 0,
          isActive: editing.isActive,
          description: editing.description.trim(),
        });
        savedPlan = res.plan;
      }
      setSaveState({ kind: 'saved' });
      setEditing(null);
      if (savedPlan) {
        const others = plans.filter((p) => p.id !== savedPlan?.id);
        onChanged({
          plans: [...others, savedPlan].sort((a, b) => a.displayOrder - b.displayOrder),
        });
      }
    } catch (err) {
      setSaveState({
        kind: 'error',
        message:
          err instanceof Error ? err.message.replace(/^\{.*"message":"(.*)"\}$/, '$1') : undefined,
      });
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography component="h2" variant="titleMedium">
              طرحها
            </Typography>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={openNew}
              data-testid="settings-add-plan"
            >
              طرح جدید
            </Button>
          </Box>
          <SaveFeedback state={saveState} />
          {plans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              هنوز طرحی ثبت نشده است.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {plans.map((p) => (
                <Box
                  key={p.id}
                  data-testid={`settings-plan-${p.slug}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {p.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      dir="ltr"
                      sx={{ textAlign: 'start', display: 'block' }}
                    >
                      {p.slug} — {p.durationDays} روز — {formatToman(p.priceToman)} تومان
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    {p.priceToman === 0 ? (
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label="طرح رایگان"
                        data-testid={`settings-plan-free-${p.slug}`}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      color={p.isActive ? 'success' : 'default'}
                      label={p.isActive ? 'فعال' : 'غیرفعال'}
                    />
                    <IconButton
                      size="small"
                      aria-label={`ویرایش طرح ${p.name}`}
                      onClick={() => openEdit(p)}
                      data-testid={`settings-edit-plan-${p.slug}`}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        maxWidth="sm"
        fullWidth
        aria-label={editingId ? 'ویرایش طرح' : 'طرح جدید'}
      >
        <DialogTitle>{editingId ? 'ویرایش طرح' : 'طرح جدید'}</DialogTitle>
        <DialogContent>
          {editing ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="نام طرح (فارسی)"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                label="شناسه انگلیسی (slug)"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                error={Boolean(errors.slug)}
                helperText={errors.slug}
                dir="ltr"
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="مدت (روز)"
                  type="number"
                  value={editing.durationDays}
                  onChange={(e) => setEditing({ ...editing, durationDays: e.target.value })}
                  error={Boolean(errors.durationDays)}
                  helperText={errors.durationDays}
                />
                <Box>
                  <TextField
                    label="قیمت (تومان)"
                    type="number"
                    value={editing.priceToman}
                    onChange={(e) => setEditing({ ...editing, priceToman: e.target.value })}
                    error={Boolean(errors.priceToman)}
                    helperText={errors.priceToman ?? '۰ تومان = طرح رایگان'}
                  />
                </Box>
              </Box>
              <TextField
                label="ترتیب نمایش"
                type="number"
                value={editing.displayOrder}
                onChange={(e) => setEditing({ ...editing, displayOrder: e.target.value })}
              />
              <TextField
                label="توضیح کوتاه (اختیاری)"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                multiline
                minRows={2}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                }
                label="طرح فعال است"
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>انصراف</Button>
          <Button onClick={save} variant="contained" disabled={saveState.kind === 'saving'}>
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

function DestinationSection({
  destination,
  token,
  onChanged,
}: {
  destination: BusinessDestination | null;
  token: string;
  onChanged: (patch: Partial<BusinessSettings>) => void;
}) {
  const [draft, setDraft] = useState<Omit<BusinessDestination, 'id'> | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const begin = () => {
    setErrors({});
    setSaveState({ kind: 'idle' }); // new edit starts clean; a fresh save feedback is rendered below
    setDraft(
      destination
        ? {
            cardNumber: destination.cardNumber,
            cardHolderName: destination.cardHolderName,
            bankName: destination.bankName,
            instructions: destination.instructions,
            reviewSlaText: destination.reviewSlaText || DEFAULT_REVIEW_SLA_TEXT,
            supportContact: destination.supportContact,
            isActive: destination.isActive,
          }
        : {
            cardNumber: '',
            cardHolderName: '',
            bankName: '',
            instructions: '',
            reviewSlaText: DEFAULT_REVIEW_SLA_TEXT,
            supportContact: '',
            isActive: true,
          },
    );
  };

  const save = async () => {
    if (!draft) return;
    const validation = validateDestination({
      cardNumber: normalizeCardNumber(draft.cardNumber),
      cardHolderName: draft.cardHolderName,
      bankName: draft.bankName,
    });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setSaveState({ kind: 'saving' });
    try {
      const res = await saveBusinessDestination(token, {
        ...draft,
        cardNumber: normalizeCardNumber(draft.cardNumber),
        instructions: draft.instructions.trim(),
        reviewSlaText: draft.reviewSlaText.trim(),
        supportContact: draft.supportContact.trim(),
      });
      setSaveState({ kind: 'saved' });
      setDraft(null);
      onChanged({ destination: res.destination });
    } catch (err) {
      setSaveState({
        kind: 'error',
        message:
          err instanceof Error ? err.message.replace(/^\{.*"message":"(.*)"\}$/, '$1') : undefined,
      });
    }
  };

  if (draft === null) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography component="h2" variant="titleMedium">
              مقصد پرداخت کارتبهکارت
            </Typography>
            {destination ? (
              <Box data-testid="settings-destination-summary">
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700 }}
                  data-testid="settings-card-transfer-status"
                >
                  پرداخت کارتبه‌کارت: {destination.isActive ? 'فعال' : 'غیرفعال'}
                </Typography>
                <Typography variant="body1" dir="ltr" sx={{ textAlign: 'start', mt: 0.5 }}>
                  {destination.cardNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {destination.cardHolderName} — {destination.bankName}
                  {destination.isActive
                    ? ''
                    : ' — اطلاعات ذخیره‌شده حفظ می‌شود و پس از فعال‌سازی دوباره استفاده می‌شود'}
                </Typography>
                {destination.reviewSlaText ? (
                  <Typography variant="caption" color="text.secondary">
                    زمان بررسی: {destination.reviewSlaText}
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                هنوز مقصد پرداختی ثبت نشده است؛ تا آن زمان دانشجوها پیام «مقصد پرداخت در دسترس نیست»
                میبینند.
              </Typography>
            )}
            <SaveFeedback state={saveState} />
            <Box>
              <Button variant="outlined" onClick={begin} data-testid="settings-edit-destination">
                {destination ? 'ویرایش مقصد پرداخت' : 'ثبت مقصد پرداخت'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="titleMedium">
            مقصد پرداخت کارتبهکارت
          </Typography>
          <TextField
            label="شماره کارت"
            value={draft.cardNumber}
            onChange={(e) => setDraft({ ...draft, cardNumber: e.target.value })}
            error={Boolean(errors.cardNumber)}
            helperText={errors.cardNumber ?? '۱۲ تا ۳۲ رقم؛ فاصله مجاز است.'}
            dir="ltr"
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="نام دارندهٔ کارت"
              value={draft.cardHolderName}
              onChange={(e) => setDraft({ ...draft, cardHolderName: e.target.value })}
              error={Boolean(errors.cardHolderName)}
              helperText={errors.cardHolderName}
            />
            <TextField
              label="نام بانک"
              value={draft.bankName}
              onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
              error={Boolean(errors.bankName)}
              helperText={errors.bankName}
            />
          </Box>
          <TextField
            label="راهنمای کوتاه انتقال"
            value={draft.instructions}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            multiline
            minRows={2}
            helperText="یک جملهٔ کوتاه، مثلاً: مبلغ را دقیقاً به همین کارت واریز کنید."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="زمان تقریبی بررسی"
              value={draft.reviewSlaText}
              onChange={(e) => setDraft({ ...draft, reviewSlaText: e.target.value })}
              helperText={`پیشفرض: ${DEFAULT_REVIEW_SLA_TEXT}`}
            />
            <TextField
              label="راه ارتباطی پشتیبانی (در صفحهٔ پرداخت)"
              value={draft.supportContact}
              onChange={(e) => setDraft({ ...draft, supportContact: e.target.value })}
              helperText="مثلاً آیدی تلگرام یا لینک"
              dir="ltr"
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
            }
            label="فعال است (فقط یک مقصد فعال میتواند وجود داشته باشد)"
          />
          <SaveFeedback state={saveState} />
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setDraft(null)}>انصراف</Button>
            <Button
              variant="contained"
              onClick={save}
              disabled={saveState.kind === 'saving'}
              data-testid="settings-save-destination"
            >
              ذخیرهٔ مقصد پرداخت
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Site contact (support + collaboration)
// ---------------------------------------------------------------------------

function SiteSection({
  site,
  token,
  onChanged,
}: {
  site: BusinessSite;
  token: string;
  onChanged: (patch: Partial<BusinessSettings>) => void;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const save = async () => {
    if (value === null) return;
    const validation = validateSiteContact(value);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setSaveState({ kind: 'saving' });
    try {
      const res = await saveBusinessSite(token, { supportContact: value.trim() });
      setSaveState({ kind: 'saved' });
      setValue(null);
      onChanged({ site: res.site });
    } catch (err) {
      setSaveState({
        kind: 'error',
        message:
          err instanceof Error ? err.message.replace(/^\{.*"message":"(.*)"\}$/, '$1') : undefined,
      });
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="titleMedium">
            کانال پشتیبانی و همکاری
          </Typography>
          <Typography variant="body2" color="text.secondary">
            یک مقصد مشترک برای صفحههای «تماس و پشتیبانی» و «همکاری» وبسایت و لینک پشتیبانی. تا وقتی
            خالی است، هر دو صفحه حالت صادقانهٔ «هنوز اعلام نشده» را نشان میدهند.
          </Typography>
          <TextField
            label="آدرس کانال (https/mailto/tel)"
            value={value ?? site.supportContact}
            onChange={(e) => setValue(e.target.value)}
            error={Boolean(errors.supportContact)}
            helperText={errors.supportContact ?? 'خالی = هنوز اعلام نشده'}
            dir="ltr"
          />
          <SaveFeedback state={saveState} />
          <Box>
            <Button
              variant="contained"
              onClick={save}
              disabled={saveState.kind === 'saving'}
              data-testid="settings-save-site"
            >
              ذخیرهٔ کانال
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function BusinessSettingsPanel() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const reload = useCallback(() => {
    const token = getPocketBase().authStore.token;
    setLoadState('loading');
    fetchBusinessSettings(token)
      .then((data) => {
        setSettings(data);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, []);

  const applyPatch = useCallback((patch: Partial<BusinessSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadState === 'loading') {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            در حال بارگذاری تنظیمات کسبوکار…
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (loadState === 'error' || settings === null) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">بارگذاری تنظیمات ممکن نشد.</Alert>
          <Button sx={{ mt: 1 }} onClick={reload}>
            تلاش دوباره
          </Button>
        </CardContent>
      </Card>
    );
  }

  const token = getPocketBase().authStore.token;

  return (
    <Stack spacing={2} data-testid="business-settings-panel">
      <PlansSection plans={settings.plans} token={token} onChanged={applyPatch} />
      <DestinationSection destination={settings.destination} token={token} onChanged={applyPatch} />
      <SiteSection site={settings.site} token={token} onChanged={applyPatch} />
    </Stack>
  );
}
