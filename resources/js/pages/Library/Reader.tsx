import { Head } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import { IeltsReader } from '@/components/library/IeltsReader';
import { StoryReader } from '@/components/library/StoryReader';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    IeltsQuestion,
    IeltsResult,
    LibraryBreadcrumb,
    LibraryTab,
    ReadingArt,
    ReadingChapter,
    ReadingEndpoints,
    ReadingNode,
    ReadingPage,
    ReadingProgressState,
    SharedProps,
} from '@/types';

interface IeltsPassage {
    title_en: string | null;
    subtitle_fa: string | null;
    paragraphs: ReadingPage[];
}

interface ReaderProps extends SharedProps {
    tabs: LibraryTab[];
    track_label: string;
    node: ReadingNode;
    breadcrumbs: LibraryBreadcrumb[];
    revision: number;
    meta: Record<string, unknown>;
    endpoints: ReadingEndpoints;
    progress: ReadingProgressState | null;
    chapters?: ReadingChapter[];
    art?: ReadingArt | null;
    passage?: IeltsPassage;
    questions?: IeltsQuestion[];
    attempt?: IeltsResult | null;
    credit?: string | null;
}

/**
 * The one reader entry: the track chooses the layout, the server payload
 * decides what exists. Story and Inside Reading share the image/page
 * reader; IELTS has paragraphs, questions and a post-submit explanation.
 */
export const LibraryReader: FunctionComponent<ReaderProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = (props: ReaderProps): React.JSX.Element => {
    const { node, breadcrumbs, meta, credit } = props;
    const parent = [...breadcrumbs].reverse().find((crumb) => crumb.url !== null);
    const title = node.title_fa ?? node.title_en ?? props.track_label;

    return (
        <>
            <Head title={title} />
            <ScreenHeader title={title} back={{ href: parent?.url ?? '/app/books', label: parent?.title ?? 'بازگشت' }} />
            {node.track === 'ielts' ? (
                <IeltsReader
                    node={node}
                    breadcrumbs={breadcrumbs}
                    passage={
                        props.passage ?? {
                            title_en: node.title_en,
                            subtitle_fa: null,
                            paragraphs: [],
                        }
                    }
                    questions={props.questions ?? []}
                    attempt={props.attempt ?? null}
                    progress={props.progress}
                    endpoints={props.endpoints}
                    credit={credit ?? (typeof meta.credit === 'string' ? meta.credit : null)}
                />
            ) : (
                <StoryReader
                    node={node}
                    breadcrumbs={breadcrumbs}
                    chapters={props.chapters ?? []}
                    art={props.art ?? null}
                    progress={props.progress}
                    endpoints={props.endpoints}
                    credit={credit ?? (typeof meta.credit === 'string' ? meta.credit : null)}
                />
            )}
        </>
    );
};

LibraryReader.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LibraryReader;
