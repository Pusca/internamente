<?php
// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}


// Ensure the property ID is set
if (!isset($post_id)) {
    global $post;
    $post_id = $post->ID;
}

?>
<div class="property_reviews_wrapper">
    <h4><?php echo ucfirst(str_replace('estate_', '', get_post_type( $post_id  ))); ?> Reviews</h4>
    <div id="review-message"></div>
<?php
get_template_part('templates/reviews/reviews-list');
get_template_part('templates/reviews/reviews-form');
?>
</div>
<?php wp_enqueue_script('wpestate_reviews'); ?>
