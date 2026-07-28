import { Box, Stack, Typography } from '@mui/material';

// Reusable brand mark. Two simple geometric letters in a midnight tile.
// No external imagery or third-party logo.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Stack
      spacing={1.5}
      aria-label="Fast English Podcast"
      sx={{ flexDirection: 'row', alignItems: 'center', direction: 'ltr' }}
    >
      <Box
        aria-hidden
        sx={{
          width: size,
          height: size,
          borderRadius: 1.5,
          background: 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)',
          display: 'grid',
          placeItems: 'center',
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: size * 0.42,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        FE
      </Box>
      <Typography component="span" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        فست انگلیش
        <Typography
          component="span"
          variant="caption"
          sx={{ display: 'block', opacity: 0.7, fontWeight: 500 }}
        >
          پادکست یادگیری انگلیسی
        </Typography>
      </Typography>
    </Stack>
  );
}
