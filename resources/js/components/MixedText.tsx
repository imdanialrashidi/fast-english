import * as React from 'react';

/**
 * Renders a Persian-first sentence with its Latin runs isolated. Without
 * the isolation, bidi moves trailing English punctuation (the «?» in
 * "How are you?") to the wrong end of the mixed line.
 */

const LATIN_RUN = /([A-Za-z][A-Za-z0-9'’.,!?;:\-]*(?:\s+[A-Za-z0-9'’.,!?;:\-]+)*)/g;

export function MixedText({ text }: { text: string }): React.JSX.Element {
    return (
        <>
            {text.split(LATIN_RUN).map((part, index) =>
                /^[A-Za-z]/.test(part) ? (
                    <bdi key={index} dir="ltr" className="font-en">
                        {part}
                    </bdi>
                ) : (
                    <React.Fragment key={index}>{part}</React.Fragment>
                ),
            )}
        </>
    );
}

/** True when the first strong character is Latin (prompt direction). */
export function isLatinFirst(text: string): boolean {
    return /^[\s"'([\-]*[A-Za-z]/.test(text);
}
