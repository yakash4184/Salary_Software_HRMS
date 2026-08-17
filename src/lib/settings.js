import { SettingModel } from "@/lib/models/Setting";
import { decryptSecret, encryptSecret } from "@/lib/secure-settings";

const SCHOOL_KEY = "schoolInfo";
const SMTP_KEY = "smtpSettings";

const defaultSchoolInfo = {
    name: "Savitri Balika Inter College",
    address: "Khutaha Road, Jamunahiya, Mirzapur",
    phone: "",
    email: "",
    website: ""
};

const defaultSmtpSettings = {
    host: "smtp.gmail.com",
    port: 587,
    email: "",
    passwordEncrypted: "",
    fromName: "Savitri Balika Inter College"
};

export async function getSchoolInfo() {
    const doc = await SettingModel.findOne({ key: SCHOOL_KEY }).lean();
    return { ...defaultSchoolInfo, ...(doc?.value || {}) };
}

export async function saveSchoolInfo(value) {
    const next = { ...defaultSchoolInfo, ...value };
    await SettingModel.findOneAndUpdate({ key: SCHOOL_KEY }, { key: SCHOOL_KEY, value: next }, { upsert: true, new: true });
    return next;
}

export async function getSmtpSettings({ includePassword = false } = {}) {
    const doc = await SettingModel.findOne({ key: SMTP_KEY }).lean();
    const settings = { ...defaultSmtpSettings, ...(doc?.value || {}) };
    const password = includePassword ? decryptSecret(settings.passwordEncrypted) : "";
    return {
        host: settings.host,
        port: Number(settings.port || 587),
        email: settings.email || "",
        password,
        fromName: settings.fromName || defaultSmtpSettings.fromName,
        configured: Boolean(settings.host && settings.port && settings.email && settings.passwordEncrypted)
    };
}

export async function saveSmtpSettings(value) {
    const current = await getSmtpSettings({ includePassword: false });
    const next = {
        host: value.host,
        port: Number(value.port),
        email: value.email,
        passwordEncrypted: value.password ? encryptSecret(value.password) : (await SettingModel.findOne({ key: SMTP_KEY }).lean())?.value?.passwordEncrypted || "",
        fromName: value.fromName
    };
    await SettingModel.findOneAndUpdate({ key: SMTP_KEY }, { key: SMTP_KEY, value: next }, { upsert: true, new: true });
    return { ...current, ...next, password: "", configured: Boolean(next.host && next.port && next.email && next.passwordEncrypted) };
}
