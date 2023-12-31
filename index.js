import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const { Client, LocalAuth } = pkg;
const app = express();
const server = http.createServer(app); // Create an HTTP server
const io = new Server(server); // Create a new instance of socket.io
const __dirname = path.resolve();
const port = 3001;
var list = new Array();

app.set("view engine", "html");

app.use(express.static("views"));

app.get("/", (req, res) => {
  res.render("index", {
    message: list,
  });
});

app.get("/getMessages", (req, res) => {
  res.json(list);
});

server.listen(port, () => {
  console.log(`Sserver listening on the port:: ${port}`);
});

// app.listen(port, () => {
//   console.log(`Server listening on the port:: ${port}`);
// });

const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox"],
  },
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

const authorPhone = async (phone) => {
  if (phone?.includes(":")) {
    // ":" karakteri varsa, ":" karakterinden sonrasını sil
    return phone?.split(":")[0];
  } else if (phone?.includes("@")) {
    // ":" karakteri yoksa ve "@" karakteri varsa, "@" karakterinden sonrasını sil
    return phone?.split("@")[0];
  } else {
    // Ne ":" ne de "@" karakteri varsa, giriş metnini olduğu gibi döndür
    return phone;
  }
};

// Get messages and list push
const saveChats = async (chat) => {
  const currentTime = Date.now();
  const fortyEightHoursAgo = 48 * 60 * 60 * 1000;

  var msg = await chat.fetchMessages();
  await msg.map(async (element) => {
    // Check if the message is from the last 48 hours
    if (
      currentTime - element.timestamp > fortyEightHoursAgo &&
      element.body != ""
    ) {
      // Author phone number edit
      const author = await authorPhone(element.author);

      // Checking for message existence
      const existingMessage = list.find(
        (item) => item.messageId === element.id.id
      );

      if (!existingMessage) {
        list.push({
          messageId: element.id.id,
          messageText: element.body,
          messageTimeStamp: element.timestamp,
          messageAuthor: author,
        });
      }
    }
  });

  list.sort((a, b) => b.messageTimeStamp - a.messageTimeStamp);

  console.log("serverList", list);
  io.emit("updateList", list);
};

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (message) => {
  const chat = await message.getChat();

  if (chat.isGroup) {
    await saveChats(chat);
  }
});

client.initialize();
