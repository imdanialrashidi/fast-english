// app/src/features/library/components/SearchField.tsx
// Podcast Slice 6 — bounded, calm Library search input.
//
// Trimmed input, bounded length (mirror of the server bound), a visible
// clear action, and submit on Enter. Debouncing lives in the route (no
// uncontrolled request per keystroke); this component only owns the input
// UI and announces changes through a polite live region.

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Box, IconButton, InputAdornment, TextField } from '@mui/material';
import { LIBRARY_QUERY_LIMITS } from '../queryState';

export function SearchField({
  value,
  onChange,
  onSubmit,
  label,
  clearLabel,
  'data-testid': testId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  clearLabel: string;
  'data-testid'?: string;
}) {
  const hasQuery = value.trim().length > 0;
  return (
    <Box data-testid={testId}>
      <TextField
        fullWidth
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        aria-label={label}
        placeholder={label}
        autoComplete="off"
        slotProps={{
          htmlInput: { maxLength: LIBRARY_QUERY_LIMITS.q },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon aria-hidden />
              </InputAdornment>
            ),
            endAdornment: hasQuery ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label={clearLabel}
                  data-testid="library-search-clear"
                  onClick={() => {
                    onChange('');
                    onSubmit();
                  }}
                  sx={{ minHeight: 40, minWidth: 40 }}
                >
                  <CloseRoundedIcon aria-hidden />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
        sx={{ '& .MuiInputBase-root': { borderRadius: '999px' } }}
      />
    </Box>
  );
}
