<?php
// Formular PHP pentru trimitere email
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verificare honeypot (spam protection)
    if (!empty($_POST['bot-field'])) {
        echo json_encode(['success' => false, 'message' => 'Spam detected']);
        exit;
    }
    
    // Preluare date
    $name = htmlspecialchars($_POST['name'] ?? '');
    $email = htmlspecialchars($_POST['email'] ?? '');
    $message = htmlspecialchars($_POST['message'] ?? '');
    $phone = htmlspecialchars($_POST['phone'] ?? '');
    
    // Validare
    if (empty($name) || empty($email) || empty($phone) || empty($message)) {
        echo json_encode(['success' => false, 'message' => 'Toate câmpurile sunt obligatorii']);
        exit;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Email invalid']);
        exit;
    }
    
    // Email content
    $subject = "Misiune noua de la $name";
    $email_body = "
        <h2>Misiune Noua - Web Alex Portfolio</h2>
        <p><strong>Nume/Brand:</strong> $name</p>
        <p><strong>Email:</strong> $email</p>
        <p><strong>Brief Misiune:</strong></p>
        <p>" . nl2br($message) . "</p>
        <hr>
        <p><small>Trimis de pe: " . ($_SERVER['HTTP_REFERER'] ?? 'Necunoscut') . "</small></p>
    ";
    
    // Headers HTML
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: $name <$email>" . "\r\n";
    $headers .= "Reply-To: $email" . "\r\n";
    
    // Email destinations
    $to = "contact@webalex.ro, tamaslegend@gmail.com";
    
    // Trimitere email
    if (mail($to, $subject, $email_body, $headers)) {
        echo json_encode(['success' => true, 'message' => 'Email trimis cu succes!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Eroare la trimiterea emailului']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Metodă nepermisă']);
}
?>
