import { Box, Container, type ContainerProps } from '@mui/material';
import { layout } from './tokens/spacing';

// Centers content and reserves enough bottom padding to clear the mobile
// bottom navigation (bottomNavigationHeight + safe-area inset) plus the
// Mini Player's reserved space (`--fep-mini-player-space`, announced by the
// Mini Player itself). Padding values come from the layout tokens.
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
          px: {
            xs: layout.pageInlinePadding.xs,
            sm: layout.pageInlinePadding.sm,
            md: layout.pageInlinePadding.md,
          },
          pt: {
            xs: layout.pageTopPadding.xs,
            sm: layout.pageTopPadding.sm,
            md: layout.pageTopPadding.md,
          },
          pb: {
            xs: `calc(${layout.bottomNavigationHeight}px + ${layout.pageBottomPadding.xs}px + env(safe-area-inset-bottom, 0px) + var(--fep-mini-player-space, 0px))`,
            md: `calc(${layout.pageBottomPadding.md}px + var(--fep-mini-player-space, 0px))`,
          },
        }}
      >
        {children}
      </Box>
    </Container>
  );
}
