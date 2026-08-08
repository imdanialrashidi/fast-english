// admin/src/features/content/components/ContentStatusChip.tsx
// Status chip with icon + text (never color alone).

import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DraftsRoundedIcon from '@mui/icons-material/DraftsRounded';
import { Chip } from '@mui/material';
import { statusLabel } from '../presentation';

const ICONS: Record<string, React.ReactNode> = {
  draft: <DraftsRoundedIcon />,
  published: <CheckCircleRoundedIcon />,
  archived: <ArchiveRoundedIcon />,
};

export function ContentStatusChip({
  status,
  size = 'small',
}: {
  status: string;
  size?: 'small' | 'medium';
}) {
  const icon = ICONS[status] ?? null;
  return (
    <Chip
      icon={icon as never}
      label={statusLabel(status)}
      size={size}
      variant="outlined"
      color={status === 'published' ? 'success' : status === 'archived' ? 'default' : 'warning'}
      sx={{ fontWeight: 600 }}
    />
  );
}
