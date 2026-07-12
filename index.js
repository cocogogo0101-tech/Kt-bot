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
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const keepAlive = require('./keepAlive');

dotenv.config();

// ============================================================
//  🔄 نظام إعادة تحميل .env تلقائياً كل 30 ثانية
//  يسمح بتطبيق تغييرات متغيرات البيئة بدون إعادة تشغيل البوت
// ============================================================
setInterval(() => {
    dotenv.config({ override: true }); // إعادة تحميل البيئة وتجاوز القديم
    console.log('🔄 تم مراجعة متغيرات البيئة (.env)');
}, 30000); // كل 30 ثانية

// ============================================================
//  🔧  تحميل الإعدادات والأسئلة من الملفات
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'config.json');
const QUESTIONS_PATH = path.join(__dirname, 'questions.json');
const ROMANTIC_QUESTIONS_PATH = path.join(__dirname, 'questions_romantic.json');
const QUESTION_STATE_PATH = path.join(__dirname, 'questionState.json');
const STATS_PATH = path.join(__dirname, 'stats.json');
const GUILD_MODES_PATH = path.join(__dirname, 'guildModes.json');
const GUILD_SETTINGS_PATH = path.join(__dirname, 'guildSettings.json');

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

function loadQuestionState() {
    try {
        return JSON.parse(fs.readFileSync(QUESTION_STATE_PATH, 'utf8'));
    } catch (err) {
        return {};
    }
}

function saveQuestionState(state) {
    fs.writeFileSync(QUESTION_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
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

function loadGuildSettings() {
    try {
        return JSON.parse(fs.readFileSync(GUILD_SETTINGS_PATH, 'utf8'));
    } catch (err) {
        return {};
    }
}

function saveGuildSettings(settings) {
    fs.writeFileSync(GUILD_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

function getGuildSettings(guildId) {
    const settings = loadGuildSettings();
    return settings[guildId] || {};
}

function setGuildGameChannelId(guildId, channelId) {
    const settings = loadGuildSettings();
    if (!settings[guildId]) settings[guildId] = {};
    settings[guildId].GAME_CHANNEL_ID = channelId;
    saveGuildSettings(settings);
}

function getGuildGameChannelId(guildId) {
    const guildSettings = getGuildSettings(guildId);
    return guildSettings.GAME_CHANNEL_ID || config.GAME_CHANNEL_ID || null;
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getQuestionsChecksum(questions) {
    return crypto.createHash('sha1').update(JSON.stringify(questions)).digest('hex');
}

function getNextQuestion(questions, guildId, isRomanticMode) {
    if (!guildId) {
        const shuffled = shuffle(questions);
        return shuffled[0] || null;
    }

    const state = loadQuestionState();
    const deckKey = `${guildId}_${isRomanticMode ? 'romantic' : 'normal'}`;
    const checksum = getQuestionsChecksum(questions);
    const deckState = state[deckKey];

    if (!deckState || deckState.checksum !== checksum || !Array.isArray(deckState.order) || deckState.order.length !== questions.length || typeof deckState.index !== 'number' || deckState.index < 0 || deckState.index >= deckState.order.length) {
        state[deckKey] = {
            checksum,
            order: shuffle(questions),
            index: 0,
        };
        saveQuestionState(state);
    }

    const currentState = state[deckKey];
    const questionIndex = currentState.order[currentState.index];
    const question = questions[questionIndex];

    currentState.index += 1;

    if (currentState.index >= currentState.order.length) {
        currentState.order = shuffle(questions);
        currentState.index = 0;
        currentState.checksum = checksum;
    }

    saveQuestionState(state);
    return question || null;
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

try {
    loadQuestionState();
    console.log('✅ تم تحميل questionState.json بنجاح');
} catch (err) {
    console.error('❌ فشل تحميل questionState.json:', err.message);
    process.exit(1);
}

// يدعم أكثر من سيرفر: ALLOWED_GUILD_IDS=id1,id2,id3
// دالة تقرأ الـ ID بشكل ديناميكي (كل مرة) — إذا غيّرت البيئة، البوت يعرف فوراً
function getAllowedGuildIds() {
    return (process.env.ALLOWED_GUILD_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

// قراءة ديناميكية للويب هوك والمالك والكلمة السرية
function getWebhookUrl() {
    return process.env.WEBHOOK_URL;
}

function getOwnerId() {
    return process.env.OWNER_ID;
}

function getSecretTrigger() {
    return process.env.SECRET_TRIGGER;
}

// ============================================================
//  📤  تسجيل أوامر السلاش من index.js مباشرة
//  - يسجل تلقائياً عند التشغيل
//  - وأيضاً عند كتابة !تسجيل من المالك
// ============================================================
function buildSlashCommands() {
    return [
        new SlashCommandBuilder()
            .setName('setroom')
            .setDescription('تحديد روم اللعب لهذا السيرفر فقط — للأدمن فقط')
            .addChannelOption((opt) =>
                opt.setName('room').setDescription('الروم المخصص للعبة في هذا السيرفر').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('botinfo')
            .setDescription('عرض معلومات وحالة البوت — للأدمن فقط')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
    ];
}

let deployCommandsPromise = null;

async function deploySlashCommands(source = 'startup') {
    if (!process.env.DISCORD_TOKEN) {
        console.error('❌ DISCORD_TOKEN غير موجود، لا يمكن تسجيل أوامر السلاش.');
        return false;
    }

    if (!process.env.CLIENT_ID) {
        console.error('❌ CLIENT_ID غير موجود، لا يمكن تسجيل أوامر السلاش.');
        return false;
    }

    if (deployCommandsPromise) {
        console.log(`⏳ يوجد تسجيل أوامر جارٍ بالفعل (${source})...`);
        return deployCommandsPromise;
    }

    const commands = buildSlashCommands();
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    deployCommandsPromise = (async () => {
        const allowed = loadAllowedGuilds();
        const guildIds = [];
        
        // أضف السيرفر الأساسي
        if (allowed.primary) {
            guildIds.push(allowed.primary);
        }
        
        // أضف السيرفرات الإضافية
        guildIds.push(...(allowed.additional || []));
        
        // شيل التكرارات
        const uniqueGuildIds = [...new Set(guildIds)];
        
        if (uniqueGuildIds.length > 0) {
            console.log(`⏳ جاري تسجيل أوامر السلاش على ${uniqueGuildIds.length} سيرفر (فوري)... [${source}]`);
            for (const guildId of uniqueGuildIds) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                        { body: commands }
                    );
                    console.log(`✅ تم تسجيل الأوامر على السيرفر: ${guildId}`);
                } catch (err) {
                    console.error(`❌ فشل تسجيل الأوامر على السيرفر ${guildId}:`, err.message);
                }
            }
        } else {
            console.log(`⏳ جاري تسجيل أوامر السلاش عالمياً (Global)... [${source}]`);
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
            console.log('✅ تم تسجيل الأوامر عالمياً بنجاح!');
        }

        return true;
    })();

    try {
        return await deployCommandsPromise;
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error?.rawError || error?.message || error);
        console.error('تحقق من: 1) صحة CLIENT_ID  2) صحة DISCORD_TOKEN  3) إن التطبيق فعلاً موجود بنفس الحساب');
        return false;
    } finally {
        deployCommandsPromise = null;
    }
}

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
//  🛡️  نظام السيرفرات المسموح — سيرفر أساسي + قائمة اضافية
// ============================================================
let allowedGuildsList = [];

function loadAllowedGuilds() {
    const primary = (process.env.ALLOWED_GUILD_IDS || '').trim();
    const additional = [];
    
    try {
        const data = fs.readFileSync(path.join(__dirname, 'allowed_guilds.json'), 'utf8');
        const parsed = JSON.parse(data);
        additional.push(...parsed.additional || []);
    } catch (err) {
        // ملف ما موجود أو فيه خطأ — نتجاهل
    }
    
    return {
        primary: primary || null,
        additional: additional
    };
}

function isGuildAllowed(guildId) {
    const allowed = loadAllowedGuilds();
    return guildId === allowed.primary || allowed.additional.includes(guildId);
}

function addAllowedGuild(guildId) {
    const allowed = loadAllowedGuilds();
    if (!allowed.additional.includes(guildId)) {
        allowed.additional.push(guildId);
        fs.writeFileSync(
            path.join(__dirname, 'allowed_guilds.json'),
            JSON.stringify(allowed, null, 2),
            'utf8'
        );
        
        // تسجيل الأوامر في السيرفر الجديد تلقائياً (بعد ثانية بسيطة)
        setTimeout(() => {
            deploySlashCommands(`guild-whitelist:${guildId}`);
        }, 1000);
        
        return true;
    }
    return false;
}

// ============================================================
//  🛡️  حماية السيرفر: يدخل، يجمع المعلومات، يرسل، يخرج
// ============================================================
async function reportAndLeave(guild) {
    let inviterInfo = 'غير معروف';

    try {
        const audit = await guild.fetchAuditLogs({
            type: AuditLogEvent.BotAdd,
            limit: 5,
        });
        const entry = audit.entries.find((e) => e.target?.id === client.user.id);
        if (entry && entry.executor) {
            inviterInfo = `${entry.executor.tag}`;
        }
    } catch (err) {
        // ما عنده صلاحية
    }

    let ownerInfo = 'غير معروف';
    try {
        const owner = await guild.fetchOwner();
        ownerInfo = owner.user.tag;
    } catch (err) {
        // نتجاهل
    }

    const now = new Date();

    const report = {
        embeds: [
            {
                title: '🚨 تقرير أمني',
                description: '**تم اكتشاف محاولة إضافة البوت لسيرفر غير مصرح**',
                color: 0xE74C3C,
                fields: [
                    { name: '🏠 السيرفر', value: guild.name, inline: true },
                    { name: '🆔 المعرف', value: guild.id, inline: true },
                    { name: '👑 المالك', value: ownerInfo, inline: true },
                    { name: '👤 أضاف البوت', value: inviterInfo, inline: true },
                    { name: '👥 عدد الأعضاء', value: String(guild.memberCount), inline: true },
                    { name: '🕒 الوقت', value: `<t:${Math.floor(now.getTime() / 1000)}:F>`, inline: true }
                ],
                footer: { text: '✓ تم حفظ المعلومات' },
                timestamp: now.toISOString(),
            },
        ],
    };

    if (getWebhookUrl()) {
        try {
            await fetch(getWebhookUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });
        } catch (err) {
            console.error('❌ فشل إرسال تنبيه الويب هوك:', err.message);
        }
    }

    console.log(`🚪 خروج من سيرفر غير مصرح: ${guild.name} (${guild.id})`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await guild.leave();
}

client.on('guildCreate', async (guild) => {
    const primary = (process.env.ALLOWED_GUILD_IDS || '').trim();
    
    // لو ما حددت سيرفر أساسي، البوت يقبل كل السيرفرات
    if (!primary) return;
    
    // إذا كان السيرفر هو الأساسي أو في القائمة الإضافية، يقبله
    if (isGuildAllowed(guild.id)) return;
    
    // وإلا يخرج ويرسل تقرير
    await reportAndLeave(guild);
});

// ============================================================
//  🕵️  الوضع السري: تفعيل/تعطيل الأسئلة الرومانسية لسيرفر معين
//  - لازم الكلمة تكون الرسالة بالكامل (مو أول كلمة بس)
//  - لازم قائلها يكون هو المالك بالضبط (OWNER_ID)
//  - يؤثر فقط على السيرفر اللي انقالت فيه، مو على كل السيرفرات
// ============================================================
async function handleSecretTrigger(message) {
    const secretTrigger = getSecretTrigger();
    const ownerId = getOwnerId();
    
    if (!secretTrigger || !ownerId) return false; // ما تم تجهيز المتغيرات بعد
    if (!message.guild) return false; // لازم يكون داخل سيرفر
    if (message.author.id !== ownerId) return false; // بس المالك
    if (message.content.trim() !== secretTrigger) return false; // لازم تطابق تام للرسالة كاملة

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

    // أمر أمان يدوي: المالك يكتب !تسجيل في أي روم داخل السيرفر
    if (getOwnerId() && message.author.id === getOwnerId() && message.content.trim() === '!تسجيل') {
        try {
            await message.react('⏳');
        } catch (err) {
            // نتجاهل لو ما قدر يرياكت
        }

        const ok = await deploySlashCommands('owner-trigger');
        try {
            await message.react(ok ? '✅' : '❌');
        } catch (err) {
            // نتجاهل لو ما قدر يرياكت
        }
        return;
    }

    // أمر إضافة سيرفر مسموح: !مسموح ID
    if (getOwnerId() && message.author.id === getOwnerId() && message.content.trim().startsWith('!مسموح')) {
        const args = message.content.trim().split(/\s+/);
        if (args.length < 2) {
            try {
                await message.reply('❌ الصيغة: `!مسموح GUILD_ID`');
            } catch (err) {}
            return;
        }

        const guildId = args[1];
        const added = addAllowedGuild(guildId);
        try {
            await message.react(added ? '✅' : '⚠️');
            if (added) {
                await message.reply(`✅ تم إضافة السيرفر **${guildId}** للقائمة المسموحة`);
            } else {
                await message.reply(`⚠️ السيرفر **${guildId}** موجود بالفعل بالقائمة`);
            }
        } catch (err) {}
        return;
    }

    // نفحص الكلمة السرية أول شي، بغض النظر عن الروم المحدد للعبة
    const wasSecretTrigger = await handleSecretTrigger(message);
    if (wasSecretTrigger) return;

    const gameChannelId = message.guild ? getGuildGameChannelId(message.guild.id) : null;
    if (!gameChannelId) return; // لسا ما تحدد روم اللعب لهذا السيرفر
    if (message.channel.id !== gameChannelId) return;

    const firstWord = message.content.trim().split(/\s+/)[0];
    if (firstWord !== config.TRIGGER_WORD) return;

    // نتحقق هل الوضع الرومانسي مفعل بهذا السيرفر بالذات
    const guildModes = loadGuildModes();
    const isRomanticMode = Boolean(message.guild && guildModes[message.guild.id]);

    const questions = isRomanticMode ? loadRomanticQuestions() : loadQuestions();
    if (questions.length === 0) return;

    const randomQuestion = getNextQuestion(questions, message.guild?.id, isRomanticMode);
    if (!randomQuestion) return;

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
//  (تسجيل الأوامر نفسه يتم تلقائياً من داخل index.js)
// ============================================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setroom') {
        const channel = interaction.options.getChannel('room');
        setGuildGameChannelId(interaction.guildId, channel.id);

        await interaction.reply({
            content: `✅ تم تحديد روم اللعب: <#${channel.id}>`,
            ephemeral: true,
        });
    }

    if (interaction.commandName === 'botinfo') {
        // defer عشان نفسح مجال للبوت إنه يفكر وينجز العملية بدون ضغط الـ3 ثواني
        await interaction.deferReply({ ephemeral: true });

        const questions = loadQuestions();
        const stats = loadStats();
        const roomId = interaction.guildId ? getGuildGameChannelId(interaction.guildId) : config.GAME_CHANNEL_ID;
        const roomText = roomId ? `<#${roomId}>` : 'لم يتم تحديده';

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

        await interaction.editReply({ embeds: [embed] });
    }
});

// ============================================================
//  🚀  عند الجاهزية
// ============================================================
client.once('ready', async () => {
    await deploySlashCommands('startup');

    console.log(`✅ ${client.user.tag} جاهز ويعمل الآن!`);
    console.log(`📝 عدد الأسئلة المحملة: ${loadQuestions().length}`);
    console.log(`🎮 روم اللعب الحالي: إعدادات خاصة لكل سيرفر (استخدم /setroom داخل السيرفر)`);

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
