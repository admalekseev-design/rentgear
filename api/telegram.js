function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sendJson(response, status, body) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return sendJson(response, 405, {
      ok: false,
      message: "Метод не поддерживается"
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram environment variables are not configured");

    return sendJson(response, 500, {
      ok: false,
      message: "Сервис отправки временно недоступен"
    });
  }

  try {
    const body =
      typeof request.body === "string"
        ? JSON.parse(request.body)
        : request.body || {};

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const service = String(body.service || "").trim();
    const website = String(body.website || "").trim();

    /*
      Honeypot. Спам-бот получает успешный ответ,
      но сообщение в Telegram не отправляется.
    */
    if (website) {
      return sendJson(response, 200, { ok: true });
    }

    if (name.length < 2 || name.length > 80) {
      return sendJson(response, 400, {
        ok: false,
        message: "Укажите корректное имя"
      });
    }

    if (phone.length < 7 || phone.length > 30) {
      return sendJson(response, 400, {
        ok: false,
        message: "Укажите корректный телефон"
      });
    }

    if (service.length < 2 || service.length > 100) {
      return sendJson(response, 400, {
        ok: false,
        message: "Выберите услугу"
      });
    }

    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeService = escapeHtml(service);

    const message = [
      "💅 <b>Новая заявка с сайта «Эстетика»</b>",
      "",
      `👤 <b>Имя:</b> ${safeName}`,
      `📞 <b>Телефон:</b> ${safePhone}`,
      `✨ <b>Услуга:</b> ${safeService}`,
      "",
      `🕒 <b>Получена:</b> ${new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Yekaterinburg",
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date())}`
    ].join("\n");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram API error:", {
        status: telegramResponse.status,
        description: telegramResult.description
      });

      return sendJson(response, 502, {
        ok: false,
        message: "Telegram не принял сообщение"
      });
    }

    return sendJson(response, 200, {
      ok: true
    });
  } catch (error) {
    console.error("Telegram function error:", error);

    return sendJson(response, 500, {
      ok: false,
      message: "Не удалось обработать заявку"
    });
  }
};
