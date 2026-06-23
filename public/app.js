// app.js — the browser side. Plain JavaScript, no framework.
// Job: let the user pick images, show them, POST them to /api/convert, and
// download the PDF that comes back.

// Grab the elements we need from the page.
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

// We keep the chosen files in our OWN array (not just the <input>) so we can:
//  - mix the file picker and drag-and-drop,
//  - ADD more files across several picks ("upload another"),
//  - remove a single file, or clear everything.
let selectedFiles = [];

// Turn a byte count into something human ("1.4 MB").
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Two files are "the same" if name + size + lastModified all match. Used to
// avoid adding the exact same photo twice if the user picks it again.
function isSameFile(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// Add newly picked/dropped files to our list (skipping duplicates).
function addFiles(newFiles) {
  for (const file of newFiles) {
    if (!selectedFiles.some((existing) => isSameFile(existing, file))) {
      selectedFiles.push(file);
    }
  }
  // Reset the input so picking the SAME file again still fires "change".
  fileInput.value = '';
  setStatus('');
  renderFileList();
}

// Remove one file by its position in the list.
function removeFile(index) {
  selectedFiles.splice(index, 1);
  setStatus('');
  renderFileList();
}

// Clear the whole selection and start fresh.
function clearAll() {
  selectedFiles = [];
  fileInput.value = '';
  setStatus('');
  renderFileList();
}

// Redraw the list of chosen files and enable/disable the buttons.
function renderFileList() {
  fileList.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = humanSize(file.size);

    // ✕ button to remove just this file.
    const remove = document.createElement('button');
    remove.className = 'file-remove';
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => removeFile(index));

    li.append(name, size, remove);
    fileList.append(li);
  });

  const hasFiles = selectedFiles.length > 0;
  convertBtn.disabled = !hasFiles;
  clearBtn.disabled = !hasFiles;
}

// Set the status line with an optional style (error / success).
function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status ${kind}`;
}

// --- Picking files via the hidden <input> (adds to the list) ---
fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));

// --- The Clear all button ---
clearBtn.addEventListener('click', clearAll);

// --- Drag and drop onto the dropzone (also adds to the list) ---
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault(); // required so the browser allows a "drop"
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  addFiles(Array.from(e.dataTransfer.files));
});

// Trigger a browser download for a Blob.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Convert: upload the files (with progress) and download the PDF ---
// We use XMLHttpRequest, not fetch, because it reports UPLOAD progress. On a
// phone / slow connection a large upload takes a while, and without a visible
// percentage it looks frozen — which is what made earlier attempts feel broken.
convertBtn.addEventListener('click', () => {
  if (selectedFiles.length === 0) return;

  const formData = new FormData();
  for (const file of selectedFiles) formData.append('images', file);

  convertBtn.disabled = true;
  clearBtn.disabled = true;
  setStatus('Uploading… 0%');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/convert');
  xhr.responseType = 'blob';
  xhr.timeout = 10 * 60 * 1000; // 10 minutes — generous for slow mobile uploads

  // Live upload progress; once bytes are all sent, the server is building the PDF.
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      setStatus(pct < 100 ? `Uploading… ${pct}%` : 'Processing your PDF…');
    }
  });
  xhr.upload.addEventListener('load', () => setStatus('Processing your PDF…'));

  // Server responded.
  xhr.addEventListener('load', async () => {
    if (xhr.status === 200) {
      downloadBlob(xhr.response, 'images.pdf');
      const skipped = xhr.getResponseHeader('X-Skipped-Files');
      setStatus(
        skipped
          ? `PDF downloaded, but skipped unreadable file(s): ${skipped}`
          : 'Done! Your PDF downloaded. Clear to start a new one.',
        skipped ? 'error' : 'success',
      );
    } else {
      // Error status — try to read the server's JSON { error } message.
      let message = 'Conversion failed. Please try again.';
      try {
        message = JSON.parse(await xhr.response.text()).error || message;
      } catch {
        /* non-JSON error body (e.g. a proxy error) — keep the default message */
      }
      setStatus(message, 'error');
    }
    renderFileList();
  });

  // Connection dropped — common on mobile data with large uploads.
  xhr.addEventListener('error', () => {
    setStatus(
      'Upload failed — check your internet connection and try again. On mobile data, try fewer images at a time or use Wi-Fi.',
      'error',
    );
    renderFileList();
  });

  // Stalled too long.
  xhr.addEventListener('timeout', () => {
    setStatus(
      'Upload timed out — your connection looks slow. Try fewer images at once, or switch to Wi-Fi.',
      'error',
    );
    renderFileList();
  });

  xhr.send(formData);
});
