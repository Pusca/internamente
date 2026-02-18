<?php
/**MILLDONE
 * Property List Filters Search Template
 * src:templates\properties_list_templates\filters_templates\property_list_filters_search.php
 * This template is responsible for displaying the search filters and sorting options
 * on property listing pages in the WpResidence theme. It includes:
 * - Hidden inputs for AJAX functionality
 * - Sorting dropdown
 * - View toggle buttons (list/grid)
 *
 * @package WpResidence
 * @subpackage PropertyListings
 * @since WpResidence 1.0
 *
 * @global object $post The current post object
 * @global string $wpestate_prop_unit The current property unit display type ('grid' or 'list')
 *
 * @uses wpestate_listings_sort_options_array() to get sorting options
 * @uses wpresidence_display_orderby_dropdown() to display the sorting dropdown
 */

// Initialize variables for sorting options
$selected_order = esc_html__('Sort by', 'wpresidence');
$sort_options_array = wpestate_listings_sort_options_array();
$listings_list = '';
?>
<div class="adv_listing_filters_head advanced_filters"> 
    <?php
    // Hidden input for storing the current page ID
    // This is used in AJAX requests to maintain context
    ?>
    <input type="hidden" id="page_idx" value="<?php echo intval($post->ID); ?>">
    
    <?php
    // Hidden input for storing search arguments
    // These arguments are used to persist search criteria across AJAX requests
    ?>
    <input type="hidden" id="searcharg" value='<?php echo json_encode($args); ?>'>
    
    <?php
    // Generate a nonce for security in AJAX requests
    // This helps prevent CSRF attacks
    $ajax_nonce = wp_create_nonce("wpestate_search_nonce");
    ?>
    <input type="hidden" id="wpestate_search_nonce" value="<?php echo esc_attr($ajax_nonce); ?>"> 

    <?php 
    // Display the dropdown for ordering properties
    // This function is defined elsewhere in the theme
    wpresidence_display_orderby_dropdown($post->ID);

    // Set up classes for grid and list view toggles
    // These classes control the visual indicator of which view is active
    $prop_unit_grid_class = 'icon_selected';
    $prop_unit_list_class = '';
    if ($wpestate_prop_unit == 'list') {
        $prop_unit_grid_class = '';
        $prop_unit_list_class = 'icon_selected';
    }
    ?>    
    
    <div class="wpestate_list_grid_filter_wiew_wrapper">
        <div class="listing_filter_select listing_filter_views listing_filter_views_horizontal">
            <div id="list_view" class="<?php echo esc_attr($prop_unit_list_class); ?>">
                <i class="fas fa-bars"></i>                  
            </div>
        </div>


        <div class="listing_filter_select listing_filter_views">
            <div id="grid_view" class="<?php echo esc_attr($prop_unit_grid_class); ?>"> 
                <i class="fa-solid fa-grip-vertical"></i>
            </div>
        </div>
    </div>
</div>