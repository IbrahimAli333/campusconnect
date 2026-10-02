"""Push notification copy in each app language.

Devices register their app language with their push token, so every
notification is written in the language that person uses. Tokens registered
before languages were recorded (or without one) get Azerbaijani, the app's
default language.
"""

from __future__ import annotations

from typing import Literal

PushLanguage = Literal["az", "en", "ru"]
DEFAULT_PUSH_LANGUAGE: PushLanguage = "az"
PUSH_LANGUAGES: tuple[PushLanguage, ...] = ("az", "en", "ru")

# template -> language -> (title, body); values are filled with str.format.
PUSH_TEMPLATES: dict[str, dict[str, tuple[str, str]]] = {
    "connection_request": {
        "az": ("Yeni əlaqə sorğusu", "{name} sizinlə əlaqə qurmaq istəyir."),
        "en": ("New connection request", "{name} wants to connect with you."),
        "ru": ("Новый запрос на контакт", "{name} хочет добавить вас в контакты."),
    },
    "connection_accepted": {
        "az": ("Əlaqə sorğusu qəbul edildi", "{name} əlaqə sorğunuzu qəbul etdi."),
        "en": ("Connection accepted", "{name} accepted your connection request."),
        "ru": ("Запрос принят", "{name} принял(а) ваш запрос на контакт."),
    },
    "application_accepted": {
        "az": ("Müraciət yeniliyi", "\"{title}\" elanına müraciətiniz qəbul edildi."),
        "en": ("Application update", "Your application to \"{title}\" was accepted."),
        "ru": ("Обновление отклика", "Ваш отклик на «{title}» принят."),
    },
    "application_rejected": {
        "az": ("Müraciət yeniliyi", "\"{title}\" elanına müraciətiniz rədd edildi."),
        "en": ("Application update", "Your application to \"{title}\" was rejected."),
        "ru": ("Обновление отклика", "Ваш отклик на «{title}» отклонён."),
    },
    "message": {
        "az": ("{name} sizə yazdı", "{preview}"),
        "en": ("Message from {name}", "{preview}"),
        "ru": ("Сообщение от {name}", "{preview}"),
    },
}


def render_push(template: str, language: str | None, values: dict[str, str]) -> tuple[str, str]:
    """Return (title, body) for a template in the given language."""
    by_language = PUSH_TEMPLATES[template]
    title, body = by_language.get(language or DEFAULT_PUSH_LANGUAGE) or by_language[DEFAULT_PUSH_LANGUAGE]
    return title.format(**values), body.format(**values)
