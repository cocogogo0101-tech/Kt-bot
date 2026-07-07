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

(async () => {
    try {
        console.log('⏳ جاري تسجيل أوامر السلاش...');

        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
            body: commands,
        });

        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
    }
})();
