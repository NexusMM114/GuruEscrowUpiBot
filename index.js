const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛒 Start Deal", callback_data: "deal" }]
      ]
    },
    parse_mode: "Markdown"
  };

  bot.sendMessage(
    chatId,
    "🔐 *Welcome to Guru Escrow Bot!*\n\nUse the buttons below to get started:",
    buttons
  );
});

// callback button handler
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "deal") {
    bot.sendMessage(chatId, "🛒 Deal process started!");
  }
});
