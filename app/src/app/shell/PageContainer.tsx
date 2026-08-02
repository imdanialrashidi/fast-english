import { Box, Container, type ContainerProps } from '@mui/material';
import { layout } from '../theme/tokens/spacing';

// Centers content and reserves enough bottom padding to clear the mobile
// bottom navigation (bottomNavigationHeight + safe-area inset). Padding
// values come from the layout tokens.
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
          px: { xs: layout.pageInlinePadding.xs, sm: layout.pageInlinePadding.sm },
          py: { xs: layout.pageBlockPadding.xs, sm: layout.pageBlockPadding.sm },
          pb: {
            xs: `calc(${layout.bottomNavigationHeight}px + 16px + env(safe-area-inset-bottom, 0px))`,
            md: layout.pageBlockPadding.md,
          },
        }}
      >
        {children}
      </Box>
    </Container>
  );
}
