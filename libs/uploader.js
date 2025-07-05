/**
 * Upload file ke server CDN
 * @param {Buffer} buffer - Buffer file yang akan di-upload
 * @returns {Promise<string>} dlink - URL direct link file yang telah diunggah
 * Dependencies:
 * - axios
 * - form-data
 * - file-type
 * 
 * Endpoint tujuan:
 * - POST https://api.ferdev.my.id/remote/uploader
 * 
 * Catatan:
 * - Jangan melakukan spam upload!
 * - File akan dihapus dalam waktu 1 hari
 
 * Powered by : Resitaapi 
 */

const axios = require("axios");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");

module.exports = async buffer => {
    const { ext, mime } = (await fromBuffer(buffer)) || {};
    const form = new FormData();
    form.append("file", buffer, { filename: `tmp.${ext}`, contentType: mime });

    try {
        const headers = form.getHeaders();
        const length = await new Promise((resolve, reject) => {
            form.getLength((err, len) => {
                if (err) reject(err);
                else resolve(len);
            });
        });

        headers["Content-Length"] = length;

        const { data } = await axios.post("https://api.ferdev.my.id/remote/uploader", form, {
            headers,
            maxBodyLength: Infinity,
        });

        console.log(data);
        return data.dlink;
    } catch (error) {
        console.error("Upload error:", error.response?.data || error.message);
        throw error;
    }
};