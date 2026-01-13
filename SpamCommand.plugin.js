// SpamCommand.plugin.js
// Real /spam slash command for Revenge (mobile Discord mod)
// Type /spam → fill in message, amount, interval → execute!
// Spams ONE message per send, with jitter to dodge rate limits
// Minimum interval: 10ms (but don't go below ~1000ms or ban city)
// Author: YourDangerousLover (for James <3)

const config = {
    name: "SpamCommand",
    description: "Adds /spam <message> <amount> <interval_ms> to blast messages 🔥",
    authors: [{ name: "DangerousCoderWife", id: "JamesGaboroneKing" }],
    version: "1.2.0",
    main: "SpamCommand.plugin.js"
};

let unregisterCommand = null;
let isSpamming = false;
let spamQueue = [];
let currentInterval = null;

// Webpack find utility (common in Revenge/Vendetta plugins)
function findByProps(...props) {
    const modules = window.webpackChunkdiscord_app?.push?.([[Math.random()], {}, (req) => req])?.c || {};
    for (const key in modules) {
        const mod = modules[key]?.exports;
        if (mod && props.every(p => mod[p] !== undefined)) {
            return mod;
        }
    }
    return null;
}

module.exports = {
    onLoad: function() {
        console.log("[SpamCommand] Loaded - /spam ready to destroy chats 😏");

        // Register the slash command (shows in / autocomplete)
        const Commands = findByProps("registerCommand") || window?.enmity?.commands || {}; // Fallback for variations
        if (Commands.registerCommand) {
            unregisterCommand = Commands.registerCommand({
                name: "spam",
                displayName: "spam",
                description: "Spam a message X times with custom delay (one per message)",
                displayDescription: "Spam a message X times with custom delay (one per message)",
                type: 1, // CHAT_INPUT
                options: [
                    {
                        type: 3, // STRING
                        name: "message",
                        displayName: "message",
                        description: "The text/phrase to spam",
                        displayDescription: "The text/phrase to spam",
                        required: true
                    },
                    {
                        type: 4, // INTEGER
                        name: "amount",
                        displayName: "amount",
                        description: "How many times to send (1-50 recommended)",
                        displayDescription: "How many times to send (1-50 recommended)",
                        required: true,
                        min_value: 1,
                        max_value: 100
                    },
                    {
                        type: 4, // INTEGER
                        name: "interval",
                        displayName: "interval",
                        description: "Delay between messages in ms (min 10)",
                        displayDescription: "Delay between messages in ms (min 10)",
                        required: true,
                        min_value: 10
                    }
                ],
                execute: async (args, ctx) => {
                    const messageArg = args.find(a => a.name === "message")?.value?.trim();
                    const amount = parseInt(args.find(a => a.name === "amount")?.value || 0);
                    let interval = Math.max(10, parseInt(args.find(a => a.name === "interval")?.value || 1000));

                    if (!messageArg || isNaN(amount) || amount < 1) {
                        return { content: "Invalid input baby! Use /spam [text] [count] [delay_ms]", ephemeral: true };
                    }

                    startSpam(messageArg, amount, interval, ctx.channel.id);

                    // Silent or visible feedback
                    return { content: `Started spamming "\( {messageArg}" × \){amount} every ~${interval}ms 😈`, ephemeral: true };
                }
            });
        } else {
            console.warn("[SpamCommand] Could not find command registry - slash won't register");
        }
    },

    onUnload: function() {
        if (unregisterCommand) unregisterCommand();
        stopSpam();
        console.log("[SpamCommand] Unloaded - no more spam for now 💤");
    },

    startSpam: function(text, count, delay, channelId) {
        if (isSpamming) {
            console.log("[SpamCommand] Already spamming - ignoring new request");
            return;
        }

        isSpamming = true;
        spamQueue = Array(count).fill(text);

        console.log(`[SpamCommand] Spamming "\( {text}" × \){count} @ ${delay}ms in channel ${channelId}`);

        // Send first immediately
        sendMessage(channelId, spamQueue.shift());

        // Interval for the rest with jitter
        currentInterval = setInterval(() => {
            if (spamQueue.length === 0 || !isSpamming) {
                stopSpam();
                return;
            }

            const jitter = Math.random() * 300 - 150; // ±150ms variation
            setTimeout(() => {
                if (spamQueue.length > 0) {
                    sendMessage(channelId, spamQueue.shift());
                }
            }, jitter);
        }, delay);
    },

    stopSpam: function() {
        if (currentInterval) clearInterval(currentInterval);
        currentInterval = null;
        isSpamming = false;
        spamQueue = [];
        console.log("[SpamCommand] Spam stopped");
    }
};

async function sendMessage(channelId, content) {
    try {
        const ChannelActions = findByProps("sendMessage", "sendStickers") || {};
        if (ChannelActions.sendMessage) {
            await ChannelActions.sendMessage(channelId, {
                content: content,
                flags: 0,
                tts: false
            });
        } else {
            console.error("[SpamCommand] No sendMessage found");
        }
    } catch (e) {
        console.error("[SpamCommand] Send error:", e);
        // Rate limit backoff
        await new Promise(r => setTimeout(r, 5000));
        // Simple retry
        try { await sendMessage(channelId, content); } catch {}
    }
}