import { Head, usePage } from '@inertiajs/react';
import type { SharedProps } from '@/types';

/**
 * Client half of the public metadata contract. The Blade partial renders
 * the same tags with matching `data-inertia` keys, so the first paint has
 * crawler-ready metadata and every Inertia visit replaces it instead of
 * leaving the previous page's canonical/OG tags behind.
 */
export function SeoHead(): React.JSX.Element | null {
    const { seo } = usePage<SharedProps>().props;

    if (seo === null || seo === undefined) {
        return null;
    }

    const hasDescription = seo.description !== null && seo.description !== '';
    const hasJsonLd = seo.json_ld !== null && Object.keys(seo.json_ld).length > 0;

    return (
        <Head title={seo.title}>
            <link head-key="canonical" rel="canonical" href={seo.canonical} />
            {hasDescription && <meta head-key="description" name="description" content={seo.description ?? ''} />}
            <meta head-key="og:site_name" property="og:site_name" content="Fast English" />
            <meta head-key="og:locale" property="og:locale" content="fa_IR" />
            <meta head-key="og:type" property="og:type" content={seo.type} />
            <meta head-key="og:title" property="og:title" content={seo.title} />
            {hasDescription && <meta head-key="og:description" property="og:description" content={seo.description ?? ''} />}
            <meta head-key="og:url" property="og:url" content={seo.canonical} />
            <meta head-key="og:image" property="og:image" content={seo.image} />
            <meta head-key="og:image:alt" property="og:image:alt" content={seo.image_alt} />
            <meta head-key="og:image:width" property="og:image:width" content={String(seo.image_width)} />
            <meta head-key="og:image:height" property="og:image:height" content={String(seo.image_height)} />
            <meta head-key="twitter:card" name="twitter:card" content="summary_large_image" />
            <meta head-key="twitter:title" name="twitter:title" content={seo.title} />
            {hasDescription && <meta head-key="twitter:description" name="twitter:description" content={seo.description ?? ''} />}
            <meta head-key="twitter:image" name="twitter:image" content={seo.image} />
            <meta head-key="twitter:image:alt" name="twitter:image:alt" content={seo.image_alt} />
            {seo.robots !== null && seo.robots !== '' && <meta head-key="robots" name="robots" content={seo.robots} />}
            {hasJsonLd && (
                <script
                    head-key="json-ld"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        // The server also HEX-escapes the payload; escaping
                        // `<` here keeps a lesson title from closing the script.
                        __html: JSON.stringify(seo.json_ld).replace(/</g, '\\u003c'),
                    }}
                />
            )}
        </Head>
    );
}
