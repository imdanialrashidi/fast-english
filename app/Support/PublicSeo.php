<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

/**
 * One shaping point for public crawler metadata (title, description,
 * canonical, Open Graph, Twitter, JSON-LD). Controllers supply the page
 * copy; this class owns the shared defaults so the server-rendered tags in
 * `resources/views/partials/seo.blade.php` and the client `SeoHead`
 * component stay identical during Inertia navigation.
 */
final class PublicSeo
{
    public const DEFAULT_IMAGE = '/images/og/fast-english-1200x630.png';

    public const DEFAULT_IMAGE_WIDTH = 1200;

    public const DEFAULT_IMAGE_HEIGHT = 630;

    public const DEFAULT_IMAGE_ALT = 'Fast English — خواندن و شنیدن انگلیسی در شش سطح';

    /**
     * @param  array<string, mixed>|null  $jsonLd
     * @return array{
     *     title: string,
     *     description: string|null,
     *     canonical: string,
     *     type: 'website'|'article',
     *     image: string,
     *     image_alt: string,
     *     image_width: int,
     *     image_height: int,
     *     robots: string|null,
     *     json_ld: array<string, mixed>|null
     * }
     */
    public static function page(
        string $title,
        ?string $description,
        string $canonical,
        ?array $jsonLd = null,
        string $type = 'website',
        ?string $image = null,
        ?string $imageAlt = null,
        ?int $imageWidth = null,
        ?int $imageHeight = null,
    ): array {
        return [
            'title' => $title,
            'description' => $description,
            'canonical' => $canonical,
            'type' => $type === 'article' ? 'article' : 'website',
            'image' => self::absolute($image !== null && trim($image) !== '' ? $image : self::DEFAULT_IMAGE),
            'image_alt' => $imageAlt ?? self::DEFAULT_IMAGE_ALT,
            'image_width' => $imageWidth ?? self::DEFAULT_IMAGE_WIDTH,
            'image_height' => $imageHeight ?? self::DEFAULT_IMAGE_HEIGHT,
            // The production-only index signal mirrors the old root
            // template: staging keeps its blanket noindex header instead.
            'robots' => app()->environment('production') ? 'index, follow' : null,
            'json_ld' => $jsonLd,
        ];
    }

    /**
     * Brand entity shared by the landing graph and the sample publisher.
     *
     * @return array<string, mixed>
     */
    public static function organization(): array
    {
        $node = [
            '@type' => 'Organization',
            '@id' => route('landing').'#organization',
            'name' => 'Fast English',
            'url' => route('landing'),
            'logo' => [
                '@type' => 'ImageObject',
                'url' => self::absolute('/icons/icon-512.png'),
                'width' => 512,
                'height' => 512,
            ],
        ];

        $email = trim(SiteSettings::supportEmail());
        if (filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
            $node['contactPoint'] = [
                '@type' => 'ContactPoint',
                'contactType' => 'customer support',
                'email' => $email,
                'availableLanguage' => ['fa', 'en'],
            ];
        }

        return $node;
    }

    /**
     * Absolute URL for local assets and storage paths.
     */
    public static function absolute(?string $url): string
    {
        $value = trim((string) $url);

        if ($value === '') {
            return URL::to('/');
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }

        return URL::to($value);
    }
}
