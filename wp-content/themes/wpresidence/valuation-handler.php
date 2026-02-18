<?php
// valuation-handler.php
// Endpoint semplice: riceve POST e invia email a puscastanislav@gmail.com

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Metodo non consentito']);
  exit;
}

// (Opzionale ma consigliato) Carica WordPress per usare wp_mail()
$wp_load = dirname(__FILE__, 3) . '/wp-load.php'; // themes/<tema>/ => risale fino a wp-load.php
if (file_exists($wp_load)) {
  require_once $wp_load;
}

function clean($key, $default = '') {
  $v = $_POST[$key] ?? $default;
  if (is_array($v)) return '';
  $v = trim((string)$v);
  return $v;
}

$to = 'puscastanislav@gmail.com';
$name  = clean('name');
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
  'Città' => clean('city'),
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
  'Spazi esterni' => clean('outdoor'),
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
  'Affidabilità' => clean('estimate_confidence'),
  'Base €/mq' => clean('estimate_base_sqm'),
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
  if ($v === '') $v = '-';
  $body .= "{$k}: {$v}\n";
}

// Header mail
$headers = [];
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
// Reply-To utile per rispondere direttamente al lead
$headers[] = 'Reply-To: ' . $name . ' <' . $email . '>';

$sent = false;

if (function_exists('wp_mail')) {
  $sent = wp_mail($to, $subject, $body, $headers);
} else {
  // fallback (meno affidabile su molti hosting)
  $sent = mail($to, $subject, $body, implode("\r\n", $headers));
}

if (!$sent) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Invio email fallito']);
  exit;
}

echo json_encode(['ok' => true]);
