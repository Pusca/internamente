<?php
// valuation-handler.php
// Endpoint per:
// 1) richiesta valutazione AI (action=ai_estimate)
// 2) invio lead via email (action=send_lead, default)

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito']);
    exit;
}

$wp_load = dirname(__FILE__, 3) . '/wp-load.php';
if (file_exists($wp_load)) {
    require_once $wp_load;
}

function clean($key, $default = '')
{
    $v = $_POST[$key] ?? $default;
    if (is_array($v)) {
        return '';
    }
    return trim((string) $v);
}

function clean_num($key, $default = 0.0)
{
    $raw = str_replace(',', '.', clean($key, (string) $default));
    return is_numeric($raw) ? (float) $raw : (float) $default;
}

function extract_json_payload($text)
{
    if (!is_string($text) || $text === '') {
        return null;
    }

    $start = strpos($text, '{');
    $end = strrpos($text, '}');
    if ($start === false || $end === false || $end <= $start) {
        return null;
    }

    $candidate = substr($text, $start, $end - $start + 1);
    $parsed = json_decode($candidate, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
        return $parsed;
    }
    return null;
}

function to_eur_int($value)
{
    return (int) round((float) $value);
}

/**
 * Recupera la API key in modo sicuro:
 * - preferisce una costante definita lato server (wp-config.php)
 * - fallback su variabile d'ambiente OPENAI_API_KEY
 * NESSUN fallback hardcoded (per evitare leak e blocchi GitHub).
 */
function internamente_get_openai_api_key()
{
    $api_key = '';

    if (defined('INTERNAMENTE_OPENAI_API_KEY') && is_string(INTERNAMENTE_OPENAI_API_KEY)) {
        $api_key = trim((string) INTERNAMENTE_OPENAI_API_KEY);
    }

    if ($api_key === '' && function_exists('getenv')) {
        $env = getenv('OPENAI_API_KEY');
        if (is_string($env)) {
            $api_key = trim($env);
        }
    }

    // Normalizza: se per errore arriva "Bearer xxx" lo ripuliamo
    if (stripos($api_key, 'bearer ') === 0) {
        $api_key = trim(substr($api_key, 7));
    }

    return $api_key;
}

function ai_estimate_property()
{
    $api_key = internamente_get_openai_api_key();

    if ($api_key === '') {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => 'API key OpenAI non configurata. Imposta INTERNAMENTE_OPENAI_API_KEY in wp-config.php oppure la variabile d\'ambiente OPENAI_API_KEY.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $model = clean('model', 'gpt-5-mini');

    $property = [
        'address' => clean('address'),
        'city' => clean('city'),
        'cap' => clean('cap'),
        'type' => clean('type'),
        'sqm' => clean_num('sqm'),
        'rooms' => clean_num('rooms'),
        'baths' => clean_num('baths'),
        'year' => clean_num('year'),
        'condition' => clean('condition'),
        'energy' => clean('energy'),
        'floor' => clean('floor'),
        'elevator' => clean('elevator'),
        'furnished' => clean('furnished'),
        'ac' => clean('ac'),
        'heating' => clean('heating'),
        'parking' => clean('parking'),
        'parking_sqm' => clean_num('parking_sqm'),
        'outdoor' => clean('outdoor'),
        'outdoor_sqm' => clean_num('outdoor_sqm'),
        'exposure' => clean('exposure'),
        'cellar' => clean('cellar'),
        'solar' => clean('solar'),
        'view' => clean('view'),
        'notes' => clean('notes'),
    ];

    if ($property['sqm'] <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Superficie non valida']);
        exit;
    }

    $schema_hint = [
        'estimate_fair' => 450000,
        'estimate_min' => 420000,
        'estimate_max' => 480000,
        'estimate_fast' => 415000,
        'estimate_best' => 495000,
        'estimate_confidence' => 'Medio',
        'estimate_base_sqm' => 3100,
        'estimate_range_pct' => 7,
        'summary' => 'Stima sintetica basata su zona, stato, metratura e comparabili recenti.',
    ];

    $system_prompt = 'Sei un valutatore immobiliare per il mercato italiano. '
        . 'Rispondi solo con JSON valido, senza markdown, senza testo extra. '
        . 'La stima deve essere prudente e coerente con i dati ricevuti.';

    $user_prompt = "Valuta questo immobile e restituisci SOLO JSON con queste chiavi:\n"
        . json_encode(array_keys($schema_hint), JSON_UNESCAPED_UNICODE)
        . "\nDati immobile:\n"
        . json_encode($property, JSON_UNESCAPED_UNICODE)
        . "\nVincoli:\n"
        . "- Tutti i valori economici devono essere numeri interi in euro.\n"
        . "- estimate_min <= estimate_fair <= estimate_max.\n"
        . "- estimate_fast <= estimate_fair.\n"
        . "- estimate_best >= estimate_fair.\n"
        . "- estimate_range_pct tra 4 e 15.\n";

    $payload = [
        'model' => $model,
        'input' => [
            ['role' => 'system', 'content' => $system_prompt],
            ['role' => 'user', 'content' => $user_prompt],
        ],
    ];

    $response = wp_remote_post(
        'https://api.openai.com/v1/responses',
        [
            'timeout' => 45,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode($payload),
        ]
    );

    if (is_wp_error($response)) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Errore chiamata AI', 'details' => $response->get_error_message()]);
        exit;
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    $body = (string) wp_remote_retrieve_body($response);
    $decoded = json_decode($body, true);

    if ($code < 200 || $code >= 300) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Risposta AI non valida', 'status' => $code, 'details' => $decoded]);
        exit;
    }

    $output_text = '';
    if (is_array($decoded) && isset($decoded['output_text']) && is_string($decoded['output_text'])) {
        $output_text = $decoded['output_text'];
    } elseif (is_array($decoded) && isset($decoded['output']) && is_array($decoded['output'])) {
        foreach ($decoded['output'] as $entry) {
            if (!is_array($entry) || !isset($entry['content']) || !is_array($entry['content'])) {
                continue;
            }
            foreach ($entry['content'] as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $output_text .= $part['text'] . "\n";
                }
            }
        }
    }

    $result = extract_json_payload($output_text);
    if (!is_array($result)) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Output AI non parsabile', 'raw' => $output_text]);
        exit;
    }

    $normalized = [
        'estimate_fair' => to_eur_int($result['estimate_fair'] ?? 0),
        'estimate_min' => to_eur_int($result['estimate_min'] ?? 0),
        'estimate_max' => to_eur_int($result['estimate_max'] ?? 0),
        'estimate_fast' => to_eur_int($result['estimate_fast'] ?? 0),
        'estimate_best' => to_eur_int($result['estimate_best'] ?? 0),
        'estimate_confidence' => (string) ($result['estimate_confidence'] ?? ''),
        'estimate_base_sqm' => to_eur_int($result['estimate_base_sqm'] ?? 0),
        'estimate_range_pct' => (int) round((float) ($result['estimate_range_pct'] ?? 0)),
        'summary' => (string) ($result['summary'] ?? ''),
    ];

    echo json_encode(['ok' => true, 'estimate' => $normalized], JSON_UNESCAPED_UNICODE);
    exit;
}

function send_lead_email()
{
    $to = 'puscastanislav@gmail.com';
    $name = clean('name');
    $email = clean('email');
    $phone = clean('phone');

    if ($name === '' || $email === '' || $phone === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Campi contatto mancanti']);
        exit;
    }

    $subject = 'Nuova richiesta valutazione immobile - Internamente';

    $fields = [
        'Indirizzo' => clean('address'),
        'Citta' => clean('city'),
        'CAP' => clean('cap'),
        'Tipologia' => clean('type'),
        'Superficie (mq)' => clean('sqm'),
        'Locali' => clean('rooms'),
        'Bagni' => clean('baths'),
        'Anno costruzione' => clean('year'),
        'Stato immobile' => clean('condition'),
        'Classe energetica' => clean('energy'),
        'Piano' => clean('floor'),
        'Ascensore' => clean('elevator'),
        'Arredato' => clean('furnished'),
        'Climatizzazione' => clean('ac'),
        'Riscaldamento' => clean('heating'),
        'Posto auto/Garage' => clean('parking'),
        'Mq posto auto/garage' => clean('parking_sqm'),
        'Spazi esterni' => clean('outdoor'),
        'Mq spazi esterni' => clean('outdoor_sqm'),
        'Esposizione' => clean('exposure'),
        'Cantina/Solaio' => clean('cellar'),
        'Pannelli solari' => clean('solar'),
        'Vista/Affaccio' => clean('view'),
        'Note' => clean('notes'),
        '--- STIMA ---' => '',
        'Valore mercato (equo)' => clean('estimate_fair'),
        'Range minimo' => clean('estimate_min'),
        'Range massimo' => clean('estimate_max'),
        'Vendita rapida' => clean('estimate_fast'),
        'Miglior offerente' => clean('estimate_best'),
        'Affidabilita' => clean('estimate_confidence'),
        'Base EUR/mq' => clean('estimate_base_sqm'),
        'Range %' => clean('estimate_range_pct'),
    ];

    $body = "CONTATTI\n";
    $body .= "Nome: {$name}\n";
    $body .= "Email: {$email}\n";
    $body .= "Telefono: {$phone}\n\n";
    $body .= "DATI IMMOBILE\n";

    foreach ($fields as $k => $v) {
        if ($k === '--- STIMA ---') {
            $body .= "\nSTIMA\n";
            continue;
        }
        $body .= "{$k}: " . ($v === '' ? '-' : $v) . "\n";
    }

    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'Reply-To: ' . $name . ' <' . $email . '>',
    ];

    $sent = false;
    if (function_exists('wp_mail')) {
        $sent = wp_mail($to, $subject, $body, $headers);
    } else {
        $sent = mail($to, $subject, $body, implode("\r\n", $headers));
    }

    if (!$sent) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Invio email fallito']);
        exit;
    }

    echo json_encode(['ok' => true]);
    exit;
}

$action = clean('action', 'send_lead');
if ($action === 'ai_estimate') {
    ai_estimate_property();
}
send_lead_email();
