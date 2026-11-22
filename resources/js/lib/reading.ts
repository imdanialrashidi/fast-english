import type { CSSProperties } from 'react';
import type { ReadingSentence, ReadingWord } from '@/types';

/** Sentence-level timing; returns the index of the sentence being spoken. */
export function activeSentenceIndex(sentences: ReadingSentence[], timeMs: number): number | null {
    for (let index = 0; index < sentences.length; index += 1) {
        const sentence = sentences[index];
        if (sentence === undefined || sentence.start_ms === null || sentence.end_ms === null) {
            continue;
        }
        if (timeMs >= sentence.start_ms && timeMs < sentence.end_ms) {
            return index;
        }
    }

    return null;
}

export function formatClock(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) {
        return '۰:۰۰';
    }
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * A 2×3 sheet has six equal panels. The browser crops one panel with a
 * background that is 200% wide and 300% tall; the position steps are
 * 0/100% across and 0/50/100% down. No image is copied per panel.
 */
export function panelCropStyle(panelIndex: number, columns: number, rows: number): CSSProperties {
    const index = Math.max(1, Math.min(columns * rows, panelIndex)) - 1;
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${columns === 1 ? 0 : (column / (columns - 1)) * 100}% ${
            rows === 1 ? 0 : (row / (rows - 1)) * 100
        }%`,
    };
}

/**
 * Selection offsets inside a rendered paragraph. JavaScript string indexes
 * are UTF-16 code units, the same unit the content pack stores, so slicing
 * here needs no conversion.
 */
export function selectionWithin(root: HTMLElement): { start: number; end: number; text: string } | null {
    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        return null;
    }

    const start = offsetWithin(root, range.startContainer, range.startOffset);
    const end = offsetWithin(root, range.endContainer, range.endOffset);
    if (start === null || end === null || end <= start) {
        return null;
    }

    return { start, end, text: root.textContent?.slice(start, end) ?? '' };
}

function offsetWithin(root: HTMLElement, node: Node, offset: number): number | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let total = 0;

    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (offset !== 0 && offset < element.childNodes.length) {
            return null;
        }

        while (walker.nextNode()) {
            const text = walker.currentNode as Text;
            if (element.contains(text)) {
                break;
            }
            total += text.data.length;
        }

        return offset === 0 ? total : total + (element.textContent?.length ?? 0);
    }

    while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        if (text === node) {
            return total + offset;
        }
        total += text.data.length;
    }

    return null;
}

export function sentencesForRange(sentences: ReadingSentence[], start: number, end: number): ReadingSentence[] {
    return sentences.filter((sentence) => sentence.start_utf16 < end && sentence.end_utf16 > start);
}

export function wordsForRange(words: ReadingWord[], start: number, end: number): ReadingWord[] {
    return words.filter(
        (word) =>
            word.start_utf16 !== null &&
            word.end_utf16 !== null &&
            word.start_utf16 < end &&
            word.end_utf16 > start,
    );
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
