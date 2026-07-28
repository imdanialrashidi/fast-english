import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { previewContinueLesson } from '../../data/previewData';
import { LevelBadge } from '../shell/LevelBadge';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

// Representative lesson reading screen.
// - Persian chrome (RTL) around the body
// - English title + body are LTR
// - CEFR level shown by badge (color + text)
// - Audio area is a placeholder explicitly labeled as unavailable.
export function LessonDemoRoute() {
  const lesson = previewContinueLesson;
  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title={lesson.title}
        subtitle={
          <Stack
            spacing={1.5}
            sx={{ flexDirection: 'row', alignItems: 'center', pt: 0.5, gap: 1.5, flexWrap: 'wrap' }}
          >
            <LevelBadge level={lesson.level} size="sm" />
            <Chip size="small" label={lesson.topic} variant="outlined" sx={{ borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {lesson.durationMin} دقیقه
            </Typography>
          </Stack>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'center' }}>
            <Box
              aria-hidden
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'primary.main',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <PlayCircleOutlineRoundedIcon fontSize="large" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="h2" variant="h4">
                پخش صوتی
              </Typography>
              <Typography variant="caption" color="text.secondary">
                پخش‌کنندهٔ صوتی در اسلایس بعدی فعال می‌شود
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <StatePanel
        variant="unavailable"
        title="پخش صوتی هنوز آماده نیست"
        description="این بخش فقط چیدمان بصری صفحهٔ درس را نشان می‌دهد. پخش صوتی محافظت‌شده در اسلایس P3-S1 فعال خواهد شد."
      />

      <Divider sx={{ my: 3 }} />

      <Box
        component="article"
        lang="en"
        dir="ltr"
        sx={{
          maxWidth: '38rem',
          mx: 'auto',
        }}
      >
        <Typography
          component="h1"
          variant="h3"
          sx={{ mb: 2, textAlign: 'start', fontFamily: 'inherit' }}
        >
          {lesson.titleEn}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'start',
            // Readable long-form line height for English paragraphs.
            lineHeight: 1.85,
            mb: 2,
          }}
        >
          Sara starts her day at half past seven. She drinks a cup of tea, checks her email, and
          leaves the house at a quarter to nine. Her office is in the city centre, so she takes the
          metro every morning. She usually reads a short article on the way to work.
        </Typography>
        <Typography variant="body1" sx={{ textAlign: 'start', lineHeight: 1.85, mb: 2 }}>
          At lunchtime, Sara often eats with her colleagues. They talk about the project, the
          weather, and the small things that make the day easier. In the afternoon, she finishes her
          tasks and writes a short list for tomorrow. She leaves the office at six and walks home.
        </Typography>
        <Typography variant="body1" sx={{ textAlign: 'start', lineHeight: 1.85 }}>
          In the evening, Sara spends an hour with her English podcast. She listens to one lesson,
          repeats a few sentences, and then writes two short paragraphs in her notebook. Before bed,
          she reads a few pages of a novel in English. Small habits, every day.
        </Typography>
      </Box>
    </PageContainer>
  );
}
