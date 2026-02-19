<?php
/**
 * Plugin Name: Internamente Baseline Hardening
 * Description: Safe baseline hardening, performance cleanup, and technical SEO tweaks.
 * Version: 1.0.0
 * Author: Internamente
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Security headers with low compatibility risk.
 */
add_action('send_headers', function () {
    if (headers_sent()) {
        return;
    }

    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), camera=(), microphone=()');
}, 20);

/**
 * Security: reduce public metadata and pingback attack surface.
 */
remove_action('wp_head', 'wp_generator');
remove_action('wp_head', 'rsd_link');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'wp_shortlink_wp_head', 10);
add_filter('the_generator', '__return_empty_string');
add_filter('wp_headers', function ($headers) {
    if (isset($headers['X-Pingback'])) {
        unset($headers['X-Pingback']);
    }
    return $headers;
});
add_filter('xmlrpc_methods', function ($methods) {
    unset($methods['pingback.ping'], $methods['pingback.extensions.getPingbacks']);
    return $methods;
});

/**
 * Security: disable file editor in wp-admin.
 */
if (!defined('DISALLOW_FILE_EDIT')) {
    define('DISALLOW_FILE_EDIT', true);
}

/**
 * Security: prevent basic author enumeration via ?author=1 redirects.
 */
add_action('template_redirect', function () {
    if (is_admin()) {
        return;
    }

    if (isset($_GET['author']) && is_numeric($_GET['author'])) {
        wp_safe_redirect(home_url('/'), 301);
        exit;
    }
}, 1);

/**
 * Performance: remove emoji scripts/styles.
 */
add_action('init', function () {
    remove_action('wp_head', 'print_emoji_detection_script', 7);
    remove_action('admin_print_scripts', 'print_emoji_detection_script');
    remove_action('wp_print_styles', 'print_emoji_styles');
    remove_action('admin_print_styles', 'print_emoji_styles');
    remove_filter('the_content_feed', 'wp_staticize_emoji');
    remove_filter('comment_text_rss', 'wp_staticize_emoji');
    remove_filter('wp_mail', 'wp_staticize_emoji_for_email');
});

/**
 * Performance: remove embeds script on frontend.
 */
add_action('wp_enqueue_scripts', function () {
    if (!is_admin()) {
        wp_deregister_script('wp-embed');
    }
}, 100);

/**
 * Technical SEO: noindex search and paginated archives.
 */
add_action('wp_head', function () {
    if (is_search() || (is_archive() && is_paged())) {
        echo '<meta name="robots" content="noindex,follow" />' . "\n";
    }
}, 1);

