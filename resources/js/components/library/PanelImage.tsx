import type { ReadingArt } from '@/types';
import { panelCropStyle } from '@/lib/reading';

interface PanelImageProps {
    art: ReadingArt | null;
    panelIndex: number | null;
    imageUrl: string | null;
    alt: string | null;
    className?: string;
}

/**
 * One panel of the book's single 2×3 sheet, cropped by CSS. The sheet is
 * downloaded once per book; a page without a panel mapping gets no image at
 * all instead of inheriting the previous page's picture.
 */
export function PanelImage({ art, panelIndex, imageUrl, alt, className = '' }: PanelImageProps): React.JSX.Element | null {
    const label = alt ?? '';

    if (imageUrl !== null) {
        return (
            <div className={`overflow-hidden rounded-3xl bg-[#EFE9DD] ${className}`}>
                <img src={imageUrl} alt={label} loading="lazy" className="h-full w-full object-cover" />
            </div>
        );
    }

    if (art === null || art.url === null || panelIndex === null) {
        return null;
    }

    return (
        <div
            role="img"
            aria-label={label}
            className={`relative overflow-hidden rounded-3xl bg-[#EFE9DD] ${className}`}
            style={{
                ...panelCropStyle(panelIndex, art.columns, art.rows),
                backgroundImage: `url(${art.url})`,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
}
