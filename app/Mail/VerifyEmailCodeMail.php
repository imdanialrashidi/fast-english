<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The six-digit email-verification mail. Sent synchronously from the
 * registration/resend path so the learner never sees a code page while a
 * background worker is down; the plain code lives only in this message.
 */
class VerifyEmailCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userName,
        public string $code,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'کد تأیید ایمیل Fast English',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.verify-email-code',
            text: 'mail.verify-email-code-text',
        );
    }
}
