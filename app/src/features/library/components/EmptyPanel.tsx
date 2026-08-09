// app/src/features/library/components/EmptyPanel.tsx
// Podcast Slice 6 — honest, distinct Library empty states.
//
// Every empty state names the actual filter that produced it and offers
// the smallest real next action (clear search / all topics / all levels /
// reset progress). No generic «no data» copy anywhere.

import { Button } from '@mui/material';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { productCopy } from '../../../app/copy/productCopy';
import type { LibraryEmptyKind } from '../logic';

export function EmptyPanel({
  kind,
  level,
  onClearSearch,
  onAllTopics,
  onAllLevels,
  onResetProgress,
}: {
  kind: LibraryEmptyKind;
  /** The explicit level filter that produced the empty result. */
  level?: string;
  onClearSearch: () => void;
  onAllTopics: () => void;
  onAllLevels: () => void;
  onResetProgress: () => void;
}) {
  if (kind === 'search') {
    return (
      <StatePanel
        variant="empty"
        title={productCopy.library.empty.searchTitle}
        description={productCopy.library.empty.searchDescription}
        action={
          <Button variant="outlined" data-testid="library-empty-clear" onClick={onClearSearch}>
            {productCopy.library.searchClear}
          </Button>
        }
      />
    );
  }
  if (kind === 'category') {
    return (
      <StatePanel
        variant="empty"
        title={productCopy.library.empty.categoryTitle}
        description={productCopy.library.empty.categoryDescription}
        action={
          <Button variant="outlined" data-testid="library-empty-topics" onClick={onAllTopics}>
            {productCopy.library.allTopics}
          </Button>
        }
      />
    );
  }
  if (kind === 'level') {
    return (
      <StatePanel
        variant="empty"
        title={productCopy.library.empty.levelTitle(level ?? '')}
        description={productCopy.library.empty.levelDescription}
        action={
          <Button variant="outlined" data-testid="library-empty-levels" onClick={onAllLevels}>
            {productCopy.library.allLevels}
          </Button>
        }
      />
    );
  }
  if (kind === 'progress') {
    return (
      <StatePanel
        variant="empty"
        title={productCopy.library.empty.progressTitle}
        description={productCopy.library.empty.progressDescription}
        action={
          <Button variant="outlined" data-testid="library-empty-progress" onClick={onResetProgress}>
            {productCopy.library.progressAll}
          </Button>
        }
      />
    );
  }
  return (
    <StatePanel
      variant="empty"
      title={productCopy.library.empty.libraryTitle}
      description={productCopy.library.empty.libraryDescription}
    />
  );
}
