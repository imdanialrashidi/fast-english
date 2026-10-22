<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Renewal reminder for an active subscription nearing its end.
 *
 * The message contains only the learner's name, the remaining days, and
 * the subscribe link. It never includes payment snapshots, receipt data,
 * bank details, or staff notes. Real delivery is a launch prerequisite
 * (SMTP); the command is idempotent through
 * subscriptions.renewal_reminder_sent_at.
 */
class SubscriptionExpiring extends Notification
{
    public function __construct(public int $daysLeft) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = trim((string) ($notifiable->name ?? ''));

        return (new MailMessage)
            ->subject('اشتراک Fast English به‌زودی تمام می‌شود')
            ->greeting($name !== '' ? 'سلام '.$name : 'سلام')
            ->line('اشتراک فعال شما '.$this->daysLeft.' روز دیگر به پایان می‌رسد.')
            ->line('برای ادامه دسترسی به همه متن‌ها و صوت‌ها، از پایان دوره فعلی تمدید کنید.')
            ->action('تمدید اشتراک', route('subscribe.index'))
            ->line('اگر قصد تمدید نداری، همین حالا هم می‌توانی از نمونه رایگان استفاده کنی.');
    }
}
