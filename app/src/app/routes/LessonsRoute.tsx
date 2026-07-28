import { Box, Stack, Typography } from '@mui/material';
import { previewRecommendations } from '../../data/previewData';
import { LevelBadge } from '../shell/LevelBadge';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';

export function LessonsRoute() {
  return (
    <PageContainer>
      <PageHeader
        title="درس‌ها"
        subtitle="فهرست درس‌ها برای مرور. محتوای واقعی پس از اتصال به پایگاه‌داده بارگذاری می‌شود."
      />
      <Stack spacing={2} aria-label="فهرست درس‌ها">
        {previewRecommendations.map((lesson) => (
          <Box
            key={lesson.id}
            sx={{
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <Stack
              spacing={1.5}
              sx={{
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack spacing={1} sx={{ flexDirection: 'row', alignItems: 'center', mb: 0.5 }}>
                  <LevelBadge level={lesson.level} size="sm" />
                  <Typography variant="caption" color="text.secondary">
                    {lesson.topic}
                  </Typography>
                </Stack>
                <Typography component="h2" variant="h4" sx={{ mb: 0.25 }}>
                  {lesson.title}
                </Typography>
                <Typography
                  lang="en"
                  dir="ltr"
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'block', textAlign: 'start' }}
                >
                  {lesson.titleEn}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {lesson.durationMin} دقیقه
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    </PageContainer>
  );
}
