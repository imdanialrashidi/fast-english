// app/src/app/routes/DashboardRoute.tsx
// Real-auth dashboard for active students. Preview data is used only for
// the recommendation card (clearly marked as preview).
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../shared/ui/StatePanel';
import { previewRecommendations } from '../../data/previewData';
import { useAuth } from '../../lib/auth';
import { LevelBadge } from '../shell/LevelBadge';

export function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return null;
  // Preview progress (deterministic, clearly preview-only).
  const previewCompleted = 7;
  const previewTotal = 24;
  const progressPct = Math.round((previewCompleted / previewTotal) * 100);
  return (
    <PageContainer>
      <PageHeader
        title={`سلام ${user.name}`}
        subtitle={`وضعیت حساب: ${user.account_status} — شمارهٔ موبایل: ${user.phone}`}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  spacing={2}
                  sx={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography component="h2" variant="h4">
                    پیش‌نمایش درس
                  </Typography>
                  <LevelBadge level={(user.selected_level ?? 'B1') as 'B1'} size="sm" />
                </Stack>
                <Box>
                  <Typography
                    component={RouterLink}
                    to="/lessons"
                    variant="h3"
                    sx={{ color: 'text.primary', textDecoration: 'none', display: 'block' }}
                  >
                    مشاهدهٔ درس‌های من
                  </Typography>
                  <Typography
                    lang="en"
                    dir="ltr"
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block', textAlign: 'start' }}
                  >
                    A Typical Workday
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  این بخش فعلاً پیش‌نمایش است و پس از اتصال به پایگاه‌داده با درس‌های واقعی پر می‌شود.
                </Typography>
                <Stack spacing={1} sx={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={progressPct}
                      sx={{ height: 6, borderRadius: '999px' }}
                      aria-label="پیشرفت دوره (پیش‌نمایش)"
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {previewCompleted} از {previewTotal} درس (پیش‌نمایش)
                  </Typography>
                </Stack>
                <Box>
                  <Button
                    component={RouterLink}
                    to="/lessons"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
                  >
                    مشاهدهٔ درس‌ها
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography component="h2" variant="h4">
                  پیشرفت شما
                </Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    نمای کلی دوره (پیش‌نمایش)
                  </Typography>
                  <Typography
                    component="div"
                    sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}
                  >
                    {progressPct}%
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  داده‌های واقعی پیشرفت پس از فعال‌سازی اشتراک در اسلایس P3-S2 نمایش داده می‌شوند.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Typography component="h2" variant="h4" sx={{ mb: 1 }}>
            پیشنهاد برای شما
          </Typography>
        </Grid>
        {previewRecommendations.map((lesson) => (
          <Grid key={lesson.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea
                component={RouterLink}
                to={`/lessons/${lesson.id}`}
                sx={{ height: '100%', alignItems: 'flex-start' }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <LevelBadge level={lesson.level} size="sm" />
                    <Box>
                      <Typography component="h3" variant="h4">
                        {lesson.title}
                      </Typography>
                      <Typography
                        lang="en"
                        dir="ltr"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.25, textAlign: 'start' }}
                      >
                        {lesson.titleEn}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {lesson.summary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lesson.durationMin} دقیقه • {lesson.topic}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ pt: 3 }}>
        <StatePanel
          variant="unavailable"
          title="پیشرفت واقعی در اسلایس P3-S2 فعال می‌شود"
          description="ذخیرهٔ پیشرفت درس‌ها پس از اتصال به پایگاه‌داده و فعال‌سازی اشتراک در دسترس قرار می‌گیرد."
        />
      </Box>
    </PageContainer>
  );
}
