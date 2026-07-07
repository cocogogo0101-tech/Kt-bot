// ============================================================
//  📦  Kt-Bot v2.0 — index.js
//  البوت الرئيسي: كت + حماية السيرفرات + أوامر أدمن
// ============================================================

process.on('uncaughtException', (err) => {
    console.error('❌❌❌ خطأ فادح غير ممسوك (uncaughtException):', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌❌❌ خطأ غير متوقع (unhandledRejection) من بداية التشغيل:', err);
});

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    AuditLogEvent,
} = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const keepAlive = require('./keepAlive');

dotenv.config();

// ============================================================
//  🔧  تحميل الإعدادات والأسئلة من الملفات
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const ROMANTIC_QUESTIONS_PATH = path.join(__dirname, 'questions_romantic.json');
const STATS_PATH = path.join(__dirname, 'stats.json');
const GUILD_MODES_PATH = path.join(__dirname, 'guildModes.json');

function loadConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function loadQuestions() {
    return JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
}

function loadRomanticQuestions() {
    return JSON.parse(fs.readFileSync(ROMANTIC_QUESTIONS_PATH, 'utf8'));
}

function loadStats() {
    return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
}

function saveStats(stats) {
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

function loadGuildModes() {
    try {
        return JSON.parse(fs.readFileSync(GUILD_MODES_PATH, 'utf8'));
    } catch (err) {
        return {};
    }
}

function saveGuildModes(modes) {
    fs.writeFileSync(GUILD_MODES_PATH, JSON.stringify(modes, null, 2), 'utf8');
}

let config;
try {
    config = loadConfig();
    console.log('✅ تم تحميل config.json بنجاح');
} catch (err) {
    console.error('❌ فشل تحميل config.json:', err.message);
    process.exit(1);
}

try {
    const q = loadQuestions();
    console.log(`✅ تم تحميل questions.json بنجاح (${q.length} سؤال)`);
} catch (err) {
    console.error('❌ فشل تحميل questions.json:', err.message);
    process.exit(1);
}

try {
    const rq = loadRomanticQuestions();
    console.log(`✅ تم تحميل questions_romantic.json بنجاح (${rq.length} سؤال)`);
} catch (err) {
    console.error('❌ فشل تحميل questions_romantic.json:', err.message);
    process.exit(1);
}

try {
    loadStats();
    console.log('✅ تم تحميل stats.json بنجاح');
} catch (err) {
    console.error('❌ فشل تحميل stats.json:', err.message);
    process.exit(1);
}

// يدعم أكثر من سيرفر: ALLOWED_GUILD_IDS=id1,id2,id3
const ALLOWED_GUILD_IDS = (process.env.ALLOWED_GUILD_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const OWNER_ID = process.env.OWNER_ID;
const SECRET_TRIGGER = process.env.SECRET_TRIGGER;

// 🌐 تشغيل سيرفر الـ Keep-Alive (لـ UptimeRobot)
keepAlive();

// ============================================================
//  🤖  إنشاء العميل (Client)
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
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
    await new Promise((resolve) => setTimeout(resolve, 5000)); // ننتظر 5 ثواني بعد إرسال التقرير قبل ما نخرج
    await guild.leave();
}

client.on('guildCreate', async (guild) => {
    if (ALLOWED_GUILD_IDS.length === 0) return; // إذا ما حددت أي سيرفر مصرح، البوت يشتغل بأي مكان
    if (ALLOWED_GUILD_IDS.includes(guild.id)) return; // هذا السيرفر ضمن المصرحين، كل شي تمام

    await reportAndLeave(guild);
});

// ============================================================
//  🕵️  الوضع السري: تفعيل/تعطيل الأسئلة الرومانسية لسيرفر معين
//  - لازم الكلمة تكون الرسالة بالكامل (مو أول كلمة بس)
//  - لازم قائلها يكون هو المالك بالضبط (OWNER_ID)
//  - يؤثر فقط على السيرفر اللي انقالت فيه، مو على كل السيرفرات
// ============================================================
async function handleSecretTrigger(message) {
    if (!SECRET_TRIGGER || !OWNER_ID) return false; // ما تم تجهيز المتغيرات بعد
    if (!message.guild) return false; // لازم يكون داخل سيرفر
    if (message.author.id !== OWNER_ID) return false; // بس المالك
    if (message.content.trim() !== SECRET_TRIGGER) return false; // لازم تطابق تام للرسالة كاملة

    const guildModes = loadGuildModes();
    const guildId = message.guild.id;
    const newState = !guildModes[guildId];
    guildModes[guildId] = newState;
    saveGuildModes(guildModes);

    // تأكيد صامت عبر رياكشن بس — بدون أي رسالة ظاهرة بالتشات
    try {
        await message.react(newState ? '✅' : '❌');
    } catch (err) {
        // نتجاهل لو ما قدر يرياكت (صلاحيات ناقصة مثلاً)
    }

    return true;
}

// ============================================================
//  💬  منطق كلمة "كت"
// ============================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // نفحص الكلمة السرية أول شي، بغض النظر عن الروم المحدد للعبة
    const wasSecretTrigger = await handleSecretTrigger(message);
    if (wasSecretTrigger) return;

    if (!config.GAME_CHANNEL_ID) return; // لسا ما تحدد روم اللعب
    if (message.channel.id !== config.GAME_CHANNEL_ID) return;

    const firstWord = message.content.trim().split(/\s+/)[0];
    if (firstWord !== config.TRIGGER_WORD) return;

    // نتحقق هل الوضع الرومانسي مفعل بهذا السيرفر بالذات
    const guildModes = loadGuildModes();
    const isRomanticMode = Boolean(message.guild && guildModes[message.guild.id]);

    const questions = isRomanticMode ? loadRomanticQuestions() : loadQuestions();
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

    const embedColor = isRomanticMode
        ? (config.ROMANTIC_EMBED_COLOR || '#FF3FA4')
        : (config.EMBED_COLOR || '#B026FF');

    const embed = new EmbedBuilder()
        .setColor(embedColor)
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
    // ملاحظة مهمة: ديسكورد ما يقبل أي رابط، لازم يكون رابط تويتش (twitch.tv/...)
    // أو يوتيوب (youtube.com/watch?v=...) صحيح وفعّال، وإلا يرفض الحالة بصمت
    if (process.env.STREAM_URL) {
        try {
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
        } catch (err) {
            console.error('❌ فشل تعيين حالة البث، تأكد إن STREAM_URL رابط تويتش/يوتيوب صحيح:', err.message);
        }
    } else {
        // حتى بدون رابط بث، نخلي البوت يظهر أونلاين بحالة عادية (بدل ما يبقى بدون أي حالة)
        client.user.setPresence({
            activities: [{ name: config.PRESENCE_TEXT || 'Working For Law RP', type: 0 }], // Playing
            status: 'online',
        });
        console.log('⚠️ لم يتم تعيين STREAM_URL في .env — تم تفعيل حالة "يلعب" العادية بدلاً من البث');
    }
});

// ============================================================
//  🩺  تشخيص الأخطاء — تطبع بالكونسول أي مشكلة اتصال أو تسجيل دخول
// ============================================================
client.on('error', (err) => {
    console.error('❌ خطأ بالـ Gateway (اتصال ديسكورد):', err);
});

client.on('shardError', (err) => {
    console.error('❌ خطأ بالـ Shard:', err);
});

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN مفقود! تأكد إنك سويت ملف .env (نسخة من .env.example) وحطيت التوكن الصحيح فيه.');
    process.exit(1);
}

console.log('🔐 جاري محاولة تسجيل الدخول بديسكورد...');

const loginTimeout = setTimeout(() => {
    console.error('⏱️ تحذير: مرت 15 ثانية ولا رد من ديسكورد على login() — الأرجح مشكلة شبكة/اتصال صادر، مو مشكلة توكن.');
}, 15000);

client.login(process.env.DISCORD_TOKEN).then(() => {
    clearTimeout(loginTimeout);
    console.log('✅ تم تسجيل الدخول بنجاح (login resolved)');
}).catch((err) => {
    clearTimeout(loginTimeout);
    console.error('❌ فشل تسجيل الدخول (login) — البوت ما قدر يتصل بديسكورد أصلاً:');
    console.error(err.message || err);
    console.error('الأسباب المحتملة: 1) التوكن غلط أو منتهي/تم عمل Reset له من البورتال');
    console.error('2) نسيت تفعّل Privileged Intent "MESSAGE CONTENT" من Discord Developer Portal > Bot');
    console.error('3) مشكلة اتصال إنترنت بـ Termux (جرب: ping discord.com)');
    process.exit(1);
});
