const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  const shortSha = execSync('git rev-parse --short HEAD').toString().trim();

  const sanitizedBranch = branch.replace(/[\/\\]/g, '-');
  const zipName = `webvowl-${sanitizedBranch}-${shortSha}.zip`;
  const outputPath = path.join(__dirname, '..', zipName);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(`Archive created successfully: ${zipName} (${archive.pointer()} total bytes)`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn('Warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  const deployDir = path.join(__dirname, '..', 'deploy');
  if (!fs.existsSync(deployDir)) {
    throw new Error(`Deploy directory not found at ${deployDir}`);
  }
  
  archive.directory(deployDir, 'webvowl');

  archive.finalize();
} catch (error) {
  console.error('Error creating zip archive:', error.message);
  process.exit(1);
}
