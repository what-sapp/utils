import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const detectType = async (buffer) => {
    try {
        if (!buffer || buffer.length === 0) {
            return {
                ext: 'bin',
                mime: 'application/octet-stream'
            };
        }

        const type = await fileTypeFromBuffer(buffer);
        return type || {
            ext: 'bin',
            mime: 'application/octet-stream'
        };
    } catch (error) {
        console.error('File type detection error:', error);
        return {
            ext: 'bin',
            mime: 'application/octet-stream'
        };
    }
};


const mapMimeToMessageType = (mime = '', ext = '') => {
    const m = (mime || '').toLowerCase();
    const e = (ext || '').toLowerCase();

    if (!m && !e) return 'document';

    if (m.startsWith('image/')) {

        if (e === 'webp' || m === 'image/webp') return 'sticker';
        return 'image';
    }
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    if (m === 'application/pdf') return 'document';
    if (m.startsWith('application/')) return 'document';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'].includes(e)) {
        if (e === 'webp') return 'sticker';
        return 'image';
    }
    if (['mp4', 'mkv', 'mov', 'webm', '3gp'].includes(e)) return 'video';
    if (['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac'].includes(e)) return 'audio';
    if (['pdf', 'zip', 'rar', '7z', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(e))
        return 'document';

    return 'document';
};

export const detectMessageType = async (content) => {
    try {
        
        if (typeof content === 'string') {
            
            if (content.startsWith('data:')) {
                
                const match = content.match(/^data:([^;]+);base64,/i);
                const mime = match ? match[1] : '';

                const guessed = mapMimeToMessageType(mime, '');
                return guessed === 'sticker' ? 'sticker' : guessed === 'document' ? 'document' : guessed;
            }

            
            if (content.startsWith('http://') || content.startsWith('https://')) {
                try {
                    const urlObj = new URL(content);
                    const pathname = urlObj.pathname || '';
                    const ext = (pathname.split('.').pop() || '').toLowerCase();
                    
 if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'].includes(ext)) {
                        if (ext === 'webp') return 'sticker';
                        return 'image';
                    }
                    if (['mp4', 'mkv', 'mov', 'webm', '3gp'].includes(ext)) return 'video';
                    if (['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac'].includes(ext)) return 'audio';
                    if (['pdf', 'zip', 'rar', '7z', 'doc', 'docx'].includes(ext)) return 'document';
                } catch (err) {

                }
            }

           
            return 'text';
        }


        if (Buffer.isBuffer(content)) {
            const type = await detectType(content); // returns {ext, mime}
            const msgType = mapMimeToMessageType(type.mime, type.ext);
            return msgType;
        }

        // If object:
        if (content && typeof content === 'object') {
            
            const possibleKeys = Object.keys(content);
            const baileyTypes = ['text', 'image', 'video', 'audio', 'sticker', 'document', 'location', 'contact'];
            for (const k of possibleKeys) {
                if (baileyTypes.includes(k)) return k;
            }

            // If object declares mimetype or ext
            if (content.mimetype || content.mime) {
                const mim = content.mimetype || content.mime;
                return mapMimeToMessageType(mim, content.ext || '');
            }

            // If object has a 'type' string that's already valid, use it
            if (typeof content.type === 'string' && baileyTypes.includes(content.type.toLowerCase())) {
                return content.type.toLowerCase();
            }

            // If object looks like a URL wrapper { url: 'http...' }
            if (typeof content.url === 'string') {
                const url = content.url;
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:([^;]+);base64,/i);
                    const mime = match ? match[1] : '';
                    return mapMimeToMessageType(mime, '');
                }
                try {
                    const urlObj = new URL(url);
                    const ext = (urlObj.pathname.split('.').pop() || '').toLowerCase();
                    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        if (ext === 'webp') return 'sticker';
                        return 'image';
                    }
                    if (['mp4', 'm4a', 'mp3', 'ogg'].includes(ext)) return ext === 'mp4' ? 'video' : 'audio';
                } catch (e) {
                    // fallthrough
                }
            }


            if (content.data && Buffer.isBuffer(content.data)) {
                const t = await detectType(content.data);
                return mapMimeToMessageType(t.mime, t.ext);
            }

            return 'document';
        }

        // Default fallback
        return 'document';
    } catch (err) {
        console.error('detectMessageType error:', err);
        return 'document';
    }
};

/**
 * Get JSON from URL
 * @param {string} url - The URL to fetch
 * @param {object} options - Axios options
 * @returns {Promise<object>}
 */
export const getJson = async (url, options = {}) => {
    try {
        const response = await axios({
            url,
            method: 'GET',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        });
        return response.data;
    } catch (error) {
        console.error('getJson error:', error.message);
        throw new Error(`Failed to get JSON from ${url}: ${error.message}`);
    }
};

/**
 * Extract URLs from string
 * @param {string} text - The text to extract URLs from
 * @returns {string[]} Array of URLs found
 */
export const extractUrlFromString = (text) => {
    if (!text || typeof text !== 'string') return [];

    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
    const matches = text.match(urlRegex);

    if (!matches) return [];

    // Filter and validate URLs
    return matches.filter(url => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    });
};

/**
 * Get MIME type from buffer
 * @param {Buffer} buffer - The buffer to analyze
 * @returns {Promise<string>} MIME type
 */
export const getMimeType = async (buffer) => {
    const type = await detectType(buffer);
    return type.mime;
};

/**
 * Get file extension from buffer
 * @param {Buffer} buffer - The buffer to analyze
 * @returns {Promise<string>} File extension
 */
export const getExtension = async (buffer) => {
    const type = await detectType(buffer);
    return type.ext;
};

/**
 * Get buffer from various sources (URL, file path, base64, Buffer)
 * @param {string|Buffer|object} source - The source to get buffer from
 * @returns {Promise<Buffer>} The buffer
 */
export const getBuffer = async (source) => {
    try {
        if (Buffer.isBuffer(source)) {
            return source;
        }

        if (typeof source === 'string') {
            // Handle base64
            if (source.startsWith('data:')) {
                const base64Data = source.split(',')[1];
                return Buffer.from(base64Data, 'base64');
            }

            // Handle URLs
            if (source.startsWith('http')) {
                const response = await fetch(source);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }

            // Handle file paths
            if (fs.existsSync(source)) {
                return fs.readFileSync(source);
            }
        }

        // If source is an object wrapper { url, headers } try fetching url
        if (source && typeof source === 'object' && typeof source.url === 'string') {
            if (source.url.startsWith('data:')) {
                const base64Data = source.url.split(',')[1];
                return Buffer.from(base64Data, 'base64');
            }
            const response = await fetch(source.url, source.options || {});
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        throw new Error('Unsupported source type');
    } catch (error) {
        console.error('Get buffer error:', error);
        throw error;
    }
};

// File type detection utilities
export const FileTypeFromBuffer = fileTypeFromBuffer;

// Aliases for compatibility
export const getFileType = detectType;
export const detectFileType = detectType;

// Existing utility functions (keeping your current utils)
export const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const generateRandomString = (length = 8) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const isUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

export const getTime = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
        timeZone: 'Africa/Kampala',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

export const formatDate = (date = new Date()) => {
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
};

export const validatePhoneNumber = (number) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(number.replace(/[-()\s]/g, ''));
};

export const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

export const sanitizeFileName = (name) => {
    return name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
};

export const readJsonFile = async (filePath) => {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        return null;
    }
};

export const writeJsonFile = async (filePath, data) => {
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing JSON file:', error);
        return false;
    }
};

export const ensureDir = async (dirPath) => {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
        return true;
    } catch (error) {
        console.error('Error creating directory:', error);
        return false;
    }
};

export const isFileExists = async (filePath) => {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
};

// Media-specific utilities
export const getMediaInfo = async (buffer) => {
    const type = await detectType(buffer);
    const size = buffer.length;

    return {
        ...type,
        size,
        sizeFormatted: formatSize(size),
        isImage: type.mime.startsWith('image/'),
        isVideo: type.mime.startsWith('video/'),
        isAudio: type.mime.startsWith('audio/'),
        isDocument: !type.mime.startsWith('image/') &&
                   !type.mime.startsWith('video/') &&
                   !type.mime.startsWith('audio/')
    };
};

export const resizeBuffer = async (buffer, maxWidth = 1024, maxHeight = 1024) => {
    try {
        const sharp = await import('sharp');
        const resized = await sharp.default(buffer)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();
        return resized;
    } catch (error) {
        console.error('Error resizing buffer:', error);
        return buffer; // Return original if resize fails
    }
};

export const convertToWebp = async (buffer, quality = 80) => {
    try {
        const sharp = await import('sharp');
        const webp = await sharp.default(buffer)
            .webp({ quality })
            .toBuffer();
        return webp;
    } catch (error) {
        console.error('Error converting to WebP:', error);
        return buffer;
    }
};

export default {
    detectType,
    detectMessageType,
    getJson,
    extractUrlFromString,
    getMimeType,
    getExtension,
    getBuffer,
    FileTypeFromBuffer,
    getFileType,
    detectFileType,
    formatSize,
    generateRandomString,
    delay,
    isUrl,
    getTime,
    formatDate,
    validatePhoneNumber,
    capitalize,
    escapeRegex,
    chunkArray,
    sanitizeFileName,
    readJsonFile,
    writeJsonFile,
    ensureDir,
    isFileExists,
    getMediaInfo,
    resizeBuffer,
    convertToWebp
};
