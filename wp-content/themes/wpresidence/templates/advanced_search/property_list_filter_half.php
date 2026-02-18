<?php
$order_class            =   ' order_filter_single ';  
$selected_order         =   esc_html__('Sort by','wpresidence');
$listing_filter         =   '';

if( is_tax() ){
    $listing_filter =  intval(wpresidence_get_option('wp_estate_property_list_type_tax_order',''));
}else if( isset($post->ID) ){
    if(is_page_template( 'page-templates/advanced_search_results.php' ) ){
        $listing_filter =  intval(wpresidence_get_option('wp_estate_property_list_type_adv_order',''));
    }else{
        $listing_filter         = get_post_meta($post->ID, 'listing_filter',true );
    }
}
  



$listing_filter_array   = wpestate_listings_sort_options_array();

$listings_list='';
$selected_order_num='';
foreach($listing_filter_array as $key=>$value){
    $listings_list.= '<li role="presentation" data-value="'.esc_html($key).'">'.esc_html($value).'</li>';//escaped above

    if($key==$listing_filter){
        $selected_order     =   $value;
        $selected_order_num =   $key;
    }
} 
?>

<div class="wpresidence_half_map_filter_wrapper">

    <?php
        print wpestate_build_dropdown_for_filters('a_filter_order',$selected_order_num,$selected_order,$listings_list );
    ?>
</div>