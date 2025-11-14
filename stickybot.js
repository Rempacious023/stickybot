process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client } = require('discord.js-selfbot-v13');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_TOKEN';

const configFile = path.join(__dirname, 'data.json');

const defaultConfig = {
  channelIds: [],
  stickyMessage: 'This is a sticky message!',
  tickInterval: 60000,
  postInterval: 60000
};

let config = defaultConfig;
if (fs.existsSync(configFile)) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    console.error('Error loading config:', err);
    config = defaultConfig;
  }
}

function saveConfig() {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('dashboard', { config });
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  config.stickyMessage = req.body.stickyMessage || config.stickyMessage;
  config.tickInterval = Number(req.body.tickInterval) || config.tickInterval;
  config.postInterval = Number(req.body.postInterval) || config.postInterval;
  
  if (req.body.channelIds) {
    config.channelIds = req.body.channelIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }
  
  saveConfig();
  res.json({ success: true, config });
});

const client = new Client();
let messageQueue = [];

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startStickyLoop();
});

function startStickyLoop() {
  setInterval(() => {
    if (config.channelIds.length === 0) {
      console.log('No channels configured. Waiting...');
      return;
    }
    
    messageQueue = [...config.channelIds];
    postNextMessage();
  }, config.tickInterval);
}

async function postNextMessage() {
  if (messageQueue.length === 0) return;
  
  const channelId = messageQueue.shift();
  
  try {
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`Channel ${channelId} not found`);
      scheduleNextPost();
      return;
    }

    try {
      // Get the last message from the channel
      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMessage = messages.first();
      
      // Delete previous sticky message if it exists and was sent by us
      if (lastMessage && lastMessage.author.id === client.user.id) {
        await lastMessage.delete().catch(() => {});
      }
    } catch (err) {
      console.log(`Could not fetch/delete previous message in ${channelId}: ${err.message}`);
    }
    
    // Post new message
    try {
      await channel.send(config.stickyMessage);
      console.log(`Posted to channel ${channelId}`);
    } catch (err) {
      console.error(`Failed to post to ${channelId}: ${err.message}`);
    }
  } catch (err) {
    console.error(`Failed to fetch channel ${channelId}: ${err.message}`);
  }
  
  scheduleNextPost();
}

function scheduleNextPost() {
  setTimeout(() => postNextMessage(), config.postInterval);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web dashboard running on port ${PORT}`);
});

client.login(TOKEN);
