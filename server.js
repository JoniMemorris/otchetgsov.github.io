const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const REPORTS_DIR = path.join(__dirname, 'reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR);
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Pre-flight CORS request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API to save a single report file into the reports/ folder
    if (req.method === 'POST' && req.url === '/api/save-file') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const { filename, content } = payload;
                
                if (!filename || !content) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing filename or content' }));
                    return;
                }

                // Sanitize filename to prevent directory traversal
                const safeFilename = path.basename(filename);
                const filePath = path.join(REPORTS_DIR, safeFilename);

                fs.writeFileSync(filePath, content, 'utf8');

                console.log(`[API] Saved report file to folder: ${safeFilename}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: `reports/${safeFilename}` }));
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to write file' }));
            }
        });
        return;
    }

    // API to synchronize/write all reports into the reports/ folder at once
    if (req.method === 'POST' && req.url === '/api/sync-folder') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const { records } = payload;

                if (!records || !Array.isArray(records)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing records array' }));
                    return;
                }

                // Clean the folder first to avoid orphaned files on delete, but keep it simple
                // Let's write/overwrite each file
                records.forEach(r => {
                    const cleanDate = r.date ? r.date.replace(/-/g, '_') : 'date_unknown';
                    const filename = `report_${cleanDate}_${r.id}.txt`;
                    const filePath = path.join(REPORTS_DIR, filename);

                    // Helper to compile text on the server or use precompiled if they passed it,
                    // but since they already have compiled text, let's use the compiled text!
                    // If they send objects, let's compile it on the fly:
                    const formattedStart = r.startDate ? r.startDate.split('-').reverse().join('.') : "__.__.____";
                    const formattedEnd = r.endDate ? r.endDate.split('-').reverse().join('.') : "__.__.____";
                    const formattedReport = r.date ? r.date.split('-').reverse().join('.') : "__.__.____";

                    let report = `📝 ОТЧЁТ О ВЫПОЛНЕННОЙ РАБОТЕ\n\n`;
                    report += `С ${formattedStart} по ${formattedEnd}\n\n`;
                    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    report += `📅 Дата: ${formattedReport}\n\n`;
                    if (r.youtubeUrl) {
                        report += `🎥 ВИДЕО ДЕМОНСТРАЦИЯ:\n`;
                        report += `🔗 ${r.youtubeUrl}\n\n\n\n`;
                    }
                    report += `🛠️ ОПИСАНИЕ ВЫПОЛНЕННЫХ ЗАДАЧ:\n`;
                    report += `${r.description}\n`;

                    if (r.checklist && r.checklist.length > 0) {
                        report += `\n📋 СТАТУС ВЫПОЛНЕНИЯ ПОДЗАДАЧ:\n`;
                        r.checklist.forEach(item => {
                            const statusBox = item.completed ? "[x]" : "[ ]";
                            report += `${statusBox} ${item.text}\n`;
                        });
                    }

                    fs.writeFileSync(filePath, report, 'utf8');
                });

                console.log(`[API] Synchronized folder reports. Total files: ${records.length}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: records.length }));
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Synchronization failed' }));
            }
        });
        return;
    }

    // Default 404
    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`[Server] Local folder sync active on http://localhost:${PORT}`);
    console.log(`[Server] Output folder path: ${REPORTS_DIR}`);
});
