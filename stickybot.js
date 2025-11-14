process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

const { Client } = require('discord.js-selfbot-v13');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_TOKEN';

let config = {
    channelIDs: (process.env.CHANNEL_IDS || '').split(',').filter(id => id.length > 0) || [],
    stickyMessage: process.env.STICKY_MESSAGE || "https://www.roblox.com/games/136267388705317 Check bio for key!",
    tickInterval: Number(process.env.TICK_INTERVAL) || 60000,
    postInterval: Number(process.env.POST_INTERVAL) || 60000,
};

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('dashboard', { config });
});

app.post('/update', (req, res) => {
    config.stickyMessage = req.body.stickyMessage || config.stickyMessage;
    config.tickInterval = Number(req.body.tickInterval) || config.tickInterval;
    config.postInterval = Number(req.body.postInterval) || config.postInterval;
    config.channelIDs = (req.body.channelIDs || "")
        .split(/[\s,]+/)
        .filter(id => id.length > 0);

    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web dashboard: http://localhost:${PORT}`));

const client = new Client();
let queueIndex = 0;
let lastPostTime = {};
let lastSentMessageId = {};

client.on('ready', () => {
    config.channelIDs.forEach(id => {
        lastPostTime[id] = 0;
        lastSentMessageId[id] = null;
    });
    console.log(`Logged in as ${client.user.tag}`);
    setInterval(handleSticky, () => config.tickInterval);
});

async function handleSticky() {
    const now = Date.now();
    let ids = config.channelIDs;
    for (let i = 0; i < ids.length; i++) {
        let channelId = ids[queueIndex];
        queueIndex = (queueIndex + 1) % ids.length;
        let channel;
        try {
            channel = await client.channels.fetch(channelId);
        } catch (e) {
            console.log(`[Missing] Cannot fetch channel ${channelId}: ${e.message}`);
            continue;
        }
        const sinceLastPost = now - (lastPostTime[channelId] || 0);
        if (sinceLastPost < config.postInterval) continue;

        if (lastSentMessageId[channelId]) {
            try {
                await channel.messages.delete(lastSentMessageId[channelId]);
            } catch {}
        }
        try {
            const sentMsg = await channel.send(config.stickyMessage);
            lastSentMessageId[channelId] = sentMsg.id;
            lastPostTime[channelId] = now;
            console.log(`[Success] Sent sticky message to ${channelId}`);
            break;
        } catch (err) {
            continue;
        }
    }
}
client.login(TOKEN);
