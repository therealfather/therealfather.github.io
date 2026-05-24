<?php

// Afișare erori pentru debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Formular PHP pentru trimitere email

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Verificare honeypot (spam protection)
    if (!empty($_POST['bot-field'])) {
        die('Spam detected');
    }

    // Preluare date
    $name = htmlspecialchars(trim($_POST['name'] ?? ''));
    $email = htmlspecialchars(trim($_POST['email'] ?? ''));
    $phone = htmlspecialchars(trim($_POST['phone'] ?? ''));
    $message = htmlspecialchars(trim($_POST['message'] ?? ''));

    // Validare
    if (empty($name) || empty($email) || empty($phone) || empty($message)) {
        die('Toate câmpurile sunt obligatorii');
    }

    // Validare email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        die('Email invalid');
    }

    // Email content
    $subject = "Misiune noua de la $name";

    $email_body = "
        <html>
        <body style='font-family: Arial, sans-serif;'>

            <h2>Misiune Noua - Web Alex Portfolio</h2>

            <p><strong>Nume/Brand:</strong> {$name}</p>

            <p><strong>Telefon:</strong> {$phone}</p>

            <p><strong>Email:</strong> {$email}</p>

            <p><strong>Brief Misiune:</strong></p>

            <p>" . nl2br($message) . "</p>

            <hr>

            <p>
                <small>
                    Trimis de pe: " . htmlspecialchars($_SERVER['HTTP_REFERER'] ?? 'Necunoscut') . "
                </small>
            </p>

            <p>
                <small>
                    IP: " . htmlspecialchars($_SERVER['REMOTE_ADDR'] ?? 'Necunoscut') . "
                </small>
            </p>

        </body>
        </html>
    ";

    // Headers HTML
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: WebAlex Contact <contact@webalex.ro>" . "\r\n";
    $headers .= "Reply-To: $email" . "\r\n";

    // Email destinations
    $to = "contact@webalex.ro, tamaslegend@gmail.com";

    // Trimitere email
    if (mail($to, $subject, $email_body, $headers)) {

        echo "
        <script>
            alert('Email trimis cu succes!');
            window.history.back();
        </script>
        ";

    } else {

        echo "
        <script>
            alert('Eroare la trimiterea emailului.');
            window.history.back();
        </script>
        ";

    }

} else {

    echo "
    <script>
        alert('Metodă nepermisă.');
        window.history.back();
    </script>
    ";

}

?>
