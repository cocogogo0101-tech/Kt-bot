// ============================================================
//  📦  Kt-Bot v2.0 — index.js
//  البوت الرئيسي: كت + حماية السيرفرات + أوامر أدمن
// ============================================================

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    AuditLogEvent,
} = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// ============================================================
//  🔧  تحميل الإعدادات والأسئلة من الملفات
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const STATS_PATH = path.join(__dirname, 'stats.json');

function loadConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function loadQuestions() {
    return JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
}

function loadStats() {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
}

function saveStats(stats) {
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

let config = loadConfig();

const ALLOWED_GUILD_ID = process.env.ALLOWED_GUILD_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// ============================================================
//  🤖  إنشاء العميل (Client)
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ============================================================
//  🛡️  حماية السيرفر: يدخل، يجمع المعلومات، يرسل، يخرج
// ============================================================
async function reportAndLeave(guild) {
    let inviterInfo = 'غير معروف';

    // نحاول نجيب مين ضاف البوت عبر Audit Log (يحتاج صلاحية View Audit Log)
    try {
        const audit = await guild.fetchAuditLogs({
            type: AuditLogEvent.BotAdd,
            limit: 5,
        });
        const entry = audit.entries.find((e) => e.target?.id === client.user.id);
        if (entry && entry.executor) {
            inviterInfo = `${entry.executor.tag} (${entry.executor.id})`;
        }
    } catch (err) {
        // ما عنده صلاحية أو حصل خطأ - نتجاهل ونكمل بالمعلومات المتوفرة
    }

    let ownerInfo = 'غير معروف';
    try {
        const owner = await guild.fetchOwner();
        ownerInfo = owner.user.tag;
    } catch (err) {
        // نتجاهل لو ما قدرنا نجيب المالك
    }

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

    const reportBody =
        '```\n' +
        '┌──────────────────────────────────────────────┐\n' +
        '│ 🚨 تقرير أمني                               │\n' +
        '├──────────────────────────────────────────────┤\n\n' +
        'تم اكتشاف تشغيل غير مصرح به.\n\n' +
        '📌 معلومات البيئة\n\n' +
        `🏠 السيرفر      : ${guild.name}\n` +
        `🆔 المعرف       : ${guild.id}\n` +
        `👑 المالك       : ${ownerInfo}\n` +
        `👤 أضاف البوت   : ${inviterInfo}\n` +
        `👥 الأعضاء      : ${guild.memberCount ?? 'غير معروف'}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '🕒 وقت الرصد\n' +
        `${timestamp}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '📋 الحالة\n\n' +
        '✓ تم التحقق من البيئة.\n' +
        '✓ تم حفظ السجل.\n' +
        '✓ تم إرسال التقرير.\n\n' +
        'الحالة النهائية: مكتملة ✅\n\n' +
        '└──────────────────────────────────────────────┘\n' +
        '```';

    const report = {
        embeds: [
            {
                color: 0xE74C3C,
                description: reportBody,
                timestamp: now.toISOString(),
            },
        ],
    };

    if (WEBHOOK_URL) {
        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });
        } catch (err) {
            console.error('❌ فشل إرسال تنبيه الويب هوك:', err.message);
        }
    }

    console.log(`🚪 خروج من سيرفر غير مصرح: ${guild.name} (${guild.id})`);
    await guild.leave();
}

client.on('guildCreate', async (guild) => {
    if (!ALLOWED_GUILD_ID) return; // إذا ما حددت سيرفر مصرح، البوت يشتغل بأي مكان
    if (guild.id === ALLOWED_GUILD_ID) return; // هذا السيرفر المصرح، كل شي تمام

    await reportAndLeave(guild);
});

// ============================================================
//  💬  منطق كلمة "كت"
// ============================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!config.GAME_CHANNEL_ID) return; // لسا ما تحدد روم اللعب
    if (message.channel.id !== config.GAME_CHANNEL_ID) return;

    const firstWord = message.content.trim().split(/\s+/)[0];
    if (firstWord !== config.TRIGGER_WORD) return;

    const questions = loadQuestions();
    if (questions.length === 0) return;

    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

    // تحديث الإحصائيات: العداد الكلي + عداد الشخص اللي طلع بالإيمبد
    const stats = loadStats();
    stats.totalUses = (stats.totalUses || 0) + 1;
    const userKey = message.author.id;
    if (!stats.mentionCounts) stats.mentionCounts = {};
    if (!stats.mentionCounts[userKey]) {
        stats.mentionCounts[userKey] = {
            username: message.author.displayName || message.author.username,
            count: 0,
        };
    }
    stats.mentionCounts[userKey].count += 1;
    stats.mentionCounts[userKey].username = message.author.displayName || message.author.username;
    saveStats(stats);

    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR || '#B026FF')
        .setAuthor({
            name: config.EMBED_AUTHOR_NAME || 'Kt-Bot',
            iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(`## 📌 ${randomQuestion}`)
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
        .setFooter({
            text: message.author.displayName || message.author.username,
            iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
});

// ============================================================
//  ⚡  الرد على أوامر Slash: /setroom و /botinfo
//  (تسجيل الأوامر نفسه يتم عبر ملف deploy-commands.js)
// ============================================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setroom') {
        const channel = interaction.options.getChannel('room');
        config.GAME_CHANNEL_ID = channel.id;
        saveConfig(config);

        await interaction.reply({
            content: `✅ تم تحديد روم اللعب: <#${channel.id}>`,
            ephemeral: true,
        });
    }

    if (interaction.commandName === 'botinfo') {
        const questions = loadQuestions();
        const stats = loadStats();
        const roomText = config.GAME_CHANNEL_ID ? `<#${config.GAME_CHANNEL_ID}>` : 'لم يتم تحديده';

        // إيجاد الشخص الأكثر ظهوراً بالنتائج
        let topUserText = 'لا يوجد بعد';
        const mentionEntries = Object.entries(stats.mentionCounts || {});
        if (mentionEntries.length > 0) {
            const [, topUser] = mentionEntries.sort((a, b) => b[1].count - a[1].count)[0];
            topUserText = `${topUser.username} (${topUser.count} مرة)`;
        }

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLOR || '#B026FF')
            .setTitle('🤖 معلومات البوت')
            .addFields(
                { name: '📡 الحالة', value: '🟢 يعمل بشكل طبيعي', inline: true },
                { name: '🔢 الإصدار', value: config.BOT_VERSION || 'غير معروف', inline: true },
                { name: '📝 عدد الأسئلة', value: String(questions.length), inline: true },
                { name: '🎮 روم اللعب الحالي', value: roomText, inline: false },
                { name: '🔑 كلمة التفعيل', value: `\`${config.TRIGGER_WORD}\``, inline: true },
                { name: '📊 إجمالي مرات الاستخدام', value: String(stats.totalUses || 0), inline: true },
                { name: '👑 الأكثر ظهوراً', value: topUserText, inline: false },
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================================
//  🚀  عند الجاهزية
// ============================================================
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} جاهز ويعمل الآن!`);
    console.log(`📝 عدد الأسئلة المحملة: ${loadQuestions().length}`);
    console.log(`🎮 روم اللعب الحالي: ${config.GAME_CHANNEL_ID || 'غير محدد - استخدم /setroom'}`);

    // تعيين حالة "Streaming" — لازم رابط تويتش/يوتيوب حقيقي بملف .env
    if (process.env.STREAM_URL) {
        client.user.setPresence({
            activities: [
                {
                    name: config.PRESENCE_TEXT || 'Working For Law RP',
                    type: 1, // ActivityType.Streaming
                    url: process.env.STREAM_URL,
                },
            ],
            status: 'online',
        });
        console.log(`📡 تم تعيين حالة البث: ${config.PRESENCE_TEXT || 'Working For Law RP'}`);
    } else {
        console.log('⚠️ لم يتم تعيين STREAM_URL في .env — حالة البث غير مفعّلة');
    }
});

client.login(process.env.DISCORD_TOKEN);
