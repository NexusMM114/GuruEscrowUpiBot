const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Guru Escrow Bot is running 🟢");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.BOT_TOKEN;

// ✅ MULTIPLE ADMINS
const ADMIN_IDS = [7168883291, 6389122186];

const bot = new TelegramBot(TOKEN, { polling: true });

// In-memory storage
const trades = {};
const wallets = {};
let totalDeals = 0; // ✅ FIXED

// ---------------- /start ----------------
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🔐 *Welcome to Guru Escrow Bot!*\n\nUse the button below to start a deal:",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Start Deal", callback_data: "deal" }]]
      }
    }
  );
});

// ---------------- CALLBACK HANDLER ----------------
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  if (data === "deal") {
    bot.sendMessage(chatId, "💰 Enter the trade amount:", {
      reply_markup: { force_reply: true }
    });
  }

  if (data.startsWith("accept_")) {
    const buyerId = data.split("_")[1];
    const trade = trades[buyerId];

    if (!trade || trade.seller !== chatId) {
      return bot.sendMessage(chatId, "⚠️ Invalid trade.");
    }

    trade.status = "accepted";

    bot.sendMessage(chatId, "✅ Trade accepted!");

    bot.sendMessage(buyerId, "📢 Seller accepted! Deposit funds.", {
      reply_markup: {
        inline_keyboard: [[{ text: "💰 Confirm To Add Money", callback_data: `deposit_${buyerId}` }]]
      }
    });
  }

  if (data.startsWith("deposit_")) {
    const buyerId = data.split("_")[1];
    const trade = trades[buyerId];

    if (!trade || trade.buyer !== chatId) {
      return bot.sendMessage(chatId, "❌ You are not the buyer.");
    }

    if ((wallets[chatId] || 0) < trade.amount) {
      return bot.sendMessage(chatId, "❌ Insufficient balance.");
    }

    wallets[chatId] -= trade.amount;
    trade.status = "funded";

    bot.sendMessage(chatId, "✅ Funds deposited!");
    bot.sendMessage(trade.seller, "📢 Buyer deposited funds. Deliver now.");
  }
});

// ---------------- MESSAGE HANDLER ----------------
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (msg.reply_to_message?.text === "💰 Enter the trade amount:") {
    if (isNaN(text)) return bot.sendMessage(chatId, "⚠️ Invalid amount.");

    trades[chatId] = { buyer: chatId, amount: Number(text), status: "pending" };
    return bot.sendMessage(chatId, "👤 Send Seller Telegram ID:", {
      reply_markup: { force_reply: true }
    });
  }

  if (msg.reply_to_message?.text.includes("Seller Telegram ID")) {
    if (isNaN(text)) return bot.sendMessage(chatId, "⚠️ Invalid seller ID.");

    const trade = trades[chatId];
    trade.seller = Number(text);

    bot.sendMessage(trade.seller, "📢 Trade request received!", {
      reply_markup: {
        inline_keyboard: [[{ text: "✅ Accept Trade", callback_data: `accept_${chatId}` }]]
      }
    });

    return bot.sendMessage(chatId, "✅ Trade request sent.");
  }

  // ---------------- /release ----------------
  if (text === "/release") {
    const trade = trades[chatId];

    if (!trade || trade.status !== "funded") {
      return bot.sendMessage(chatId, "⚠️ No active funded trade found.");
    }

    wallets[trade.seller] =
      (wallets[trade.seller] || 0) + trade.amount;

    trade.status = "completed";
    totalDeals++; // ✅ FIXED

    bot.sendMessage(chatId, "✅ Funds successfully released to the seller!");
    bot.sendMessage(
      trade.seller,
      `🎉 You received ₹${trade.amount}\n💼 Balance: ₹${wallets[trade.seller]}`
    );
  }

  // ---------------- /paisa ----------------
  if (text === "/paisa") {
    return bot.sendMessage(chatId, `💰 Balance: ₹${wallets[chatId] || 0}`);
  }

  // ---------------- /add ----------------
  if (text.startsWith("/add")) {
    if (!ADMIN_IDS.includes(chatId)) {
      return bot.sendMessage(chatId, "❌ Admin only.");
    }

    const [, userId, amount] = text.split(" ");
    wallets[userId] = (wallets[userId] || 0) + Number(amount);

    bot.sendMessage(chatId, "✅ Funds added.");
    bot.sendMessage(userId, `💰 ₹${amount} added by admin.`);
  }

  // ---------------- /dispute ----------------
  if (text === "/dispute") {
    const trade = trades[chatId];
    if (!trade || trade.status !== "funded") {
      return bot.sendMessage(chatId, "⚠️ No trade for dispute.");
    }

    trade.status = "disputed";
    bot.sendMessage(chatId, "⚠️ Trade disputed. Admin notified.");

    ADMIN_IDS.forEach((id) => {
      bot.sendMessage(
        id,
        `🚨 Dispute\nBuyer: ${trade.buyer}\nSeller: ${trade.seller}\nAmount: ₹${trade.amount}`
      );
    });
  }
});
