const fs = require('fs');
const path = require('path');

const INVALID_PATTERNS = [
    { regex: /<a[^>]*>\s*<a/gi, name: 'Nested <a> tags' },
    { regex: /<button[^>]*>\s*<button/gi, name: 'Nested <button> tags' },
    { regex: /<a[^>]*>[\s\S]*?<button/gi, name: '<button> inside <a>' },
    { regex: /<p[^>]*>[\s\S]*?<div/gi, name: '<div> inside <p>' },
    { regex: /<p[^>]*>[\s\S]*?<p/gi, name: 'Nested <p> tags' },
    { regex: /<p[^>]*>[\s\S]*?<ul/gi, name: '<ul> inside <p>' },
    { regex: /<p[^>]*>[\s\S]*?<ol/gi, name: '<ol> inside <p>' },
    { regex: /<p[^>]*>[\s\S]*?<table/gi, name: '<table> inside <p>' },
    { regex: /<p[^>]*>[\s\S]*?<h[1-6]/gi, name: '<heading> inside <p>' },
];

// Directories to scan
const SCAN_DIRS = [
    path.join(__dirname, '../app'),
    path.join(__dirname, '../components'),
];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Simple check - this regex approach is naive for nested structures but effective for catching direct nesting in JSX
    // For standard JSX, we might want to be careful about matching closing tags, but let's try to catch obvious ones.
    // Warning: This regex might produce false positives if tags are far apart or in comments. 
    // It's a heuristic tool.

    INVALID_PATTERNS.forEach(pattern => {
        // We check for opening tag of parent, followed by opening tag of invalid child
        // This is hard with regex on full file. 
        // Let's iterate line by line or use a more robust search for smaller blocks if possible.
        // For now, let's just grep "dangerous" patterns.

        // Better approach: Look for lines or small blocks.
        // Actually, Regex on the whole file might work for simple cases like <a><Button>...

        // Re-implementing a simpler check:
        // Check for <p> ... <div> on the same line or closely following lines?
        // No, let's use the patterns but treat them carefully.

        // Changing strategy: Simple grep-like output for manual review
    });

    // Let's just output lines that look suspicious
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        // Check for <a> containing <button> on same line
        if (/<a.*<button/i.test(line) || /<Link.*<button/i.test(line) || /<Link.*<Button/i.test(line)) {
            console.log(`[SUSPICIOUS] ${filePath}:${index + 1}: ${line.trim().substring(0, 100)}`);
            if (line.includes('<Button')) console.log('  -> <Link> wrapping <Button> (likely renders <button>) is invalid!');
        }

        // Check for <p> containing <div> on same line
        if (/<p.*<div/i.test(line)) {
            console.log(`[INVALID] ${filePath}:${index + 1}: <div> inside <p> is invalid HTML!`);
        }

        // Check for <a> containing <a> on same line
        if (/<a.*<a/i.test(line)) {
            console.log(`[INVALID] ${filePath}:${index + 1}: Nested <a> tags!`);
        }
    });
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            scanFile(fullPath);
        }
    });
}

console.log('Scanning for invalid HTML patterns...');
SCAN_DIRS.forEach(dir => traverseDir(dir));
console.log('Scan complete.');
