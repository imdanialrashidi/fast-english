// admin/src/features/payments/components/OperatorQueueToolbar.tsx
// Queue filters: status Select + debounced search + clear actions.
// Every filter is reflected in the URL query parameters by the parent;
// this component only renders the controls with accessible labels.
// The search commits are debounced remotely (350 ms) and superseded
// requests are aborted by the parent's AbortController.

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
} from '@mui/material';
import type { QueueStatusFilter } from '../types';

interface Props {
  statusFilter: QueueStatusFilter;
  onStatusChange: (value: QueueStatusFilter) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  /** Commit the search immediately (Enter / search button). */
  onSearchCommit: () => void;
  onClearSearch: () => void;
  /** One action that clears status + search + page. */
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function OperatorQueueToolbar({
  statusFilter,
  onStatusChange,
  searchInput,
  onSearchInputChange,
  onSearchCommit,
  onClearSearch,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  return (
    <Stack sx={{ gap: 1.5 }}>
      <FormControl size="small" fullWidth>
        <Select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as QueueStatusFilter)}
          aria-label="فیلتر وضعیت"
          data-testid="queue-status-filter"
        >
          <MenuItem value="all">همه</MenuItem>
          <MenuItem value="pending">در انتظار</MenuItem>
          <MenuItem value="approved">تأیید شده</MenuItem>
          <MenuItem value="rejected">رد شده</MenuItem>
          <MenuItem value="cancelled">لغو شده</MenuItem>
        </Select>
      </FormControl>

      <OutlinedInput
        size="small"
        placeholder="جستجو با مرجع بانکی یا شناسه..."
        aria-label="جستجو در صف درخواست‌ها"
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSearchCommit();
          }
        }}
        sx={{ minHeight: 48 }}
        endAdornment={
          <InputAdornment position="end">
            {searchInput ? (
              <IconButton
                onClick={onClearSearch}
                aria-label="پاک‌کردن جستجو"
                size="small"
                sx={{ minWidth: 44, minHeight: 44 }}
                data-testid="queue-search-clear"
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            ) : null}
            <IconButton
              onClick={onSearchCommit}
              aria-label="جستجو"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <SearchRoundedIcon />
            </IconButton>
          </InputAdornment>
        }
      />

      {hasActiveFilters ? (
        <Box>
          <Button
            onClick={onClearFilters}
            startIcon={<FilterAltOffRoundedIcon />}
            size="small"
            sx={{ minHeight: 44 }}
            data-testid="queue-clear-filters"
          >
            پاک‌کردن فیلترها
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
