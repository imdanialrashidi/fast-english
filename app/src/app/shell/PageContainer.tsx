import { Box, Container, type ContainerProps } from '@mui/material';

// Centers content and reserves enough bottom padding to clear the mobile
// bottom navigation (64 px nav + safe-area inset).
export function PageContainer({
  children,
  maxWidth = 'md',
  disableGutter = false,
}: {
  children: React.ReactNode;
  maxWidth?: ContainerProps['maxWidth'];
  disableGutter?: boolean;
}) {
  return (
    <Container maxWidth={maxWidth} disableGutters={disableGutter} sx={{ position: 'relative' }}>
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 3 },
          // Reserve space for the fixed mobile bottom nav + iOS/Android safe area.
          pb: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 4 },
        }}
      >
        {children}
      </Box>
    </Container>
  );
}
