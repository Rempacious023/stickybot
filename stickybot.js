process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client } = require('discord.js-selfbot-v13');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_TOKEN';

// Configuration file path
const configFile = path.join(__dirname, 'data.json');

// Default configuration
const defaultConfig = {
  channelIds: [],
  stickyMessage: 'This is a sticky message!',
  tickInterval: 60000,
  postInterval: 60000
};

// Load configuration from file
let config = defaultConfig;
if (fs.existsSync(configFile)) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (err) {
    console.error('Error loading config:', err);
    config = defaultConfig;
  }
}

// Save configuration to file
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
  
  // Parse channel IDs (comma-separated)
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
let currentMessageIndex = 0;
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

function postNextMessage() {
  if (messageQueue.length === 0) return;
  
  const channelId = messageQueue.shift();
  
  client.channels.fetch(channelId)
    .then(channel => {
      // Delete previous message if exists
      if (channel.lastMessageId) {
        channel.messages.fetch(channel.lastMessageId)
          .then(msg => {
            if (msg.author.id === client.user.id) {
              msg.delete().catch(() => {});
            }
          })
          .catch(() => {});
      }
      
      // Post new message
      channel.send(config.stickyMessage)
        .then(() => {
          console.log(`Posted to channel ${channelId}`);
          setTimeout(() => postNextMessage(), config.postInterval);
        })
        .catch(err => {
          console.error(`Failed to post to ${channelId}:`, err.message);
          setTimeout(() => postNextMessage(), config.postInterval);
        });
    })
    .catch(err => {
      console.error(`Failed to fetch channel ${channelId}:`, err.message);
      setTimeout(() => postNextMessage(), config.postInterval);
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web dashboard running on port ${PORT}`);
});

client.login(TOKEN);
