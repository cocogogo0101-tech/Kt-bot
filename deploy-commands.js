// ============================================================
//  📤  deploy-commands.js
//  يسجل أوامر السلاش (/setroom, /botinfo) على ديسكورد
//  شغّله مرة واحدة بعد أي إضافة/تعديل على الأوامر:
//  node deploy-commands.js
// ============================================================

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const commands = [
    new SlashCommandBuilder()
        .setName('setroom')
        .setDescription('تحديد روم اللعب (روم كت) — للأدمن فقط')
        .addChannelOption((opt) =>
            opt.setName('room').setDescription('الروم المخصص للعبة').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('عرض معلومات وحالة البوت — للأدمن فقط')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const ALLOWED_GUILD_IDS = (process.env.ALLOWED_GUILD_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

(async () => {
    try {
        if (!process.env.DISCORD_TOKEN) {
            console.error('❌ DISCORD_TOKEN غير موجود بملف .env — تأكد إنك سويت نسخة .env من .env.example وحطيت التوكن الصحيح.');
            return;
        }
        if (!process.env.CLIENT_ID) {
            console.error('❌ CLIENT_ID غير موجود بملف .env');
            return;
        }

        if (ALLOWED_GUILD_IDS.length > 0) {
            // تسجيل على مستوى السيرفر (Guild Commands) — يظهر فوراً خلال ثواني
            console.log(`⏳ جاري تسجيل أوامر السلاش على ${ALLOWED_GUILD_IDS.length} سيرفر (فوري)...`);
            for (const guildId of ALLOWED_GUILD_IDS) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                    { body: commands }
                );
                console.log(`✅ تم تسجيل الأوامر على السيرفر: ${guildId}`);
            }
        } else {
            // ما فيه سيرفرات محددة — نسجل Global (يأخذ حتى ساعة عشان يظهر بكل مكان)
            console.log('⏳ جاري تسجيل أوامر السلاش عالمياً (Global)... قد تأخذ حتى ساعة للظهور');
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
                body: commands,
            });
            console.log('✅ تم تسجيل الأوامر عالمياً بنجاح!');
        }
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error?.rawError || error?.message || error);
        console.error('تحقق من: 1) صحة CLIENT_ID  2) صحة DISCORD_TOKEN  3) إن التطبيق فعلاً موجود بنفس الحساب');
    }
})();
