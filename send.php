<?php
/* ============================================================
   Отправка заявки с сайта на почту фабрики.
   Кладётся в корень сайта рядом с index.html.

   Как включить: в script.js в блоке ORDER замените endpoint на 'send.php'
   и mode на 'php'. Работает на любом хостинге с PHP (Timeweb, Reg.ru,
   Beget, Спринтхост и т. п.).
   ============================================================ */

declare(strict_types=1);

const MAIL_TO   = 'darina_meb_ps@mail.ru';
const MAIL_FROM = 'site@darinameb.ru'; // адрес на вашем домене — иначе письма уходят в спам

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается']);
    exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

$clean = static function (?string $v, int $max = 500): string {
    $v = trim((string)$v);
    $v = str_replace(["\r", "\n", "%0a", "%0d"], ' ', $v); // защита от инъекции в заголовки
    return mb_substr($v, 0, $max);
};

$name  = $clean($data['Имя']         ?? $data['name']  ?? '', 120);
$city  = $clean($data['Город']       ?? $data['city']  ?? '', 120);
$phone = $clean($data['Телефон']     ?? $data['phone'] ?? '', 40);
$note  = $clean($data['Комментарий'] ?? $data['note']  ?? '', 2000);
$order = trim((string)($data['Заказ'] ?? $data['order'] ?? ''));
$total = $clean($data['Итого, ₽']    ?? $data['total'] ?? '', 40);
$count = $clean($data['Позиций']     ?? $data['count'] ?? '', 10);

$digits = preg_replace('/\D+/', '', $phone);

if ($name === '' || $city === '' || mb_strlen((string)$digits) < 10) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Заполните город, имя и телефон'], JSON_UNESCAPED_UNICODE);
    exit;
}

$e = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

$rows = '';
foreach ([
    'Имя'         => $name,
    'Город'       => $city,
    'Телефон'     => $phone,
    'Комментарий' => $note !== '' ? $note : '—',
    'Позиций'     => $count !== '' ? $count : '—',
    'Итого'       => $total !== '' ? $total . ' ₽' : '—',
] as $k => $v) {
    $rows .= '<tr>'
        . '<td style="padding:8px 14px;border:1px solid #DBD3C8;background:#F6F2EC;font-weight:600;white-space:nowrap">' . $e($k) . '</td>'
        . '<td style="padding:8px 14px;border:1px solid #DBD3C8">' . nl2br($e($v)) . '</td>'
        . '</tr>';
}

$html = '<!doctype html><html lang="ru"><meta charset="utf-8"><body style="font-family:Arial,Helvetica,sans-serif;color:#191512">'
    . '<h2 style="color:#7B4B22;margin:0 0 4px">Новая заявка с сайта</h2>'
    . '<p style="margin:0 0 16px;color:#7A6E63;font-size:13px">' . $e(date('d.m.Y H:i')) . '</p>'
    . '<table style="border-collapse:collapse;font-size:14px">' . $rows . '</table>'
    . '<h3 style="color:#7B4B22;margin:22px 0 8px">Выбранные позиции</h3>'
    . '<pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:13px;background:#F6F2EC;'
    . 'border:1px solid #DBD3C8;border-radius:10px;padding:14px;margin:0">' . $e($order !== '' ? $order : '—') . '</pre>'
    . '<p style="margin-top:22px;font-size:12px;color:#7A6E63">Письмо отправлено формой заказа на darinameb.ru</p>'
    . '</body></html>';

$subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта — ' . $name . ', ' . $city) . '?=';

$headers   = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/html; charset=UTF-8';
$headers[] = 'From: =?UTF-8?B?' . base64_encode('Сайт Дарина') . '?= <' . MAIL_FROM . '>';
$headers[] = 'Reply-To: ' . MAIL_FROM;
$headers[] = 'X-Mailer: PHP/' . phpversion();

$sent = @mail(MAIL_TO, $subject, $html, implode("\r\n", $headers));

/* Дублируем заявку в файл: если почта на хостинге отвалится, заказы не потеряются */
@file_put_contents(
    __DIR__ . '/orders.log',
    date('c') . ' | ' . $name . ' | ' . $city . ' | ' . $phone . ' | ' . $total . " ₽\n" . $order . "\n---\n",
    FILE_APPEND | LOCK_EX
);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Почтовая служба хостинга недоступна'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
