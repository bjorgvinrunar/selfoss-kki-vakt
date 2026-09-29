<?php
/**
 * Dæmi: sækja gögnin frá GitHub inn í WordPress og birta með shortcode.
 * Settu þetta í viðbótina þína (eða functions.php) og slóðin vísar á bjorgvinrunar/selfoss-kki-vakt.
 *
 * Notkun:  [selfoss_leikir lid="mfl-karla"]
 */

define('SELFOSS_KKI_JSON', 'https://raw.githubusercontent.com/bjorgvinrunar/selfoss-kki-vakt/main/data/allt.json');

function selfoss_kki_gogn() {
    $gogn = get_transient('selfoss_kki_gogn');
    if ($gogn !== false) {
        return $gogn;
    }

    $svar = wp_remote_get(SELFOSS_KKI_JSON, ['timeout' => 10]);
    if (!is_wp_error($svar) && wp_remote_retrieve_response_code($svar) === 200) {
        $gogn = json_decode(wp_remote_retrieve_body($svar), true);
        if (is_array($gogn)) {
            update_option('selfoss_kki_sidast_gott', $gogn, false); // varaafrit ef GitHub svarar ekki
            set_transient('selfoss_kki_gogn', $gogn, 10 * MINUTE_IN_SECONDS);
            return $gogn;
        }
    }

    return get_option('selfoss_kki_sidast_gott', []);
}

function selfoss_kki_shortcode($atts) {
    $atts = shortcode_atts(['lid' => ''], $atts);
    $gogn = selfoss_kki_gogn();

    foreach ($gogn['lid'] ?? [] as $lid) {
        if ($lid['slug'] !== $atts['lid']) {
            continue;
        }

        $html = '<table class="selfoss-leikir"><thead><tr>'
              . '<th>Dags.</th><th>Tími</th><th>Heima</th><th>Gestir</th><th>Úrslit</th>'
              . '</tr></thead><tbody>';

        foreach ($lid['leikir'] as $leikur) {
            $html .= '<tr>'
                   . '<td>' . esc_html($leikur['dags'] ?? '') . '</td>'
                   . '<td>' . esc_html($leikur['timi'] ?? '') . '</td>'
                   . '<td>' . esc_html($leikur['heima'] ?? '') . '</td>'
                   . '<td>' . esc_html($leikur['gestir'] ?? '') . '</td>'
                   . '<td>' . esc_html($leikur['urslit'] ?? '') . '</td>'
                   . '</tr>';
        }

        return $html . '</tbody></table>';
    }

    return '<p>Engir leikir fundust.</p>';
}
add_shortcode('selfoss_leikir', 'selfoss_kki_shortcode');
